# Fase 5 — Bloque 5: beneficios financieros y convenios

## Resumen

Este bloque agrega dos capacidades administrativas sobre la base financiera ya existente:

| Área | Implementación |
| --- | --- |
| Becas | `finance.scholarship_programs`, `finance.student_scholarships`, `finance.scholarship_applications` |
| Convenios | `finance.payment_agreements`, `finance.payment_agreement_installments`, `finance.payment_agreement_allocations` |
| Impacto monetario | Reutiliza exclusivamente `finance.charge_adjustments` |

## Principio contable

Referencia del documento del bloque: secciones 1, 2, 16, 17, 21, 22 y 24–38.

- No se modifica `finance.student_charges.original_amount`.
- Becas, descuentos y condonaciones se materializan únicamente mediante `finance.charge_adjustments`.
- Los convenios no crean pagos, no crean cargos, no alteran `original_amount` y no cambian el saldo por sí mismos.

## Responsabilidades técnicas

| Componente | Responsabilidad |
| --- | --- |
| `finance.scholarship_programs` | Programa institucional reusable de beca |
| `finance.student_scholarships` | Asignación individual vigente por alumno |
| `finance.scholarship_applications` | Trazabilidad inequívoca beca → cargo → ajuste |
| `finance.payment_agreements` | Convenio formal multi-parcialidad |
| `finance.payment_agreement_installments` | Calendario congelado y reconciliable |
| `finance.payment_agreement_allocations` | Relación allocation real → parcialidad |

## Permisos agregados

Referencia: secciones 39 y 40.

- `finance.scholarships.programs.manage`
- `finance.scholarships.assign`
- `finance.scholarships.approve`
- `finance.scholarships.apply`
- `finance.discounts.apply`
- `finance.waivers.create`
- `finance.waivers.approve`
- `finance.payment-agreements.create`
- `finance.payment-agreements.approve`
- `finance.payment-agreements.manage`
- `finance.payment-agreements.read`

## Reglas técnicas implementadas

Referencia: secciones 9–15, 18–23, 28–38 y 47–49.

- `creator != approver` para programas de beca, asignaciones, condonaciones y convenios.
- AAL2, MFA y `session_version` vigente para mutaciones.
- Idempotencia mediante `finance.financial_commands`.
- Inmutabilidad histórica con triggers específicos.
- RLS habilitada y cero grants directos a `PUBLIC`, `anon` y `authenticated` sobre tablas nuevas.
- `finance` permanece fuera de Data API.

## UI mínima

Referencia: secciones 42–44.

| Ruta | Propósito |
| --- | --- |
| `/finanzas/becas` | Panorama de becas y beneficios |
| `/finanzas/becas/nuevo` | Alta controlada de programa/asignación |
| `/finanzas/becas/[scholarshipId]` | Detalle técnico |
| `/finanzas/descuentos` | Descuentos y condonaciones |
| `/finanzas/convenios` | Panorama de convenios |
| `/finanzas/convenios/nuevo` | Captura controlada de convenio |
| `/finanzas/convenios/[agreementId]` | Detalle técnico |

## Validaciones institucionales pendientes

Referencia: sección 55.

### Estado

PENDING_INSTITUTIONAL_VALIDATION

Decisiones pendientes:

- tipos definitivos de beca;
- porcentajes permitidos;
- topes máximos;
- conceptos elegibles;
- periodos elegibles;
- criterios institucionales de elegibilidad;
- roles aprobadores definitivos;
- políticas de descuentos;
- políticas de condonación;
- reglas de combinación;
- política de reversión;
- máximo de parcialidades;
- monto mínimo por parcialidad;
- fechas y tolerancias de convenio;
- consecuencias formales de incumplimiento;
- visibilidad para alumno y tutor;
- documentos de evidencia;
- automatización futura.

## Pruebas del bloque

Referencia: secciones 50–58.

Archivos previstos:

- `supabase/tests/financial-benefits.test.sql`
- `supabase/tests/payment-agreements.test.sql`
- `supabase/tests/financial-benefits-local.test.mjs`
- `supabase/tests/payment-agreements-local.test.mjs`
- `supabase/tests/financial-benefits-concurrency.test.mjs`

## Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| Reducciones concurrentes exceden saldo | Locks transaccionales y cálculo en PostgreSQL |
| Convenio se interpreta como pago | Separación estricta entre convenio y ledger |
| Beca revocada borra historial | Revocación sin reescritura histórica |
| Caja obtiene autorización implícita | Permisos específicos sin wildcard operativo |
