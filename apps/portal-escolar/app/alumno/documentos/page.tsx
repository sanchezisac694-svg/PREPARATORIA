import { Alert, AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getStudentAcademicDocumentsService } from "../../../lib/academic-documents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentDocumentsPage() {
  noStore();
  const service = await getStudentAcademicDocumentsService();
  const documents = await service.getMyDocuments();

  return (
    <section className="student-portal-stack">
      <h1>Mis documentos</h1>
      <Alert tone="info">
        Documento informativo generado por el sistema. Su validez institucional está pendiente de
        confirmación.
      </Alert>
      {documents.length === 0 ? (
        <Card>
          <p>No hay documentos publicados visibles para esta cuenta.</p>
        </Card>
      ) : (
        documents.map((document) => (
          <Card key={document.documentId}>
            <h2>{document.typeName}</h2>
            <p>Folio: {document.folio ?? "Pendiente"}</p>
            <p>Estado: {document.status}</p>
            <p>Emisión: {new Date(document.issuedAt).toLocaleString("es-MX")}</p>
            <AppLink href={`/alumno/documentos/${document.documentId}`}>Consultar detalle</AppLink>
          </Card>
        ))
      )}
    </section>
  );
}
