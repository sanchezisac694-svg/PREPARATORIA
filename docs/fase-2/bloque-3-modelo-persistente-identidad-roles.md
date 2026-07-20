# Fase 2 — Bloque 3: modelo persistente de identidad y roles

## Objetivo

Crear una base persistente mínima y versionada para identidad institucional, cuentas, roles múltiples y trazabilidad, sin autenticación funcional, usuarios reales, módulos escolares ni conexiones remotas.

Referencia funcional: **Fase 2 — Bloque 3: modelo persistente de identidad y roles**, contratos de `packages/authz`, ADR-003, ADR-005, ADR-007 y RN-ID-001 de Fase 0.

## Configuración local

`supabase/config.toml` fue generado con Supabase CLI `2.109.1` y reducido al alcance local:

- `project_id` técnico `sistema-preparatoria-local`, sin `project_ref`.
- API local habilitada únicamente para permitir validación futura.
- Auth, registro, Storage, Realtime, Studio, SMTP, Edge Runtime y Analytics deshabilitados.
- Red de base de datos limitada a loopback.
- Sin seeds, proveedores externos, secretos o credenciales.
- Esquemas expuestos: únicamente `public` y `graphql_public`; `core` no se expone.

No se ejecutaron `supabase link`, `db push`, `db pull`, despliegues ni conexiones remotas.

## Esquema elegido

Se utiliza `core` en lugar de `public` para separar la identidad institucional de los esquemas expuestos por defecto. `core` no aparece en `api.schemas`, carece de permisos para `PUBLIC`, `anon` y `authenticated`, y requerirá una decisión explícita de arquitectura antes de cualquier acceso futuro.

## Catálogos SQL

Se eligieron enums PostgreSQL porque los estados son catálogos técnicos cerrados, pequeños y compartidos con `packages/authz`.

