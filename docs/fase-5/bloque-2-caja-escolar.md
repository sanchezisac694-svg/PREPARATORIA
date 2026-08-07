# Fase 5 — Bloque 2: Caja escolar y operación presencial

## Resumen

Este bloque agrega la capa operativa de caja sobre la base financiera del Bloque 1 sin duplicar pagos, allocaciones, recibos, cargos ni saldos.

## Migración

- Nueva migración aditiva: `20260807162636_create_cash_register_operations.sql`
- Las 24 migraciones anteriores permanecen intactas.
- Total esperado después del bloque: 25 migraciones.

## Fuente de verdad

La fuente financiera sigue siendo:

- `finance.student_accounts`
- `finance.student_charges`
- `finance.payments`
- `finance.payment_allocations`

La caja solo agrega trazabilidad operativa:

- cajas;
- asignaciones de cajero;
- sesiones;
- vínculo sesión–pago;
- movimientos manuales;
- arqueos;
- conciliaciones.

## Tablas agregadas

| Tabla                           | Responsabilidad                             |
| ------------------------------- | ------------------------------------------- |
| `finance.cash_registers`        | Catálogo de cajas físicas o puntos de cobro |
| `finance.cashier_assignments`   | Vigencia de asignación caja–cajero          |
| `finance.cash_sessions`         | Turnos operativos con snapshot final        |
| `finance.cash_session_payments` | Trazabilidad entre pago y turno             |
| `finance.cash_movements`        | Movimientos manuales append-only            |
| `finance.cash_counts`           | Conteos de arqueo                           |
| `finance.cash_reconciliations`  | Resultado y aprobación de diferencias       |

## Enums cerrados

- `finance.cash_register_status`
- `finance.cashier_assignment_status`
- `finance.cash_session_status`
- `finance.cash_movement_type`
- `finance.cash_movement_status`
- `finance.cash_movement_reason_code`
- `finance.cash_difference_reason_code`
- `finance.cash_reconciliation_status`

## Permisos técnicos

- `finance.cash.registers.manage`
- `finance.cash.assignments.manage`
- `finance.cash.sessions.open`
- `finance.cash.sessions.read`
- `finance.cash.sessions.close`
- `finance.cash.movements.create`
- `finance.cash.movements.reverse`
- `finance.cash.counts.create`
- `finance.cash.reconciliation.review`
- `finance.cash.reconciliation.approve`
- `finance.cash.reports.read`

### Rol CAJA

Se mantiene operativo para:

- apertura y lectura de turno;
- cierre de turno;
- movimientos manuales permitidos;
- arqueos;
- reportes de su turno.

No recibe `finance.cash.reconciliation.approve`.

## Fórmula de efectivo esperado

`finance.calculate_expected_cash(cash_session_id)` calcula:

- apertura;
- pagos `CASH` confirmados y vinculados;
- `CASH_IN`;
- menos `CASH_OUT`;
- menos `CASH_WITHDRAWAL`;
- menos el efecto de reversos de movimientos.

No incluye:

- `BANK_TRANSFER`;
- `BANK_DEPOSIT`;
- `CARD_TERMINAL`;
- cargos;
- descuentos;
- allocaciones;
- pagos en estado no final.

## Cierre y snapshot

El cierre persiste:

- `expected_cash_amount`
- `counted_cash_amount`
- `difference_amount`

Si la diferencia es `0`, la sesión cierra balanceada.

Si la diferencia es distinta de `0`, la sesión pasa a `RECONCILIATION_REQUIRED`.

## Segregación de diferencias

La aprobación de diferencia exige un actor distinto del cajero de la sesión.

Regla técnica:

- `approved_by_account_id <> cashier_account_id`

## Cancelación

`CANCELLED` permanece solo como estado estructural futuro.

No existe `cancel_cash_session(...)`.
No hay transición operativa a `CANCELLED` en V1.

## Reversos posteriores al cierre

Regla funcional confirmada:

- el snapshot histórico de una sesión cerrada no se reescribe.

Observación técnica actual:

- la suite focalizada demuestra que un reverso de pago posterior al cierre no modifica el snapshot;
- hoy ese intento termina bloqueado por la regla heredada `PAYMENT_ALREADY_APPLIED`.

Esto debe revisarse institucionalmente en un bloque posterior si se requiere representar reversos post-cierre con mayor granularidad operativa.

## Seguridad

- RLS habilitada en todas las tablas nuevas;
- cero policies directas;
- cero grants de tabla a `PUBLIC`, `anon` o `authenticated`;
- `finance` sigue fuera de la Data API;
- funciones internas revocadas;
- wrappers públicos limitados a operaciones controladas.

## TypeScript

Se agregó `packages/supabase/src/cash-register.ts` como contrato server-only:

- puerto inyectable;
- sin exponer `SupabaseClient`;
- montos decimales como strings;
- errores cerrados;
- operaciones y funciones SQL cerradas.

## UI administrativa mínima

Rutas creadas en `apps/sistema-administrativo`:

- `/caja`
- `/caja/turno`
- `/caja/cobros/nuevo`
- `/caja/movimientos`
- `/caja/arqueo`
- `/caja/cierre`

La superficie es informativa y segura:

- no crea ERP;
- no habilita reversos libres;
- no expone IDs sensibles;
- no agrega pagos en línea;
- no agrega CFDI.

## Pruebas

### SQL pgTAP

- `supabase/tests/cash-register.test.sql`
- 40/40 PASS

### Integración local

- `supabase/tests/cash-register-local.test.mjs`
- PASS

### Concurrencia

- `supabase/tests/cash-register-concurrency.test.mjs`
- 15 subpruebas reales PASS

## Riesgos y pendientes institucionales

1. Compatibilidad histórica de `finance.payments.reverse` fuera del flujo normal de CAJA.
2. Representación futura de reversos posteriores al cierre sin reescribir el snapshot.
3. Definición institucional final del rol que aprueba diferencias.
4. Evolución futura de `CANCELLED` si se autoriza un flujo formal distinto.
