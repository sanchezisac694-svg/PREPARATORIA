import { Alert, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianAcademicDocumentsService } from "../../../../../lib/academic-documents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianDocumentsPage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianAcademicDocumentsService();

  try {
    const documents = await service.getGuardianStudentDocuments(linkId);
    return (
      <section className="student-portal-stack">
        <h1>Documentos del alumno vinculado</h1>
        <Alert tone="info">
          Documento informativo generado por el sistema. Su validez institucional está pendiente de
          confirmación.
        </Alert>
        {documents.length === 0 ? (
          <Card>
            <p>No hay documentos visibles o el alcance documental sigue deshabilitado.</p>
          </Card>
        ) : (
          documents.map((document) => (
            <Card key={document.documentId}>
              <h2>{document.typeName}</h2>
              <p>Folio: {document.folio ?? "Pendiente"}</p>
              <p>Estado: {document.status}</p>
            </Card>
          ))
        )}
      </section>
    );
  } catch (error) {
    return (
      <section className="student-portal-stack">
        <h1>Documentos del alumno vinculado</h1>
        <Alert tone="warning">
          {(error as Error).message.includes("documental")
            ? "El alcance documental del tutor permanece deshabilitado."
            : "No fue posible consultar los documentos autorizados."}
        </Alert>
      </section>
    );
  }
}
