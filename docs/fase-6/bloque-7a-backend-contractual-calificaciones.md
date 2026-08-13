# Fase 6 — Bloque 7A: backend contractual de calificaciones

## Objetivo

Construir la fachada pública mínima para que una futura UI administrativa/docente de calificaciones consuma el dominio persistente existente sin SQL directo, sin duplicar reglas académicas y sin relajar seguridad.

## Arquitectura

```text
UI futura
  ↓
@preparatoria/supabase/grade-management-public
  ↓
RPC públicos seguros (schema public)
  ↓
Funciones academic existentes + read models internos
  ↓
Tablas academic existentes
```

## Dominio reutilizado

Se reutilizan directamente:

- `academic.grade_capture_windows`
- `academic.student_unit_grades`
- `academic.student_unit_grade_history`
- `academic.subject_final_results`
- `academic.subject_result_history`
- `academic.semester_evaluation_summaries`
- `academic.grade_corrections`
- `academic.grade_commands`
- `academic.grade_events`

Y funciones existentes de dominio, entre ellas:

- `academic.capture_student_unit_grade`
- `academic.capture_bulk_unit_grades`
- `academic.review_student_unit_grade`
- `academic.finalize_student_unit_grade`
- `academic.cancel_student_unit_grade`
- `academic.calculate_subject_final_result`
- `academic.confirm_subject_final_result`
- `academic.create_grade_correction`
- `academic.submit_grade_correction`
- `academic.begin_grade_correction_review`
- `academic.approve_grade_correction`
- `academic.reject_grade_correction`
- `academic.apply_grade_correction`
- `academic.cancel_grade_correction`
- `academic.create_grade_capture_window`
- `academic.open_grade_capture_window`
- `academic.close_grade_capture_window`
- `academic.cancel_grade_capture_window`
- `academic.apply_institutional_grade_rounding`

## Read models públicos

| Clave | Wrapper público | Propósito | Permisos | Ownership |
| --- | --- | --- | --- | --- |
| DB-UX-11 | `public.list_grade_management_offerings(...)` | Consulta administrativa de offerings con filtros y paginación | `academic.grades.read` + `academic.subject_results.read` | si actor es docente, solo offerings propios |
| DB-UX-12 | `public.get_grade_management_offering_detail(uuid)` | Detalle de offering con alumnos, tres unidades y resultado | `academic.grades.read` + `academic.subject_results.read` | docente solo sobre offering asignado |
| DB-UX-13 | `public.list_my_grade_management_offerings(...)` | Carga docente propia para calificaciones | `academic.grades.read` | resuelta desde sesión + `teaching_assignments` activas |
| DB-UX-14A | `public.get_grade_management_unit_grade_history(uuid)` | Historial append-only de unidad | `academic.grades.read` | docente solo offering propio |
| DB-UX-14B | `public.get_grade_management_subject_result_history(uuid)` | Historial append-only de resultado | `academic.subject_results.read` | docente solo offering propio |
| DB-UX-14C | `public.list_grade_management_corrections(...)` | Correcciones y workflow operativo | `academic.grades.read` | docente solo offering propio |
| DB-UX-15 | `public.list_grade_capture_windows(...)` | Ventanas de captura con vigencia y operaciones derivadas de estado | `academic.grade_windows.manage` | administrativo |

## Wrappers públicos de mutación

