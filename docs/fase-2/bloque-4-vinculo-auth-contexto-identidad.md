# Fase 2 — Bloque 4: vínculo con Supabase Auth y contexto de identidad

## Objetivo

Vincular una cuenta institucional con Supabase Auth y ofrecer contexto técnico mínimo, sin implementar login, registro, sesiones desde aplicaciones ni políticas RLS funcionales.

Referencia funcional: **Fase 2 — Bloque 4: vínculo con Supabase Auth y contexto de identidad**, ADR-003, ADR-005, ADR-007 y los contratos de `packages/authz`.

## Migración y cardinalidad

La migración `link_auth_and_identity_context` agrega:

```text
core.accounts.auth_user_id → auth.users.id
```

La FK usa `ON DELETE RESTRICT`. La columna permanece nullable y conserva el índice único parcial del Bloque 3.

- Una cuenta puede no estar vinculada todavía.
- Una cuenta solo puede vincularse con un usuario Auth.
- Un usuario Auth solo puede vincularse con una cuenta.
- Un usuario vinculado no puede eliminarse mientras exista la cuenta.

La migración no crea usuarios, no modifica columnas internas de Auth y no instala triggers sobre `auth.users`.

## Aprovisionamiento futuro

Un servicio privilegiado y auditado deberá crear o seleccionar el usuario Auth y asignar su UUID a `core.accounts.auth_user_id`. Deberá comprobar identidad institucional, estado, duplicados, responsable y motivo. Ese servicio no fue implementado.

## Funciones de contexto

| Función                         | Retorno               | Comportamiento                                                                                  |
| ------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| `core.current_auth_user_id()`   | `uuid`                | Devuelve `auth.uid()` o `null` sin sesión.                                                      |
| `core.current_account_id()`     | `uuid`                | Devuelve la cuenta vinculada salvo que esté `DISABLED`; sin vínculo devuelve `null`.            |
| `core.current_person_id()`      | `uuid`                | Devuelve la persona de la cuenta válida; sin cuenta devuelve `null`.                            |
| `core.current_account_status()` | `core.account_status` | Devuelve el estado vinculado incluso si es `DISABLED`; sin vínculo devuelve `null`.             |
| `core.current_role_codes()`     | `text[]`              | Devuelve roles activos, no revocados, únicos y ordenados; sin cuenta devuelve un arreglo vacío. |

`SUSPENDED` y `BLOCKED` continúan produciendo contexto técnico. Su tratamiento funcional permanece pendiente.

## Seguridad de funciones

Todas son `STABLE`, no aceptan parámetros, no usan SQL dinámico, fijan `search_path = ''` y califican completamente esquemas y relaciones.

`current_auth_user_id()` es `SECURITY INVOKER` porque solo llama a `auth.uid()`.

Las otras cuatro son `SECURITY DEFINER` porque leen columnas concretas de tablas `core`, que permanecen con RLS deny-by-default y sin acceso directo. Solo devuelven UUID, estado técnico y códigos de rol.

El propietario es `postgres`. La ejecución se revoca para `PUBLIC` y `anon` y se concede únicamente a `authenticated`.

## Privilegios y Data API

`authenticated` recibe solamente:

- `USAGE` sobre `core`.
- `EXECUTE` sobre las cinco funciones.

No recibe privilegios sobre tablas o secuencias. `anon` no recibe acceso.

`core` permanece fuera de `api.schemas`; los objetos no se exponen mediante REST o GraphQL.

## Simulación local de JWT

Las pruebas usan UUID sintéticos y:

```sql
set local request.jwt.claim.sub = '<uuid-ficticio>';
```

`auth.uid()` interpreta el claim dentro de la transacción. `ROLLBACK` elimina usuarios sintéticos, cuentas, asignaciones y contexto JWT. No se utilizan tokens ni servicios remotos.

## Contrato TypeScript

`packages/authz` incorpora:

- `AccountId`, identificador nominal.
- `AuthIdentityContext`, con `authUserId`, `accountId`, `personId`, `accountStatus` y `roleCodes`.

No crea clientes Supabase ni contiene datos personales o entidades escolares.

## Pruebas

`supabase/tests/auth-context.test.sql` comprueba:

- FK hacia `auth.users` y `ON DELETE RESTRICT`.
- UUID inexistente y duplicado.
- Cuenta sin vínculo.
- Contexto sin sesión y sin cuenta.
- Cuenta, persona y estado correctos.
- Roles activos, revocados, inactivos y duplicados.
- Exclusión de cuenta `DISABLED`.
- Propietario, estabilidad, `search_path` y modos de seguridad.
- Grants exclusivos.
- RLS sin políticas y `core` fuera de Data API.
- Limpieza transaccional.

## Reversión

La reversión local elimina, en orden:

1. Grants de ejecución y uso.
2. Las cinco funciones.
3. `accounts_auth_user_id_fkey`.

La columna `auth_user_id`, su índice único parcial y el resto del Bloque 3 se conservan. La prueba se realiza en una transacción descartable y nunca en remoto.

## Riesgos y limitaciones

- Cuatro funciones se ejecutan con privilegios de `postgres`; cualquier ampliación requiere revisión independiente.
- Los claims simulados no prueban emisión, validación o renovación real de tokens.
- El contexto técnico no equivale a autorización funcional.
- `SUSPENDED` y `BLOCKED` requieren reglas institucionales.
- La eliminación de usuarios queda bloqueada mientras exista una cuenta vinculada.
- Los cambios de roles pueden requerir refresco de sesión si en el futuro se duplican claims en JWT; esta implementación consulta la base.

## Decisiones pendientes

- Proceso formal para crear usuarios Auth.
- Responsable autorizado para vincular `auth_user_id`.
- Invitaciones y activación.
- Tratamiento de `SUSPENDED`.
- Tratamiento de `BLOCKED`.
- Reactivación.
- Cierre global y revocación de sesiones.
- MFA.
- Políticas RLS funcionales.
- Auditoría de asignación y retiro de roles.

Ninguna decisión pendiente fue resuelta mediante suposiciones.

## Funciones no implementadas

- Login, logout, registro o recuperación.
- Invitaciones o administración real de usuarios.
- Middleware, proxy o Server Actions.
- Políticas RLS de lectura o escritura.
- Operaciones desde aplicaciones.
- Módulos escolares, académicos o financieros.
