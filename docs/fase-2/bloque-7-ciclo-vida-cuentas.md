# Fase 2 — Bloque 7: ciclo de vida y activación controlada de cuentas

## Objetivo y alcance

Este bloque hace que PostgreSQL sea la autoridad final del estado institucional de `core.accounts`. El estado de Supabase Auth, la confirmación de correo o una sesión válida no activan ni autorizan automáticamente una cuenta institucional.

No se implementaron UI, login, registro, recuperación, MFA, SMTP, cron, Edge Functions, webhooks ni operaciones remotas.

## Estados y máquina

Se conservan exactamente:

- `PENDING_INVITATION`
- `PENDING_ACTIVATION`
- `ACTIVE`
- `SUSPENDED`
- `BLOCKED`
- `DISABLED`

Transiciones:

```text
PENDING_INVITATION → PENDING_ACTIVATION | DISABLED
PENDING_ACTIVATION → ACTIVE | BLOCKED | DISABLED
ACTIVE             → SUSPENDED | BLOCKED | DISABLED
SUSPENDED          → ACTIVE | BLOCKED | DISABLED
BLOCKED            → ACTIVE | SUSPENDED | DISABLED
DISABLED           → PENDING_ACTIVATION | ACTIVE
```

Preparar y expirar una invitación son eventos auditables que mantienen `PENDING_INVITATION`. Toda transición directa de estado fuera de las funciones controladas es rechazada.

## Auditoría y metadatos

`core.account_lifecycle_events` conserva de forma append-only:

- cuenta y persona;
- estado anterior y final;
- evento y razón cerrados;
- actor;
- idempotencia y correlación;
- expiración aplicable;
- fechas de creación y efectividad.

`core.accounts` incorpora únicamente evidencia operacional: activación, suspensión, bloqueo, preparación/expiración de invitación y cancelación. `account_status` es la situación actual; los eventos son el historial completo.

No se almacenan correo, contraseñas, tokens, OTP, enlaces, cookies, CURP, nombres, documentos, datos escolares, JSON arbitrario ni stack traces.

## Operaciones SQL

- `prepare_account_invitation`
- `mark_account_invitation_issued`
- `activate_account`
- `suspend_account`
- `block_account`
- `unblock_account`
- `disable_account`
- `reactivate_account`
- `cancel_account_activation`
- `expire_account_invitation`

La función interna bloquea la cuenta mediante `SELECT ... FOR UPDATE`, valida estado, actor, vínculo Auth, expiración e idempotencia, actualiza la cuenta y agrega el evento dentro de la misma transacción.

## Activación, restricciones y reactivación

La activación exige cuenta `PENDING_ACTIVATION`, `auth_user_id` vinculado, invitación vigente cuando exista, actor permitido y clave idempotente.

`SUSPENDED` conserva identidad y roles, pero el contexto del Bloque 5 devuelve cero aplicaciones. `BLOCKED` conserva identidad e historial y tampoco concede autorización operativa. `DISABLED` no elimina ni desvincula `auth.users`.

La reactivación es explícita:

- `SUSPENDED → ACTIVE`
- `BLOCKED → ACTIVE | SUSPENDED`
- `DISABLED → PENDING_ACTIVATION`
- `DISABLED → ACTIVE` solo mediante operación administrativa diferenciada

No se reactivan roles revocados, invitaciones antiguas, sesiones ni permisos adicionales.

## Actor y autorización inicial

- `SUPERADMIN`: todas las operaciones.
- `ADMINISTRATIVO`: preparación/emisión, activación, suspensión y reactivación.
- `CONTROL_ESCOLAR`: operaciones sobre cuentas con rol activo `ALUMNO`, `TUTOR`, `DOCENTE` o `ASPIRANTE`.
- `CAJA`, `DOCENTE`, `TUTOR`, `ALUMNO` y `ASPIRANTE`: sin autorización operativa.

El actor debe existir, estar `ACTIVE` y conservar un rol vigente. Los scopes por plantel, área o grupo permanecen pendientes.

## Idempotencia y concurrencia

Cada evento tiene una clave UUID única. El mismo comando devuelve el estado actual sin duplicar eventos; una clave reutilizada con payload incompatible produce `IDEMPOTENCY_CONFLICT`. El bloqueo de fila y la comprobación del estado actual hacen que PostgreSQL resuelva intentos simultáneos de forma determinista.

## Seguridad

- RLS habilitada y cero políticas sobre la auditoría.
- Cero grants para `PUBLIC`, `anon` y `authenticated`.
- Funciones operativas reservadas a la futura capa servidor.
- `search_path = ''`, propietario controlado y referencias calificadas.
- Sin SQL dinámico, HTTP, secretos, escritura en `auth.users` ni triggers Auth.
- `core` continúa fuera de Data API.
- El servicio `@preparatoria/supabase/account-lifecycle` usa `server-only`, un puerto inyectable y no expone `SupabaseClient`.

`BLOCKED` no invalida automáticamente access tokens emitidos. La invalidación global de sesiones y refresh tokens sigue pendiente.

## Pruebas y reversión

Las pruebas pgTAP cubren estructura, RLS, políticas, grants, invitación, activación, vínculo Auth, suspensión, bloqueo, desactivación, reactivación, expiración, cancelación, actores, idempotencia, auditoría append-only y transición directa rechazada. Las pruebas TypeScript cubren contrato, fallo del puerto, errores cerrados, redacción y barrera server-only.

Los datos son sintéticos y cada archivo finaliza con rollback. La reversión local elimina wrappers, función interna, triggers, tabla, constraints, columnas y enums en orden inverso.

## Riesgos y pendientes

- Definir scopes institucionales de `CONTROL_ESCOLAR`.
- Definir el mecanismo humano de reactivación directa desde `DISABLED`.
- Implementar regeneración real de invitaciones y scheduler de expiración.
- Implementar invalidación global de sesiones.
- Integrar el puerto SQL con una conexión servidor controlada.

No se enviaron invitaciones ni correos reales, no se crearon usuarios reales y no se conectó ningún proyecto remoto.
