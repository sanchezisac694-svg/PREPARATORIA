import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CajaCierrePage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Cierre de turno</h1>
        <p>El cierre persiste un snapshot final y nunca reescribe historia de sesiones cerradas.</p>
      </Card>

      <Card>
        <h2>Reglas críticas</h2>
        <ul>
          <li>OPEN → CLOSING bloquea nuevos vínculos de pago y movimientos.</li>
          <li>Difference = 0: conciliación balanceada y cierre inmediato.</li>
          <li>Difference ≠ 0: RECONCILIATION_REQUIRED y aprobación segregada.</li>
          <li>
            Reversos posteriores afectan el momento operativo futuro, no el snapshot histórico.
          </li>
        </ul>
        <Alert tone="warning">CANCELLED permanece fuera del flujo operativo de V1.</Alert>
      </Card>
    </Container>
  );
}
