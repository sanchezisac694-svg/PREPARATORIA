# Fase 2 — Bloque 5: RLS base para contexto propio

## Objetivo

Permitir que una identidad autenticada obtenga su contexto técnico mínimo y las aplicaciones derivadas de sus roles, sin conceder lectura directa sobre tablas `core`, operaciones administrativas o datos personales.

Referencia funcional: **Fase 2 — Bloque 5: RLS base para contexto propio de identidad**, ADR-005 y contratos de `packages/authz`.

## Estrategia de exposición

Se creó:

```text
core.get_current_identity_context()
```

La función devuelve exactamente:

- `auth_user_id`
- `account_id`
- `person_id`
- `account_status`
- `role_codes`
- `allowed_applications`

No devuelve correo, nombre, CURP, teléfono, domicilio, documentos, timestamps, responsables, motivos ni información de otras personas.

`core` continúa fuera de los esquemas expuestos por Data API. La función queda disponible para ejecución PostgreSQL controlada por `authenticated` y como base para una capa confiable posterior; no se habilitó una tabla, vista o RPC pública.

## Seguridad de la función

La función es:

- `STABLE`
- `SECURITY DEFINER`
- Propiedad de `postgres`
- Sin parámetros
- Sin SQL dinámico
- Con `search_path = ''`
- Con referencias completamente calificadas

`EXECUTE` está revocado para `PUBLIC` y `anon` y concedido solamente a `authenticated`.

El uso de `SECURITY DEFINER` es necesario porque las tablas continúan sin grants directos y con RLS. La superficie se limita a una sola fila y seis campos técnicos derivados del claim actual.

## Comportamiento por estado

| Estado               | IDs técnicos                               | Roles | Aplicaciones |
| -------------------- | ------------------------------------------ | ----- | ------------ |
| `ACTIVE`             | Auth, cuenta y persona                     | Sí    | Sí           |
| `PENDING_INVITATION` | Auth, cuenta y persona                     | Vacío | Vacío        |
| `PENDING_ACTIVATION` | Auth, cuenta y persona                     | Vacío | Vacío        |
| `SUSPENDED`          | Auth, cuenta y persona                     | Vacío | Vacío        |
| `BLOCKED`            | Auth, cuenta y persona                     | Vacío | Vacío        |
| `DISABLED`           | Auth y estado; cuenta y persona son `null` | Vacío | Vacío        |
| Sin vínculo          | Solo Auth                                  | Vacío | Vacío        |
| Sin sesión           | Valores nulos                              | Vacío | Vacío        |

Los roles de `SUSPENDED` y `BLOCKED` permanecen almacenados, pero no se utilizan para autorización.

## Aplicaciones autorizadas

La aplicación se deriva exclusivamente de roles activos y asignaciones no revocadas:

| Aplicación               | Roles                                                     |
| ------------------------ | --------------------------------------------------------- |
| `PORTAL_ESCOLAR`         | `ASPIRANTE`, `ALUMNO`, `TUTOR`, `DOCENTE`                 |
| `SISTEMA_ADMINISTRATIVO` | `SUPERADMIN`, `ADMINISTRATIVO`, `CONTROL_ESCOLAR`, `CAJA` |

Una identidad con roles de ambos grupos obtiene ambas aplicaciones, en ese orden y sin duplicados. No existen wildcards.

## Políticas RLS

Se crearon cuatro políticas `SELECT TO authenticated`:

| Política                                  | Tabla                | Alcance defensivo                             |
| ----------------------------------------- | -------------------- | --------------------------------------------- |
| `accounts_select_own_active_context`      | `core.accounts`      | Cuenta propia `ACTIVE`.                       |
| `people_select_own_active_context`        | `core.people`        | Persona de la cuenta propia `ACTIVE`.         |
| `account_roles_select_own_active_context` | `core.account_roles` | Asignaciones propias, activas y no revocadas. |
| `roles_select_own_active_context`         | `core.roles`         | Roles propios activos.                        |

No se crearon políticas `INSERT`, `UPDATE` o `DELETE`.

Estas políticas son defensa en profundidad: `authenticated` continúa sin `SELECT` sobre las tablas, por lo que no puede consultarlas directamente aunque una política coincida.

## Privilegios

`authenticated` conserva:

- `USAGE` sobre `core`.
- `EXECUTE` sobre las funciones técnicas autorizadas.

No recibe `SELECT`, `INSERT`, `UPDATE` o `DELETE` sobre tablas o secuencias. `anon` no recibe acceso.

## Contrato TypeScript

`AuthIdentityContext` incorpora:

```text
allowedApplications: readonly Application[]
```

Los roles, aplicaciones, estados y reglas se importan de los catálogos existentes. La prueba estática compara el mapeo SQL con `applicationRoleMap`.

## Pruebas

`supabase/tests/identity-context-access.test.sql` utiliza usuarios y UUID sintéticos en transacciones reversibles para comprobar:

- Ausencia de sesión y cuenta vinculada.
- Todos los estados.
- Roles de Portal, administrativos y mixtos.
- Roles revocados, inactivos, repetidos y ausencia de roles.
- Unión exacta de aplicaciones.
- Aislamiento entre dos usuarios.
- Ejecución permitida a `authenticated` y denegada a `anon`.
- Lectura directa denegada en las cuatro tablas.
- Cuatro políticas SELECT y cero políticas de escritura.
- Propietario, `SECURITY DEFINER`, estabilidad y `search_path`.
- Limpieza completa mediante `ROLLBACK`.

## Sincronización SQL/TypeScript

La prueba automatizada compara:

- Ocho roles.
- Dos aplicaciones.
- Roles autorizados por aplicación.
- Seis estados de cuenta.

Cualquier divergencia entre la tercera migración y `packages/authz` hace fallar la suite.

## Reversión

La reversión local:

1. Revoca `EXECUTE` de la función.
2. Elimina `get_current_identity_context`.
3. Elimina las cuatro políticas.
4. Confirma que permanecen las cuatro tablas, la FK Auth y las cinco funciones del Bloque 4.
5. Ejecuta `ROLLBACK` y confirma la restauración del Bloque 5.

No se ejecuta en remoto.

## Riesgos y limitaciones

- La función se ejecuta como `postgres`; una ampliación de campos o consultas requiere auditoría independiente.
- Las políticas no sustituyen grants: ambos mecanismos deben revisarse juntos en cambios futuros.
- El contexto propio no autoriza operaciones académicas, financieras o administrativas.
- `SUSPENDED` y `BLOCKED` tienen tratamiento restrictivo provisional.
- La función no está expuesta como RPC pública mientras `core` permanezca fuera de Data API.

## Decisiones pendientes

- Políticas administrativas.
- Asignación y retiro de roles.
- Aprovisionamiento de cuentas.
- Cierre global de sesiones.
- MFA.
- Acceso de soporte.
- Auditoría de cambios.
- Autorización por propiedad, grupo, materia y relación.
- Tratamiento institucional definitivo de `SUSPENDED` y `BLOCKED`.

## Funciones no implementadas

- Login, registro, recuperación o pantallas.
- Administración de cuentas o usuarios.
- Asignación o retiro de roles.
- Acceso a datos de otras personas.
- Operaciones escolares, académicas o financieras.
- Middleware, proxy o conexión remota.
