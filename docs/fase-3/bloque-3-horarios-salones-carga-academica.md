# Fase 3 — Bloque 3: Horarios, salones, turnos y carga académica

## Objetivo

Construir una programación académica manual, histórica y validada para representar turnos, espacios, días, bloques y sesiones vinculadas con periodo, grupo, oferta y asignación docente. El modelo permite consultar horarios por grupo, docente y espacio, calcular carga docente, detectar conflictos, publicar y cerrar versiones, registrar cambios controlados y preparar la futura asistencia por materia y sesión.

## Alcance

Este bloque implementa exclusivamente la infraestructura persistente y los contratos técnicos para turnos, espacios, bloques, plantillas, disponibilidad docente, horarios de grupo, sesiones de clase, cambios controlados, cobertura y carga docente. La fuente funcional es el Plan Maestro y el diseño aprobado para el Bloque 3.

No incluye asistencia, retardos, sustituciones, calificaciones, tareas, comunicaciones, pagos, aulas virtuales, exámenes, eventos, optimización automática, inteligencia artificial ni panel administrativo.

## Decisiones confirmadas

- El horario pertenece a un periodo académico y cada grupo puede tener varias sesiones por día.
- Cada sesión enlaza una oferta del mismo grupo y periodo con una asignación docente válida, un turno, un bloque y un espacio.
- La programación es manual; solo las validaciones de integridad y conflictos son automáticas.
- No se permiten cruces de grupo, docente o espacio.
- El horario se versiona y conserva históricamente; una versión publicada no se edita de forma destructiva.
- La asistencia futura podrá vincularse por materia y sesión, y `is_first_period` identifica la primera hora sin implementar todavía retardos.
- El modelo admite distintos turnos por grupo y múltiples edificios o espacios.

## Decisiones pendientes

No se fijan nombres o aforos oficiales de espacios, cantidad de edificios, horas de entrada/salida, duración de clases, recesos, jornadas sabatinas o dominicales, máximos de horas consecutivas, carga docente máxima o mínima, horas contractuales, sesiones mínimas por materia, preferencias, salón fijo, calendarios especiales ni reglas institucionales definitivas de laboratorio. Los fixtures son exclusivamente sintéticos.

La política V1 considera disponible al docente salvo un bloqueo `UNAVAILABLE` explícito. `PREFERRED` es informativo. Una sesión `LABORATORY` exige un espacio del tipo `LABORATORY`; ambas decisiones quedan documentadas como provisionales y pendientes de ratificación institucional.

## Migración y modelo

La migración `20260720221750_create_academic_scheduling.sql`, creada con Supabase CLI, añade once tablas privadas en `academic`:

| Tabla                      | Responsabilidad                                     |
| -------------------------- | --------------------------------------------------- |
| `academic_shifts`          | Turnos intradía y su ciclo de vida.                 |
| `academic_spaces`          | Salones, laboratorios y otros espacios.             |
| `schedule_time_blocks`     | Periodos, primera hora y recesos por turno.         |
| `schedule_templates`       | Plantillas aprobables por turno y vigencia.         |
| `schedule_template_blocks` | Días ISO y bloques permitidos.                      |
| `teacher_availability`     | Disponibilidad declarada por periodo.               |
| `group_schedules`          | Versiones de horario por grupo.                     |
| `class_sessions`           | Clase, oferta, asignación, espacio, día y bloque.   |
| `schedule_change_requests` | Flujo formal para cambios posteriores.              |
| `schedule_commands`        | Idempotencia SHA-256 por actor, comando y clave.    |
| `schedule_events`          | Auditoría técnica append-only sin datos personales. |

Todas usan UUID y `timestamptz`, referencias `ON DELETE RESTRICT`, RLS habilitada, cero políticas y cero privilegios para `PUBLIC`, `anon` y `authenticated`. `academic` permanece fuera de los esquemas expuestos por Data API.

## Turnos, espacios y bloques

- Los turnos normalizan un código único, no cruzan medianoche en V1 y siguen `DRAFT → ACTIVE ↔ INACTIVE → RETIRED` conforme a la máquina cerrada autorizada.
- Los espacios admiten salón, laboratorio, taller, espacio multiuso u otro. Capacidad es opcional y positiva; `MAINTENANCE`, `INACTIVE` y `RETIRED` impiden sesiones nuevas.
- Los bloques pertenecen a un turno, tienen secuencia positiva, hora inicial/final, estado, indicador de primera hora e indicador de receso. Los bloques activos no se solapan y solo uno puede ser primera hora por turno.
- Un receso nunca puede recibir una sesión de clase. No se sembraron turnos, horas, salones ni recesos oficiales.

