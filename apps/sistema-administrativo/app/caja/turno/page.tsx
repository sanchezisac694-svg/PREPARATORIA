import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CajaTurnoPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Turno de caja</h1>
        <p>Vista técnica del turno actual, sin exponer todavía datos operativos reales.</p>
        <Alert tone="info">
          El turno solo puede abrirse con caja activa, asignación vigente, AAL2, MFA y
          session_version válida.
        </Alert>
      </Card>

      <Card>
        <h2>Estados previstos</h2>
        <ul>
          <li>OPEN: cobros y movimientos permitidos.</li>
          <li>CLOSING: nuevos vínculos de pago y movimientos bloqueados.</li>
          <li>RECONCILIATION_REQUIRED: diferencia detectada y pendiente de aprobación.</li>
          <li>CLOSED: snapshot final inmutable.</li>
          <li>CANCELLED: reservado para evolución futura, sin transición operativa en V1.</li>
        </ul>
      </Card>
    </Container>
  );
}
