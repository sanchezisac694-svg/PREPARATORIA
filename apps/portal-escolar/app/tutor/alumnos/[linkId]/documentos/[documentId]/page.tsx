import { Alert, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianAcademicDocumentsService } from "../../../../../../lib/academic-documents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianDocumentDetailPage({
  params,
}: Readonly<{ params: Promise<{ documentId: string; linkId: string }> }>) {
  noStore();
  const { documentId, linkId } = await params;
  const service = await getGuardianAcademicDocumentsService();

  try {
    const document = await service.getGuardianStudentDocument(linkId, documentId);
    return (
      <section className="student-portal-stack">
        <h1>{document.typeName}</h1>
        <Alert tone="info">La descarga del tutor permanece deshabilitada en esta etapa.</Alert>
        <Card>
          <p>Folio: {document.folio ?? "Pendiente"}</p>
          <p>Estado: {document.status}</p>
        </Card>
      </section>
    );
  } catch {
    return (
      <section className="student-portal-stack">
        <h1>Documento del alumno vinculado</h1>
        <Alert tone="warning">DOCUMENT_SCOPE_DENIED</Alert>
      </section>
    );
  }
}
