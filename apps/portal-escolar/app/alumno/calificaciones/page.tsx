import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalMetric, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentGradesPage() {
  noStore();
  const service = await getStudentPortalService();
  const grades = await service.getGrades();
  const unitGrades = Array.isArray(grades.unitGrades)
    ? (grades.unitGrades as Array<Record<string, unknown>>)
    : [];
  const subjectResults = Array.isArray(grades.subjectResults)
    ? (grades.subjectResults as Array<Record<string, unknown>>)
    : [];
  const summary =
    typeof grades.summary === "object" && grades.summary !== null
      ? (grades.summary as Record<string, unknown>)
      : null;

  return (
    <>
      <StudentPortalSection title="Calificaciones por unidad publicadas">
        {unitGrades.length === 0 ? (
          <StudentPortalEmpty message="Aún no hay calificaciones finalizadas o corregidas visibles." />
        ) : (
          <table className="student-portal-table">
            <thead>
              <tr>
                <th>Materia</th>
                <th>Unidad</th>
                <th>Calificación</th>
                <th>Acredita</th>
              </tr>
            </thead>
            <tbody>
              {unitGrades.map((row, index) => (
                <tr
                  key={`${String(row.subjectCode ?? "subject")}-${String(row.unitNumber ?? index)}`}
                >
                  <td>{String(row.subjectName ?? "-")}</td>
                  <td>{String(row.unitNumber ?? "-")}</td>
                  <td>{String(row.normalizedGrade ?? "-")}</td>
                  <td>{row.isAccredited === true ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StudentPortalSection>

      <StudentPortalSection title="Resultados confirmados por materia">
        {subjectResults.length === 0 ? (
          <StudentPortalEmpty message="Aún no existen resultados confirmados visibles para este periodo." />
        ) : (
          <table className="student-portal-table">
            <thead>
              <tr>
                <th>Materia</th>
                <th>Resultado</th>
                <th>Final</th>
                <th>Cálculo</th>
              </tr>
            </thead>
            <tbody>
              {subjectResults.map((row, index) => (
                <tr key={`${String(row.subjectCode ?? "subject")}-${index}`}>
                  <td>{String(row.subjectName ?? "-")}</td>
                  <td>{String(row.resultCode ?? "-")}</td>
                  <td>{String(row.roundedFinalGrade ?? "Sin calificación")}</td>
                  <td>{String(row.calculationStatus ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </StudentPortalSection>

      <StudentPortalSection title="Resumen confirmado del periodo">
        {summary ? (
          <div className="student-portal-grid">
            <StudentPortalMetric
              label="Estado"
              value={
                summary.evaluationStatus === "MANUAL_REVIEW_REQUIRED"
                  ? "Revisión institucional"
                  : String(summary.evaluationStatus ?? "-")
              }
            />
            <StudentPortalMetric
              label="Decisión visible"
              value={String(summary.proposedProgressDecision ?? "-")}
            />
            <StudentPortalMetric
              label="Acreditadas"
              value={String(summary.accreditedSubjectCount ?? 0)}
            />
            <StudentPortalMetric
              label="No acreditadas"
              value={String(summary.nonAccreditedSubjectCount ?? 0)}
            />
          </div>
        ) : (
          <StudentPortalEmpty message="No hay resumen confirmado visible para este periodo." />
        )}
      </StudentPortalSection>
    </>
  );
}
