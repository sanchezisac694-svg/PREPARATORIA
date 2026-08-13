# Fase 6 — Bloque 7B: UI de Calificaciones

## Objetivo

Construir la superficie administrativa y docente de Calificaciones en `apps/sistema-administrativo` utilizando exclusivamente el contrato público `@preparatoria/supabase/grade-management-public`, sin introducir SQL, migraciones ni reinterpretaciones académicas en frontend.

## Adapter app-side

- Archivo: `apps/sistema-administrativo/lib/grade-management.ts`
- Naturaleza: `server-only`
- Sesión: reutiliza cookies SSR y `createGradeManagementPublicService(...)`
- Alcance:
  - listado administrativo;
  - carga propia docente;
  - detalle de offering;
  - historial de unidad;
  - historial de resultado;
  - ventanas;
  - correcciones;
  - mutaciones seguras por Server Actions.
- Restricciones:
  - sin `service_role`;
  - sin SQL directo;
  - sin `packages/supabase/src/**`;
  - sin cliente privilegiado.

## Rutas creadas

| Ruta | Superficie | Permiso base | Estado |
| --- | --- | --- | --- |
| `/control-escolar/calificaciones` | Listado administrativo de offerings | `academic.grades.read` | OPERATIVA |
| `/control-escolar/calificaciones/[academicOfferingId]` | Detalle por grupo/materia | `academic.grades.read` | OPERATIVA |
| `/control-escolar/calificaciones/mis-grupos` | Carga propia docente resuelta por sesión | `academic.grades.read` | OPERATIVA |
| `/control-escolar/calificaciones/ventanas` | Gestión de ventanas de captura | `academic.grade_windows.manage` | OPERATIVA |
| `/control-escolar/calificaciones/correcciones` | Consulta y workflow de correcciones | `academic.grades.read` | OPERATIVA |
| `/control-escolar/calificaciones/[academicOfferingId]/unidades/[studentUnitGradeId]` | Historial de unidad | `academic.grades.read` | OPERATIVA |
| `/control-escolar/calificaciones/[academicOfferingId]/resultados/[subjectFinalResultId]` | Historial de resultado | `academic.subject_results.read` | OPERATIVA |

## Permisos y acciones visibles

La UI deriva acciones desde permisos efectivos; no autoriza por rol directo.

| Permiso | Uso en UI |
| --- | --- |
| `academic.grades.read` | Listado, detalle, historiales, correcciones visibles |
| `academic.grades.capture` | Captura de unidad cuando el backend permite el estado |
| `academic.grades.review` | Revisión de unidad en estado compatible |
| `academic.grades.finalize` | Finalización de unidad y confirmación sensible |
| `academic.grades.correct` | Alta y workflow de correcciones |
| `academic.grade_windows.manage` | Crear, abrir, cerrar y cancelar ventanas |
| `academic.subject_results.read` | Lectura de AC/NA y su historial |

## Read models consumidos

- `list_grade_management_offerings(...)`
- `list_my_grade_management_offerings(...)`
- `get_grade_management_offering_detail(...)`
- `get_grade_management_unit_grade_history(...)`
- `get_grade_management_subject_result_history(...)`
- `list_grade_management_corrections(...)`
- `list_grade_capture_windows(...)`

## Mutaciones usadas

- `capture_student_unit_grade(...)`
- `capture_bulk_unit_grades(...)` mediante Server Action preparada
- `review_student_unit_grade(...)`
- `finalize_student_unit_grade(...)`
- `cancel_student_unit_grade(...)`
- `confirm_subject_final_result(...)`
- `create_grade_capture_window(...)`
- `open_grade_capture_window(...)`
- `close_grade_capture_window(...)`
- `cancel_grade_capture_window(...)`
- `create_grade_correction(...)`
- `submit_grade_correction(...)`
- `begin_grade_correction_review(...)`
- `approve_grade_correction(...)`
- `reject_grade_correction(...)`
- `apply_grade_correction(...)`
- `cancel_grade_correction(...)`

## Privacidad

La UI evita mostrar como contenido visible:

- `auth_user_id`
- `account_id`
- `person_id`
- `studentRecordId`
- `teachingAssignmentId`
- `studentUnitGradeId`
- `subjectFinalResultId`
- `gradeCorrectionId`

Los identificadores anteriores pueden existir solo como soporte interno para rutas o formularios server-side.

## Estado administrativo

- Listado de offerings: OPERATIVA
- Detalle de offering: OPERATIVA
- Resultados AC/NA: OPERATIVA
- Ventanas: OPERATIVA
- Correcciones: OPERATIVA
- Historiales: OPERATIVA

## Estado docente

- Carga propia: OPERATIVA
- Captura: OPERATIVA
- Revisión: OPERATIVA
- Finalización: OPERATIVA

## Labels compartidos

Archivo:

- `apps/sistema-administrativo/app/_admin/grade-labels.tsx`

Responsabilidad:

- presentación en español;
- badges seguros;
- fallbacks como `Nombre no disponible`, `Docente no disponible` y `No definida`;
- traducción visual de `AC`, `NA` y `MANUAL_REVIEW_REQUIRED`.

No contiene reglas académicas.

## Reglas preservadas

La UI no reimplementa:

- número de unidades;
- mínima aprobatoria;
- criterio 2 de 3;
- redondeo oficial;
- tratamiento de `5.95`;
- tratamiento institucional de `6.25`;
- cálculo de `AC` / `NA`;
- calificación final numérica oficial.

La fuente de verdad sigue siendo backend.

## DB-UX pendientes

| Clave | Estado | Alcance en 7B |
| --- | --- | --- |
| DB-UX-17 | `PENDING_INSTITUTIONAL_VALIDATION` | No se crea input ni semántica de calificación final numérica oficial |
| DB-UX-18 | `PENDING_INSTITUTIONAL_VALIDATION` | No se agrega lógica React de redondeo normativo |

## Fuera de alcance

- SQL;
- migraciones;
- cambios a reglas académicas;
- promoción de semestre;
- asistencia, retardos o prefectura;
- documentos oficiales;
- reinterpretación del dominio docente fuera del contrato existente.
