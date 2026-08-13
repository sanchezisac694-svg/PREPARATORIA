import { Alert, Button, Card, Container, Field, Input, PageHeader, Select } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../_admin/financial-feedback";
import { registerCashMovementAction } from "../actions";
import { requireAdminAccess } from "../../../lib/auth";
import { getCashRegisterAdapter } from "../../../lib/cash-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const movementTypes = ["CASH_IN", "CASH_OUT", "CASH_WITHDRAWAL", "CASH_TRANSFER"] as const;
const reasonCodes = [
  "CHANGE_FUND_ADDITION",
  "SAFE_DROP",
  "CASH_TRANSFER",
  "CORRECTION",
  "OTHER_MANUAL_REVIEW",
] as const;

export default async function CajaMovimientosPage({
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
        description="Registro controlado de entradas y salidas manuales del turno visible."
        title="Movimientos manuales"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Catálogo disponible</h2>
        <ul>
          {reasonCodes.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2>Registrar movimiento</h2>
        {!activeSession ? (
          <Alert tone="warning">
            No existe un turno abierto visible. Los movimientos manuales requieren un turno OPEN.
          </Alert>
        ) : (
          <form action={registerCashMovementAction}>
            <input type="hidden" name="targetSessionId" value={activeSession.cashSessionId} />
            <Field label="Tipo de movimiento" labelFor="movementType">
              <Select id="movementType" name="movementType" required>
                {movementTypes.map((movementType) => (
                  <option key={movementType} value={movementType}>
                    {movementType}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Motivo" labelFor="reasonCode">
              <Select id="reasonCode" name="reasonCode" required>
                {reasonCodes.map((reasonCode) => (
                  <option key={reasonCode} value={reasonCode}>
                    {reasonCode}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Importe" labelFor="amount">
              <Input id="amount" inputMode="decimal" name="amount" placeholder="25.00" required />
            </Field>
            <Button type="submit">Registrar movimiento</Button>
          </form>
        )}
      </Card>
    </Container>
  );
}
