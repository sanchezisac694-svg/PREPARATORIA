import { Alert, Card } from "@preparatoria/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VerifyDocumentPage() {
  return (
    <section className="student-portal-stack">
      <h1>Verificar documento</h1>
      <Alert tone="info">
        Ingrese folio y código de verificación desde una integración server-side autorizada.
      </Alert>
      <Card>
        <p>Estados públicos previstos: VIGENTE, REVOCADO, SUSTITUIDO, EXPIRADO y NO_VERIFICADO.</p>
        <p>Esta vista no expone datos personales ni académicos.</p>
      </Card>
    </section>
  );
}
