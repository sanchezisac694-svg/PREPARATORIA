import { Alert, Button, Card, Container, Field, Input, PageHeader, Select } from "@preparatoria/ui";

import { FinancialActionFeedback, isUuid, readFeedback } from "../../../_admin/financial-feedback";
import {
  addCollectionActionAction,
  closeCollectionCaseAction,
  createPaymentCommitmentAction,
} from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CollectionCaseDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ caseId }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const feedback = readFeedback(query);

  return (
    <Container>
      <PageHeader
        description="Seguimiento operativo de un caso ya identificado por backend."
        title="Detalle de caso de cobranza"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Disponibilidad del detalle</h2>
        {isUuid(caseId) ? (
          <Alert tone="info">
            El contrato actual permite mutaciones sobre el caso identificado, pero todavía no expone
            un DTO de lectura completa de caso para esta pantalla.
          </Alert>
        ) : (
          <Alert tone="warning">
            {
              "El identificador visible no corresponde a un caso operativo válido. Esta pantalla queda clasificada como dependencia backend para lectura detallada. El alumno y el tutor no deben ver prioridades internas, notas o workflow administrativo."
            }
          </Alert>
        )}
      </Card>

      {isUuid(caseId) ? (
        <>
          <Card>
            <h2>Registrar seguimiento</h2>
            <form action={addCollectionActionAction}>
              <input type="hidden" name="requestedCollectionCaseId" value={caseId} />
              <Field label="Tipo de seguimiento" labelFor="requestedActionType">
                <Select id="requestedActionType" name="requestedActionType" required>
                  <option value="PHONE_CONTACT">Contacto telefónico</option>
                  <option value="EMAIL_CONTACT">Contacto por correo</option>
                  <option value="IN_PERSON_CONTACT">Contacto presencial</option>
                  <option value="NOTICE_DELIVERED">Aviso entregado</option>
                  <option value="CASE_REVIEWED">Caso revisado</option>
                </Select>
              </Field>
              <Field label="Canal" labelFor="requestedContactChannel">
                <Select id="requestedContactChannel" name="requestedContactChannel" required>
                  <option value="PHONE">Teléfono</option>
                  <option value="EMAIL">Correo</option>
                  <option value="IN_PERSON">Presencial</option>
                  <option value="OTHER">Otro</option>
                </Select>
              </Field>
              <Field label="Resumen factual" labelFor="requestedSummary">
                <Input
                  id="requestedSummary"
                  name="requestedSummary"
                  placeholder="Seguimiento administrativo factual"
                  required
                />
              </Field>
              <Button type="submit">Registrar seguimiento</Button>
            </form>
          </Card>

          <Card>
            <h2>Registrar compromiso</h2>
            <form action={createPaymentCommitmentAction}>
              <input type="hidden" name="requestedCollectionCaseId" value={caseId} />
              <Field label="Cuenta del alumno" labelFor="requestedStudentAccountId">
                <Input
                  id="requestedStudentAccountId"
                  name="requestedStudentAccountId"
                  placeholder="UUID de cuenta"
                  required
                />
              </Field>
              <Field label="Monto prometido" labelFor="requestedPromisedAmount">
                <Input
                  id="requestedPromisedAmount"
                  inputMode="decimal"
                  name="requestedPromisedAmount"
                  placeholder="500.00"
                  required
                />
              </Field>
              <Field label="Fecha compromiso" labelFor="requestedPromisedDate">
                <Input
                  id="requestedPromisedDate"
                  name="requestedPromisedDate"
                  required
                  type="date"
                />
              </Field>
              <Field label="Notas" labelFor="requestedNotes">
                <Input
                  id="requestedNotes"
                  name="requestedNotes"
                  placeholder="Compromiso administrativo"
                />
              </Field>
              <Button type="submit">Registrar compromiso</Button>
            </form>
          </Card>

          <Card>
            <h2>Cerrar caso</h2>
            <form action={closeCollectionCaseAction}>
              <input type="hidden" name="requestedCollectionCaseId" value={caseId} />
              <Field label="Motivo de cierre" labelFor="requestedCloseReasonCode">
                <Select id="requestedCloseReasonCode" name="requestedCloseReasonCode" required>
                  <option value="BALANCE_SETTLED">Saldo atendido</option>
                  <option value="ADMINISTRATIVE_CLOSURE">Cierre administrativo</option>
                </Select>
              </Field>
              <Button type="submit">Cerrar caso</Button>
            </form>
          </Card>
        </>
      ) : null}
    </Container>
  );
}
