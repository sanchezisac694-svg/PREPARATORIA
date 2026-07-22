import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentSubjectsPage() {
  noStore();
  const service = await getStudentPortalService();
  const subjects = await service.getSubjects();
  const rows = Array.isArray(subjects) ? (subjects as Array<Record<string, unknown>>) : [];

  return (
    <StudentPortalSection title="Materias del periodo">
      {rows.length === 0 ? (
        <StudentPortalEmpty message="No hay materias publicadas para el periodo visible." />
      ) : (
        <table className="student-portal-table">
          <thead>
            <tr>
              <th>Clave</th>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Docente</th>
              <th>Resultado confirmado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const result =
                typeof row.result === "object" && row.result !== null
                  ? (row.result as Record<string, unknown>)
                  : null;
              return (
                <tr key={String(row.offeringEnrollmentId ?? row.subjectCode)}>
                  <td>{String(row.subjectCode ?? "-")}</td>
                  <td>{String(row.subjectName ?? "-")}</td>
                  <td>{String(row.groupName ?? row.groupCode ?? "-")}</td>
                  <td>{String(row.teacherName ?? "Docente pendiente de asignación")}</td>
                  <td>
                    {result
                      ? `${String(result.resultCode ?? "-")} / ${String(
                          result.roundedFinalGrade ?? "Sin calificación",
                        )}`
                      : "Sin resultado confirmado"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </StudentPortalSection>
  );
}
