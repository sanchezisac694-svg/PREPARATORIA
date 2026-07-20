# Fase 2 — Bloque 12: MFA TOTP, AAL2 y autenticación reforzada

## Objetivo y amenaza mitigada

Este bloque incorpora un segundo factor TOTP administrado exclusivamente por Supabase Auth. Reduce el riesgo de acceso con un NIP comprometido y exige autenticación reforzada para cuentas y operaciones institucionales sensibles. La referencia funcional es la sección “Fase 2 — Bloque 12” del Plan Maestro.

La interfaz no constituye el control de seguridad: el servicio server-only, el gateway de identidad y PostgreSQL comprueban la sesión, `session_version`, la política MFA y AAL.

## TOTP, AAL1 y AAL2

- Un login con identificador y NIP produce AAL1.
- `enroll` crea un factor TOTP no verificado.
- `challenge` y `verify`, o `challengeAndVerify`, validan un código de seis dígitos.
- Supabase Auth eleva la sesión a AAL2 después de `verify`.
- En un login posterior, `nextLevel = aal2` indica que existe un factor verificado pendiente de desafío.
- Solo se aceptan claims `aal1` y `aal2`; un valor distinto falla cerrado.

Supabase Auth conserva los factores. `core` no guarda el secret TOTP, QR, URI `otpauth`, código TOTP, factor ID, challenge ID, JWT, token o cookie.

## Política por rol

| Rol             | Requisito   |
| --------------- | ----------- |
| SUPERADMIN      | REQUIRED    |
| ADMINISTRATIVO  | REQUIRED    |
| CONTROL_ESCOLAR | REQUIRED    |
| CAJA            | REQUIRED    |
| DOCENTE         | RECOMMENDED |
| TUTOR           | OPTIONAL    |
| ALUMNO          | OPTIONAL    |
| ASPIRANTE       | OPTIONAL    |

Una cuenta multirrol adopta el requisito más fuerte. Una cuenta opcional que activa MFA pasa a una política opt-in y debe completar el desafío en inicios posteriores.

## Modelo persistente

La migración `20260720173349_add_mfa_totp_aal2.sql` crea:

- `core.account_mfa_policies`: requisito cerrado por rol.
- `core.account_mfa_compliance`: estado institucional y conteo agregado de factores verificados.
- `core.account_mfa_security_events`: auditoría append-only, idempotente y sin material Auth.

Los estados de cumplimiento son `NOT_APPLICABLE`, `NOT_ENROLLED`, `ENROLLMENT_PENDING`, `COMPLIANT`, `GRACE_PERIOD`, `NON_COMPLIANT`, `RECOVERY_REQUIRED` y `ADMINISTRATIVE_REVIEW`.

Las tres tablas tienen RLS habilitada, cero políticas de aplicación y cero grants directos a `anon` o `authenticated`. Las FK usan `ON DELETE RESTRICT`. `core` permanece fuera de la Data API.

## Enrolamiento, QR y secret

Las rutas `/seguridad/mfa` y `/seguridad/mfa/configurar` existen en ambas aplicaciones. El inicio de enrolamiento exige sesión válida, cuenta ACTIVE, aplicación permitida y reautenticación reciente con NIP.

El QR y la clave manual se devuelven solamente como resultado efímero de la Server Action. Se muestran para configurar el autenticador, no se almacenan ni se registran y las respuestas de proxy usan `Cache-Control: private, no-store`, `Pragma: no-cache` y `Expires: 0`. No se usan query strings, `localStorage`, IndexedDB ni Cache Storage.

El nombre amistoso es opcional, tiene máximo 60 caracteres y rechaza HTML, controles y vocabulario sensible.

## Challenge, verify y login MFA

`/mfa/verificar` selecciona en servidor un factor TOTP verificado; no entrega su identificador a la UI. El código se mantiene como cadena para conservar ceros iniciales. Los errores son genéricos.

Después del primer factor:

1. se valida `session_version`;
2. se consulta el AAL real mediante Supabase Auth;
3. una cuenta con factor pendiente va a `/mfa/verificar`;
4. una cuenta obligatoria sin factor va a `/mfa/requerido`;
5. AAL2 permite continuar al destino interno.

Los proxies evitan ciclos entre login, verificación, enrolamiento, sesión expirada y dashboard. Todas las rutas MFA se sirven sin caché.

## Gateway, RLS y step-up

El gateway público agrega `session_valid`, `mfa_required` y `mfa_satisfied`. Si MFA obligatoria no se satisface, oculta IDs y roles; conserva únicamente la aplicación permitida necesaria para completar el bootstrap MFA.

Las funciones `current_authenticator_assurance_level`, `is_current_aal2`, `is_mfa_required_for_current_account`, `is_current_mfa_policy_satisfied` y `require_current_mfa_policy` leen claims verificados por PostgreSQL y fallan cerrado. Las políticas propias de `people`, `accounts`, `roles` y `account_roles` exigen versión vigente y política MFA satisfecha.

