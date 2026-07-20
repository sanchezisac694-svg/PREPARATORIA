import { Card, Container } from "@preparatoria/ui";
import { MfaEnrollmentForm } from "./mfa-enrollment-form";

export default function ConfigureMfaPage() {
  return (
    <Container>
      <Card>
        <h1>Configurar autenticación reforzada</h1>
        <p>Usa una aplicación autenticadora TOTP para proteger tu cuenta.</p>
        <MfaEnrollmentForm />
      </Card>
    </Container>
  );
}
