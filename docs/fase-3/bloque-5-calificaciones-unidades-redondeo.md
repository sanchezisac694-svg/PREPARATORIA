# Fase 3 — Bloque 5: calificaciones por unidades, redondeo y decisión académica

## Objetivo y alcance

Este bloque incorpora ventanas de captura, exactamente tres calificaciones de unidad por materia, revisión y finalización docente, resultados AC/NA, redondeo institucional, correcciones controladas, consolidación semestral, propuesta de progreso, auditoría, idempotencia y concurrencia. El dominio permanece en el esquema privado `academic` y reutiliza identidad, trayectoria, ofertas, unidades, asignaciones docentes y `academic_progress_decisions`.

Referencia funcional: Plan Maestro, reglas de calificaciones; autorización de Fase 3, Bloque 5, apartados 2 a 28.

## Reglas confirmadas

- Escala decimal de 0 a 10 y mínima aprobatoria 6.
- Cada materia tiene exactamente tres unidades.
- Una unidad es acreditada con nota mayor o igual a 6.
- La materia es `AC` cuando acredita al menos dos de tres unidades y `NA` con menos de dos.
- El criterio 2-de-3 es independiente de una nota numérica final.
- Captura, revisión y finalización corresponden al docente de la oferta activa.
- Toda mutación exige cuenta activa, AAL2, `session_version` vigente y permiso explícito.
- La decisión de progreso requiere confirmación institucional y reutiliza `academic.academic_progress_decisions` cuando existe una propuesta confirmable.

## Reglas pendientes

No se definieron ponderaciones, promedio aritmético o ponderado, asistencia como componente, extraordinarios, recuperación, regularización, máximo de materias NA, repetición por una sola materia, promoción condicionada, sexto semestre, captura extemporánea, firma, fechas oficiales, sustitución docente, cierre automático, autorización de Dirección ni publicación. Esas situaciones producen `MANUAL_REVIEW_REQUIRED` y no una decisión inventada.

## Modelo

| Tabla                           | Responsabilidad                                               |
| ------------------------------- | ------------------------------------------------------------- |
| `grade_capture_windows`         | Ventanas UNIT_CAPTURE, FINAL_REVIEW o CORRECTION.             |
| `student_unit_grades`           | Nota única por inscripción de oferta y unidad 1–3.            |
| `student_unit_grade_history`    | Versiones append-only de captura, estado y corrección.        |
| `subject_final_results`         | Conteos 2-de-3, AC/NA y nota numérica nullable.               |
| `subject_result_history`        | Historia de cálculo, confirmación y recálculo.                |
| `semester_evaluation_summaries` | Consolidación derivada del servidor por matrícula y semestre. |
| `grade_corrections`             | Flujo controlado de corrección.                               |
| `grade_commands`                | Idempotencia y huella SHA-256.                                |
| `grade_events`                  | Auditoría mínima append-only.                                 |

Todas usan UUID, `timestamptz`, claves foráneas `ON DELETE RESTRICT`, RLS y cero acceso directo de aplicación.

## Ventanas y captura

Las ventanas siguen `DRAFT → OPEN → CLOSED` y permiten cancelación autorizada. Una ventana de unidad requiere `unit_number` entre 1 y 3; revisión final y corrección lo mantienen nulo. No se inventaron fechas oficiales. La captura verifica ventana abierta, inscripción activa, compatibilidad de oferta/unidad y asignación docente. Existe captura individual y masiva controlada; una cuarta unidad es rechazada por catálogo y constraints.

`capture_bulk_unit_grades` es exclusivamente una operación interna, transaccional y limitada a registros previamente validados. No importa CSV, Excel ni archivos externos; no constituye una interfaz administrativa de carga masiva, no crea alumnos, ofertas o unidades, no omite autorización o idempotencia y falla el lote completo si un elemento es inválido. El lote no puede mezclar ofertas, periodos o docentes.

## Revisión, finalización y estados

Las notas siguen `CAPTURED → REVIEWED → FINALIZED`; una nota finalizada solo pasa a `CORRECTED` mediante corrección aprobada. Las transiciones no declaradas son rechazadas. Una nota finalizada no se edita directamente y cada cambio conserva una versión histórica.

## Redondeo institucional

`academic.apply_institutional_grade_rounding(raw_grade)` implementa expresamente los cortes, sin sustituirlos por redondeo genérico:

- `x ≤ n + 0.25` baja a `n`.
- `n + 0.25 < x ≤ n + 0.75` produce `n + 0.5`.
- `x > n + 0.75` sube a `n + 1`.
- Aplica a valores aprobatorios entre 6 y 10.
- **5.95 no sube a 6**: permanece 5.95.