El contrato de step-up exige identidad activa, aplicación permitida, AAL2 y un redirect de allowlist. Cambio de NIP, gestión de factores, invalidación global, recuperación, estados de cuenta y roles deben utilizar este contrato al integrarse en sus flujos administrativos completos.

## Factor de respaldo y desenrolamiento

El respaldo es un segundo factor TOTP; no se crean recovery codes propios. Su alta requiere AAL2 y reautenticación reciente. El desenrolamiento valida propiedad en la lista de Supabase Auth, AAL2 y reautenticación; una cuenta REQUIRED no puede eliminar su último factor verificado. Una baja confirmada cambia cumplimiento, aumenta `session_version` y cierra la sesión.

## Recuperación institucional

Este bloque define `RECOVERY_REQUIRED`, `ADMINISTRATIVE_REVIEW`, eventos y contratos para recuperación futura. No implementa un cliente administrativo real ni pretende eliminar factores ajenos con la clave publicable. La recuperación privilegiada completa sigue pendiente y deberá aplicar segregación de funciones, AAL2 del actor y reconciliación.

## Auditoría, privacidad y abuso

La auditoría usa 21 eventos y 11 motivos cerrados. Solo acepta correlación, idempotencia, cuenta, actor, tipo, motivo y tiempo. Es append-only.

La guardia técnica en memoria contempla enrolamiento, challenge, verify, desenrolamiento y recuperación; admite cinco fallos por ventana de 15 minutos y deriva claves HMAC opacas. Es adecuada para el entorno actual de una instancia, no sustituye rate limiting distribuido.

No se registran secret, QR, URI, códigos, factor IDs, challenge IDs, JWT, cookies, NIP, alias ni correo.

## `session_version`, refresh y SSR

El alta verificada, desenrolamiento, cambio de cumplimiento, recuperación e incidente aumentan `session_version`. Tras verificar se intenta refrescar la sesión; si el resultado no se confirma, se cierra localmente. Desenrolamiento y recuperación fuerzan logout.

Un factor removido puede dejar temporalmente un JWT con AAL2 obsoleto hasta refresh. `session_version` complementa la evaluación de Auth y permite rechazar ese JWT en gateway/RLS. El Custom Access Token Hook conserva `aal`, `amr`, `session_id`, `sub`, `exp`, `role` y añade únicamente la versión institucional.

## APIs públicas

`@preparatoria/supabase/mfa-security` exporta catálogos, errores cerrados, `AuthMfaPort`, `MfaPersistencePort`, resolución de política, enrolamiento, verificación, desenrolamiento, step-up y guardia de abuso. El subpath importa `server-only`; no exporta `SupabaseClient`, `Session`, tokens ni capacidades generales del SDK.

`auth-session` adapta únicamente las operaciones MFA utilizadas: enroll TOTP, challenge, verify, challenge-and-verify, list factors, unenroll, AAL, refresh y logout.

## Pruebas

- Reset local desde base vacía con diez migraciones.
- pgTAP: 8 archivos, 222 aserciones; `mfa-security.test.sql` aporta plan de 56.
- TypeScript: catálogos, políticas, parser AAL, enrolamiento efímero, verify, AAL2, último factor, abuso y barrera server-only.
- Auth local: usuario sintético, AAL1, enrolamiento, TOTP generado solo en el test, AAL2, segundo factor, desenrolamiento, versión obsoleta, nuevo challenge y limpieza.
- Puertas generales: formato, lint, tipos, tests, build, límites, seguridad, diff y estado Git.

Los tests no imprimen material MFA ni credenciales. No usan red remota.

## Reversión

En la base local descartable:

1. retirar páginas y Server Actions MFA;
2. retirar `mfa-security.ts` y su export;
3. restaurar el gateway y las cuatro políticas anteriores;
4. eliminar las tres tablas y cuatro enums de este bloque;
5. conservar `session_version`, autenticación, recuperación de NIP, ciclo de vida y las nueve migraciones previas.

Las migraciones históricas no se modifican. La reversión de producción futura requerirá una migración nueva; nunca se reescribirá historia.

## Riesgos y pendientes

- Rate limiting distribuido, CAPTCHA y alertas siguen pendientes.
- La recuperación privilegiada de factores requiere un bloque posterior.
- La interrupción abrupta puede anteceder al `finally` de un test local.
- El render del QR depende del formato SVG documentado por el SDK fijado.
- La exigencia AAL2 debe incorporarse a cada futura operación sensible, no solo a su navegación.
- Debe validarse institucionalmente si DOCENTE pasa de RECOMMENDED a REQUIRED.

## Fuera de alcance

SMS, WhatsApp, correo OTP, WebAuthn, passkeys, recovery codes, dispositivos confiables, bypass codes, panel administrativo completo, producción y módulos escolares.

No se ejecutó `supabase link`, `db push` ni `db pull`; no hubo conexión remota.
