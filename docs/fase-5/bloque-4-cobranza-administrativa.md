# Fase 5 - Bloque 4: Gestion de adeudos y cobranza administrativa

## Objetivo

Agregar una capa administrativa de cobranza que derive la deuda desde el ledger financiero existente y registre seguimiento, compromisos e historial sin crear una segunda contabilidad.

## Fuente financiera y no second ledger

La fuente de verdad permanece en:

- `finance.student_accounts`
- `finance.student_charges`
- `finance.charge_adjustments`
- `finance.payments`
- `finance.payment_allocations`

Las tablas nuevas:

- `finance.collection_cases`
- `finance.collection_actions`
- `finance.payment_commitments`

no almacenan balance editable, saldo vencido editable ni una contabilidad paralela. La deuda siempre se vuelve a calcular desde el ledger.

## Debt derivation

La derivacion reutiliza la semantica vigente de `finance.get_charge_balance(charge_id)`.

Se agrega `finance.get_student_debt_position(student_account_id uuid, business_date date default current_date)` para derivar:

- `total_outstanding`
- `total_overdue`
- `total_not_due`
- `oldest_overdue_date`
- `days_past_due`
- `charge_count`
- `overdue_charge_count`
- desglose por cargo

La funcion no persiste totales. Si cambia el ledger, cambia la posicion de deuda sin editar casos de cobranza.

## Overdue y aging

Un cargo se considera vencido cuando:

- `status in ('POSTED','PARTIALLY_PAID')`
- `finance.get_charge_balance(id) > 0`
- `due_date is not null`
- `due_date < business_date`

`due_date is null` se clasifica como `NO_DUE_DATE` y no se fuerza a overdue.

Buckets tecnicos V1:

- `CURRENT`
- `1_30_DAYS`
- `31_60_DAYS`
- `61_90_DAYS`
- `91_PLUS_DAYS`

Estado:
PENDING_INSTITUTIONAL_VALIDATION

La clasificacion existe solo como derivacion tecnica; no dispara recargos, prioridad automatica ni sanciones.

## Casos de cobranza

`finance.collection_cases` registra:

- cuenta financiera objetivo;
- estado de workflow;
- prioridad;
- razon de apertura;
- apertura, asignacion y cierre;
- metadatos operativos (`last_action_at`, `next_action_at`).

Estados cerrados:

- `OPEN`
- `IN_FOLLOW_UP`
- `PROMISE_PENDING`
- `REVIEW_REQUIRED`
- `RESOLVED`
- `CLOSED`

La prioridad V1 usa:

- `LOW`
- `NORMAL`
- `HIGH`
- `URGENT`

Estado:
PENDING_INSTITUTIONAL_VALIDATION

No se deriva automaticamente desde monto o mora.

## Open case y prevencion de duplicados

`public.open_collection_case(...)` exige:

- cuenta financiera `ACTIVE`;
- `total_overdue > 0`;
- permiso exacto;
- `AAL2`;
- MFA satisfecha;
- `session_version` vigente;
- aplicacion `SISTEMA_ADMINISTRATIVO`;
- idempotencia.

La base garantiza un solo caso activo por `student_account_id` mediante indice parcial sobre:

- `OPEN`
- `IN_FOLLOW_UP`
- `PROMISE_PENDING`
- `REVIEW_REQUIRED`
- `RESOLVED`

No depende solo de `SELECT` previo.

## Listado administrativo de adeudos

`finance.list_overdue_student_accounts(...)` es una lectura server-side paginada con filtros cerrados:

- `academic_period_id`
- `semester_number`
- `group_id`
- `training_area_id`
- `aging_bucket`
- `collection_case_status`
- `search_text`
- `limit`
- `offset`

Devuelve solo:

- identificador institucional;
- nombre visible minimo;
- semestre/grupo;
- total pendiente;
- total vencido;
- oldest overdue date;
- days past due;
- aging bucket;
- estado del caso.

No devuelve:

- `auth_user_id`
- `person_id`
- correo
- telefono
- tutor
- datos medicos
- calificaciones

Se evita exponer `student_account_id` en contratos de UI.

## Actions

`finance.collection_actions` es append-only y registra:

- tipo;
- estado;
- canal;
- `occurred_at`;
- actor;
- `summary`;
- `next_action_at`.

