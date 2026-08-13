import {
  Alert,
  Button,
  Card,
  Container,
  DateDisplay,
  DescriptionItem,
  DescriptionList,
  Field,
  FormMessage,
  Input,
  PageHeader,
  Select,
} from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../_admin/financial-feedback";
import { FinancialStatusBadge } from "../../_admin/financial-labels";
import { openCashSessionAction } from "../actions";
import { requireAdminAccess } from "../../../lib/auth";
import { getCashRegisterAdapter } from "../../../lib/cash-register";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaTurnoPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ activeSession, registers }, params] = await Promise.all([
    getCashRegisterAdapter().then((adapter) => adapter.getOverview()),
    searchParams ?? Promise.resolve({}),
  ]);
  const feedback = readFeedback(params);

  return (
    <Container>
      <PageHeader
        description="Apertura controlada y consulta del turno operativo actual."
        title="Turno de caja"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Estado visible del turno</h2>
        {activeSession ? (
          <DescriptionList>
            <DescriptionItem
              label="Estado"
              value={<FinancialStatusBadge value={activeSession.status} />}
            />
            <DescriptionItem
              label="Fecha de operación"
              value={<DateDisplay value={activeSession.businessDate} />}
            />
            <DescriptionItem label="Apertura" value={activeSession.openingAmount} />
            <DescriptionItem
              label="Efectivo esperado"
              value={activeSession.expectedCashAmount ?? "Pendiente"}
            />
            <DescriptionItem
              label="Conteo visible"
              value={activeSession.countedCashAmount ?? "Todavía no capturado"}
            />
          </DescriptionList>
        ) : (
          <Alert tone="info">
            No existe un turno abierto visible. Si tu cuenta tiene permiso y una caja asignada,
            puedes abrirlo desde esta pantalla.
          </Alert>
        )}
      </Card>

      <Card>
        <h2>Apertura de turno</h2>
        {registers.length === 0 ? (
          <Alert tone="warning">
            No hay cajas visibles para abrir turno. Esto suele indicar que falta una asignación o
            que la lectura detallada depende de backend.
          </Alert>
        ) : activeSession ? (
          <FormMessage tone="info">
            Ya existe un turno visible. Las nuevas aperturas quedan bloqueadas hasta cerrarlo o
            conciliarlo.
          </FormMessage>
        ) : (
          <form action={openCashSessionAction}>
            <Field label="Caja" labelFor="targetRegisterId">
              <Select id="targetRegisterId" name="targetRegisterId" required>
                {registers.map((register) => (
                  <option key={register.cashRegisterId} value={register.cashRegisterId}>
                    {register.name} ({register.code})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha de operación" labelFor="requestedBusinessDate">
              <Input id="requestedBusinessDate" name="requestedBusinessDate" required type="date" />
            </Field>
            <Field label="Monto de apertura" labelFor="openingAmount">
              <Input
                id="openingAmount"
                inputMode="decimal"
                name="openingAmount"
                placeholder="150.00"
                required
              />
            </Field>
            <Button type="submit">Abrir turno</Button>
          </form>
        )}
      </Card>
    </Container>
  );
}
