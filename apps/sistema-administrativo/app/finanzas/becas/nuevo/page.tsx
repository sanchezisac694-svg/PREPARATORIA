import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function NewScholarshipPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo programa o asignación de beca</h1>
        <p>
          La captura definitiva se realizará server-side. Esta vista deja documentado el flujo
          aprobado: crear, someter, aprobar, activar y después aplicar sobre cargos elegibles.
        </p>
        <Alert tone="info">
          Los porcentajes, topes, conceptos elegibles y reglas de combinación siguen marcados como
          <strong> PENDING_INSTITUTIONAL_VALIDATION</strong>.
        </Alert>
      </Card>
    </Container>
  );
}
