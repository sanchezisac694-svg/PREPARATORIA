import { AppLink, Card, Container } from "@preparatoria/ui";

import { InstitutionalLoginForm } from "../institutional-login-form";

export default function Page() {
  return (
    <Container>
      <Card>
        <h1>Acceso institucional</h1>
        <p>Portal Escolar</p>
        <InstitutionalLoginForm />
        <AppLink href="/login">Volver</AppLink>
      </Card>
    </Container>
  );
}
