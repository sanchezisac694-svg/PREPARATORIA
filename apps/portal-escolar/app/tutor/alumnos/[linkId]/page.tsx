import { AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../lib/guardian-portal";
import { GuardianPortalMetric, GuardianPortalSection } from "../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentPage({
  params,
}: Readonly<{
  params: Promise<{ linkId: string }>;
}>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const overview = await service.getStudentOverview(linkId);
  const student =
    typeof overview.student === "object" && overview.student !== null
      ? (overview.student as Record<string, unknown>)
      : {};
  const selectedPeriod =
    typeof overview.selectedPeriod === "object" && overview.selectedPeriod !== null
      ? (overview.selectedPeriod as Record<string, unknown>)
      : null;

  return (
    <>
      <GuardianPortalSection title="Alumno autorizado">
        <div className="student-portal-grid">
          <GuardianPortalMetric
            label="Código institucional"
            value={String(student.institutionalStudentCode ?? "No visible")}
          />
          <GuardianPortalMetric
            label="Semestre actual"
            value={String(student.currentSemesterNumber ?? "Sin dato")}
          />
          <GuardianPortalMetric
            label="Periodo seguro"
            value={selectedPeriod ? String(selectedPeriod.name ?? "Sin nombre") : "Sin periodo"}
          />
        </div>
      </GuardianPortalSection>

      <GuardianPortalSection title="Consultas académicas">
        <div className="student-portal-stack">
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/expediente`}>Expediente</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/materias`}>Materias</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/horario`}>Horario</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/asistencia`}>Asistencia</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/permisos`}>Permisos</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/calificaciones`}>Calificaciones</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/trayectoria`}>Trayectoria</AppLink>
          </Card>
          <Card>
            <AppLink href={`/tutor/alumnos/${linkId}/estado-cuenta`}>Estado de cuenta</AppLink>
          </Card>
        </div>
      </GuardianPortalSection>
    </>
  );
}
