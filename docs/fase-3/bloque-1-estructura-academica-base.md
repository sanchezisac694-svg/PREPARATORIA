# Fase 3 — Bloque 1: estructura académica base

## Objetivo y alcance

El bloque establece el núcleo versionable y auditable de ciclos, periodos, planes de seis semestres, áreas, materias, unidades, grupos, ofertas y asignaciones docentes. El dominio vive en el esquema interno `academic` y solo referencia `core.accounts` para actores y docentes.

No se cargaron materias ni datos institucionales reales. Las únicas semillas son las cuatro áreas confirmadas: Físico-Matemáticos, Ciencias Sociales, Químico-Biólogos y Económico-Administrativos, todas desde quinto semestre.

## Migraciones

| Migración                              | Responsabilidad                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `create_academic_structure`            | Esquema, tipos, trece tablas, constraints, índices, RLS y áreas confirmadas.               |
| `harden_academic_structure`            | Autorización AAL2, idempotencia persistente y las diecinueve mutaciones iniciales.         |
| `complete_academic_structure_controls` | Estados intermedios, SHA-256, auditoría completa, inmutabilidad y serialización de cierre. |

Las once migraciones de las Fases 1 y 2 permanecen sin cambios.

## Máquinas de estado

| Entidad         | Transiciones permitidas                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Ciclo y periodo | `DRAFT → PLANNED → ACTIVE → CLOSING → CLOSED`; cancelación desde `DRAFT` o `PLANNED`.             |
| Plan            | `DRAFT → UNDER_REVIEW → APPROVED → ACTIVE → RETIRED`; cancelación desde `DRAFT` o `UNDER_REVIEW`. |
| Grupo           | `DRAFT → PLANNED → OPEN → ACTIVE → CLOSED`; cancelación desde `DRAFT`, `PLANNED` u `OPEN`.        |
| Oferta          | `DRAFT → PLANNED → ACTIVE → CLOSED`; cancelación desde `DRAFT` o `PLANNED`.                       |
| Asignación      | `PLANNED → ACTIVE → ENDED`; cancelación desde `PLANNED`.                                          |

Las funciones de planeación, revisión, apertura, inicio de cierre, cierre, retiro y cancelación bloquean la fila mediante `FOR UPDATE`, validan la transición exacta y fallan ante cualquier salto no listado. El cierre de un periodo exige que sus ofertas estén `CLOSED` o `CANCELLED`; una oferta solo puede activarse con periodo y grupo `ACTIVE`.

## Autorización y contratos

Todas las mutaciones resuelven el actor desde `auth.uid()` y comprueban cuenta `ACTIVE`, `session_version`, MFA, AAL2 y permiso explícito. Los contratos TypeScript no aceptan actor, AAL, versión de sesión ni huella, no exportan `SupabaseClient` y solo devuelven identificador, operación y estado.

`SUPERADMIN` y `ADMINISTRATIVO` conservan las facultades explícitas definidas; `CONTROL_ESCOLAR` administra grupos, ofertas y asignaciones, pero no aprueba planes. CAJA y los roles del Portal no obtienen acceso administrativo.

## Idempotencia SHA-256

Las operaciones nuevas construyen en PostgreSQL una huella SHA-256 hexadecimal de 64 caracteres mediante `extensions.digest`. El payload se representa como `jsonb`, por lo que el orden de claves es canónico; no se almacena el payload ni se acepta una huella del cliente. Un reintento con la misma operación devuelve el resultado previo sin duplicar auditoría y una huella distinta para la misma clave produce `IDEMPOTENCY_CONFLICT`.

La constraint admite temporalmente las huellas MD5 de 32 caracteres creadas por las diecinueve operaciones de la migración de endurecimiento. Esta compatibilidad evita reinterpretar registros que pudieran existir fuera de una base descartable; todas las operaciones añadidas en la tercera migración exigen 64 caracteres y no contienen MD5.

