import { AppLink, Card, Container } from "@preparatoria/ui";

import { ApplicantLoginForm } from "../applicant-login-form";

export default function Page() {
  return (
    <Container>
      <Card>
        <h1>Acceso de aspirante</h1>
        <p>Portal Escolar</p>
        <ApplicantLoginForm />
        <AppLink href="/login">Volver</AppLink>
      </Card>
    </Container>
  );
}
