# Fase 3 — Bloque 2: inscripción y trayectoria del alumno

## Objetivo y alcance

Este bloque incorpora al esquema privado `academic` el expediente académico institucional, generaciones, solicitudes de inscripción y reinscripción, matrícula por periodo, asignación manual de grupo, ofertas obligatorias, decisiones manuales de progreso, bajas, historial, auditoría, autorización, idempotencia y control de concurrencia. Se enlaza con `core.people`, `core.accounts` y la estructura académica del Bloque 1 sin duplicar identidades, planes, ciclos, periodos, grupos, materias u ofertas.

No se implementaron aspirantes, admisión, conversión automática a alumno, lista de espera, pagos, becas, adeudos, calificaciones, unidades capturadas, promedios, redondeo, aprobación automática, asistencia, horarios, tareas, documentos, kardex visible, portales completos, notificaciones, carga masiva ni conexión remota.

## Decisiones confirmadas

- La preparatoria tiene seis semestres; cada matrícula pertenece a un único semestre y no mezcla materias.
- Las materias son fijas, obligatorias y sin optativas en la versión 1.
- Control Escolar realiza manualmente la asignación de grupo; no existe lista de espera.
- El avance o la repetición requiere una decisión académica explícita. Al no existir calificaciones, nunca se calcula aprobación automática.
- Un resultado de repetición conserva el semestre y exige esperar un periodo compatible posterior.
- Las áreas empiezan en quinto semestre y usan el catálogo del Bloque 1: `FISICO_MATEMATICOS`, `CIENCIAS_SOCIALES`, `QUIMICO_BIOLOGOS` y `ECONOMICO_ADMINISTRATIVOS`.
- Químico-Biólogos puede tener varios grupos. La capacidad nula significa que este bloque no inventa un límite.
- El expediente y todos sus movimientos conservan historia aunque una cuenta se desactive.
- `COMPLETED` significa semestres concluidos; `GRADUATED` queda separado para una validación institucional y documental posterior.

## Pendientes institucionales

Permanecen sin suposición: formato oficial de matrícula o número de control, fecha límite y requisitos documentales de inscripción, reglas económicas, descuentos, becas, edad mínima, máximos de reinscripciones o repeticiones, cambio de área, equivalencias, convalidaciones, regularización, extraordinarios, recuperación académica, bajas por inasistencia o adeudo, seriación, movilidad, traslado, cambio de plan, reingreso después de baja definitiva y proceso formal de titulación o egreso.

## Modelo persistente

La migración `20260720213106_create_student_enrollment_trajectory.sql` agrega diez tablas UUID con `timestamptz`, claves foráneas `ON DELETE RESTRICT`, RLS habilitada, cero políticas y cero privilegios para `PUBLIC`, `anon` y `authenticated`:

| Tabla                                   | Responsabilidad                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `academic.student_generations`          | Cohorte de ingreso, plan y ciclos esperados.                                         |
| `academic.student_records`              | Expediente único, persona/cuenta ALUMNO, plan, generación, semestre y área actuales. |
| `academic.enrollment_requests`          | Solicitud previa, elegibilidad cerrada y trazabilidad de revisión.                   |
| `academic.period_enrollments`           | Matrícula histórica por periodo, semestre, área y grupo.                             |
| `academic.student_group_assignments`    | Asignación manual activa e historial de cambios.                                     |
| `academic.student_offering_enrollments` | Ofertas obligatorias derivadas del grupo.                                            |
| `academic.academic_progress_decisions`  | Decisión manual de avance, repetición, hold, baja o conclusión.                      |
| `academic.student_status_history`       | Historial mínimo append-only del expediente.                                         |
| `academic.enrollment_commands`          | Idempotencia persistente por actor, operación y clave.                               |
| `academic.student_academic_events`      | Auditoría técnica append-only de mutaciones.                                         |

Los códigos institucionales son texto y conservan ceros iniciales; su formato definitivo sigue pendiente. Los índices parciales impiden más de un expediente operativo por persona, más de una matrícula operativa por alumno y periodo, más de una asignación activa por matrícula y más de una decisión confirmada por periodo fuente.

## Estados y transiciones

