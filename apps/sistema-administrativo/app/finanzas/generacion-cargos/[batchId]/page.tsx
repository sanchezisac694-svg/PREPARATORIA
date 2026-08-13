import { Alert, Button, Card, Container, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, isUuid, readFeedback } from "../../../_admin/financial-feedback";
import {
  approveChargeGenerationBatchAction,
  executeChargeGenerationBatchAction,
  submitChargeGenerationBatchAction,
} from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChargeGenerationBatchDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ batchId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const [{ batchId }, query] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const feedback = readFeedback(query);

  return (
    <Container>
      <PageHeader
        description="Acciones permitidas sobre un lote ya identificado por backend."
        title="Detalle de lote"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        {isUuid(batchId) ? (
          <Alert tone="info">
            El contrato actual permite someter, aprobar y ejecutar el lote indicado, pero todavía no
            expone un DTO de lectura completa de detalle de lote para esta pantalla. El backend
            revalida cuenta activa, enrollment elegible, exclusiones y duplicados antes de ejecutar.
          </Alert>
        ) : (
          <Alert tone="warning">
            El identificador visible no corresponde a un lote operativo válido. Esta vista queda
            como dependencia backend para lectura detallada.
          </Alert>
        )}
      </Card>

      {isUuid(batchId) ? (
        <>
          <Card>
            <h2>Someter a revisión</h2>
            <form action={submitChargeGenerationBatchAction}>
              <input type="hidden" name="targetBatchId" value={batchId} />
              <Button type="submit">Someter lote</Button>
            </form>
          </Card>

          <Card>
            <h2>Aprobar</h2>
            <form action={approveChargeGenerationBatchAction}>
              <input type="hidden" name="targetBatchId" value={batchId} />
              <Button type="submit" variant="secondary">
                Aprobar lote
              </Button>
            </form>
          </Card>

          <Card>
            <h2>Ejecutar</h2>
            <form action={executeChargeGenerationBatchAction}>
              <input type="hidden" name="targetBatchId" value={batchId} />
              <Button type="submit">Ejecutar lote</Button>
            </form>
          </Card>
        </>
      ) : null}
    </Container>
  );
}
