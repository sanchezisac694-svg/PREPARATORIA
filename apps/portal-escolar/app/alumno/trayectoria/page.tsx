import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentTrajectoryPage() {
  noStore();
  const service = await getStudentPortalService();
  const trajectory = await service.getTrajectory();
  const periods = Array.isArray(trajectory.periods)
    ? (trajectory.periods as Array<Record<string, unknown>>)
    : [];
  const decisions = Array.isArray(trajectory.progressDecisions)
    ? (trajectory.progressDecisions as Array<Record<string, unknown>>)
    : [];

  return (
    <>
      <StudentPortalSection title="Trayectoria por periodos">
        {periods.length === 0 ? (
          <StudentPortalEmpty message="Aún no existe trayectoria visible para este alumno." />
        ) : (
          <table className="student-portal-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Semestre</th>
                <th>Grupo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((row) => (
                <tr key={String(row.academicPeriodId)}>
                  <td>{String(row.academicPeriodName ?? row.academicPeriodCode ?? "-")}</td>
                  <td>{String(row.semesterNumber ?? "-")}</td>
                  <td>{String(row.groupName ?? row.groupCode ?? "-")}</td>
                  <td>{String(row.enrollmentStatus ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StudentPortalSection>

      <StudentPortalSection title="Decisiones de progreso confirmadas">
        {decisions.length === 0 ? (
          <StudentPortalEmpty message="No hay decisiones confirmadas visibles todavía." />
        ) : (
          <table className="student-portal-table">
            <thead>
              <tr>
                <th>Periodo fuente</th>
                <th>Decisión</th>
                <th>Estado</th>
                <th>Semestre resultante</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((row, index) => (
                <tr key={`${String(row.sourceAcademicPeriodId ?? "period")}-${index}`}>
                  <td>
                    {String(row.sourceAcademicPeriodName ?? row.sourceAcademicPeriodCode ?? "-")}
                  </td>
                  <td>{String(row.decisionType ?? "-")}</td>
                  <td>{String(row.decisionStatus ?? "-")}</td>
                  <td>{String(row.resultingSemesterNumber ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StudentPortalSection>
    </>
  );
}
