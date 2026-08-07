import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function NewCollectionCasePage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo caso de cobranza</h1>
        <p>
          Solo puede abrirse si existe saldo vencido derivado. La apertura exige AAL2,
          session_version vigente, permiso exacto e idempotencia.
        </p>
        <Alert tone="warning">
          Abrir un caso no cambia el saldo, no crea pagos y no modifica el dominio académico.
        </Alert>
      </Card>
    </Container>
  );
}
