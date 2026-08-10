import { Alert, AppLink, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ScholarshipsPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Becas y beneficios financieros</h1>
        <p>
          Esta superficie administra programas de beca, asignaciones individuales y aplicación
          controlada de beneficios sin modificar el monto original de los cargos.
        </p>
        <Alert tone="warning">
          Toda reducción monetaria se materializa mediante <code>charge_adjustments</code>. La beca
          revocada no reescribe historial ni recupera deuda automáticamente.
        </Alert>
      </Card>

      <Card>
        <h2>Rutas disponibles</h2>
        <nav aria-label="Becas y beneficios">
          <ul>
            <li>
              <AppLink href="/finanzas/becas/nuevo">Nuevo programa o asignación</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/becas/programa-ejemplo">Detalle de programa</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/descuentos">Descuentos y condonaciones</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
