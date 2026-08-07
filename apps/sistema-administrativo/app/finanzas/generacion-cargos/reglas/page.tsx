import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ChargeGenerationRulesPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Reglas de generación</h1>
        <p>
          Cada regla define qué concepto financiero aplica y qué tipo de generación académica
          representa.
        </p>
        <Alert tone="info">
          Las versiones activas quedan inmutables y la periodicidad institucional sigue pendiente de
          validación.
        </Alert>
      </Card>
    </Container>
  );
}
