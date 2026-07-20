# Fase 2 — Bloque 10: seguridad, cambio y recuperación de NIP

## Objetivo y alcance

El bloque separa tres operaciones: cambio autenticado, recuperación institucional y
restablecimiento mediante una autorización temporal. Supabase Auth sigue siendo el único
responsable del hash del NIP. No se implementaron correo, SMS, magic links, OTP, MFA,
recuperación pública automática ni un panel administrativo.

## Arquitectura

El cambio propio se ejecuta mediante Server Action, cliente SSR y cookies seguras. La recuperación
coordina persistencia institucional, una operación Auth externa y finalización. PostgreSQL y Auth
no comparten transacción: un resultado externo incierto pasa a `RECONCILIATION_REQUIRED`.

`packages/supabase/src/nip-security.ts` es server-only y expone contratos limitados, catálogos,
generación y digest de tokens, cambio, solicitud, aprobación, emisión, restablecimiento,
revocación, cancelación y reconciliación. No exporta `SupabaseClient`, sesiones o credenciales.

## Cambio autenticado y reautenticación

`/seguridad/cambiar-nip` existe en ambas aplicaciones. Exige sesión validada con `getClaims()`,
cuenta `ACTIVE`, aplicación permitida, NIP actual, nuevo y confirmación. El adaptador SSR obtiene
el alias exclusivamente desde claims validados, reautentica mediante `signInWithPassword` y solo
después ejecuta `updateUser({ password })`. Así la comprobación del NIP actual no depende de que
la opción configurable `current_password` esté habilitada. Ambos NIP solo viven en memoria.

Se rechaza formato inválido, confirmación distinta y reutilización evidente del NIP actual. El
mensaje público es “No fue posible actualizar el NIP.”. La sesión actual se conserva y se solicita
`signOut({ scope: "others" })`.

## Recuperación institucional

No existe búsqueda pública por identificador ni entrega automática. `SUPERADMIN` y
`ADMINISTRATIVO` pueden solicitar, aprobar, emitir, cancelar, revocar y reconciliar.
`CONTROL_ESCOLAR` solo puede solicitar para `ALUMNO`, `TUTOR`, `DOCENTE` o `ASPIRANTE`.
`CAJA`, `DOCENTE`, `TUTOR`, `ALUMNO` y `ASPIRANTE` no administran credenciales de terceros.

La verificación humana de identidad permanece pendiente de un procedimiento institucional
oficial. `/recuperar-acceso` es informativa y no recibe identificadores ni credenciales.

## Modelo persistente y máquina de estados

La octava migración crea:

- `core.nip_recovery_requests`;
- `core.nip_reset_authorizations`;
- `core.nip_security_events`.

Estados: `REQUESTED`, `APPROVED`, `READY_FOR_RESET`, `CONSUMED`, `EXPIRED`, `CANCELLED`,
`RETRYABLE_FAILURE`, `TERMINAL_FAILURE` y `RECONCILIATION_REQUIRED`.

Las transiciones están cerradas en SQL y TypeScript. `CONSUMED`, `EXPIRED`, `CANCELLED` y
`TERMINAL_FAILURE` son terminales. Las funciones usan `SELECT ... FOR UPDATE`, claves de
idempotencia y rechazo explícito de transiciones no declaradas. Todas las relaciones usan
`ON DELETE RESTRICT`; no existe `ON DELETE CASCADE`.

## Autorización temporal, token y digest

El token tiene 256 bits aleatorios y codificación base64url. No contiene cuenta, identificador,
correo o alias. Se calcula HMAC-SHA-256 con `NIP_RESET_TOKEN_SECRET`; solo el digest hexadecimal
se persiste. La comparación TypeScript utiliza `timingSafeEqual`.

La autorización tiene caducidad corta, máximo cinco intentos, consumo único y revocación
explícita. El token solo puede salir hacia un `ResetAuthorizationDeliveryPort` tipado. En este
bloque existe únicamente un adaptador local de prueba; no hay canal productivo, correo o SMS.

## Auditoría, privacidad e idempotencia

`core.nip_security_events` es append-only. Registra eventos cerrados, actor, correlación,
idempotencia, razón segura y error cerrado. No admite payload arbitrario, NIP, contraseña, token,
digest, alias, correo, IP completa, user-agent o stack trace.

