# Fase 2 — Bloque 6: aprovisionamiento institucional de identidades

## Objetivo y límites

Este bloque incorpora la infraestructura técnica para preparar, ejecutar, auditar, reintentar y compensar el aprovisionamiento institucional de una identidad. No incorpora UI, registro público, login, recuperación de contraseña, módulos escolares ni operaciones reales contra Supabase Auth remoto.

Supabase Auth Admin solo se utilizará en servidor. Una clave secreta nunca debe exponerse al navegador. En este bloque no se creó ningún cliente administrativo real, no se ejecutó ninguna invitación y no se creó ningún usuario remoto.

## Arquitectura saga

PostgreSQL y Supabase Auth no comparten una transacción distribuida. El flujo queda dividido en:

1. Preparación transaccional en PostgreSQL.
2. Operación externa futura mediante `AuthAdminProvisioningPort`.
3. Registro del resultado y finalización transaccional en PostgreSQL.
4. Compensación o reconciliación cuando no puede completarse el flujo.

Diagrama textual:

`PREPARED → AUTH_PENDING → AUTH_CREATED → LINK_PENDING → COMPLETED`

Ramas controladas:

- `PREPARED | AUTH_PENDING → RETRYABLE_FAILURE → AUTH_PENDING`
- etapas operativas → `TERMINAL_FAILURE`
- resultado externo incierto → `COMPENSATION_PENDING`
- compensación confirmada → `COMPENSATED`
- solicitud no completada → `CANCELLED`

Toda transición se valida mediante `core.is_valid_identity_provisioning_transition` y el trigger de guarda. Las funciones bloquean la solicitud con `SELECT ... FOR UPDATE`.

## Modelo persistente

La migración `20260716204942_add_identity_provisioning_saga.sql` crea:

| Objeto                                       | Responsabilidad                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `core.identity_provisioning_requests`        | Estado actual, idempotencia, vínculo previsto, intentos y error seguro. |
| `core.identity_provisioning_requested_roles` | Roles iniciales cerrados, sin duplicados y con historial preservado.    |
| `core.identity_provisioning_events`          | Auditoría append-only con metadatos limitados.                          |

Catálogos cerrados:

- `core.identity_provisioning_stage`
- `core.identity_provisioning_event_type`
- `core.identity_provisioning_delivery_mode`
- `core.identity_provisioning_error_code`

La base exige idempotencia única, una solicitud activa por cuenta, `auth_user_id` único, consistencia de persona/cuenta, roles existentes, timestamps coherentes y `ON DELETE RESTRICT`. El correo no se persiste.

## Funciones SQL

- `core.prepare_identity_provisioning`
- `core.mark_identity_auth_pending`
- `core.record_identity_auth_created`
- `core.finalize_identity_provisioning`
- `core.mark_identity_provisioning_failure`
- `core.mark_identity_compensation`
- `core.cancel_identity_provisioning`

Las funciones de escritura son `SECURITY DEFINER`, propiedad de `postgres`, con `search_path = ''`, nombres calificados y sin SQL dinámico. Las funciones de validación y triggers usan `SECURITY INVOKER`. Ninguna función escribe o elimina directamente en `auth.users`.

## Contrato y orquestador TypeScript

El subpath server-only `@preparatoria/supabase/provisioning` publica:

- `AuthAdminProvisioningPort`
- `IdentityProvisioningPersistencePort`
- `ProvisionIdentityCommand`
- `provisionInstitutionalIdentity`
- catálogos, tipos y errores cerrados

El puerto Auth permite crear/invitar, consultar por idempotencia y eliminar únicamente para compensación. Es inyectable, no expone `SupabaseClient`, no lee variables de entorno y no recibe claves. La implementación de este bloque usa adaptadores falsos sin red.

## Idempotencia, concurrencia y finalización

La misma clave con el mismo payload devuelve la solicitud existente; con payload incompatible falla con `IDEMPOTENCY_CONFLICT`. La unicidad parcial impide dos solicitudes activas para la misma cuenta. La finalización usa bloqueo de fila, no duplica roles activos, no reactiva asignaciones revocadas y devuelve `COMPLETED` en repeticiones.

`AUTH_PENDING` se reconcilia antes de crear otro usuario. El `auth_user_id` registrado se conserva como evidencia hasta que la compensación quede confirmada.

## Compensación y reconciliación

El orquestador solo solicita eliminación cuando el adaptador confirma que el usuario fue creado por la operación actual. Nunca elimina un usuario preexistente. Un resultado externo incierto se marca para reconciliación y detiene la automatización destructiva. Una compensación fallida queda tipada como `COMPENSATION_FAILED`.

La decisión definitiva sobre el operador institucional que autorizará reconciliaciones y compensaciones continúa pendiente.

## Privacidad y seguridad

- El correo solo cruza el contrato Auth y se redacta en diagnósticos.
- Eventos rechazan correo, contraseñas, tokens, secretos, cookies, OTP y stack traces.
- `safe_metadata` admite únicamente claves técnicas cerradas y un máximo de 2048 bytes.
- Las tres tablas tienen RLS habilitada, cero políticas y cero grants para `PUBLIC`, `anon` y `authenticated`.
- Las funciones no son ejecutables por roles de aplicación.
- `core` continúa fuera de la Data API.
- No existen triggers sobre `auth.users`, escrituras SQL productivas en Auth, secretos, project-ref ni conexión remota.

## Pruebas

Se cubren:

- migración desde base vacía;
- catálogos SQL/TypeScript sincronizados;
- preparación, idempotencia y conflicto;
- persona, cuenta, relación y roles inválidos;
- transiciones válidas e inválidas;
- vínculo real local con un usuario Auth sintético y reversible;
- finalización y roles idempotentes;
- fallos reintentables y terminales;
- cancelación;
- auditoría append-only;
- RLS, políticas, grants y ejecución de funciones;
- reversión local;
- éxito, reintentos, resultado incierto, compensación y redacción con adaptadores falsos;
- barrera `server-only` desde Client Components.

`supabase test db` ejecuta los tres archivos SQL mediante pgTAP con planes explícitos, 22 aserciones reales, `finish()` y rollback. La suite finaliza con código 0, sin pruebas omitidas y sin mensajes `no plan found`.

## Reversión

En una base descartable se eliminan, en orden, eventos, roles solicitados y solicitudes; después se eliminan funciones, triggers y enums de este bloque. La prueba usa savepoint y rollback, por lo que restaura íntegramente el estado local.

## Riesgos y pendientes

- Falta implementar el adaptador real Auth Admin y su rol servidor controlado.
- Falta definir el procedimiento humano de reconciliación y compensación.
- Los timeouts del proveedor requieren observabilidad operativa futura.
- Falta decidir invitación frente a creación administrativa para cada flujo institucional.
- No se implementaron reenvío de invitación, SMTP, MFA, sesiones, desactivación, reactivación, UI ni cargas masivas.
