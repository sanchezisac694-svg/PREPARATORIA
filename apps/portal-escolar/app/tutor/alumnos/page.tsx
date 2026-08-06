import { AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../lib/guardian-portal";
import { GuardianPortalEmpty, GuardianPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentsPage() {
  noStore();
  const service = await getGuardianPortalService();
  const linkedStudents = await service.getLinkedStudents();
  const rows = Array.isArray(linkedStudents) ? linkedStudents : [];

  return (
    <GuardianPortalSection title="Alumnos vinculados">
      {rows.length > 0 ? (
        <div className="student-portal-stack">
          {rows.map((student, index) => {
            const row = typeof student === "object" && student !== null ? student : {};
            const linkId = String((row as Record<string, unknown>).linkId ?? "");
            return (
              <Card key={linkId || index}>
                <h3>
                  {String(
                    (row as Record<string, unknown>).institutionalStudentCode ?? "Alumno vinculado",
                  )}
                </h3>
                <p className="technical-reference">
                  Estado: {String((row as Record<string, unknown>).linkStatus ?? "Desconocido")}
                </p>
                <p className="technical-reference">
                  Relación:{" "}
                  {String((row as Record<string, unknown>).relationshipType ?? "Pendiente")}
                </p>
                <AppLink href={`/tutor/alumnos/${linkId}`}>Abrir vista del alumno</AppLink>
              </Card>
            );
          })}
        </div>
      ) : (
        <GuardianPortalEmpty message="No hay alumnos vinculados visibles para esta cuenta." />
      )}
    </GuardianPortalSection>
  );
}
