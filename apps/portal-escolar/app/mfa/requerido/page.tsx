import { AppLink, Card, Container } from "@preparatoria/ui";

export default function MfaRequiredPage() {
  return (
    <Container>
      <Card>
        <h1>Autenticación reforzada requerida</h1>
        <p>Tu cuenta requiere un autenticador antes de continuar.</p>
        <AppLink href="/seguridad/mfa/configurar">Configurar ahora</AppLink>
      </Card>
    </Container>
  );
}
