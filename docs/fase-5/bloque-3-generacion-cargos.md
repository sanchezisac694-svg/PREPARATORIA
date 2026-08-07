# Fase 5 - Bloque 3: Programacion de cobros y generacion institucional de cargos

## Objetivo

Agregar una capa controlada para programar y ejecutar generacion masiva de cargos sin crear un ledger paralelo y manteniendo a `finance.student_charges` como unica fuente de verdad.

## Relacion academica

La elegibilidad reutiliza exclusivamente datos reales de:

- `academic.student_records`
- `academic.enrollment_requests`
- `academic.period_enrollments`
- `academic.groups`
- `academic.study_plans`

No se inventan estados academicos ni reglas de promocion.

## Relacion financiera

La generacion usa:

- `finance.charge_concepts`
- `finance.charge_rates`
- `finance.student_accounts`
- `finance.student_charges`
- `finance.financial_commands`
- `finance.financial_events`

El bloque no introduce saldos paralelos ni tablas de tarifas duplicadas.

## Source of truth

Los cargos reales viven solo en `finance.student_charges`.

Las tablas nuevas guardan:

- configuracion de reglas;
- versiones congeladas;
- previews y snapshots operativos;
- exclusions futuras;
- resultado operativo por batch.

## Reglas y versiones

Se agregan:

- `finance.charge_generation_rules`
- `finance.charge_generation_rule_versions`

Las reglas definen concepto y tipo de generacion. Las versiones congelan:

- periodo academico;
- plan;
- semestre;
- training area;
- tarifa efectiva;
- estrategia de vencimiento.

Una version `APPROVED` o `ACTIVE` queda inmutable mediante triggers.

## Elegibilidad

La evaluacion es determinista y fail-closed. Un item solo se procesa cuando:

- existe `student_record` valido;
- el `period_enrollment` es compatible;
- la cuenta financiera esta `ACTIVE`;
- existe tarifa aplicable;
- no hay exclusion activa;
- no existe cargo logico equivalente;
- no requiere revision manual.

Estados de elegibilidad:

- `ELIGIBLE`
- `ALREADY_CHARGED`
- `ACCOUNT_NOT_ACTIVE`
- `ENROLLMENT_NOT_ELIGIBLE`
- `NO_APPLICABLE_RATE`
- `EXPLICITLY_EXCLUDED`
- `MANUAL_REVIEW_REQUIRED`

## Preview

`finance.preview_charge_generation(...)` devuelve candidatos y resumen sin crear cargos ni receipts.

Resumen minimo:

- candidatos;
- elegibles;
- ya cobrados;
- excluidos;
- revision manual;
- sin tarifa;
- total estimado.

## Batches y snapshots

Se agregan:

- `finance.charge_generation_batches`
- `finance.charge_generation_batch_items`

Al crear el batch se congela:

- poblacion candidata;
- tarifa resuelta;
- monto resuelto;
- vencimiento;
- resultado inicial de elegibilidad.

Durante `execute` solo se revalidan condiciones criticas: cuenta activa, enrollment elegible, exclusion activa nueva, duplicate estructural y validez de sesion/actor.

## Exclusiones

`finance.charge_generation_exclusions` evita generacion futura para un alumno bajo una regla o version sin alterar cargos ya creados.

No equivale a:

- beca;
- descuento;
- ajuste;
- cancelacion retroactiva.

## Deduplicacion

Se agrega una garantia estructural en `finance.student_charges` para impedir duplicados logicos entre:

- dos batches;
- un batch y un cargo manual;
- reintentos;
- dos reglas equivalentes.

La deduplicacion vive en base de datos, no solo en `SELECT` previo.

## Idempotencia

Se reaprovecha `finance.financial_commands` con command types nuevos para:

- create rule;
- create version;
- approve version;
- activate version;
- preview;
- create batch;
- submit batch;
- approve batch;
- execute batch;
- create exclusion.

Misma key y mismo fingerprint retornan el mismo resultado. Misma key con fingerprint distinto falla con `IDEMPOTENCY_CONFLICT`.

## Concurrencia

La suite local cubre 15 escenarios:

1. two batches same rule/period
2. double execute same batch
3. two rules same logical charge
4. batch vs manual charge
5. enrollment changes after preview
6. enrollment changes during execution
7. rate changes after preview
8. rate changes during execution
9. account closes during execution
10. exclusion created during execution
11. same key / same fingerprint
12. same key / different fingerprint
13. session_version revoked
14. concurrent approval
15. independent academic periods

## Fallo parcial

Un batch puede terminar:

- `COMPLETED`
- `COMPLETED_WITH_ERRORS`

Los items exitosos no se duplican en reintentos y los contadores se recalculan desde el estado real de los items.

## Rates y due dates

La tarifa se resuelve en preview y se congela como:

- `resolved_charge_rate_id`
- `resolved_amount`

Estrategias de vencimiento V1:

- `FIXED_DATE`
- `DAYS_AFTER_GENERATION`
- `MANUAL_REVIEW`

No se implementan calendarios habiles ni cron institucional.

## Decisiones institucionales abiertas

### Montos reales

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Los importes productivos definitivos no fueron fijados en este bloque.

### Periodicidad de colegiaturas

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La periodicidad operativa real permanece fuera del alcance de esta V1.

### Numero de cuotas

Estado:
PENDING_INSTITUTIONAL_VALIDATION

