import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalMetric, StudentPortalSection } from "./_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentOverviewPage() {
  noStore();
  const service = await getStudentPortalService();
  const overview = await service.getOverview();
  const selectedPeriod =
    typeof overview.selectedPeriod === "object" && overview.selectedPeriod !== null
      ? (overview.selectedPeriod as Record<string, unknown>)
      : null;
  const metrics =
    typeof overview.metrics === "object" && overview.metrics !== null
      ? (overview.metrics as Record<string, unknown>)
      : {};
  const attendance =
    typeof overview.attendance === "object" && overview.attendance !== null
      ? (overview.attendance as Record<string, unknown>)
      : {};
  const summary =
    typeof overview.summary === "object" && overview.summary !== null
      ? (overview.summary as Record<string, unknown>)
      : null;

  return (
    <>
      <StudentPortalSection
        description="El servidor resuelve automáticamente el expediente del alumno autenticado."
        title="Resumen académico"
      >
        {selectedPeriod ? (
          <div className="student-portal-grid">
            <StudentPortalMetric
              label="Periodo"
              value={String(selectedPeriod.name ?? "Sin nombre")}
            />
            <StudentPortalMetric
              label="Grupo"
              value={
                typeof selectedPeriod.group === "object" && selectedPeriod.group !== null
                  ? String(
                      ((selectedPeriod.group as Record<string, unknown>).name as
                        string | undefined) ?? "Sin grupo",
                    )
                  : "Sin grupo"
              }
            />
            <StudentPortalMetric label="Materias" value={String(metrics.totalSubjects ?? 0)} />
            <StudentPortalMetric
              label="Sesiones cerradas"
              value={String(metrics.attendanceSessions ?? 0)}
            />
          </div>
        ) : (
          <StudentPortalEmpty message="Todavía no existe un periodo académico visible para este alumno." />
        )}
      </StudentPortalSection>

      <StudentPortalSection title="Asistencia publicada">
        <div className="student-portal-grid">
          <StudentPortalMetric label="Presentes" value={String(attendance.presentCount ?? 0)} />
          <StudentPortalMetric label="Faltas" value={String(attendance.absentCount ?? 0)} />
          <StudentPortalMetric label="Retardos" value={String(attendance.lateCount ?? 0)} />
          <StudentPortalMetric label="Justificadas" value={String(attendance.excusedCount ?? 0)} />
        </div>
      </StudentPortalSection>

      <StudentPortalSection title="Resumen de calificaciones">
        {summary ? (
          <div className="student-portal-grid">
            <StudentPortalMetric
              label="Estado seguro"
              value={
                summary.evaluationStatus === "MANUAL_REVIEW_REQUIRED"
                  ? "Revisión institucional"
                  : String(summary.evaluationStatus ?? "Sin publicar")
              }
            />
            <StudentPortalMetric
              label="Materias acreditadas"
              value={String(summary.accreditedSubjectCount ?? 0)}
            />
            <StudentPortalMetric
              label="Materias no acreditadas"
              value={String(summary.nonAccreditedSubjectCount ?? 0)}
            />
            <StudentPortalMetric
              label="Materias pendientes"
              value={String(summary.pendingSubjectCount ?? 0)}
            />
          </div>
        ) : (
          <StudentPortalEmpty message="Aún no hay un resumen confirmado visible para este periodo." />
        )}
      </StudentPortalSection>
    </>
  );
}
