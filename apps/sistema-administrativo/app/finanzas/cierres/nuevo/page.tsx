import { Alert, Card, Container } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewFinancialClosurePage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo cierre operativo</h1>
        <p>
          La creación exige AAL2, MFA, session_version vigente y segregación creator != approver.
        </p>
        <Alert tone="warning">
          PENDING_INSTITUTIONAL_VALIDATION: timezone institucional, periodos cerrables y responsable
          final de creación/aprobación.
        </Alert>
      </Card>
    </Container>
  );
}
