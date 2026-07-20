import { Card, Container } from "@preparatoria/ui";
import { MfaChallengeForm } from "./mfa-challenge-form";

export default function VerifyMfaPage() {
  return (
    <Container>
      <Card>
        <h1>Verificación reforzada</h1>
        <p>Ingresa el código de tu aplicación autenticadora.</p>
        <MfaChallengeForm />
      </Card>
    </Container>
  );
}
