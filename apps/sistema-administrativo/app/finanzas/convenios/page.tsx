import { Alert, AppLink, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AgreementsPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Convenios de pago</h1>
        <p>
          Los convenios organizan parcialidades y seguimiento verificable, pero no modifican por sí
          mismos el saldo adeudado ni los vencimientos originales de los cargos.
        </p>
        <Alert tone="warning">
          “El convenio organiza el pago y no modifica por sí mismo el saldo adeudado.”
        </Alert>
      </Card>

      <Card>
        <h2>Rutas disponibles</h2>
        <nav aria-label="Convenios de pago">
          <ul>
            <li>
              <AppLink href="/finanzas/convenios/nuevo">Nuevo convenio</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/convenios/convenio-ejemplo">Detalle de convenio</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
