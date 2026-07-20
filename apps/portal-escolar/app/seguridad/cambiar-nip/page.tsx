import { Card, Container } from "@preparatoria/ui";

import { requirePortalAccess } from "../../../lib/auth";
import { ChangeNipForm } from "./change-nip-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePortalAccess();
  return (
    <Container>
      <Card>
        <h1>Cambiar NIP</h1>
        <p>Confirma tu NIP actual antes de establecer uno nuevo.</p>
        <ChangeNipForm />
      </Card>
    </Container>
  );
}
