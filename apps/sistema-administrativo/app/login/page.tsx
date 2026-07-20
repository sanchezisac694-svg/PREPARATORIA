import { Card, Container } from "@preparatoria/ui";
import { InstitutionalLoginForm } from "./institutional-login-form";

export default function Page() {
  return (
    <Container>
      <Card>
        <h1>Sistema Administrativo</h1>
        <p>Acceso institucional</p>
        <InstitutionalLoginForm />
      </Card>
    </Container>
  );
}
