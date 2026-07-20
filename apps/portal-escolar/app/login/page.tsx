import { AppLink, Card, Container } from "@preparatoria/ui";

export default function Page() {
  return (
    <Container>
      <Card>
        <h1>Portal Escolar</h1>
        <p>Seleccione el tipo de acceso.</p>
        <p>
          <AppLink href="/login/institucional">Acceso institucional</AppLink>
        </p>
        <p>
          <AppLink href="/login/aspirante">Acceso de aspirante</AppLink>
        </p>
      </Card>
    </Container>
  );
}
