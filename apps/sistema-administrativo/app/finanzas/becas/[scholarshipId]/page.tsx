import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, isUuid, readFeedback } from "../../../_admin/financial-feedback";
import { applyScholarshipAction } from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ScholarshipDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ scholarshipId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ scholarshipId }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({}),
  ]);
  const feedback = readFeedback(query);

  return (
    <Container>
      <PageHeader
        description="Aplicación operativa de una beca ya identificada por backend."
        title="Detalle de programa o asignación"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        {isUuid(scholarshipId) ? (
          <Alert tone="info">
            El contrato permite aplicar la beca al cargo indicado, pero aún no expone un DTO de
            lectura completa del programa o asignación para esta vista.
          </Alert>
        ) : (
          <Alert tone="warning">
            El identificador visible no corresponde a una asignación operativa válida.
          </Alert>
        )}
      </Card>

      {isUuid(scholarshipId) ? (
        <Card>
          <h2>Aplicar beca</h2>
          <form action={applyScholarshipAction}>
            <input type="hidden" name="targetStudentScholarshipId" value={scholarshipId} />
            <Field label="Cargo destino" labelFor="targetChargeId">
              <Input
                id="targetChargeId"
                name="targetChargeId"
                placeholder="UUID del cargo"
                required
              />
            </Field>
            <Button type="submit">Aplicar beca</Button>
          </form>
        </Card>
      ) : null}
    </Container>
  );
}
