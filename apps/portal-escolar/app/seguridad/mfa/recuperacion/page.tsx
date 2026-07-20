import { AppLink, Card, Container } from "@preparatoria/ui";

export default function MfaRecoveryInformationPage() {
  return (
    <Container>
      <Card>
        <h1>Recuperación del segundo factor</h1>
        <p>
          La recuperación requiere validación institucional. Después de su autorización deberás
          iniciar sesión y configurar un nuevo autenticador.
        </p>
        <AppLink href="/seguridad/mfa/configurar">Configurar nuevo factor</AppLink>
      </Card>
    </Container>
  );
}