## Auditoría e inmutabilidad

Cada mutación exitosa genera exactamente un evento principal con actor de sesión, entidad, estado anterior, estado resultante y clave idempotente. Los reintentos no agregan eventos. La auditoría no admite payload arbitrario y sus filas son append-only.

Los trece registros/tablas de historia académica están protegidos por FKs `ON DELETE RESTRICT`, triggers de rechazo o ambos. Se rechaza el `DELETE` directo; también se protegen ciclos y periodos `CLOSED`, planes `APPROVED`, `ACTIVE` o `RETIRED`, grupos y ofertas `CLOSED`, asignaciones `ENDED`, códigos de áreas, eventos y comandos completados. Las funciones controladas habilitan un bypass transaccional interno únicamente alrededor de su actualización validada.

## Seguridad de base de datos

- Las trece tablas tienen RLS habilitada y cero políticas.
- `academic` no se expone por Data API.
- `PUBLIC`, `anon` y `authenticated` no tienen `USAGE`, grants de tablas ni ejecución de funciones.
- Todas las funciones fijan `search_path = ''`; los helpers sin privilegios son `SECURITY INVOKER`.
- No hay vistas ni funciones académicas en `public`, escrituras productivas en Auth, secretos, HTTP o conexión remota.

## Pruebas

La suite `academic-structure.test.sql` declara y emite 101 aserciones pgTAP; junto con las 287 históricas, `supabase test db` ejecuta 388 aserciones. Cubre objetos, catálogos, transiciones válidas e inválidas, SHA-256 canónico, ausencia de MD5 en operaciones nuevas, guards, RLS, grants, Data API y ausencia de funciones públicas.

La prueba integrada recorre los 46 puntos solicitados dentro de una transacción reversible: ciclo, dos periodos, plan, seis semestres, materias, tres unidades, revisión/aprobación, grupos comunes y de área, ofertas compatibles e incompatibles, docente PRIMARY, cierre, auditoría, idempotencia, conflicto, roles, AAL2 y `session_version`.

La prueba concurrente usa conexiones PostgreSQL independientes, constraints y bloqueos reales. Comprueba:

1. código de grupo duplicado;
2. segundo docente `PRIMARY`;
3. activación simultánea de ciclo;
4. periodos solapados;
5. cierre de periodo frente a activación de oferta.

En cada carrera persiste un único resultado válido, no se duplica la auditoría y el estado final es fail-closed. Un retardo corto de 150 ms se usa solo para mantener el bloqueo de fila ya adquirido en la quinta carrera; la exclusión depende del bloqueo PostgreSQL y no del tiempo. Los fixtures se eliminan en `finally` con IDs sintéticos.

## Reversión

La reversión se valida retirando temporalmente las tres migraciones académicas, reconstruyendo la base y ejecutando las 287 aserciones históricas. Después se restauran las tres migraciones, se reconstruye nuevamente y se ejecutan las 388 aserciones completas. No se elimina ni reescribe ninguna migración.

## Riesgos y decisiones pendientes

Permanecen abiertas, sin suposiciones: claves y lista oficial de materias, fechas institucionales, nomenclatura y cantidad de grupos, cargas docentes, turno, modalidad, horas, créditos, equivalencias, seriación, optativas, extracurriculares y regla definitiva de área en sexto semestre.

La compatibilidad temporal con huellas MD5 históricas debe retirarse en una migración futura solo después de confirmar que no existen comandos persistidos con 32 caracteres. El adaptador productivo del puerto TypeScript y la exposición controlada de operaciones permanecen fuera de este bloque.

## Fuera de alcance

No se implementaron alumnos, aspirantes, inscripción, calificaciones, promedios, asistencia, horarios, pagos, documentos, tareas, notificaciones, sustituciones, carga masiva ni panel administrativo. No hubo conexión remota, commit, push ni trabajo del Bloque 2.
