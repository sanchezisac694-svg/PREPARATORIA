import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function NewAgreementPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo convenio de pago</h1>
        <p>
          La captura final generará calendario explícito, snapshot de adeudo y reconciliación
          posterior contra pagos reales ya confirmados.
        </p>
        <Alert tone="info">
          No se crean pagos, no se mueven vencimientos de cargos y no se cierra cobranza por el
          simple hecho de aprobar el convenio.
        </Alert>
      </Card>
    </Container>
  );
}
