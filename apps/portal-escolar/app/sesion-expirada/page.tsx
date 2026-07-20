import { Alert, Container } from "@preparatoria/ui";

export default function ExpiredSessionPage() {
  return (
    <Container>
      <Alert>Tu sesión ya no es válida. Inicia sesión nuevamente.</Alert>
    </Container>
  );
}
