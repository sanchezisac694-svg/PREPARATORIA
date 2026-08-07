import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function OverdueAccountsPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Adeudos derivados</h1>
        <p>
          El listado es server-side, paginado y muestra solo identidad mínima, vencimiento y estado
          del caso.
        </p>
        <Alert tone="info">
          No se muestran UUIDs internos, correos, teléfonos ni notas internas de cobranza.
        </Alert>
      </Card>
    </Container>
  );
}
