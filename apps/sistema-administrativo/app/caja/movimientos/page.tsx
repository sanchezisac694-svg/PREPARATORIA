import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CajaMovimientosPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Movimientos manuales</h1>
        <p>Solo contempla movimientos técnicos permitidos sobre un turno OPEN.</p>
      </Card>

      <Card>
        <h2>Catálogo cerrado provisional</h2>
        <ul>
          <li>CHANGE_FUND_ADDITION</li>
          <li>SAFE_DROP</li>
          <li>CASH_TRANSFER</li>
          <li>CORRECTION</li>
          <li>OTHER_MANUAL_REVIEW</li>
        </ul>
        <Alert tone="info">
          No se aceptan justificaciones libres como única evidencia y no existe cancelación
          operativa del turno en esta versión.
        </Alert>
      </Card>
    </Container>
  );
}
