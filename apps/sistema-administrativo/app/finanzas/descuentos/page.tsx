import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../_admin/financial-feedback";
import {
  applyDiscountAction,
  applyWaiverAction,
  approveWaiverAction,
  createWaiverAction,
} from "../becas/actions";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DiscountsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const params = (await searchParams) ?? {};
  const feedback = readFeedback(params);

  return (
    <Container>
      <PageHeader
        description="Operaciones separadas para descuento autorizado y condonación."
        title="Descuentos y condonaciones"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <Alert tone="warning">
          La condonación conserva segregación de creador y aprobador. Ninguna de estas acciones crea
          un ledger paralelo ni recalcula saldos en la UI.
        </Alert>
      </Card>

      <Card>
        <h2>Descuento autorizado</h2>
        <form action={applyDiscountAction}>
          <Field label="Cargo destino" labelFor="discountTargetChargeId">
            <Input
              id="discountTargetChargeId"
              name="targetChargeId"
              placeholder="UUID del cargo"
              required
            />
          </Field>
          <Field label="Importe" labelFor="discountRequestedAmount">
            <Input
              id="discountRequestedAmount"
              inputMode="decimal"
              name="requestedAmount"
              placeholder="100.00"
              required
            />
          </Field>
          <Button type="submit">Registrar descuento</Button>
        </form>
      </Card>

      <Card>
        <h2>Condonación</h2>
        <form action={createWaiverAction}>
          <Field label="Cargo destino" labelFor="waiverTargetChargeId">
            <Input
              id="waiverTargetChargeId"
              name="targetChargeId"
              placeholder="UUID del cargo"
              required
            />
          </Field>
          <Field label="Importe" labelFor="waiverRequestedAmount">
            <Input
              id="waiverRequestedAmount"
              inputMode="decimal"
              name="requestedAmount"
              placeholder="100.00"
              required
            />
          </Field>
          <Button type="submit">Registrar condonación</Button>
        </form>
      </Card>

      <Card>
        <h2>Aprobar condonación</h2>
        <form action={approveWaiverAction}>
          <Field label="Ajuste" labelFor="approveTargetAdjustmentId">
            <Input
              id="approveTargetAdjustmentId"
              name="targetAdjustmentId"
              placeholder="UUID del ajuste"
              required
            />
          </Field>
          <Button type="submit" variant="secondary">
            Aprobar condonación
          </Button>
        </form>
      </Card>

      <Card>
        <h2>Aplicar condonación</h2>
        <form action={applyWaiverAction}>
          <Field label="Ajuste aprobado" labelFor="applyTargetAdjustmentId">
            <Input
              id="applyTargetAdjustmentId"
              name="targetAdjustmentId"
              placeholder="UUID del ajuste"
              required
            />
          </Field>
          <Button type="submit">Aplicar condonación</Button>
        </form>
      </Card>
    </Container>
  );
}
