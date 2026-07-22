import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const weekdayLabels = [
  "",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

export default async function StudentSchedulePage() {
  noStore();
  const service = await getStudentPortalService();
  const schedule = await service.getSchedule();
  const rows = Array.isArray(schedule) ? (schedule as Array<Record<string, unknown>>) : [];

  return (
    <StudentPortalSection title="Horario publicado">
      {rows.length === 0 ? (
        <StudentPortalEmpty message="No hay horario publicado para el periodo visible." />
      ) : (
        <table className="student-portal-table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Bloque</th>
              <th>Materia</th>
              <th>Salón</th>
              <th>Docente</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${String(row.subjectCode ?? "subject")}-${index}`}>
                <td>{weekdayLabels[Number(row.weekday ?? 0)] ?? String(row.weekday ?? "-")}</td>
                <td>
                  {String(row.timeBlock ?? "-")} ({String(row.startsAt ?? "--")} -{" "}
                  {String(row.endsAt ?? "--")})
                </td>
                <td>{String(row.subjectName ?? "-")}</td>
                <td>{String(row.spaceName ?? row.spaceCode ?? "-")}</td>
                <td>{String(row.teacherName ?? "Docente pendiente de asignación")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StudentPortalSection>
  );
}
