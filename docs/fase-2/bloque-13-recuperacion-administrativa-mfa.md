# Fase 2 — Bloque 13: recuperación administrativa de MFA

## Objetivo y amenaza

Este bloque modela el caso en que una persona pierde todos sus factores TOTP. Protege contra
autoaprobación, toma de cuenta por un solo operador, replay, enumeración de factores, exposición de
credenciales, resultados parciales entre PostgreSQL y Auth y reutilización de sesiones previas.

No existe recuperación pública automática. La verificación humana ocurre fuera del sistema y aquí
solo se registra su resultado mediante un método cerrado.

## Arquitectura privilegiada

| Alternativa                                         | Decisión                                                 |
| --------------------------------------------------- | -------------------------------------------------------- |
| Cliente administrativo dentro de cada Server Action | Rechazada por acoplamiento y dispersión de credenciales. |
| Dominio, puerto y adaptador local server-only       | Elegida para este bloque.                                |
| Edge Function                                       | Candidata para producción.                               |
| Backend/BFF interno                                 | Candidato para producción.                               |
| Escritura directa en `auth.mfa_factors`             | Rechazada: Supabase Auth conserva la autoridad.          |

`@preparatoria/supabase/mfa-administration` contiene el dominio y el puerto
`PrivilegedAuthMfaAdministrationPort`. El subpath
`@preparatoria/supabase/mfa-administration-local` contiene el único adaptador privilegiado y lleva
la barrera `server-only`. No se exporta desde un barrel universal ni se importa desde proxy o Client
Components.

La capacidad productiva queda pendiente: deberá reemplazarse el adaptador local por una Edge
Function, BFF o backend protegido sin cambiar el dominio.

## Credencial server-only

El arnés local recibe `SUPABASE_AUTH_ADMIN_SECRET_KEY` por proceso. No usa prefijo `NEXT_PUBLIC_`,
no tiene valor versionado, no se imprime y solo se lee al construir el adaptador. La variable es
opcional para el resto del monorepo y su ausencia produce `AUTH_ADMIN_CREDENTIAL_MISSING`.

El adaptador acepta exclusivamente `http://localhost:54321`,
`http://127.0.0.1:54321` o el host local aprobado para Docker, sin credenciales en URL, rutas,
query ni fragmentos. Un proyecto remoto falla cerrado.

## Persistencia

La migración `20260720183317_add_administrative_mfa_recovery.sql` crea:

- `core.mfa_recovery_requests`: solicitud, actores, estado, idempotencia y tiempos;
- `core.mfa_recovery_factor_operations`: solo digest HMAC-SHA-256 y resultado por factor;
- `core.mfa_administrative_security_events`: auditoría append-only.

Los catálogos cerrados cubren estado, razón, método de verificación, alcance de eliminación,
snapshot, operación, evento y error. No se guarda factor ID crudo, secreto TOTP, QR, URI
`otpauth`, challenge, código, NIP, JWT, sesión, cookie, correo, alias o identificador institucional.

Las tres tablas tienen RLS, cero políticas de aplicación y cero grants para `PUBLIC`, `anon` y
`authenticated`. Las funciones son internas a `core`; no existe RPC administrativa pública y
`core` permanece fuera de Data API. Las FK usan `ON DELETE RESTRICT`.

## Actores y separación de funciones

- `SUPERADMIN` y `ADMINISTRATIVO`: solicitud, verificación, aprobación, ejecución, cancelación y
  reconciliación.
- `CONTROL_ESCOLAR`: solicitud y registro de verificación; no ejecuta Auth ni reconcilia.
- `CAJA`, `DOCENTE`, `TUTOR`, `ALUMNO` y `ASPIRANTE`: sin operación administrativa.

Todas las operaciones exigen sesión institucional válida y AAL2. La cuenta objetivo nunca solicita,
aprueba o ejecuta su propia recuperación. Solicitante y aprobador deben ser distintos. Para cuentas
administrativas se mantiene doble control; la ejecución separada es la política preferida cuando
existen operadores suficientes.

La institución aún debe aprobar formalmente los métodos de verificación humana. No se almacenan
documentos, CURP, fotografías, biometría, domicilio ni respuestas de validación.

## Máquina de estados

La máquina acepta únicamente las transiciones documentadas en el Plan del Bloque 13. `COMPLETED`,
`CANCELLED`, `EXPIRED` y `TERMINAL_FAILURE` son terminales. Un índice único parcial permite una
sola recuperación activa por cuenta. Las funciones bloquean la solicitud con `SELECT FOR UPDATE`.

