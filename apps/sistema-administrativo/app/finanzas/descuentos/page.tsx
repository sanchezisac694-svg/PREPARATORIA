import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Descuentos y condonaciones</h1>
        <p>
          Los descuentos autorizados y condonaciones reutilizan el flujo existente de ajustes y no
          crean un ledger paralelo.
        </p>
        <Alert tone="warning">
          Caja no aprueba descuentos sensibles ni condonaciones. Toda condonación exige segregación
          de creador y aprobador.
        </Alert>
      </Card>
    </Container>
  );
}