El gateway `public.record_own_nip_security_event` acepta únicamente eventos del cambio propio,
resuelve cuenta y persona desde `auth.uid()` y no acepta IDs desde el cliente. Las operaciones
administrativas permanecen sin grants para aplicaciones.

## Funciones controladas

- `core.request_nip_recovery`
- `core.approve_nip_recovery`
- `core.issue_nip_reset_authorization`
- `core.mark_nip_reset_attempt`
- `core.complete_nip_reset`
- `core.mark_nip_reset_failure`
- `core.expire_nip_reset_authorization`
- `core.revoke_nip_reset_authorization`
- `core.cancel_nip_recovery`
- `core.mark_nip_reconciliation_required`

Son funciones con `search_path = ''`, referencias calificadas, sin SQL dinámico, HTTP,
escrituras en `auth.users` o tokens en claro. Su ejecución está revocada para `PUBLIC`, `anon` y
`authenticated`.

## Sesiones y limitaciones reales de Supabase

Supabase permite scopes `local`, `others` y `global`. El cambio propio conserva la sesión actual y
revoca las demás sesiones mediante `others`. Esto elimina refresh tokens de esas sesiones, pero
los access tokens JWT ya emitidos continúan válidos hasta su `exp`; por tanto no se afirma
invalidación global inmediata.

El restablecimiento administrativo local actualiza Auth mediante un puerto inyectado. Como no
existe todavía una credencial administrativa productiva ni un JWT de la sesión perdida, la
revocación total no se simula: el resultado indica que no fue confirmada y queda pendiente un
mecanismo institucional adicional, posiblemente `session_version`.

## Protección contra abuso

Las categorías son `CHANGE_NIP`, `REQUEST_RECOVERY`, `RESET_NIP` y `VALIDATE_RESET_TOKEN`. Las
llaves son HMAC opacas y no contienen NIP, token o identificador legible. El adaptador en memoria
usa cinco fallos en quince minutos. No es rate limiting productivo ni funciona entre instancias;
debe sustituirse antes de un despliegue distribuido.

## RLS y privilegios

Las tres tablas tienen RLS habilitada, cero políticas y cero grants para `PUBLIC`, `anon` o
`authenticated`. `core` continúa fuera de Data API. Solo el gateway propio tiene `EXECUTE` para
`authenticated`; no expone tablas ni acepta `account_id`.

## Pruebas

pgTAP valida tablas, enums, RLS, privilegios, actores, idempotencia, integridad cuenta/persona,
aprobación, autorización, digest, intentos, consumo único, estados terminales, auditoría
append-only, funciones, ausencia de escrituras/triggers Auth y reversión local.

TypeScript valida catálogos sincronizados, máquina de estados, token aleatorio, digest,
comparación constante, cambio autenticado, reautenticación, estados, revocación parcial,
restablecimiento, errores y reconciliación.

La prueba Auth local usa únicamente personas y usuarios sintéticos. Comprueba login, cambio real,
rechazo del NIP anterior, NIP con ceros iniciales, recuperación, aprobación, autorización,
restablecimiento, consumo único, logout, sesiones y limpieza. No imprime NIP, token, digest,
alias, correo, access token, refresh token o cookies.

## Reversión

En la base local descartable se validó eliminar las tres tablas y sus funciones dependientes
dentro de un savepoint y restaurarlas mediante rollback. La reversión definitiva eliminaría
primero páginas y servicios del bloque, luego gateway, funciones, tablas y enums. Conserva las
siete migraciones previas, identidad, identificador institucional, SSR, aprovisionamiento y ciclo
de vida.

## Riesgos, pendientes y elementos no implementados

- Procedimiento oficial de verificación institucional.
- Canal productivo para entregar autorizaciones.
- Adaptador administrativo real y gestión de su secreto.
- Invalidación inmediata de access tokens y posible `session_version`.
- Rate limiting distribuido, CAPTCHA y MFA.
- Recuperación por correo, SMS, WhatsApp, magic link u OTP.
- Panel administrativo, cambio de identificador y migración masiva.
- La política provisional permite seis caracteres; debe endurecerse institucionalmente.
- No hubo conexión remota, `supabase link`, `db push` o `db pull`.

El NIP nunca se almacena en `core`; Supabase Auth administra su hash. El token nunca se almacena
en claro. No se enviaron correos ni SMS y no existe recuperación pública automática.
