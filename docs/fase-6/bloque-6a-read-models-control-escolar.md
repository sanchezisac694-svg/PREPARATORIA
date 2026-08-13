# Fase 6 — Bloque 6A: Read models administrativos de Control Escolar

## Objetivo

Incorporar read models backend-only para consultas administrativas de Control Escolar sin crear UI nueva, sin exponer acceso directo al esquema `academic` y reutilizando el modelo académico ya persistido.

## Migración

- Nueva migración aditiva: `supabase/migrations/20260813171608_create_control_school_read_models.sql`
- Migraciones históricas modificadas: ninguna

## RPC públicos creados

Todos los wrappers viven en `public`, son `SECURITY DEFINER`, usan `set search_path=''`, revocan `PUBLIC` y `anon`, y otorgan `EXECUTE` solo a `authenticated`.

| RM | Wrapper público | Propósito |
| --- | --- | --- |
| RM-01 | `public.list_control_school_students(...)` | Lista administrativa de alumnos con filtros seguros y paginación. |
| RM-02 | `public.get_control_school_student_detail(uuid)` | Detalle administrativo de alumno autenticado para Control Escolar. |
| RM-03 | `public.list_control_school_groups(...)` | Lista administrativa de grupos. |
| RM-04 | `public.get_control_school_group_detail(uuid)` | Detalle de grupo con integrantes, materias y asignaciones docentes mínimas. |
| RM-05 | `public.get_control_school_group_schedule(uuid, uuid)` | Horario administrativo por grupo y periodo. |
| RM-06 | `public.get_control_school_structure(uuid, uuid)` | Estructura académica reutilizable: ciclos, periodos, planes, semestres, áreas, materias y grupos. |
| RM-07 | `public.list_control_school_enrollments(...)` | Listado administrativo de inscripciones por periodo/grupo/semestre/estatus. |
| RM-08 | `public.get_control_school_student_trajectory(uuid)` | Trayectoria e historial de decisiones académicas persistidas. |

## Reutilización del modelo existente

Se reutilizan exclusivamente tablas y relaciones ya existentes de `core` y `academic`, entre ellas:

- `core.accounts`
- `core.account_roles`
- `academic.student_records`
- `academic.period_enrollments`
- `academic.enrollment_requests`
- `academic.academic_progress_decisions`
- `academic.groups`
- `academic.academic_periods`
- `academic.school_cycles`
- `academic.study_plans`
- `academic.plan_semesters`
- `academic.training_areas`
- `academic.subjects`
- `academic.curriculum_subjects`
- `academic.academic_offerings`
- `academic.teaching_assignments`
- `academic.group_schedules`
- `academic.class_sessions`
- `academic.schedule_time_blocks`
- `academic.academic_spaces`

No se agregaron tablas nuevas para este bloque.

## Autorización y seguridad

La implementación exige en tiempo de ejecución:

- `auth.uid()` válido
- cuenta `ACTIVE`
- `session_version` vigente
- AAL2
- política MFA satisfecha
- aplicación `SISTEMA_ADMINISTRATIVO` permitida
- permiso académico específico según el read model invocado

La migración agrega dos helpers internos:

- `academic.require_control_school_application_context()`
- `academic.require_control_school_catalog_permission(text)`

Además reutiliza helpers endurecidos existentes:

- `academic.require_student_enrollment_permission(text)`
- `academic.require_academic_permission(text)`
- `academic.require_schedule_permission(text)`

No se otorgó `USAGE` al esquema `academic` ni `SELECT` directo sobre tablas a `authenticated`.

## Privacidad y minimización de datos

Los read models no exponen:

- `auth_user_id`
- `account_id`
- `person_id`
- JWT
- claims
- actores técnicos de aprobación/corrección

En este bloque, `core.people` no contiene nombres institucionales visibles. Por eso:

- `studentDisplayName` se devuelve como `null`
- `teacherDisplayName` se devuelve como `null`
- `teacherIdentifier` se expone solo cuando existe un identificador institucional operativo

No se inventaron nombres visibles.

## Contrato TypeScript

Archivo:

- `packages/supabase/src/control-school.ts`

Expone:

- nombres cerrados de RPC
- DTOs mínimos tipados
- `ControlSchoolError`
- `createControlSchoolService(...)`

El servicio es `server-only`, valida configuración pública de Supabase y falla cerrado ante respuestas inválidas o errores de dominio.

## Pruebas

### Node / TypeScript

Archivo:

- `packages/supabase/tests/control-school.test.mjs`

Cobertura:

- consumo exclusivo de wrappers públicos
- DTOs mínimos tipados
- fallo cerrado ante payload inválido
- propagación cerrada de errores de dominio

### SQL / pgTAP

Archivo:

- `supabase/tests/control-school-read-models.test.sql`

Cobertura:

- existencia de wrappers
- grants/revokes
- listados, detalles, horario, estructura, inscripciones y trayectoria
- filtros y paginación
- privacidad de identificadores internos
- rechazo por `studentRecordId` y `groupId` inexistentes
- rechazo por periodo ajeno
- rechazo por aplicación incorrecta
- rechazo sin autenticación
- rechazo con AAL insuficiente

Resultado focal esperado:

- `Files=1`
- `Tests=45`
- `Result=PASS`

## Estado de cierre DB-UX

| Clave | Estado | Evidencia |
| --- | --- | --- |
| DB-UX-05 | PARCIAL | `public.list_control_school_students(...)` cubre listado, semestre, grupo, estatus y periodo; permanece parcial porque no existe fuente autorizada para nombre visible seguro. |
| DB-UX-06 | CERRADA | `public.get_control_school_student_detail(uuid)` cubre detalle administrativo del alumno, situación de inscripción y expediente académico básico persistido. |
| DB-UX-07 | CERRADA | `public.list_control_school_groups(...)` y `public.get_control_school_group_detail(uuid)` cubren listado, detalle, integrantes y materias por grupo. |
| DB-UX-08 | PARCIAL | `public.get_control_school_group_schedule(uuid, uuid)` cubre horario administrativo por grupo; queda parcial porque no expone un resumen agregado de carga separado del detalle horario. |
| DB-UX-09 | CERRADA | `public.get_control_school_structure(uuid, uuid)` cubre la vista administrativa navegable de estructura académica. |
| DB-UX-10 | CERRADA | `public.list_control_school_enrollments(...)` y `public.get_control_school_student_trajectory(uuid)` cubren consulta administrativa de inscripciones y trayectoria. |

## Restricciones mantenidas

- Sin UI nueva
- Sin páginas Next.js nuevas
- Sin mutaciones académicas nuevas
- Sin acceso cliente directo al esquema `academic`
- Sin conexión remota
- Sin datos reales

## Riesgos y pendientes

- La capa SQL endurecida histórica no exponía `academic.cycles.read` y `academic.periods.read` a `CONTROL_ESCOLAR`; este bloque resolvió la lectura de catálogos mediante un helper nuevo acotado al caso de uso administrativo y sujeto a permiso específico.
- La fuente actual no contiene nombres institucionales visibles en `core.people`; cualquier UI futura deberá seguir la política institucional antes de mostrar nombres.
