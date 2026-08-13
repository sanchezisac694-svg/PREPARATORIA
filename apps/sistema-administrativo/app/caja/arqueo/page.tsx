import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../_admin/financial-feedback";
import { FinancialStatusBadge } from "../../_admin/financial-labels";
import { beginCashSessionCloseAction, recordCashCountAction } from "../actions";
import { requireAdminAccess } from "../../../lib/auth";
import { getCashRegisterAdapter } from "../../../lib/cash-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaArqueoPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ activeSession }, params] = await Promise.all([
    getCashRegisterAdapter().then((adapter) => adapter.getOverview()),
    searchParams ?? Promise.resolve({}),
  ]);
  const feedback = readFeedback(params);

  return (
    <Container>
      <PageHeader
        description="Inicio del cierre y captura del conteo físico del turno visible."
        title="Arqueo de caja"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Estado del turno</h2>
        {activeSession ? (
          <ul>
            <li>
              Estado actual: <FinancialStatusBadge value={activeSession.status} />
            </li>
            <li>Efectivo esperado: {activeSession.expectedCashAmount ?? "Pendiente"}</li>
            <li>Conteo visible: {activeSession.countedCashAmount ?? "No capturado"}</li>
            <li>El cajero no puede aprobar su propia diferencia.</li>
          </ul>
        ) : (
          <Alert tone="warning">
            No existe un turno visible para capturar arqueo o avanzar a cierre.
          </Alert>
        )}
      </Card>

      {activeSession ? (
        <>
          <Card>
            <h2>Iniciar cierre</h2>
            <form action={beginCashSessionCloseAction}>
              <input type="hidden" name="targetSessionId" value={activeSession.cashSessionId} />
              <Button type="submit">Marcar turno en cierre</Button>
            </form>
          </Card>

          <Card>
            <h2>Capturar conteo físico</h2>
            <form action={recordCashCountAction}>
              <input type="hidden" name="targetSessionId" value={activeSession.cashSessionId} />
              <Field label="Conteo total en caja" labelFor="countedAmount">
                <Input
                  id="countedAmount"
                  inputMode="decimal"
                  name="countedAmount"
                  placeholder="625.00"
                  required
                />
              </Field>
              <Button type="submit">Registrar conteo</Button>
            </form>
          </Card>
        </>
      ) : null}
    </Container>
  );
}
