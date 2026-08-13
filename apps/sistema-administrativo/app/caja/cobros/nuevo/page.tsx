import { Alert, Button, Card, Container, Field, Input, PageHeader, Select } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../../_admin/financial-feedback";
import { registerCashierPaymentAction } from "../../actions";
import { requireAdminAccess } from "../../../../lib/auth";
import { getCashRegisterAdapter } from "../../../../lib/cash-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const paymentMethods = ["CASH", "TRANSFER", "CARD", "OTHER_MANUAL_REVIEW"] as const;

export default async function NuevoCobroCajaPage({
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
        description="Registro presencial de pagos dentro del turno operativo visible."
        title="Nuevo cobro presencial"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Condiciones del flujo</h2>
        <ul>
          <li>El cobro se registra únicamente con un turno abierto.</li>
          <li>
            La cuenta del alumno debe proporcionarse como identificador administrativo válido.
          </li>
          <li>El navegador no decide qué cuenta cobrar ni cómo aplicar el pago.</li>
        </ul>
      </Card>

      <Card>
        <h2>Registrar cobro</h2>
        {!activeSession ? (
          <Alert tone="warning">
            No existe un turno abierto visible. Primero abre el turno de caja antes de registrar el
            cobro.
          </Alert>
        ) : (
          <form action={registerCashierPaymentAction}>
            <input type="hidden" name="sessionId" value={activeSession.cashSessionId} />
            <Field
              helpText="Usa el identificador administrativo de cuenta ya validado por la institución."
              label="Cuenta del alumno"
              labelFor="accountId"
            >
              <Input id="accountId" name="accountId" placeholder="UUID de cuenta" required />
            </Field>
            <Field label="Importe" labelFor="requestedAmount">
              <Input
                id="requestedAmount"
                inputMode="decimal"
                name="requestedAmount"
                placeholder="500.00"
                required
              />
            </Field>
            <Field label="Método de pago" labelFor="requestedMethod">
              <Select id="requestedMethod" name="requestedMethod" required>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method === "CASH"
                      ? "Efectivo"
                      : method === "TRANSFER"
                        ? "Transferencia"
                        : method === "CARD"
                          ? "Tarjeta"
                          : "Revisión manual"}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit">Registrar cobro</Button>
          </form>
        )}
      </Card>
    </Container>
  );
}
