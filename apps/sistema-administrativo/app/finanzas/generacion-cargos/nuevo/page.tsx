import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function NewChargeGenerationBatchPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo batch de cargos</h1>
        <p>
          El preview es obligatorio y debe mostrar candidatos, elegibles, excluidos, duplicados y
          revisión manual antes de crear el batch.
        </p>
        <Alert tone="warning">
          El navegador no decide elegibilidad ni montos; la resolución ocurre en PostgreSQL y el
          servicio server-only.
        </Alert>
      </Card>
    </Container>
  );
}