## Plantillas y disponibilidad

Las plantillas delimitan días ISO y bloques utilizables para un turno y una vigencia; no representan clases asignadas. Su ciclo cerrado es `DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → RETIRED`, con cancelación desde borrador o revisión. Los bloques de otro turno y los recesos se rechazan.

La disponibilidad docente se declara por periodo, día y bloque para cuentas `ACTIVE` con rol `DOCENTE`. `AVAILABLE` y `UNAVAILABLE` tienen efecto en V1; `PREFERRED` no concede autorización ni fuerza asignaciones. La cancelación conserva el historial.

## Horarios y sesiones

El horario de grupo contiene versiones positivas compatibles con el grupo, periodo y plantilla. Solo puede existir una versión `PUBLISHED` por grupo. Sus estados son `DRAFT`, `UNDER_REVIEW`, `APPROVED`, `PUBLISHED`, `CLOSED` y `CANCELLED` con transiciones cerradas.

Cada sesión enlaza horario, oferta, asignación, espacio, día y bloque. Solo admite `REGULAR_CLASS`, `LABORATORY` y `WORKSHOP`, con estados `PLANNED`, `ACTIVE`, `CANCELLED` y `ENDED`. Se validan periodo, vigencias, oferta, asignación activa, cuenta docente activa, plantilla, receso, disponibilidad y compatibilidad de laboratorio. No existen tipos de examen, tutoría, sustitución o clase extraordinaria.

## Carga docente y cobertura

`get_teacher_workload_summary` calcula ofertas, grupos, sesiones y minutos semanales, distribución por día, estados y conflictos sin persistir totales derivados. `validate_teacher_workload` comprueba cruces, disponibilidad y asignación, pero no inventa límites de horas.

`validate_group_schedule_coverage` devuelve únicamente `valid`, ofertas sin sesiones, conflictos y sesiones inválidas. No exige un mínimo de sesiones por materia porque esa regla institucional continúa pendiente.

## Cambios, publicación y cierre

Las solicitudes controladas cubren alta, movimiento, cambio de espacio, cambio entre asignaciones activas de la misma oferta, cancelación y reemplazo de horario. No implementan docentes suplentes. El flujo es cerrado desde borrador hasta aplicación, rechazo, cancelación o expiración.

Publicar exige un horario aprobado y cobertura válida, bloquea versiones competidoras y deja una sola versión publicada. Cerrar conserva la versión como historia inmutable. Los movimientos y cambios posteriores requieren una solicitud aprobada y generan auditoría.

## Reglas y estados

- Los turnos V1 no cruzan medianoche. Sus estados son `DRAFT`, `ACTIVE`, `INACTIVE` y `RETIRED`.
- Los espacios son `CLASSROOM`, `LABORATORY`, `WORKSHOP`, `MULTIPURPOSE` u `OTHER`; mantenimiento, inactividad y retiro impiden sesiones nuevas.
- Los bloques activos no se solapan dentro del turno, solo uno puede ser primera hora y un receso no recibe clases.
- La convención de día es ISO: 1 lunes y 7 domingo. La plantilla debe declarar cada combinación utilizable.
- La ausencia de disponibilidad declarada significa disponible; `UNAVAILABLE` bloquea y `PREFERRED` es informativo. Esta es una decisión provisional.
- Solo existe una versión `PUBLISHED` por grupo. `CLOSED` es histórico e inmutable.
- Las sesiones admiten solo `REGULAR_CLASS`, `LABORATORY` y `WORKSHOP`. `LABORATORY` exige un espacio `LABORATORY` en V1.
- No se fijan máximos/mínimos de carga, horas contractuales, pago por hora ni sesiones semanales mínimas, porque no están confirmados.

Las máquinas de estado son cerradas: una transición no enumerada produce un error estable. Las mutaciones directas de terminales, comandos completados y eventos se bloquean; no se permite `DELETE`.

## Conflictos y concurrencia

La validación ocurre dentro de PostgreSQL. Combina índices parciales, locks de filas, advisory locks transaccionales y una barrera de escritura en `class_sessions`. Se impiden cruces por grupo, docente o espacio dentro del mismo periodo, día y bloque. Activar una sesión coordina locks con la asignación y el espacio; mantenimiento o finalización docente no pueden dejar una sesión activa inconsistente.

La suite `schedule-concurrency.test.mjs` usa conexiones independientes y cubre doce carreras: grupo, docente, espacio, ocupación exclusiva, dos versiones publicadas, movimiento, cierre de periodo, mantenimiento, fin de asignación, idempotencia, cambio de salón y publicación frente a cierre.

