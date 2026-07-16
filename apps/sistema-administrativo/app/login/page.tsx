import { Card, Container } from "@preparatoria/ui";
import { LoginForm } from "./login-form";
export default function Page() {
  return (
    <Container>
      <Card>
        <h1>Sistema Administrativo</h1>
        <p>Acceso institucional</p>
        <LoginForm />
      </Card>
    </Container>
  );
}
