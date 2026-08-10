import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function AgreementDetailPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Detalle de convenio</h1>
        <p>
          Aquí se mostrará el adeudo vigente, snapshot inicial, parcialidades, cumplimiento
          reconciliado y evaluación derivada.
        </p>
        <Alert tone="warning">
          El estatus <code>DEFAULTED</code> permanece manual y autorizado en esta versión.
        </Alert>
      </Card>
    </Container>
  );
}
