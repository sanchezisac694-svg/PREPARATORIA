import { Button, Card, Container, PageHeader, SectionCard, StatusBadge } from "@preparatoria/ui";

import { getRoleDisplayName } from "../_admin/navigation";
import { logoutAction } from "../actions";
import { requireAdminAccess } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await requireAdminAccess();
  const readableRoles = identity.context.roleCodes.map(getRoleDisplayName);

  return (
    <Container>
      <PageHeader
        actions={
          <form action={logoutAction}>
            <Button size="sm" type="submit" variant="secondary">
              Cerrar sesión
            </Button>
          </form>
        }
        description="La sesión institucional está activa y el shell administrativo ya organiza la navegación principal."
        title="Inicio"
      />

      <SectionCard
        description="Resumen inicial de la cuenta autenticada dentro del nuevo shell administrativo."
        title="Contexto de sesión"
      >
        <Card variant="metric">
          <h2>Roles activos</h2>
          <div className="dashboard-role-list">
            {readableRoles.map((role) => (
              <StatusBadge key={role} tone="info">
                {role}
              </StatusBadge>
            ))}
          </div>
        </Card>
      </SectionCard>
    </Container>
  );
}
