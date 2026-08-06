import { AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../lib/guardian-portal";
import { GuardianPortalEmpty, GuardianPortalMetric, GuardianPortalSection } from "./_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianOverviewPage() {
  noStore();
  const service = await getGuardianPortalService();
  const overview = await service.getPortalOverview();
  const linkedStudents = Array.isArray(overview.linkedStudents) ? overview.linkedStudents : [];

  return (
    <>
      <GuardianPortalSection
        title="Resumen del acceso"
        description="El servidor resuelve la sesión del tutor y limita la consulta a vínculos activos y vigentes."
      >
        <div className="student-portal-grid">
          <GuardianPortalMetric
            label="Alumnos vinculados"
            value={String(overview.totalLinkedStudents ?? linkedStudents.length)}
          />
          <GuardianPortalMetric label="Scope técnico" value="STANDARD_ACADEMIC_READ" />
        </div>
      </GuardianPortalSection>

      <GuardianPortalSection title="Acceso disponible">
        {linkedStudents.length > 0 ? (
          <div className="student-portal-stack">
            {linkedStudents.map((student, index) => {
              const row = typeof student === "object" && student !== null ? student : {};
              const linkId = String((row as Record<string, unknown>).linkId ?? "");
              return (
                <Card key={linkId || index}>
                  <h3>
                    Alumno{" "}
                    {String(
                      (row as Record<string, unknown>).institutionalStudentCode ?? "sin código",
                    )}
                  </h3>
                  <p className="technical-reference">
                    Relación:{" "}
                    {String((row as Record<string, unknown>).relationshipType ?? "Pendiente")}
                  </p>
                  <p className="technical-reference">
                    Estado del vínculo:{" "}
                    {String((row as Record<string, unknown>).linkStatus ?? "Desconocido")}
                  </p>
                  <AppLink href={`/tutor/alumnos/${linkId}`}>Consultar alumno vinculado</AppLink>
                </Card>
              );
            })}
          </div>
        ) : (
          <GuardianPortalEmpty message="Todavía no existe un vínculo institucional activo visible para esta cuenta." />
        )}
      </GuardianPortalSection>
    </>
  );
}
