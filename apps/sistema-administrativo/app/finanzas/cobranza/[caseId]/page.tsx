import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CollectionCaseDetailPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Detalle de caso de cobranza</h1>
        <p>
          El detalle del caso debe mostrar deuda derivada, acciones append-only y compromiso activo
          sin exponer datos personales innecesarios.
        </p>
        <Alert tone="info">
          El alumno y el tutor no deben ver prioridad interna, notas, asignaciones ni workflow
          interno de cobranza.
        </Alert>
      </Card>
    </Container>
  );
}