Tipos V1:

- `ACCOUNT_REVIEW`
- `IN_PERSON_CONTACT`
- `PHONE_CONTACT`
- `EMAIL_CONTACT`
- `NOTICE_DELIVERED`
- `PAYMENT_COMMITMENT_CREATED`
- `PAYMENT_COMMITMENT_UPDATED`
- `PAYMENT_COMMITMENT_BROKEN`
- `PAYMENT_RECEIVED`
- `CASE_REVIEWED`
- `OTHER_MANUAL_REVIEW`

El `summary` se limita a 1..500 caracteres y debe permanecer factual, administrativo, minimo y auditable.

No se almacenan:

- salud;
- opiniones personales;
- etiquetas peyorativas;
- secretos;
- credenciales;
- tarjetas;
- cuentas bancarias completas.

## Payment commitments

`finance.payment_commitments` registra compromisos de pago con estados:

- `PENDING`
- `FULFILLED`
- `BROKEN`
- `CANCELLED`

La tabla conserva:

- monto prometido;
- fecha prometida;
- notas administrativas limitadas;
- timestamps de cumplimiento o cancelacion.

Crear un compromiso:

- no crea pagos;
- no crea ajustes;
- no modifica cargos;
- no cambia `due_date`.

Al crearlo, el caso puede pasar a `PROMISE_PENDING`.

## Evaluacion, fulfillment, broken y cancel

`finance.evaluate_payment_commitment(...)` es read-only y devuelve:

- monto prometido;
- pagos calificables posteriores a la creacion;
- saldo actual;
- si ya vencio;
- si puede marcarse `FULFILLED`;
- si aparenta incumplimiento.

`public.mark_payment_commitment_fulfilled(...)` requiere evidencia en el ledger y no se dispara automaticamente.

`public.mark_payment_commitment_broken(...)` requiere:

- compromiso `PENDING`;
- fecha vencida;
- evaluacion read-only que indique incumplimiento.

`public.cancel_payment_commitment(...)` solo opera desde `PENDING` y conserva el historial.

## Cierre y reversal after close

`public.close_collection_case(...)` aplica regla fail-closed:

- `BALANCE_SETTLED` requiere `total_overdue = 0`;
- `DUPLICATE_CASE` y `OPENED_IN_ERROR` pueden cerrar aunque exista deuda porque el caso administrativo era invalido;
- `OTHER_MANUAL_REVIEW` no cierra con saldo vencido en V1.

Estado:
PENDING_INSTITUTIONAL_VALIDATION

para cualquier politica institucional futura distinta.

Si despues de `CLOSED` un pago se revierte:

- la deuda reaparece por derivacion;
- el caso historico no se reabre automaticamente;
- si sigue habiendo overdue, se abre un nuevo caso manual.

## Permisos, roles, AAL y session_version

Permisos agregados:

- `finance.collections.cases.open`
- `finance.collections.cases.read`
- `finance.collections.cases.manage`
- `finance.collections.actions.create`
- `finance.collections.commitments.create`
- `finance.collections.commitments.manage`
- `finance.collections.reports.read`

Matriz V1:

- `SUPERADMIN`: explicito
- `ADMINISTRATIVO`: operador principal
- `CONTROL_ESCOLAR`: lectura limitada
- `CAJA`: sin administracion de casos
- `DOCENTE`, `PREFECTURA`, `ALUMNO`, `TUTOR`, `ASPIRANTE`: sin permisos internos de cobranza

Lectura masiva y mutaciones exigen `AAL2`. Las mutaciones tambien exigen MFA, `session_version` vigente y cuenta `ACTIVE`.

## Audit e inmutabilidad

Eventos agregados:

- `COLLECTION_CASE_OPENED`
- `COLLECTION_CASE_ASSIGNED`
- `COLLECTION_ACTION_CREATED`
- `PAYMENT_COMMITMENT_CREATED`
- `PAYMENT_COMMITMENT_UPDATED`
- `PAYMENT_COMMITMENT_FULFILLED`
- `PAYMENT_COMMITMENT_BROKEN`
- `PAYMENT_COMMITMENT_CANCELLED`
- `COLLECTION_CASE_RESOLVED`
- `COLLECTION_CASE_CLOSED`
- `COLLECTION_OPERATION_DENIED`

