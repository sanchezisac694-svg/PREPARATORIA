# Fase 4 — Bloque 1: Portal del alumno y consultas académicas propias

Referencia funcional principal: `docs/Plan_Maestro_Sistema_Preparatoria_V1.docx`, reglas de portal propio y publicación segura definidas para Fase 4 — Bloque 1.

## Objetivo implementado

El servidor identifica al alumno desde su sesión institucional y resuelve su contexto académico sin aceptar `student_record_id`, `account_id`, `person_id` ni `auth_user_id` como entrada del navegador.

## Arquitectura aplicada

| Capa                    | Implementación                                                               | Restricción aplicada                                                      |
| ----------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Resolución de identidad | `apps/portal-escolar/lib/student-portal.ts` + `requireStudentPortalAccess()` | Exige cuenta `ACTIVE`, acceso al Portal Escolar y rol `ALUMNO`            |
| Servicio SSR            | `packages/supabase/src/student-portal.ts`                                    | `server-only`, usa solo RPCs públicos controlados                         |
| Lectura SQL             | migración `20260721192802_student_portal_read_model.sql`                     | Contexto del alumno resuelto por `auth.uid()` + `session_version` vigente |
| Presentación UI         | rutas `apps/portal-escolar/app/alumno/*`                                     | páginas dinámicas, privadas y sin caché compartible                       |

## RPCs públicas expuestas

Solo se agregaron funciones públicas de lectura controlada:

- `public.get_my_student_portal_record()`
- `public.get_my_student_portal_overview(uuid)`
- `public.get_my_student_portal_subjects(uuid)`
- `public.get_my_student_portal_schedule(uuid)`
- `public.get_my_student_portal_attendance(uuid)`
- `public.get_my_student_portal_permissions(uuid)`
- `public.get_my_student_portal_grades(uuid)`
- `public.get_my_student_portal_trajectory()`

## Reglas de seguridad implementadas

| Regla           | Implementación                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------- |
| AAL permitido   | AAL1 aceptado para lectura propia                                                                  |
| Sesión vigente  | `core.is_current_session_version_valid()`                                                          |
| Cuenta activa   | validación directa en `core.accounts`                                                              |
| Rol activo      | `ALUMNO` activo obligatorio                                                                        |
| Filtro opcional | `requested_period_id` solo como filtro; si no pertenece al alumno, responde `PERIOD_NOT_AVAILABLE` |
| Data API        | `academic` permanece fuera de `api.schemas`                                                        |
| Grants          | sin grants directos a tablas `academic` para `authenticated`, `anon` o `PUBLIC`                    |
| Privacidad      | rutas con `force-dynamic`, `revalidate = 0` y `noStore()`                                          |

## Publicación segura aplicada

| Dominio                  | Visibilidad                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| Horario                  | solo `group_schedules.status = 'PUBLISHED'`                                       |
| Asistencia               | solo sesiones `CLOSED` o `LOCKED`                                                 |
| Calificaciones de unidad | solo `FINALIZED` o `CORRECTED`                                                    |
| Resultado de materia     | solo `CONFIRMED`                                                                  |
| Resumen semestral        | solo `CONFIRMED`; `MANUAL_REVIEW_REQUIRED` se muestra como revisión institucional |
| Decisiones de progreso   | solo `CONFIRMED`                                                                  |

Nunca se exponen estados administrativos como `DRAFT`, `UNDER_REVIEW`, `CAPTURED`, `REVIEWED` o `CALCULATED`.

## Rutas creadas

| Ruta                     | Contenido                            |
| ------------------------ | ------------------------------------ |
| `/alumno`                | overview                             |
| `/alumno/expediente`     | expediente académico                 |
| `/alumno/materias`       | materias del periodo                 |
| `/alumno/horario`        | horario publicado                    |
| `/alumno/asistencia`     | asistencia y retardos                |
| `/alumno/permisos`       | permisos visibles                    |
| `/alumno/calificaciones` | calificaciones y resultados          |
| `/alumno/trayectoria`    | trayectoria y decisiones confirmadas |

## Docente

En este bloque no existe todavía un nombre institucional persistido en `core.people`. Por eso, cuando no hay un nombre visible seguro asociado a una `teaching_assignment`, la interfaz muestra:

`Docente pendiente de asignación`

## Pruebas agregadas

| Tipo                    | Archivo                                             |
| ----------------------- | --------------------------------------------------- |
| Contrato TypeScript SSR | `packages/supabase/tests/supabase.test.mjs`         |
| Smoke UI                | `apps/portal-escolar/tests/smoke.test.mjs`          |
| pgTAP perimetral        | `supabase/tests/student-portal-read-model.test.sql` |
| Validación local real   | `supabase/tests/student-portal-local.test.mjs`      |

## Riesgos y pendientes

| Tema                             | Estado                                                             |
| -------------------------------- | ------------------------------------------------------------------ |
| Nombre institucional del docente | pendiente de un atributo visible y autorizado en identidad/persona |
| Filtros de periodo en UI         | no expuestos todavía; el backend ya los valida                     |
| Portal del tutor                 | fuera de alcance                                                   |
| Documentos oficiales             | fuera de alcance                                                   |
