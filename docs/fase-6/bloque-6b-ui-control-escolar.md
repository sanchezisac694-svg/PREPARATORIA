# Fase 6 — Bloque 6B: UI administrativa de Control Escolar

## Objetivo

Construir la UI administrativa de lectura para Control Escolar utilizando exclusivamente los read models del Bloque 6A, sin SQL nuevo, sin migraciones y sin mutaciones académicas.

## Rutas implementadas

| Ruta | Pantalla | Estado |
| --- | --- | --- |
| `/control-escolar/alumnos` | Listado paginado de alumnos con filtros reales | PARCIAL |
| `/control-escolar/alumnos/[studentRecordId]` | Detalle de alumno y trayectoria | PARCIAL |
| `/control-escolar/grupos` | Listado paginado de grupos | OPERATIVO |
| `/control-escolar/grupos/[groupId]` | Detalle de grupo con horario integrado | OPERATIVO |
| `/control-escolar/inscripciones` | Consulta paginada de inscripciones | OPERATIVO |
| `/control-escolar/estructura` | Estructura académica consolidada | OPERATIVO |

## Read models consumidos

| Read model | Consumo en UI |
| --- | --- |
| RM-01 | Listado de alumnos |
| RM-02 | Detalle de alumno |
| RM-03 | Listado de grupos |
| RM-04 | Detalle de grupo |
| RM-05 | Horario del grupo |
| RM-06 | Estructura académica y catálogos de filtro |
| RM-07 | Listado de inscripciones |
| RM-08 | Trayectoria del alumno |

## Adapter app-side

- Archivo: `apps/sistema-administrativo/lib/control-school.ts`
- `server-only`
- reutiliza cookies SSR del request;
- consume únicamente `@preparatoria/supabase/control-school`;
- no usa `service_role`;
- no usa cliente privilegiado;
- no hace RPC manual desde las páginas.

## Permisos de navegación y acceso

La navegación del shell ahora muestra la sección **Control escolar** solo cuando el usuario tiene capacidad real sobre cada pantalla:

| Pantalla | Permisos |
| --- | --- |
| Alumnos | `academic.students.read` |
| Grupos | `academic.groups.read` |
| Inscripciones | `academic.enrollments.read` |
| Estructura académica | cualquiera de `academic.periods.read`, `academic.plans.read`, `academic.subjects.read`, `academic.groups.read` |

No se usan roles como sustituto del permiso.

## Privacidad

- No se muestran `auth_user_id`, `account_id`, `person_id`, `teachingAssignmentId`, `academicOfferingId` ni aliases Auth.
- `studentRecordId` y `groupId` se usan solo en URL y navegación interna.
- La UI no ejecuta joins adicionales para recuperar nombres.
- No mostrar IDs internos como contenido principal.
- Cuando el read model no trae nombre institucional, el fallback visible es `Nombre no disponible`.

## Estados de pantalla

### Alumnos

- filtros SSR por búsqueda, estatus, semestre, grupo y periodo;
- paginación real `offset/pageSize/totalRows`;
- `studentRecordId` no visible;
- limitación de nombres heredada del contrato.

### Detalle de alumno y trayectoria

- encabezado seguro con matrícula como fallback;
- situación actual;
- inscripción actual;
- trayectoria persistida sin recalcular promoción, promedio ni redondeo.

### Grupos

- listado con estado, área, semestre y conteo;
- detalle con alumnos, materias, docentes y horario.

### Inscripciones

- filtros SSR por búsqueda, periodo, semestre, grupo y estado;
- fechas relevantes visibles;
- navegación al expediente del alumno.

### Estructura académica

- ciclos escolares;
- periodos académicos;
- planes de estudio;
- semestres;
- áreas de formación;
- materias;
- grupos.

## DB-UX y limitaciones

| Clave | Estado | Impacto en UI |
| --- | --- | --- |
| DB-UX-05 | PARCIAL | Los nombres institucionales no siempre están disponibles; se usa `Nombre no disponible` sin consultas adicionales. |
| DB-UX-08 | PARCIAL | El horario por grupo sí está disponible, pero no se crea un dashboard agregado de carga docente. |

## Fuera de alcance

- mutaciones académicas;
- calificaciones;
- asistencia;
- aspirantes;
- documentos;
- acciones falsas como “Nuevo alumno”, “Editar alumno”, “Reinscribir” o “Crear grupo”.

## Validación esperada

- `format:check`
- `lint`
- `typecheck`
- `test`
- `build`
- test específico `apps/sistema-administrativo/tests/control-escolar.test.mjs`
- `check-boundaries`
- `check-security`

## Referencia funcional

Este bloque implementa la superficie administrativa solicitada para la Fase 6 — Bloque 6B y se apoya en los read models documentados en `docs/fase-6/bloque-6a-read-models-control-escolar.md`.