Los límites 6.25/6.26, 6.75/6.76 y sus equivalentes en 7, 8 y 9 se prueban con pgTAP. La ambigüedad de precisión para notas reprobatorias sigue pendiente; la implementación conserva hasta tres decimales y nunca las eleva a 6.

## Resultado de materia y nota numérica

Se requieren tres unidades `FINALIZED` o `CORRECTED`. Dos o tres unidades acreditadas producen `AC`; cero o una producen `NA`. `raw_final_grade` y `rounded_final_grade` permanecen nulos y `calculation_status` queda `MANUAL_REVIEW_REQUIRED`. Por tanto, AC/NA está separado de la nota final numérica y no se inventó un promedio oficial.

## Resumen semestral y decisión

Los conteos se derivan exclusivamente de inscripciones a ofertas del mismo `period_enrollment`; el cliente no aporta totales. Resultados faltantes producen `INCOMPLETE`. Incluso con resultados completos, la ausencia de política de promoción produce `MANUAL_REVIEW_REQUIRED`. La confirmación rechaza esa propuesta hasta que exista una política institucional; cuando la propuesta sea confirmable creará la decisión en `academic_progress_decisions`, sin duplicar el sistema existente.

## Correcciones

El flujo es `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED` y `APPROVED → APPLIED`. Aplicar conserva nota y estado previos, actualiza acreditación, marca la unidad `CORRECTED` y permite recalcular materia y semestre sin borrar decisiones históricas confirmadas.

## Autorización

- `SUPERADMIN`: todas las capacidades explícitas.
- `ADMINISTRATIVO`: ventanas, consulta, revisión, corrección y confirmación.
- `CONTROL_ESCOLAR`: ventanas, consulta, revisión, corrección, consolidación y confirmación.
- `DOCENTE`: captura, revisión y finalización solo de ofertas propias activas.
- `PREFECTURA`, `CAJA` y `ASPIRANTE`: sin acceso.
- Lectura futura de Alumno/Tutor no se expone en este bloque.

## Idempotencia, concurrencia y auditoría

Las veinte mutaciones usan `grade_commands`: almacenan actor, tipo, clave, huella SHA-256 y resultado mínimo. Misma clave, actor, tipo y carga devuelve exactamente el resultado previo; otra huella produce `IDEMPOTENCY_CONFLICT`. Los reintentos no duplican eventos ni historial y los comandos completados son inmutables.

Dieciocho carreras con conexiones PostgreSQL independientes cubren los quince escenarios originales y, expresamente, corrección frente a cálculo, corrección frente a confirmación y dos decisiones de progreso. Si la corrección gana al cálculo, este usa la unidad corregida; si el cálculo gana, el resultado queda `CORRECTED` y exige recálculo. Frente a confirmación, solo puede persistir `CONFIRMED/APPROVED` o `CORRECTED/APPLIED`. Dos decisiones dejan exactamente una confirmada y la competidora falla con `PROGRESS_DECISION_CONFLICT`. Eventos e historiales son append-only y no contienen nombres, correos, JWT, tokens ni payload arbitrario.

## Inmutabilidad, RLS y Data API

Triggers rechazan DELETE y UPDATE directo de registros protegidos. Las nueve tablas tienen RLS habilitada, cero policies y cero grants para `PUBLIC`, `anon` y `authenticated`. `academic` continúa fuera de Data API; las funciones controladas tienen `search_path` fijo y no se publican como RPC administrativas.

## Pruebas y reversión

La suite incluye 139 aserciones pgTAP del bloque: conserva las 79 defensas estructurales y añade 60 comprobaciones funcionales identificables para ventanas, límites, captura, estados, 2-de-3, nota nullable, revisión manual, idempotencia, correcciones, historia, auditoría, Auth e inmutabilidad. También contiene pruebas TypeScript del contrato server-only, una integración local ampliada sin reducir sus 40 controles y dieciocho carreras reales. La reversión reconstruye los hitos 287, 388, 466, 541 y 616 antes de restaurar las migraciones base y de endurecimiento del Bloque 5. Las diecisiete migraciones anteriores y la migración base del Bloque 5 conservan sus hashes.

## Riesgos y fuera de alcance

La futura política de promedio o promoción requerirá una migración aditiva. Una corrección posterior a una decisión confirmada debe usar la reversión controlada existente. No se implementó importación masiva desde archivos ni una interfaz de carga masiva; sí existe la operación interna por lote requerida para atomicidad y eficiencia. No se implementaron boletas, kardex visible, certificados, extraordinarios, regularización, recuperación, tareas, rúbricas, asistencia en nota, pagos, portal completo, notificaciones reales ni datos reales. No hubo conexión remota, commit ni push.