| DB-UX | Wrapper público | Dominio reutilizado | Permiso |
| --- | --- | --- | --- |
| 16 | `public.capture_student_unit_grade(...)` | `academic.capture_student_unit_grade` | `academic.grades.capture` |
| 16 | `public.capture_bulk_unit_grades(...)` | `academic.capture_bulk_unit_grades` | `academic.grades.capture` |
| 16 | `public.review_student_unit_grade(...)` | `academic.review_student_unit_grade` | `academic.grades.review` |
| 16 | `public.finalize_student_unit_grade(...)` | `academic.finalize_student_unit_grade` | `academic.grades.finalize` |
| 16 | `public.cancel_student_unit_grade(...)` | `academic.cancel_student_unit_grade` | `academic.grades.correct` |
| 16 | `public.calculate_subject_final_result(...)` | `academic.calculate_subject_final_result` | `academic.subject_results.calculate` |
| 16 | `public.confirm_subject_final_result(...)` | `academic.confirm_subject_final_result` | `academic.subject_results.confirm` |
| 16 | `public.create_grade_correction(...)` | `academic.create_grade_correction` | `academic.grades.correct` |
| 16 | `public.submit_grade_correction(...)` | `academic.submit_grade_correction` | `academic.grades.correct` |
| 16 | `public.begin_grade_correction_review(...)` | `academic.begin_grade_correction_review` | `academic.grades.correct` |
| 16 | `public.approve_grade_correction(...)` | `academic.approve_grade_correction` | `academic.grades.correct` |
| 16 | `public.reject_grade_correction(...)` | `academic.reject_grade_correction` | `academic.grades.correct` |
| 16 | `public.apply_grade_correction(...)` | `academic.apply_grade_correction` | `academic.grades.correct` |
| 16 | `public.cancel_grade_correction(...)` | `academic.cancel_grade_correction` | `academic.grades.correct` |
| 16 | `public.create_grade_capture_window(...)` | `academic.create_grade_capture_window` | `academic.grade_windows.manage` |
| 16 | `public.open_grade_capture_window(...)` | `academic.open_grade_capture_window` | `academic.grade_windows.manage` |
| 16 | `public.close_grade_capture_window(...)` | `academic.close_grade_capture_window` | `academic.grade_windows.manage` |
| 16 | `public.cancel_grade_capture_window(...)` | `academic.cancel_grade_capture_window` | `academic.grade_windows.manage` |

## Contrato TypeScript

Archivo:

- `packages/supabase/src/grade-management-public.ts`

Subpath:

- `@preparatoria/supabase/grade-management-public`

Expone:

- DTOs tipados de lectura
- filtros y paginación cerrada
- mutaciones públicas seguras
- `GradeManagementPublicError`
- `createGradeManagementPublicService(...)`

Es `server-only` y no expone SQL, `service_role`, JWT ni IDs de identidad internos.

## Seguridad

- Contexto administrativo obligatorio mediante `core.get_current_identity_context()`
- requiere:
  - `auth.uid()`
  - cuenta activa y sesión válida
  - `session_version` vigente
  - `mfa_satisfied`
  - aplicación `SISTEMA_ADMINISTRATIVO`
  - AAL2 y permiso funcional real vía `academic.require_grade_permission(...)`
- ownership docente real:
  - si el actor es `DOCENTE`, solo puede leer/mutar offerings con `teaching_assignment` activa
- sin grants directos sobre tablas
- sin `USAGE` nuevo sobre `academic`
- wrappers públicos con `SECURITY DEFINER`, `set search_path=''`, revokes a `PUBLIC/anon`

## Privacidad

No se devuelven:

- `auth_user_id`
- `account_id`
- `person_id`
- alias Auth
- JWT
- `session_version`
- MFA factors
- NIP

La identidad visible se limita a identificadores institucionales operativos y `displayName` nullable.

## Reglas académicas preservadas

Se preserva exactamente el dominio existente:

- 3 unidades
- escala 0–10
- mínima aprobatoria 6
- `5.95` no sube a `6`
- acreditación por al menos 2 de 3 unidades
- `AC/NA`
- redondeo solo mediante `academic.apply_institutional_grade_rounding(...)`
- `6.25 -> 6`
- `6.26 -> 6.5`
- no se inventa calificación final numérica oficial

## PENDING_INSTITUTIONAL_VALIDATION

### DB-UX-17

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La decisión institucional sobre “calificación final numérica manual vs resultado derivado AC/NA” no se resuelve aquí. El contrato público conserva `raw_final_grade` y `rounded_final_grade` como `null` cuando el dominio vigente así lo produce.

### DB-UX-18

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La frontera histórica ambigua de redondeo no se modifica. El bloque preserva el comportamiento backend vigente:

- `6.25 -> 6`
- `6.26 -> 6.5`

## Estado DB-UX

| Clave | Estado |
| --- | --- |
| DB-UX-11 | CERRADA |
| DB-UX-12 | CERRADA |
| DB-UX-13 | CERRADA |
| DB-UX-14 | CERRADA |
| DB-UX-15 | CERRADA |
| DB-UX-16 | CERRADA |
| DB-UX-17 | PENDING_INSTITUTIONAL_VALIDATION |
| DB-UX-18 | PENDING_INSTITUTIONAL_VALIDATION |
