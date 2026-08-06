import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalMetric, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentRecordPage() {
  noStore();
  const service = await getStudentPortalService();
  const record = await service.getRecord();

  const studyPlan =
    typeof record.studyPlan === "object" && record.studyPlan !== null
      ? (record.studyPlan as Record<string, unknown>)
      : {};
  const generation =
    typeof record.generation === "object" && record.generation !== null
      ? (record.generation as Record<string, unknown>)
      : {};

  return (
    <StudentPortalSection title="Expediente académico">
      <div className="student-portal-grid">
        <StudentPortalMetric
          label="Matrícula institucional"
          value={String(record.institutionalStudentCode ?? "Pendiente")}
        />
        <StudentPortalMetric
          label="Estado del expediente"
          value={String(record.studentStatus ?? "N/D")}
        />
        <StudentPortalMetric
          label="Semestre actual"
          value={String(record.currentSemesterNumber ?? "Sin asignación")}
        />
        <StudentPortalMetric label="Plan" value={String(studyPlan.name ?? "Sin plan")} />
        <StudentPortalMetric label="Versión del plan" value={String(studyPlan.version ?? "N/D")} />
        <StudentPortalMetric
          label="Generación"
          value={String(generation.name ?? "Sin generación")}
        />
      </div>
    </StudentPortalSection>
  );
}
