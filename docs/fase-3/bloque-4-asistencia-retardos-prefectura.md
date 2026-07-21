# Fase 3 — Bloque 4: asistencia, retardos, permisos y control de prefectura

## Objetivo y alcance

Este bloque incorpora el registro técnico de asistencia por sesión de clase, roster inmutable de alumnos inscritos, retardos por materia, validación de primera hora, alertas cada cuatro retardos válidos, permisos, correcciones controladas y auditoría append-only. La implementación reside en el esquema privado `academic`, reutiliza identidad, inscripción, oferta académica y horarios de los bloques anteriores y no crea datos personales duplicados.

Referencia funcional: Plan Maestro, reglas de asistencia y control de prefectura; diseño autorizado de Fase 3, Bloque 4, apartados 2 a 30.

## Decisiones confirmadas

- Existe un único estado operativo por alumno y sesión.
- El roster solo incluye una inscripción de periodo, oferta y grupo activas.
- El retardo pertenece a la sesión de una materia. La primera hora procede de `schedule_time_blocks.is_first_period`.
- Prefectura valida retardos y permisos. `SUPERADMIN` conserva facultad explícita de contingencia; no hay escalamiento implícito.
- El cuarto retardo válido de primera hora crea una alerta `PENDING_NOTIFICATION`, reinicia el contador operativo a cero y conserva el total histórico. Otros cuatro retardos válidos crean la siguiente alerta.
- Un permiso no elimina el registro original. Una corrección conserva historia y evento.
- No hay sanciones automáticas, sustituciones docentes ni notificaciones reales.

## Decisiones institucionales pendientes

Continúan sin resolver: porcentaje mínimo de asistencia; máximo de faltas; sanciones, suspensión o baja automática; tolerancia oficial y definición en minutos de retardo; ventanas de captura y corrección; responsable, canal, texto y acuse de notificación; reglas y justificantes médicos; permisos retroactivos; faltas colectivas; eventos, actividades especiales y exámenes; sustituciones, recuperación de clase y fuerza mayor. Ninguna de estas decisiones se codificó como regla definitiva.

## Modelo persistente

| Tabla                                | Responsabilidad                                                  |
| ------------------------------------ | ---------------------------------------------------------------- |
| `academic.attendance_sessions`       | Sesión de control vinculada a una clase y fecha.                 |
| `academic.attendance_records`        | Estado único de cada alumno incluido en el roster.               |
| `academic.attendance_record_history` | Historial append-only de capturas, permisos y correcciones.      |
| `academic.student_lateness_counters` | Contador operativo, total histórico y secuencia de alertas.      |
| `academic.lateness_alerts`           | Alerta institucional pendiente, registrada, acusada o cancelada. |
| `academic.student_permissions`       | Solicitud y ciclo de vida de un permiso.                         |
| `academic.permission_validations`    | Validaciones y revocaciones append-only de prefectura.           |
| `academic.attendance_corrections`    | Solicitud y aprobación de correcciones.                          |
| `academic.attendance_commands`       | Idempotencia, huella SHA-256 y resultado estable.                |
| `academic.attendance_events`         | Bitácora técnica append-only y correlacionable.                  |

Los catálogos cerrados cubren estados de sesión (`DRAFT`, `OPEN`, `CLOSED`, `CANCELLED`, `LOCKED`), asistencia (`NOT_RECORDED`, `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`), permisos, validaciones, correcciones, comandos y eventos. Las claves foráneas relevantes usan `ON DELETE RESTRICT`; no se enlaza directamente con `auth.users` cuando existe `account_id`.

## Sesiones, roster y asistencia

Las sesiones se crean en borrador, se pueblan desde la trayectoria vigente y siguen transiciones cerradas. Solo una sesión abierta admite captura. El roster queda asociado a inscripción, oferta y asignación de grupo; guardas impiden bajas o cambios concurrentes mientras existe una sesión activa. Los estados cerrados o bloqueados rechazan mutaciones incompatibles. La captura individual y masiva utiliza operaciones controladas e idempotentes y valida al docente contra su asignación.

## Retardos, primera hora y alertas

Un retardo requiere minutos positivos, pero este bloque no fija tolerancia oficial. Solo un `LATE` validado por `PREFECTURA` o `SUPERADMIN`, correspondiente a un bloque marcado como primera hora, incrementa `FIRST_PERIOD_VALIDATED`. Al llegar a cuatro, `lifetime_count` permanece acumulado, `current_count` vuelve a cero, `alert_sequence` aumenta y se crea una sola alerta. La alerta únicamente registra que una notificación es necesaria; no envía mensajes.

