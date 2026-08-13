import { Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../../_admin/financial-feedback";
import { createPaymentAgreementAction } from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewAgreementPage({
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
        description="Creación inicial de convenios usando el contrato ya disponible."
        title="Nuevo convenio"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Registrar convenio</h2>
        <form action={createPaymentAgreementAction}>
          <Field label="Cuenta del alumno" labelFor="targetStudentAccountId">
            <Input
              id="targetStudentAccountId"
              name="targetStudentAccountId"
              placeholder="UUID de cuenta"
              required
            />
          </Field>
          <Field label="Monto acordado" labelFor="requestedAgreedAmount">
            <Input
              id="requestedAgreedAmount"
              inputMode="decimal"
              name="requestedAgreedAmount"
              placeholder="500.00"
              required
            />
          </Field>
          <Button type="submit">Registrar convenio</Button>
        </form>
      </Card>
    </Container>
  );
}
