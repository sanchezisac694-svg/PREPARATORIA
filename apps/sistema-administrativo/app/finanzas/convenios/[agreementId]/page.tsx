import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, isUuid, readFeedback } from "../../../_admin/financial-feedback";
import {
  approvePaymentAgreementAction,
  cancelPaymentAgreementAction,
  markPaymentAgreementDefaultedAction,
  reconcilePaymentAgreementInstallmentAction,
} from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";
import { getPaymentAgreementsAdapter } from "../../../../lib/payment-agreements";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgreementDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ agreementId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ agreementId }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const feedback = readFeedback(query);
  const evaluation = isUuid(agreementId)
    ? await getPaymentAgreementsAdapter()
        .then((adapter) =>
          adapter.evaluate({
            target_payment_agreement_id: agreementId,
          }),
        )
        .catch(() => null)
    : null;

  return (
    <Container>
      <PageHeader
        description="Seguimiento y operaciones permitidas sobre un convenio identificado."
        title="Detalle de convenio"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        {evaluation ? (
          <ul>
            <li>Estado de evaluación: {evaluation.evaluationStatus}</li>
            <li>Parcialidades con vencimiento: {evaluation.installmentsDue}</li>
            <li>Parcialidades vencidas: {evaluation.installmentsPastDue}</li>
            <li>Total programado: {evaluation.totalScheduled}</li>
            <li>Total cumplido: {evaluation.totalFulfilled}</li>
            <li>Saldo restante: {evaluation.remainingAgreementAmount}</li>
          </ul>
        ) : (
          <Alert tone="info">
            El contrato actual permite evaluar convenios por identificador válido. Si no hay lectura
            disponible para este identificador, la vista queda operativa parcial.
          </Alert>
        )}
      </Card>

      {isUuid(agreementId) ? (
        <>
          <Card>
            <h2>Aprobar convenio</h2>
            <form action={approvePaymentAgreementAction}>
              <input type="hidden" name="targetPaymentAgreementId" value={agreementId} />
              <Button type="submit">Aprobar convenio</Button>
            </form>
          </Card>

          <Card>
            <h2>Conciliar parcialidad</h2>
            <form action={reconcilePaymentAgreementInstallmentAction}>
              <input type="hidden" name="targetPaymentAgreementId" value={agreementId} />
              <Field label="Parcialidad" labelFor="targetInstallmentId">
                <Input
                  id="targetInstallmentId"
                  name="targetInstallmentId"
                  placeholder="UUID de la parcialidad"
                  required
                />
              </Field>
              <Button type="submit">Conciliar parcialidad</Button>
            </form>
          </Card>

          <Card>
            <h2>Cancelar convenio</h2>
            <form action={cancelPaymentAgreementAction}>
              <input type="hidden" name="targetPaymentAgreementId" value={agreementId} />
              <Field label="Motivo" labelFor="cancelReason">
                <Input
                  id="cancelReason"
                  name="requestedReason"
                  placeholder="Motivo administrativo"
                  required
                />
              </Field>
              <Button type="submit" variant="secondary">
                Cancelar convenio
              </Button>
            </form>
          </Card>

          <Card>
            <h2>Marcar incumplimiento</h2>
            <form action={markPaymentAgreementDefaultedAction}>
              <input type="hidden" name="targetPaymentAgreementId" value={agreementId} />
              <Field label="Motivo" labelFor="defaultReason">
                <Input
                  id="defaultReason"
                  name="requestedReason"
                  placeholder="Incumplimiento documentado"
                  required
                />
              </Field>
              <Button type="submit">Registrar incumplimiento</Button>
            </form>
          </Card>
        </>
      ) : null}
    </Container>
  );
}
