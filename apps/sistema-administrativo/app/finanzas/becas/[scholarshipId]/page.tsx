import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ScholarshipDetailPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Detalle de beca o programa</h1>
        <p>
          Aquí se presentará el estado del programa, asignaciones activas, aplicaciones sobre cargos
          y trazabilidad hacia ajustes financieros.
        </p>
        <Alert tone="warning">
          La autorización final siempre depende de AAL2, MFA y <code>session_version</code> vigente.
        </Alert>
      </Card>
    </Container>
  );
}
