# Fase 5 — Bloque 6: reportes financieros y cierre operativo de periodo

Referencia principal: Plan Maestro, capacidad financiera institucional y definición del Bloque 6 aprobada para implementación.

## Source of truth

Los reportes del bloque derivan únicamente del ledger y subdominios financieros ya existentes:

- `finance.student_charges`
- `finance.charge_adjustments`
- `finance.payments`
- `finance.payment_allocations`
- `finance.student_accounts`
- `finance.cash_sessions`
- `finance.cash_session_payments`
- `finance.cash_movements`
- `finance.cash_counts`
- `finance.cash_reconciliations`
- `finance.collection_cases`
- `finance.payment_commitments`
- `finance.scholarship_programs`
- `finance.student_scholarships`
- `finance.scholarship_applications`
- `finance.payment_agreements`
- `finance.payment_agreement_installments`
- `finance.payment_agreement_allocations`

No se creó una segunda contabilidad ni tablas persistentes de totales derivados.

## Migración y objetos nuevos

- Nueva migración aditiva: `20260810164241_create_financial_reports_and_period_closures.sql`
- Migraciones previas intactas: 28
- Total esperado al cierre del bloque: 29

Objetos nuevos principales:

- Enum `finance.financial_period_closure_status`
- Enum `finance.financial_report_grouping`
- Tabla `finance.financial_period_closures`
- Helpers:
  - `finance.get_financial_snapshot`
  - `finance.require_financial_reports_permission`
  - `finance.report_csv_safe_cell`
  - `finance.report_page_size`
  - `finance.report_offset`
- Wrappers públicos de reportes y cierres en `public.*`

## Semántica de fechas

- Cargos: `posted_at`
- Vencimiento: `due_date`
- Pagos: `paid_at`
- Ajustes: `effective_at`
- Asignaciones de pago: `applied_at`
- Caja: `business_date`

No se mezcló `created_at` como fecha funcional de negocio.

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Tema pendiente: timezone institucional definitiva para “business date”.

## Tipos de reporte

Se implementaron wrappers administrativos server-side para:

- `/finanzas/reportes/resumen`
- `/finanzas/reportes/cargos`
- `/finanzas/reportes/pagos`
- `/finanzas/reportes/adeudos`
- `/finanzas/reportes/caja`
- `/finanzas/reportes/beneficios`
- `/finanzas/reportes/convenios`
- `/finanzas/cierres`
- `/finanzas/cierres/nuevo`
- `/finanzas/cierres/[closureId]`

Agrupación cerrada disponible a nivel de dominio:

- `DAY`
- `MONTH`
- `ACADEMIC_PERIOD`

`WEEK` no se implementó en V1.

## Fórmulas y consistencia

`finance.get_financial_snapshot(...)` centraliza la fórmula compartida para:

- `gross_charges`
- `credit_adjustments`
- `discounts`
- `waivers`
- `scholarship_adjustments`
- `net_charges`
- `confirmed_payments`
- `reversed_payments`
- `net_collections`
- `outstanding`
- `overdue`

La consistencia de lectura se resuelve server-side dentro de una sola sentencia SQL por reporte/snapshot. No se construyó el resumen con múltiples RPC secuenciales desde TypeScript.

## Clasificación de beneficios

- `SCHOLARSHIP`: ajuste `DISCOUNT` con trazabilidad en `finance.scholarship_applications`
- `AUTHORIZED_DISCOUNT`: ajuste `DISCOUNT` sin trazabilidad de beca
- `WAIVER`: ajuste `WAIVER`
- `REVERSAL`: ajuste `REVERSAL`

Esto evita contar toda rebaja como beca y evita doble conteo entre descuento autorizado y beca.

## Reuso de deuda, caja y convenios

- Adeudos: reutiliza `finance.get_student_debt_position(...)` y `finance.list_overdue_student_accounts(...)`
- Caja: reutiliza la semántica heredada de `finance.calculate_expected_cash(...)`
- Convenios: `finance.report_payment_agreements(...)` reporta estado, snapshot inicial, total programado, monto cumplido, remanente y evaluación

Los convenios y compromisos de pago no se cuentan como ingreso.

## Paginación

- default: 50
- máximo: 200

Los listados son server-side y fail-closed. No existe `page_size` ilimitado.

## Export CSV

V1 implementa solo CSV server-side.

