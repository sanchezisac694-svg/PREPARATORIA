import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ChargeGenerationBatchDetailPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Detalle de batch</h1>
        <p>
          El detalle del batch debe exponer solo identidad mínima, elegibilidad, monto congelado,
          vencimiento y resultado por item.
        </p>
        <Alert tone="info">
          La ejecución revalida cuenta activa, enrollment elegible, exclusiones y duplicados antes
          de crear o postear cada cargo.
        </Alert>
      </Card>
    </Container>
  );
}
