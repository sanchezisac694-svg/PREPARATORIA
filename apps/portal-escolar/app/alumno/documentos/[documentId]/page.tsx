import { Alert, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getStudentAcademicDocumentsService } from "../../../../lib/academic-documents";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentDocumentDetailPage({
  params,
}: Readonly<{ params: Promise<{ documentId: string }> }>) {
  noStore();
  const { documentId } = await params;
  const service = await getStudentAcademicDocumentsService();
  const document = await service.getMyDocument(documentId);
  const download = document.downloadAvailable
    ? await service.getMyDocumentDownload(documentId)
    : null;

  return (
    <section className="student-portal-stack">
      <h1>{document.typeName}</h1>
      <Alert tone="info">
        Documento informativo generado por el sistema. Su validez institucional está pendiente de
        confirmación.
      </Alert>
      <Card>
        <p>Folio: {document.folio ?? "Pendiente"}</p>
        <p>Estado: {document.status}</p>
        <p>Emisión: {new Date(document.issuedAt).toLocaleString("es-MX")}</p>
        <p>
          Descarga:{" "}
          {download ? `${download.mimeType} · ${download.sizeBytes} bytes` : "No disponible"}
        </p>
      </Card>
    </section>
  );
}