## Idempotencia, auditoría e inmutabilidad

Cada mutación calcula en servidor una huella SHA-256 canónica y registra actor, tipo de comando y clave idempotente. La misma clave y carga devuelve el resultado previo; una carga distinta falla con `IDEMPOTENCY_CONFLICT`. No se duplican entidades ni eventos.

`schedule_events` es append-only y registra entidad, periodo/horario cuando aplica, evento, actor, estados, razón, clave y correlación. No almacena nombres, correos, identificadores institucionales, JWT, cookies, tokens, IP completa ni JSON arbitrario.

Se prohíbe `DELETE`. También se protegen estados terminales, comandos completados y eventos, y no se pueden alterar directamente los campos estructurales de horarios publicados o cerrados ni de sesiones finalizadas o canceladas.

## Autorización y seguridad

Se agregaron exactamente diecisiete permisos cerrados para turnos, espacios, bloques, plantillas, horarios, disponibilidad, carga y cambios. `SUPERADMIN` y `ADMINISTRATIVO` reciben la administración prevista. `CONTROL_ESCOLAR` recibe solo horarios, aprobación/publicación explícitas, disponibilidad, carga y cambios. `DOCENTE`, `CAJA`, `ALUMNO`, `TUTOR` y `ASPIRANTE` no reciben mutaciones del bloque.

Cada mutación deriva el actor de `auth.uid()`, exige cuenta `ACTIVE`, `session_version` vigente, aplicación administrativa, MFA y AAL2, y valida el permiso exacto. Ninguna función acepta actor, AAL, versión de sesión o huella suministrados por el cliente. No existen escrituras ni triggers en Auth, RPC administrativas en `public`, secretos o conexión remota.

## RLS y privilegios

Las once tablas tienen RLS habilitada y cero políticas. `PUBLIC`, `anon` y `authenticated` no poseen privilegios de esquema, tabla, secuencia o función sobre esta superficie. Las operaciones institucionales permanecen internas en `academic`; no se añadieron funciones administrativas en `public` y el esquema no se expone por Data API.

## Contrato TypeScript

`@preparatoria/supabase/academic-scheduling` es un subpath `server-only`. Expone catálogos cerrados, validadores de código/día/hora, comandos tipados, resultados mínimos y un puerto de persistencia inyectable. No expone `SupabaseClient`, datos personales ni capacidades generales del SDK.

## Pruebas

| Suite                                       | Evidencia                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `academic-scheduling.test.sql`              | Plan pgTAP de 75 aserciones: estructura, enums, RLS, privilegios, funciones, estados, SHA-256, inmutabilidad, Auth intacto y reversión por transacción. |
| `academic-scheduling-local.test.mjs`        | Flujo institucional de 49 pasos con fixtures sintéticos y rollback.                                                                                     |
| `schedule-concurrency.test.mjs`             | 12 carreras reales con conexiones PostgreSQL independientes.                                                                                            |
| `packages/supabase/tests/supabase.test.mjs` | Barrera cliente/servidor, catálogos, validación, puerto y resultados mínimos.                                                                           |
| `packages/authz/tests/authz.test.mjs`       | Catálogo y matriz de los permisos nuevos sin wildcard ni strings libres.                                                                                |

## Reversión

Solo se valida en la base local descartable. El procedimiento es retirar temporalmente la migración 16, reiniciar para comprobar los hitos de Fase 2 (287), Bloque 1 (388) y Bloque 2 (466), y reaplicar después la migración completa. No se ejecutan `supabase link`, `db push` ni `db pull`, y no se modifican los hashes de las quince migraciones históricas.

## Riesgos y pendientes

- La política por defecto de disponibilidad y la compatibilidad estricta de laboratorios deben ratificarse institucionalmente.
- La barrera de conflictos prioriza consistencia sobre throughput; debe observarse con volúmenes reales antes de optimizarla.
- La cantidad oficial de sesiones por materia y los límites contractuales de carga siguen pendientes; el sistema no los inventa.
- La lectura propia para docentes/alumnos y la declaración propia de disponibilidad quedan para bloques autorizados posteriores.

## Fuera de alcance

No se generaron horarios automáticamente, no se inventaron horas oficiales, no se implementaron asistencia, retardos, justificaciones, prefectura, sustituciones, calificaciones, materiales, comunicación, pagos, salones virtuales, exámenes, eventos, calendarios, cargas masivas, optimización o IA. Tampoco se conectó Supabase remoto ni se avanzó al Bloque 4.