Solicitud, aprobación y ejecución poseen claves separadas. La misma clave con el mismo payload es
idempotente; un payload distinto falla. La ejecución incrementa `session_version` una sola vez antes
de llamar Auth. Un reintento conserva la invalidación.

## Ejecución y factores

1. El operador AAL2 obtiene el bloqueo institucional.
2. PostgreSQL marca `EXECUTION_IN_PROGRESS`.
3. Se incrementa `session_version`.
4. El cumplimiento cambia a `RECOVERY_REQUIRED`.
5. El puerto lista factores desde Auth; los IDs viven solo en memoria.
6. Se persiste un digest HMAC no reversible por operación.
7. El adaptador invoca las firmas verificadas de `@supabase/auth-js` 2.110.6:
   `listFactors({ userId })` y `deleteFactor({ userId, id })`.
8. Se vuelve a inspeccionar Auth.
9. Si no quedan factores verificados se marca `REENROLLMENT_REQUIRED`.

Eliminar un factor verificado provoca el cierre de las sesiones activas según Supabase Auth. La API
JavaScript instalada no ofrece revocación por `userId` sin un JWT del usuario, por lo que el puerto
documenta `verified_factor_deletion` como mecanismo observado. No se afirma invalidación
criptográfica inmediata del access token: `session_version` rechaza institucionalmente tokens
anteriores aunque todavía no hayan expirado.

Auth y PostgreSQL no comparten transacción. Un error incierto nunca se considera éxito: se marca
`RECONCILIATION_REQUIRED`, se vuelve a listar y solo se continúa con el estado observado.

## Reenrolamiento y finalización

Después de eliminar factores, el usuario debe iniciar sesión otra vez, permanece AAL1 y solo puede
acceder a login, logout, información y enrolamiento. La recuperación no queda `COMPLETED` al borrar
factores. Requiere un TOTP nuevo, challenge, verify, AAL2 y al menos un factor verificado; entonces el
cumplimiento vuelve a `COMPLIANT`.

El Sistema Administrativo incluye las rutas técnicas:

- `/seguridad/mfa-recuperaciones`;
- `/seguridad/mfa-recuperaciones/nueva`;
- `/seguridad/mfa-recuperaciones/[id]`.

Las acciones exigen AAL2 y roles autorizados. Permanecen fail-closed mientras no exista un
backend/BFF productivo que implemente el repositorio institucional; no usan la credencial local en
la aplicación. Portal Escolar solo añade la ruta informativa
`/seguridad/mfa/recuperacion`.

## Abuso, privacidad y auditoría

Las categorías administrativas generan claves HMAC opacas con actor, objetivo y operación. La
guardia continúa siendo local en memoria, con límite finito; no se presenta como rate limiting
distribuido. Los mensajes públicos son genéricos.

La auditoría conserva actor, objetivo institucional interno, transición, razón, correlación,
idempotencia y error cerrado. Los eventos rechazan UPDATE y DELETE.

## Pruebas

- pgTAP: 65 aserciones específicas para esquema, catálogos, RLS, grants, solicitud, verificación,
  aprobación, AAL2, separación de funciones, ejecución, `session_version`, operaciones, cumplimiento,
  reenrolamiento, cierre, append-only y privacidad.
- TypeScript: roles, AAL1/AAL2, servicio, puerto falso, resultado incierto, adaptador local, URL
  remota, credencial ausente, digests y claves de abuso.
- Auth local: listado y eliminación real mediante el adaptador privilegiado, factores sintéticos,
  AAL1/AAL2, segundo TOTP, obsolescencia de sesión y limpieza.
- Puertas estáticas: `check-security` exige `server-only` y prohíbe importar el adaptador desde proxy
  o Client Components; `check-boundaries` valida exports y ciclos.

## Reversión

En una base local descartable se pueden retirar las rutas, servicio, adaptador, tres tablas, enums y
funciones del Bloque 13. Deben conservarse las diez migraciones previas, MFA TOTP del Bloque 12,
`session_version`, recuperación de NIP e identidad. Las migraciones históricas no se modifican.

## Riesgos, pendientes y fuera de alcance

- Falta Edge Function/BFF/backend productivo y gestión de secretos mediante Vault/KMS.
- La UI administrativa permanece fail-closed hasta disponer de ese canal interno.
- Auth y PostgreSQL requieren reconciliación explícita ante fallos parciales.
- El rate limiting distribuido, CAPTCHA, notificaciones y SIEM quedan pendientes.
- No hay recovery codes propios, SMS, correo OTP, WhatsApp, WebAuthn, passkeys, biometría, documentos
  de identidad, panel administrativo completo, producción ni módulos escolares.
- No se conectó ningún proyecto remoto y no se ejecutó `link`, `db push` ni `db pull`.
