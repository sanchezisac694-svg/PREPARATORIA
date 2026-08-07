import { Alert, AppLink, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Cobranza administrativa</h1>
        <p>
          Esta superficie deriva adeudos desde el ledger financiero existente y registra seguimiento
          administrativo sin crear una segunda contabilidad.
        </p>
        <Alert tone="warning">
          Los compromisos y casos no modifican cargos, pagos, ajustes ni vencimientos.
        </Alert>
      </Card>

      <Card>
        <h2>Rutas disponibles</h2>
        <nav aria-label="Cobranza administrativa">
          <ul>
            <li>
              <AppLink href="/finanzas/cobranza/adeudos">Adeudos</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/cobranza/nuevo">Nuevo caso</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/cobranza/caso-ejemplo">Detalle de caso</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
