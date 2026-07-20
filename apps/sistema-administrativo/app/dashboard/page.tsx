import { Card, Container } from "@preparatoria/ui";
import { logoutAction } from "../actions";
import { requireAdminAccess } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const identity = await requireAdminAccess();
  return (
    <Container>
      <Card>
        <h1>Sistema Administrativo</h1>
        <p>Sesión institucional activa</p>
        <p className="technical-reference">Roles: {identity.context.roleCodes.join(", ")}</p>
        <form action={logoutAction}>
          <button type="submit">Cerrar sesión</button>
        </form>
      </Card>
    </Container>
  );
}
