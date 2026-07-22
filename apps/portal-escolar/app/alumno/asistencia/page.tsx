import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalMetric, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentAttendancePage() {
  noStore();
  const service = await getStudentPortalService();
  const attendance = await service.getAttendance();
  const rows = Array.isArray(attendance.records)
    ? (attendance.records as Array<Record<string, unknown>>)
    : [];
  const lateness =
    typeof attendance.lateness === "object" && attendance.lateness !== null
      ? (attendance.lateness as Record<string, unknown>)
      : {};

  return (
    <>
      <StudentPortalSection title="Resumen de retardos">
        <div className="student-portal-grid">
          <StudentPortalMetric label="Contador actual" value={String(lateness.currentCount ?? 0)} />
          <StudentPortalMetric
            label="Histórico validado"
            value={String(lateness.lifetimeCount ?? 0)}
          />
          <StudentPortalMetric
            label="Secuencia visible"
            value={String(lateness.alertSequence ?? 0)}
          />
          <StudentPortalMetric
            label="Alertas visibles"
            value={String(lateness.visibleAlertCount ?? 0)}
          />
        </div>
      </StudentPortalSection>

      <StudentPortalSection title="Asistencia publicada">
        {rows.length === 0 ? (
          <StudentPortalEmpty message="No hay sesiones cerradas o bloqueadas visibles todavía." />
        ) : (
          <table className="student-portal-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Materia</th>
                <th>Bloque</th>
                <th>Estado</th>
                <th>Retardo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${String(row.subjectCode ?? "subject")}-${index}`}>
                  <td>{String(row.sessionDate ?? "-")}</td>
                  <td>{String(row.subjectName ?? "-")}</td>
                  <td>{String(row.timeBlockName ?? "-")}</td>
                  <td>{String(row.attendanceStatus ?? "-")}</td>
                  <td>
                    {row.latenessMinutes == null ? "—" : `${String(row.latenessMinutes)} min`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StudentPortalSection>
    </>
  );
}