No se definio un numero institucional final de parcialidades o emisiones por ciclo.

### Fechas limite

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La estrategia tecnica de vencimiento existe, pero las fechas institucionales reales siguen abiertas.

### Estados academicos cobrables definitivos

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La elegibilidad tecnica actual no sustituye la ratificacion institucional final sobre todos los estados cobrables.

### Tratamiento de bajas

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La politica institucional exacta para cobros, exclusiones o cancelaciones por baja no fue cerrada aqui.

### Tratamiento de suspendidos

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La respuesta institucional final ante suspendidos y su impacto financiero sigue pendiente.

### Quien prepara batches

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La implementacion define permisos tecnicos, pero no fija al responsable institucional definitivo.

### Quien aprueba batches

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Existe aprobacion tecnica y bloqueo de autoaprobacion, pero la autoridad institucional final sigue abierta.

### Quien ejecuta batches

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La capacidad tecnica existe, sin cerrar todavia la asignacion institucional definitiva.

### Segregacion institucional final

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La segregacion tecnica actual no sustituye la definicion institucional final de separacion de funciones.

### Uso futuro de exclusiones

Estado:
PENDING_INSTITUTIONAL_VALIDATION

El bloque implementa exclusiones controladas, pero no fija aun su politica institucional de uso ordinario.

### Cancelacion de batch

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La semantica institucional final de cancelacion, ventana permitida y responsables sigue pendiente.

### Automatizacion futura

Estado:
PENDING_INSTITUTIONAL_VALIDATION

No se aprobaron cron, scheduler ni generacion automatica en este bloque.

### Becas

Estado:
PENDING_INSTITUTIONAL_VALIDATION

No se implemento tratamiento definitivo de becas dentro de la programacion de cobros.

### Descuentos

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Los descuentos institucionales quedan fuera del alcance confirmado de esta version.

### Recargos

Estado:
PENDING_INSTITUTIONAL_VALIDATION

No se definieron recargos, intereses ni reglas moratorias productivas.

## Permisos, AAL y session_version

Permisos agregados:

- `finance.charge-generation.rules.manage`
- `finance.charge-generation.rules.approve`
- `finance.charge-generation.preview`
- `finance.charge-generation.batches.create`
- `finance.charge-generation.batches.review`
- `finance.charge-generation.batches.approve`
- `finance.charge-generation.batches.execute`
- `finance.charge-generation.batches.read`
- `finance.charge-generation.exclusions.manage`

Controles tecnicos:

- `AAL2`;
- MFA;
- `session_version` vigente;
- cuenta `ACTIVE`;
- aplicacion `SISTEMA_ADMINISTRATIVO`;
- permiso exacto.

`CAJA`, `DOCENTE`, `ALUMNO`, `TUTOR` y `ASPIRANTE` no reciben ejecucion masiva.

## Audit e inmutabilidad

Se agregan eventos financieros cerrados para creacion, aprobacion, preview, submit, execute, skipped, failed y completed.

Las tablas nuevas usan triggers especificos para evitar mutaciones destructivas en:

- versiones activas;
- configuracion aprobada/procesada de batches;
- items procesados;
- exclusions historicas.

## RLS, grants y Data API

Todas las tablas nuevas:

- viven en `finance`;
- tienen RLS habilitado;
- no tienen policies cliente;
- no exponen grants directos a `PUBLIC`, `anon` ni `authenticated`.

Solo se otorga `EXECUTE` controlado a wrappers publicos necesarios. `finance` permanece fuera de la Data API.

## TypeScript

Se agrega `packages/supabase/src/charge-generation.ts` como contrato `server-only`, con:

- puerto inyectable;
- tipos cerrados;
- money como string;
- errores cerrados;
- sin exponer `SupabaseClient`.

## UI administrativa minima

Se crean rutas server-side en:

- `/finanzas/generacion-cargos`
- `/finanzas/generacion-cargos/reglas`
- `/finanzas/generacion-cargos/nuevo`
- `/finanzas/generacion-cargos/[batchId]`

El flujo visible obliga a pasar por preview antes de submit, approve y execute.

## Privacidad

La UI solo expone:

- identificador institucional;
- nombre visible minimo cuando exista;
- semestre;
- grupo;
- estado de elegibilidad;
- monto;
- vencimiento;
- motivo.

No expone:

- `auth_user_id`;
- `person_id`;
- `account_id` interno;
- correo;
- telefono;
- tutor;
- datos medicos.

## Rollback

La reversión del bloque se limita a la base local descartable usada en validacion. No se alteran las 25 migraciones anteriores; el bloque agrega una unica migracion nueva y el estado actual esperado del repositorio es de 26 migraciones totales.

## Riesgos

- La periodicidad institucional real sigue pendiente y V1 queda manual.
- El nombre visible del alumno depende del modelo actual; no se inventan campos nuevos.
- La inmutabilidad por trigger debe seguir vigilada en auditorias posteriores para evitar mutaciones no previstas.
- La deduplicacion estructural nueva debe seguirse observando en integraciones futuras con admision e inscripcion.

## Decisiones institucionales pendientes

Permanecen pendientes de validacion institucional:

- periodicidad real de colegiaturas;
- cuotas e importes definitivos;
- recargos, descuentos y becas;
- estados academicos cobrables definitivos;
- responsables formales de preparar, aprobar y ejecutar;
- automatizacion futura.
