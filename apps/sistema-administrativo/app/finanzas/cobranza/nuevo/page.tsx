import { Alert, Button, Card, Container, Field, Input, PageHeader, Select } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../../_admin/financial-feedback";
import { openCollectionCaseAction } from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCollectionCasePage({
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
        description="Apertura controlada de casos solo cuando existe saldo vencido derivado."
        title="Nuevo caso de cobranza"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <Alert tone="warning">
          Esta pantalla no cambia el saldo, no crea pagos y no altera vencimientos. Solo registra el
          inicio del seguimiento administrativo.
        </Alert>
      </Card>

      <Card>
        <h2>Registrar caso</h2>
        <form action={openCollectionCaseAction}>
          <Field
            helpText="Se usa el identificador administrativo de cuenta provisto por la institución."
            label="Cuenta del alumno"
            labelFor="requestedStudentAccountId"
          >
            <Input
              id="requestedStudentAccountId"
              name="requestedStudentAccountId"
              placeholder="UUID de cuenta"
              required
            />
          </Field>
          <Field label="Motivo de apertura" labelFor="requestedOpenedReasonCode">
            <Select id="requestedOpenedReasonCode" name="requestedOpenedReasonCode" required>
              <option value="OVERDUE_BALANCE">Adeudo vencido</option>
            </Select>
          </Field>
          <Field label="Prioridad" labelFor="requestedPriority">
            <Select id="requestedPriority" name="requestedPriority" required>
              <option value="LOW">Baja</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </Select>
          </Field>
          <Button type="submit">Abrir caso</Button>
        </form>
      </Card>
    </Container>
  );
}