| Enum                  | Valores                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `core.person_status`  | `ACTIVE`, `INACTIVE`, `ARCHIVED`                                                         |
| `core.account_status` | `PENDING_INVITATION`, `PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `BLOCKED`, `DISABLED` |

La incorporación o retiro de un estado requerirá una migración explícita. No se agregaron valores provisionales.

## Tablas y relaciones

| Tabla                | Responsabilidad                                      | Relaciones principales                                                          |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `core.people`        | Identidad institucional única y borrado lógico.      | Raíz de identidad; no depende de aplicaciones ni perfiles escolares.            |
| `core.accounts`      | Cuenta principal y futuro vínculo con Supabase Auth. | `person_id → people.id`; `status_changed_by → accounts.id`.                     |
| `core.roles`         | Catálogo persistente de ocho roles.                  | Referenciada por asignaciones; roles del sistema protegidos.                    |
| `core.account_roles` | Historial de asignación y revocación.                | `account_id`, `assigned_by` y `revoked_by → accounts.id`; `role_id → roles.id`. |

Todas las relaciones usan `ON DELETE RESTRICT`. No existe `CASCADE`.

## Columnas y datos excluidos

`people` contiene solamente UUID, timestamps, estado y `deleted_at`. No contiene nombre, CURP, correo, teléfono, domicilio, documentos ni entidades de alumno, tutor, docente o administrativo.

`accounts.auth_user_id` es nullable y único cuando existe. No referencia todavía `auth.users`, lo que permite aprovisionamiento previo y pruebas locales independientes de Auth. La FK definitiva se añadirá en un bloque posterior cuando se apruebe el ciclo de aprovisionamiento y eliminación.

## Restricciones e índices

- UUID seguros mediante `gen_random_uuid()`.
- Una cuenta por persona mediante `UNIQUE (person_id)`.
- Índice único parcial de `auth_user_id` cuando no es nulo.
- Índice único parcial para una asignación activa por cuenta y rol.
- Índices históricos por cuenta, rol y fecha de asignación.
- Checks de orden y coherencia de timestamps.
- `disabled_at` obligatorio exclusivamente para cuentas `DISABLED`.
- `deleted_at` solamente con persona `ARCHIVED`.
- Motivos no vacíos cuando se proporcionan.
- Revocaciones anteriores a la asignación rechazadas.

La carga inicial de roles usa `ON CONFLICT (code) DO NOTHING`, por lo que es idempotente. Los códigos y etiquetas coinciden con `packages/authz`.

## Funciones y triggers

| Función                                          | Uso                                                              |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `core.set_updated_at`                            | Actualiza `updated_at` en `people` y `accounts`.                 |
| `core.protect_system_role`                       | Impide actualizar o eliminar roles marcados como sistema.        |
| `core.prevent_revoked_account_role_reactivation` | Impide convertir directamente una asignación revocada en activa. |

Las funciones son `SECURITY INVOKER` por omisión, fijan `search_path = pg_catalog` y tienen ejecución revocada para `PUBLIC`, `anon` y `authenticated`. No contienen lógica escolar.

## RLS y privilegios

RLS está habilitada en las cuatro tablas. No existe ninguna política para `anon`, `authenticated` u otro rol de aplicación. En consecuencia, el modelo queda deny-by-default.

Además:

- Se revoca acceso al esquema, tablas, secuencias y funciones.
- Se revocan privilegios predeterminados para objetos futuros dentro de `core`.
- No se conceden privilegios amplios.
- No existe cliente administrativo, consulta desde aplicaciones o exposición por Data API.

Las políticas funcionales se diseñarán posteriormente con alcance por propiedad, relación, persona y recurso. No se crearán políticas permisivas temporales.

## Sincronización con `packages/authz`

La fuente provisional de verdad para códigos visibles y estados de cuenta es `packages/authz`; la migración materializa esos catálogos.

`supabase/tests/identity-schema.test.mjs` importa los exports compilados del paquete y compara:

- Los ocho roles SQL.
- Sus ocho etiquetas visibles.
- Los seis estados SQL de cuenta.

La prueba falla ante divergencias. `PersonStatus` pertenece únicamente al modelo persistente porque todavía no forma parte del contrato de autorización.

## Estrategia de migración

La migración fue creada mediante `supabase migration new create_identity_and_roles` y se ejecuta dentro de una transacción explícita. En un entorno local con Docker, `supabase db reset` deberá aplicar desde una base vacía todas las migraciones y verificar la reconstrucción.

No se generaron tipos desde una base remota, seeds ni usuarios.

## Estrategia de reversión

Antes de cualquier despliegue, la reversión consiste en retirar la migración, configuración, pruebas, scripts y dependencia de CLI.

En desarrollo local, `supabase db reset` destruye y reconstruye el entorno. Después de un despliegue futuro, la reversión deberá implementarse mediante otra migración hacia adelante que preserve historial; no se recomienda borrar directamente tablas o enums con datos.

## Pruebas

Las pruebas estáticas comprueban:

- Nombre versionado y transacción.
- Cuatro tablas exactas.
- Roles, etiquetas y estados sincronizados.
- Restricciones, índices parciales y seis FK `RESTRICT`.
- Triggers técnicos y `search_path`.
- Bloqueo de reactivación y protección del catálogo.
- RLS habilitada y ausencia de políticas.
- Revocación de privilegios.
- Esquema `core` no expuesto.
- Ausencia de datos personales, secretos, módulos escolares y referencias remotas.

La prueba real contra una base vacía, restricciones ejecutadas y metadatos de RLS requiere Docker. Docker no estaba disponible durante este bloque, por lo que esos resultados no se presentan como exitosos y el veredicto queda condicionado a ejecutarlos.

## Riesgos y limitaciones

- La validación estática no sustituye la ejecución real en PostgreSQL.
- Los enums exigen migraciones explícitas para cambios futuros.
- El modelo no bloquea operaciones del propietario de la base; la protección frente a aplicaciones proviene del esquema privado, privilegios revocados y RLS.
- No existe todavía FK a `auth.users`.
- No existen políticas funcionales ni servicio autorizado para asignar o revocar roles.
- Una terminación abrupta durante una futura migración dependerá de la atomicidad proporcionada por PostgreSQL.

## Decisiones institucionales pendientes

- Responsables autorizados para asignar y retirar roles.
- Reglas y autoridad para reactivar asignaciones.
- Vínculo definitivo, aprovisionamiento y eliminación respecto de `auth.users`.
- Plazo de retención del historial de roles y estados.
- Tratamiento formal de eliminación, anonimización o archivo de personas.
- Aprobación institucional definitiva de la matriz de roles y permisos.
- Autorización y responsable de `BLOCKED → ACTIVE`.
- Autorización y responsable de `SUSPENDED → BLOCKED`.
- Privilegios acumulativos para identidades con múltiples roles.

Ninguna de estas decisiones se resolvió mediante suposiciones.

## Exclusiones confirmadas

- Sin login, registro, recuperación, sesiones o usuarios reales.
- Sin pantallas, middleware, proxy o llamadas desde aplicaciones.
- Sin tablas académicas, financieras, escolares o documentales.
- Sin conexión a producción o proyecto Supabase enlazado.
- Sin commit, push o avance al Bloque 4.
