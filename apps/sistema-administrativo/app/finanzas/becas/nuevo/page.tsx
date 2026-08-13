import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../../_admin/financial-feedback";
import { createScholarshipProgramAction } from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewScholarshipPage({
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
        description="Alta inicial de programas de beca sobre el contrato ya existente."
        title="Nuevo programa o asignación"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <Alert tone="info">
          El contrato visible en esta etapa permite registrar el programa. La lectura detallada y el
          flujo completo de asignación permanecen sujetos al backend existente.
        </Alert>
      </Card>

      <Card>
        <h2>Registrar programa</h2>
        <form action={createScholarshipProgramAction}>
          <Field label="Código del programa" labelFor="requestedCode">
            <Input id="requestedCode" name="requestedCode" placeholder="SCH-2026-A" required />
          </Field>
          <Button type="submit">Registrar programa</Button>
        </form>
      </Card>
    </Container>
  );
}