El payload de auditoria no copia el `summary` completo.

Inmutabilidad:

- `collection_actions`: append-only;
- `payment_commitments`: sin `DELETE`, con transiciones controladas;
- `collection_cases`: sin `DELETE`; `CLOSED` conserva historia de apertura.

## RLS, grants y Data API

Las tres tablas nuevas:

- viven en `finance`;
- tienen RLS habilitada;
- no tienen policies cliente;
- no otorgan grants directos a `PUBLIC`, `anon` ni `authenticated`.

Solo se concede `EXECUTE` a wrappers publicos controlados. `finance` permanece fuera de la Data API.

## TypeScript

Se agrega `packages/supabase/src/collections.ts` como contrato `server-only` con:

- puerto inyectable;
- money como string;
- tipos tecnicos minimos;
- errores cerrados;
- sin exponer `SupabaseClient`.

## UI administrativa

Se agregan rutas server-side en:

- `/finanzas/cobranza`
- `/finanzas/cobranza/adeudos`
- `/finanzas/cobranza/nuevo`
- `/finanzas/cobranza/[caseId]`

La UI recuerda explicitamente que:

- la deuda se deriva del ledger;
- abrir un caso no modifica el saldo;
- un compromiso no registra pago;
- alumno y tutor no deben ver casos, acciones ni compromisos internos.

## Privacidad y visibilidad

El alumno y el tutor no pueden leer:

- `collection_cases`
- `collection_actions`
- `payment_commitments`

La capa administrativa no expone en navegador:

- `auth_user_id`
- `person_id`
- telefono
- email
- datos medicos
- calificaciones
- secretos
- tarjetas
- cuentas bancarias

## No academic blocking, no notifications, no late fees

Este bloque no escribe en:

- `academic.student_records`
- `academic.period_enrollments`
- `academic.academic_progress_decisions`
- asistencia
- calificaciones
- documentos academicos

Tampoco implementa:

- email
- SMS
- WhatsApp
- push
- scheduler
- recargos
- intereses
- penalidades

`days_past_due` es solo informativo.

## Pruebas

Cobertura agregada:

- `supabase/tests/collections.test.sql`
- `supabase/tests/collections-local.test.mjs`
- `supabase/tests/collections-concurrency.test.mjs`
- contrato TypeScript en `packages/supabase/tests/supabase.test.mjs`
- smoke administrativo minimo para las rutas nuevas

La suite de concurrencia cubre 15 escenarios individuales, incluyendo:

1. double open same account
2. case open vs payment
3. case close vs payment
4. two actions same idempotency
5. commitment create vs payment
6. commitment fulfillment vs payment reversal
7. two commitments concurrent
8. case assign vs close
9. account closes vs case open
10. charge cancelled vs case view
11. payment allocation vs debt query
12. session_version revoked
13. same key/same fingerprint
14. same key/different fingerprint
15. independent accounts

## Riesgos

- La prioridad institucional definitiva sigue pendiente.
- El aging oficial puede requerir cambios de politica, no de mecanismo base.
- La regla institucional exacta para `RESOLVED` vs `CLOSED` puede ajustarse en bloques posteriores.
- No existe automatizacion de cobranza; todo el flujo sigue siendo manual y controlado.

## Decisiones institucionales abiertas

### Politica institucional final de prioridad

Estado:
PENDING_INSTITUTIONAL_VALIDATION

### Adopcion institucional oficial del aging tecnico

Estado:
PENDING_INSTITUTIONAL_VALIDATION

### Politica formal para OTHER_MANUAL_REVIEW con saldo pendiente

Estado:
PENDING_INSTITUTIONAL_VALIDATION

### Responsables institucionales definitivos para abrir, revisar, cerrar y supervisar casos

Estado:
PENDING_INSTITUTIONAL_VALIDATION

### Politica futura de automatizacion, recordatorios o escalamiento externo

Estado:
PENDING_INSTITUTIONAL_VALIDATION

## Rollback

La reversion del bloque se limita a la base local descartable de validacion. No se modifican las 26 migraciones previas; el bloque agrega una sola migracion aditiva para llegar a 27 migraciones totales.