- sin jobs en background
- sin tablas de exportación
- sin XLSX
- sin PDF

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Temas pendientes:

- formatos oficiales requeridos;
- retención institucional de exports;
- firma o sello;
- PDF;
- XLSX.

Límite técnico inicial:

- 10,000 filas por export

Si se excede, el contrato falla con `FINANCIAL_REPORT_EXPORT_LIMIT_EXCEEDED`.

## Protección contra CSV injection

Se sanitizan celdas que inician con:

- `=`
- `+`
- `-`
- `@`

La estrategia aplicada antepone `'` y además escapa comillas dobles y reemplaza CR/LF.

## Privacidad

Los reportes y exportaciones usan whitelist de columnas. No se exponen por defecto:

- `auth_user_id`
- `person_id`
- `account_id` técnico
- emails
- teléfonos
- guardianes
- notas
- datos médicos
- payloads de auditoría

La identidad visible mínima es el identificador institucional del alumno y un nombre derivado mínimo.

## Permisos, roles y seguridad

Permisos nuevos:

- `finance.reports.charges.read`
- `finance.reports.payments.read`
- `finance.reports.collections.read`
- `finance.reports.cash.read`
- `finance.reports.benefits.read`
- `finance.reports.agreements.read`
- `finance.reports.summary.read`
- `finance.reports.export`
- `finance.period-close.create`
- `finance.period-close.approve`
- `finance.period-close.read`

Matriz aplicada:

- `SUPERADMIN`: explícito
- `ADMINISTRATIVO`: consumidor principal
- `CAJA`: lectura de caja y pagos
- `CONTROL_ESCOLAR`: sin permisos financieros globales nuevos en este bloque

Requisitos de seguridad:

- reportes ordinarios: mismo patrón backoffice actual
- export: AAL2
- cierre de periodo: AAL2 + MFA + `session_version` vigente

## Cierre operativo de periodo

`finance.financial_period_closures` guarda snapshots históricos, no balances vivos editables.

Estados:

- `DRAFT`
- `UNDER_REVIEW`
- `APPROVED`
- `SUPERSEDED`

Reglas implementadas:

- aprobación separada: `creator != approver`
- snapshot histórico inmutable cuando queda aprobado
- `SUPERSEDED` preserva historial
- sin `DELETE`
- sin bloqueo del ledger posterior

Operaciones posteriores a un cierre aprobado:

- pagos tardíos cambian el reporte vivo, no el snapshot anterior
- reversals cambian el reporte vivo, no el snapshot anterior
- descuentos/waivers posteriores cambian el reporte vivo, no el snapshot anterior

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Temas pendientes:

- definición institucional final de “cierre”;
- responsables formales de creación y aprobación;
- periodos cerrables;
- fecha límite;
- posibilidad futura de bloqueo operativo posterior al cierre.

## RLS, grants y Data API

- `finance.financial_period_closures` tiene RLS habilitada
- sin grants directos a `PUBLIC`, `anon` o `authenticated`
- ejecución únicamente por wrappers controlados
- `finance` permanece fuera de Data API

## TypeScript

Servicios server-only nuevos:

- [financial-reports.ts](/C:/Users/sanch/Desktop/Sistema_Preparatoria_LF/packages/supabase/src/financial-reports.ts)
- [financial-period-close.ts](/C:/Users/sanch/Desktop/Sistema_Preparatoria_LF/packages/supabase/src/financial-period-close.ts)

Contratos:

- DTO cerrados
- dinero como string
- sin exponer `SupabaseClient`
- sin cliente privilegiado en browser

## Performance

No se introdujeron índices extra fuera del cierre salvo la restricción lógica para cierres activos equivalentes.

Estado:
PENDING_INSTITUTIONAL_VALIDATION

Tema pendiente:

- revisión institucional posterior de planes `EXPLAIN` si dirección solicita reportes más pesados o exports mayores.

## Concurrencia e invariantes

Cobertura prevista del bloque:

- snapshot consistente de reportes
- snapshot atómico de cierre
- máximo un cierre activo equivalente
- aprobación efectiva única
- historial preservado al superseder
- pagos/convenios/compromisos no se mezclan como ingresos

## Rollback

Rollback técnico del bloque:

- revertir la migración nueva en base local descartable;
- eliminar wrappers y servicios TypeScript asociados;
- retirar rutas administrativas de reportes/cierres.

No se modificaron las 28 migraciones previas.
