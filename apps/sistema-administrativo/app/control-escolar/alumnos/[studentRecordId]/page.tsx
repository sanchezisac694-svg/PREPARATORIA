import { permissions } from "@preparatoria/authz";
import {
  Card,
  Container,
  DataTable,
  DateDisplay,
  DescriptionItem,
  DescriptionList,
  ErrorState,
  PageHeader,
  SectionCard,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";
import { ControlSchoolError } from "@preparatoria/supabase/control-school";

import {
  AcademicStatusBadge,
  formatAcademicValue,
  renderStudentHeading,
} from "../../../_admin/academic-labels";
import { requireControlSchoolAccess } from "../../../../lib/control-school";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlSchoolStudentDetailPage({
  params,
}: Readonly<{
  params: Promise<{ studentRecordId: string }>;
}>) {
  const { studentRecordId } = await params;

  try {
    const { service } = await requireControlSchoolAccess([permissions.ACADEMIC_STUDENTS_READ]);
    const [detail, trajectory] = await Promise.all([
      service.getStudentDetail(studentRecordId),
      service.getStudentTrajectory(studentRecordId),
    ]);
    const heading = renderStudentHeading(detail.studentIdentifier, detail.studentDisplayName);

    return (
      <Container>
        <PageHeader
          description={
            heading.subtitle ?? "Consulta administrativa del expediente académico actual."
          }
          title={heading.title}
        />

        <SectionCard
          description="Identidad visible, estado y trazabilidad actual del expediente."
          title="Resumen institucional"
        >
          <div className="control-school-badge-row">
            <AcademicStatusBadge value={detail.studentStatus} />
          </div>
          <DescriptionList>
            <DescriptionItem label="Matrícula" value={detail.studentIdentifier} />
            <DescriptionItem
              label="Estatus del alumno"
              value={<AcademicStatusBadge value={detail.studentStatus} />}
            />
            <DescriptionItem
              label="Activación"
              value={
                detail.timeline.activatedAt ? (
                  <DateDisplay value={detail.timeline.activatedAt} />
                ) : (
                  "No disponible"
                )
              }
            />
            <DescriptionItem
              label="Baja"
              value={
                detail.timeline.withdrawnAt ? (
                  <DateDisplay value={detail.timeline.withdrawnAt} />
                ) : (
                  "No registrada"
                )
              }
            />
            <DescriptionItem
              label="Egreso"
              value={
                detail.timeline.graduatedAt ? (
                  <DateDisplay value={detail.timeline.graduatedAt} />
                ) : (
                  "No registrado"
                )
              }
            />
          </DescriptionList>
        </SectionCard>

        <SectionCard title="Situación actual">
          <DescriptionList>
            <DescriptionItem
              label="Periodo"
              value={detail.currentSituation.academicPeriod?.name ?? "No disponible"}
            />
            <DescriptionItem
              label="Semestre"
              value={
                detail.currentSituation.semesterNumber
                  ? `${detail.currentSituation.semesterNumber}° semestre`
                  : "No disponible"
              }
            />
            <DescriptionItem
              label="Grupo"
              value={detail.currentSituation.group?.name ?? "Sin grupo"}
            />
            <DescriptionItem
              label="Área"
              value={detail.currentSituation.trainingArea?.name ?? "Sin área"}
            />
            <DescriptionItem
              label="Plan de estudios"
              value={`${detail.currentSituation.studyPlan.code} · ${detail.currentSituation.studyPlan.name}`}
            />
            <DescriptionItem
              label="Generación"
              value={`${detail.currentSituation.generation.code} · ${detail.currentSituation.generation.name}`}
            />
          </DescriptionList>
        </SectionCard>

        <SectionCard title="Inscripción actual">
          {detail.currentEnrollment ? (
            <DescriptionList>
              <DescriptionItem
                label="Estado"
                value={<AcademicStatusBadge value={detail.currentEnrollment.status} />}
              />
              <DescriptionItem
                label="Número de inscripción"
                value={detail.currentEnrollment.enrollmentNumber ?? "No disponible"}
              />
              <DescriptionItem
                label="Fecha de inscripción"
                value={
                  detail.currentEnrollment.enrolledAt ? (
                    <DateDisplay value={detail.currentEnrollment.enrolledAt} />
                  ) : (
                    "No disponible"
                  )
                }
              />
              <DescriptionItem
                label="Conclusión"
                value={
                  detail.currentEnrollment.completedAt ? (
                    <DateDisplay value={detail.currentEnrollment.completedAt} />
                  ) : (
                    "No concluida"
                  )
                }
              />
              <DescriptionItem
                label="Cancelación"
                value={
                  detail.currentEnrollment.cancelledAt ? (
                    <DateDisplay value={detail.currentEnrollment.cancelledAt} />
                  ) : (
                    "No cancelada"
                  )
                }
              />
            </DescriptionList>
          ) : (
            <p>No hay una inscripción visible para este expediente.</p>
          )}
        </SectionCard>

        <Card>
          <h2>Trayectoria</h2>
          {trajectory.periods.length === 0 ? (
            <p>No hay periodos cursados visibles para este expediente.</p>
          ) : (
            <DataTable caption="Periodos cursados y decisiones persistidas">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Periodo</TableHeadCell>
                  <TableHeadCell>Semestre</TableHeadCell>
                  <TableHeadCell>Grupo</TableHeadCell>
                  <TableHeadCell>Área</TableHeadCell>
                  <TableHeadCell>Estado</TableHeadCell>
                  <TableHeadCell>Decisión de progreso</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {trajectory.periods.map((period) => {
                  const decision = trajectory.progressDecisions.find(
                    (candidate) => candidate.sourceAcademicPeriodId === period.academicPeriodId,
                  );

                  return (
                    <TableRow key={period.periodEnrollmentId}>
                      <TableCell>{period.academicPeriodName}</TableCell>
                      <TableCell>{`${period.semesterNumber}° semestre`}</TableCell>
                      <TableCell>{period.group?.name ?? "Sin grupo"}</TableCell>
                      <TableCell>{period.trainingArea?.name ?? "Sin área"}</TableCell>
                      <TableCell>
                        <AcademicStatusBadge value={period.enrollmentStatus} />
                      </TableCell>
                      <TableCell>
                        {decision ? (
                          <div className="control-school-inline-stack">
                            <AcademicStatusBadge value={decision.decisionStatus} />
                            <span>{formatAcademicValue(decision.decisionType)}</span>
                          </div>
                        ) : (
                          "Sin decisión registrada"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBodySection>
            </DataTable>
          )}
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof ControlSchoolError) {
      return (
        <Container>
          <PageHeader title="Detalle del alumno" />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar el expediente"
          />
        </Container>
      );
    }

    throw error;
  }
}
