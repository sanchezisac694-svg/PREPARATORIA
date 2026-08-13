import { Alert, Button, Card, Container, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../_admin/financial-feedback";
import { FinancialStatusBadge } from "../../_admin/financial-labels";
import { approveCashDifferenceAction, closeCashSessionAction } from "../actions";
import { requireAdminAccess } from "../../../lib/auth";
import { getCashRegisterAdapter } from "../../../lib/cash-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaCierrePage({
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
        description="Cierre y aprobación segregada de diferencias del turno visible."
        title="Cierre de caja"
      />

      <FinancialActionFeedback {...feedback} />

      {!activeSession ? (
        <Card>
          <Alert tone="warning">No existe un turno visible para cerrar o conciliar.</Alert>
        </Card>
      ) : (
        <>
          <Card>
            <h2>Estado del turno</h2>
            <ul>
              <li>
                Estado: <FinancialStatusBadge value={activeSession.status} />
              </li>
              <li>Diferencia visible: {activeSession.differenceAmount ?? "No calculada"}</li>
              <li>Conteo registrado: {activeSession.countedCashAmount ?? "Pendiente"}</li>
              <li>CANCELLED permanece fuera del flujo operativo de V1.</li>
            </ul>
          </Card>

          <Card>
            <h2>Registrar cierre</h2>
            <form action={closeCashSessionAction}>
              <input type="hidden" name="targetSessionId" value={activeSession.cashSessionId} />
              <Button type="submit">Registrar cierre</Button>
            </form>
          </Card>

          <Card>
            <h2>Aprobar diferencia</h2>
            <Alert tone="info">
              Usa esta acción solo cuando el backend ya marcó que la diferencia requiere aprobación
              segregada.
            </Alert>
            <form action={approveCashDifferenceAction}>
              <input type="hidden" name="targetSessionId" value={activeSession.cashSessionId} />
              <Button type="submit" variant="secondary">
                Aprobar diferencia
              </Button>
            </form>
          </Card>
        </>
      )}
    </Container>
  );
}