- Expediente: `DRAFT → ACTIVE`; desde `ACTIVE` se permite baja temporal, hold, conclusión o baja definitiva; baja temporal y hold regresan únicamente a `ACTIVE`; `COMPLETED → GRADUATED`; `DRAFT → CANCELLED`.
- Generación: `DRAFT → ACTIVE → CLOSED`.
- Solicitud: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ENROLLED`; también contempla rechazo, cancelación y expiración en los puntos declarados.
- Matrícula: `PLANNED → ACTIVE`; activa puede suspenderse temporalmente, completarse, cancelarse de forma correctiva o retirarse; una suspensión puede reactivarse.
- Decisión: `DRAFT → CONFIRMED`; borrador puede cancelarse y una confirmada solo puede marcarse `REVERSED` mediante operación controlada.
- Asignación de grupo: la activa termina o se cancela correctivamente; un cambio crea una asignación nueva y conserva la anterior.

Toda transición no enumerada falla cerrada. Los registros terminales, eventos, historiales y comandos completados se protegen contra mutación; las diez tablas rechazan eliminación directa.

## Elegibilidad, avance y bajas

La elegibilidad usa estados y razones cerrados. Reinscripción, repetición y reingreso elegibles requieren una decisión `CONFIRMED` para el periodo efectivo. `ADVANCE` incrementa exactamente uno y nunca produce semestre 7; `REPEAT` conserva semestre; `HOLD` impide nuevas solicitudes; `COMPLETE_STUDIES` solo opera desde sexto semestre. `ACADEMIC_RESULT_PENDING` se conserva hasta que un bloque futuro calcule resultados académicos.

La baja temporal serializa sobre el expediente con la activación de matrícula: si existe una matrícula activa, la baja se rechaza; si la baja gana, una activación concurrente observa el expediente no activo y falla. La baja definitiva exige `academic.withdrawals.manage`, permiso no concedido a `CONTROL_ESCOLAR` en esta etapa.

## Grupo, capacidad, ofertas y cobertura

La matrícula y la asignación validan periodo, plan, semestre y área. La capacidad se comprueba mientras el grupo está bloqueado; solicitudes aprobadas no reservan cupo y no se crea lista de espera. Un cambio bloquea matrícula y grupos, termina la asignación previa, actualiza el grupo, cancela ofertas previas y, si la matrícula está activa, reconstruye las ofertas del grupo nuevo en la misma transacción.

`academic.validate_group_curriculum_coverage(group_id)` compara por catálogo todas las materias curriculares activas y obligatorias del plan, semestre y área con las ofertas activas del grupo. Solo considera completa una materia con exactamente tres unidades. La activación crea todas las inscripciones a ofertas en una transacción y revierte por completo ante cobertura incompleta; no existe selección aislada por alumno.

## Autorización y aislamiento

Las operaciones sensibles exigen sesión institucional válida, cuenta `ACTIVE`, `session_version` vigente, MFA satisfecha y AAL2. `SUPERADMIN` y `ADMINISTRATIVO` reciben los permisos explícitos del bloque. `CONTROL_ESCOLAR` administra expedientes, solicitudes, matrículas, grupos y decisiones, pero no la baja definitiva. `CAJA`, `DOCENTE`, `TUTOR`, `ALUMNO` y `ASPIRANTE` no reciben mutaciones.

Todas las funciones fijan `search_path=''`, califican referencias, carecen de SQL dinámico y revocan `EXECUTE` a roles de aplicación. El esquema `academic` no está en `pgrst.db_schemas`; no se agregaron funciones administrativas a `public`, políticas RLS, triggers en Auth ni escrituras productivas en `auth.users`.

## Idempotencia, auditoría e inmutabilidad

Cada operación registra un comando por actor, tipo y `idempotency_key`. La huella se calcula server-side con SHA-256 canónico: misma clave y misma huella devuelve la entidad previa; una huella distinta produce `IDEMPOTENCY_CONFLICT`. Las nuevas operaciones no aceptan MD5.

Las mutaciones generan eventos mínimos sin datos personales, calificaciones, adeudos, documentos ni JSON arbitrario. `student_status_history` y `student_academic_events` son append-only. Los cambios de grupo y las reversiones conservan el registro anterior; no existen borrados destructivos.

## Contrato TypeScript server-only

`@preparatoria/supabase/student-enrollment` expone un catálogo cerrado de 31 operaciones, 41 errores, mapeo a funciones SQL, normalización de código que preserva ceros, validación de semestre y un puerto de persistencia. Importa `server-only`, no acepta actor, AAL, `sessionVersion` ni huella, no exporta `SupabaseClient`, no retorna filas completas ni datos personales y normaliza fallos desconocidos a un mensaje público genérico.

## Pruebas

- `student-enrollment.test.sql`: plan pgTAP exacto de 78 aserciones sobre esquema, tablas, enums, RLS, políticas, grants, Data API, SHA-256, restricciones, índices, transiciones, funciones, `search_path` y privilegios; usa transacción y `ROLLBACK`.
- `student-enrollment-local.test.mjs`: recorrido reversible de 43 pasos con actores sintéticos, generación, expediente, solicitud inicial, matrícula, ofertas, avance, reinscripción, repetición, hold, bajas, cambio de grupo, capacidad, autorización, AAL2, `session_version`, idempotencia, auditoría e inmutabilidad.
- `student-enrollment-concurrency.test.mjs`: diez carreras con conexiones PostgreSQL independientes para matrícula duplicada, último cupo, asignación activa, cambio simultáneo, cierre de periodo, cierre de grupo, decisión confirmada, clave idempotente, ofertas y baja frente a activación. Los fixtures se limpian siempre en `finally`.
- Las pruebas de `packages/authz` verifican catálogo y matriz. Las de `packages/supabase` verifican barrera server-only, exports públicos, 31 operaciones, 41 errores, entradas y resultados mínimos.

## Reversión

La reversión se valida solo contra la base local descartable: retirar temporalmente todas las migraciones de Fase 3 y obtener 287 aserciones; restaurar las tres migraciones del Bloque 1 y obtener 388; restaurar la migración del Bloque 2 y ejecutar el total actualizado. Los archivos se mueven únicamente a un directorio temporal externo y se restauran en `finally`. Los hashes de las once migraciones de Fase 2 y las tres del Bloque 1 deben permanecer intactos.

## Riesgos

- Las reglas definitivas de matrícula, fechas, documentos, economía, repeticiones, áreas, equivalencias, regularización y egreso siguen pendientes.
- La decisión de progreso es manual hasta que exista el dominio de calificaciones; un procedimiento operativo institucional debe gobernarla.
- Capacidad nula queda deliberadamente sin límite. La institución debe definir cuándo será obligatoria.
- Las funciones son internas y no tienen grants de aplicación; un orquestador administrativo futuro deberá preservar actor derivado de sesión, AAL2 e idempotencia sin crear una RPC pública privilegiada.
- Las carreras prueban PostgreSQL local real; el comportamiento operativo debe volver a validarse cuando se defina infraestructura de producción, sin reutilizar datos ni credenciales reales.

No hubo conexión a un proyecto Supabase remoto.
