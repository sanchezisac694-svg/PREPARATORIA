import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CajaArqueoPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Arqueo de caja</h1>
        <p>El arqueo usa conteo total, append-only y un turno en estado CLOSING.</p>
        <Alert tone="info">
          El efectivo esperado se deriva en PostgreSQL; no se persiste ni recalcula en cliente.
        </Alert>
      </Card>

      <Card>
        <h2>Reglas visibles</h2>
        <ul>
          <li>Conteo obligatorio antes del cierre.</li>
          <li>Sin diferencia: cierre balanceado.</li>
          <li>Con diferencia: conciliación requerida.</li>
          <li>El cajero no puede aprobar su propia diferencia.</li>
        </ul>
      </Card>
    </Container>
  );
}