## Permisos y correcciones

Los permisos recorren `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED` y, desde aprobado, `APPLIED`; cancelación y expiración solo se admiten desde estados expresamente definidos. La aplicación de un permiso aprobado conserva el valor previo en historial. Las correcciones recorren revisión y aprobación antes de aplicarse, se rechazan sobre sesiones bloqueadas y ajustan el contador operativo si invalidan un retardo contado, sin borrar el total histórico ni el hecho auditado. Una validación revocada se representa mediante una nueva fila.

## Rol y autorización

Se añade el rol interno `PREFECTURA`, con etiqueta visible separada, acceso al Sistema Administrativo y permisos explícitos de lectura, gestión/validación de asistencia, validación de retardos y permisos, registro de notificación y lectura de auditoría. `DOCENTE` captura únicamente sesiones propias; `CONTROL_ESCOLAR` no sustituye a prefectura; `CAJA`, usuarios AAL1, sesiones obsoletas y cuentas no activas son rechazados. Las funciones productivas validan cuenta, rol, permiso, AAL2 y `session_version` antes de operar.

## API técnica

El subpath server-only `@preparatoria/supabase/attendance-management` publica catálogos, validadores, resultados mínimos y el puerto `AttendanceManagementPort`. No exporta el SDK completo ni crea un cliente administrativo. Las funciones SQL controladas abarcan crear/poblar/abrir/cerrar/bloquear/cancelar sesiones; captura individual y masiva; validación de retardos; ciclo de permisos; aplicación de justificantes; ciclo de correcciones; registro y acuse de alertas; y resúmenes e integridad.

## Idempotencia, concurrencia, auditoría e inmutabilidad

Cada comando registra actor, tipo, clave, huella SHA-256 y entidad resultante. Repetir la misma intención devuelve el resultado estable; reutilizar la clave con otra carga produce conflicto. Bloqueos de fila, restricciones únicas y guardas de dependencias protegen aperturas, roster, captura, cuarto retardo, validación, alertas, correcciones, bajas y cambios de grupo. Historial, validaciones y eventos rechazan edición o borrado directo; las mutaciones permitidas usan una ventana transaccional interna y dejan evento con actor, razón, clave y correlación.

## RLS y privilegios

Las diez tablas tienen RLS habilitada y no contienen políticas. `PUBLIC`, `anon` y `authenticated` no reciben privilegios directos sobre tablas, secuencias ni funciones. El esquema `academic` permanece fuera de la Data API; el acceso ocurre solamente mediante funciones controladas con `search_path` fijo. Las funciones auxiliares son `SECURITY INVOKER`; las fronteras controladas que requieren acceso interno son `SECURITY DEFINER` y revocadas a los roles de aplicación.

## Pruebas

La suite incluye pgTAP de catálogos, tablas, restricciones, índices, funciones, triggers, RLS y privilegios; pruebas TypeScript de contratos y barrera server-only; una integración local sintética de 46 pasos; y quince carreras reales con conexiones PostgreSQL independientes. Se comprueban sesiones, roster, estados, primera hora, cuarta incidencia, reinicio, lifetime, alertas, permisos, correcciones, autorización, idempotencia, conflicto, auditoría, inmutabilidad y ausencia de acceso directo. Todos los fixtures se revierten o eliminan y no contienen datos reales.

## Reversión

La reversión se valida solo sobre la base local descartable: reset a Fases 1–2 (287 aserciones), Bloque 1 (388), Bloque 2 (466), Bloque 3 (541) y restauración completa con Bloque 4. No se edita ni revierte una migración histórica; se elimina el efecto reconstruyendo la base hasta la versión objetivo y luego se restaura mediante `db reset`. Los hashes de las dieciséis migraciones previas deben permanecer intactos.

## Riesgos

- Las reglas institucionales pendientes pueden requerir nuevas migraciones y estados, nunca reinterpretación destructiva del historial.
- El registro de notificación no demuestra entrega por un canal externo ni acuse del tutor.
- La corrección de retardos conserva el lifetime como evidencia histórica; cualquier métrica normativa futura debe distinguir hechos registrados de incidencias vigentes.
- Las operaciones concurrentes dependen de ejecutar exclusivamente las funciones controladas; por eso no existen privilegios directos para las aplicaciones.

## Fuera de alcance

Quedan fuera porcentajes o sanciones, automatización de bajas, canales de notificación, carga de justificantes, sustituciones, actividades especiales, autenticación nueva, UI, rutas, datos reales y cualquier conexión a Supabase remoto. No se ejecutaron `supabase link`, `db push` ni `db pull`.
