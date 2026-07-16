"use client";

import { normalizeError } from "@preparatoria/shared";
import { Alert, Button, Card, Container } from "@preparatoria/ui";

type ErrorPageProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const normalized = normalizeError(error);

  return (
    <Container>
      <Card>
        <h1>Error técnico</h1>
        <Alert tone="error">{normalized.message}</Alert>
        <Button onClick={reset}>Reintentar</Button>
        <p className="technical-reference">Referencia: {normalized.correlationId}</p>
      </Card>
    </Container>
  );
}
