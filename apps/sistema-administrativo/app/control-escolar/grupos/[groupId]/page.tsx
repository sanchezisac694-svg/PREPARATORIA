import { permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
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
  formatWeekday,
  renderNameOrFallback,
} from "../../../_admin/academic-labels";
import { requireControlSchoolAccess } from "../../../../lib/control-school";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlSchoolGroupDetailPage({
  params,
}: Readonly<{
  params: Promise<{ groupId: string }>;
}>) {
  const { groupId } = await params;

  try {
    const { service } = await requireControlSchoolAccess([permissions.ACADEMIC_GROUPS_READ]);
    const [detail, schedule] = await Promise.all([
      service.getGroupDetail(groupId),
      service.getGroupSchedule(groupId),
    ]);

    return (
      <Container>
        <PageHeader
          description={`${detail.group.code} · ${detail.group.academicPeriod.name}`}
          title={detail.group.name}
        />

        <SectionCard title="Información general">
          <div className="control-school-badge-row">
            <AcademicStatusBadge value={detail.group.status} />
          </div>
          <dl className="ui-description-list">
            <div className="ui-description-list__item">
              <dt>Grupo</dt>
              <dd>{`${detail.group.code} · ${detail.group.name}`}</dd>
            </div>
            <div className="ui-description-list__item">
              <dt>Semestre</dt>
              <dd>{`${detail.group.semesterNumber}° semestre`}</dd>
            </div>
            <div className="ui-description-list__item">
              <dt>Periodo</dt>
              <dd>{detail.group.academicPeriod.name}</dd>
            </div>
            <div className="ui-description-list__item">
              <dt>Área</dt>
              <dd>{detail.group.trainingArea?.name ?? "Sin área"}</dd>
            </div>
            <div className="ui-description-list__item">
              <dt>Cantidad de alumnos</dt>
              <dd>{detail.group.studentCount}</dd>
            </div>
          </dl>
        </SectionCard>

        <Card>
          <h2>Alumnos</h2>
          {detail.students.length === 0 ? (
            <p>No hay alumnado visible en este grupo.</p>
          ) : (
            <DataTable caption="Alumnado visible del grupo">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Matrícula</TableHeadCell>
                  <TableHeadCell>Nombre</TableHeadCell>
                  <TableHeadCell>Semestre</TableHeadCell>
                  <TableHeadCell>Inscripción</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {detail.students.map((student) => (
                  <TableRow key={student.studentRecordId}>
                    <TableCell>
                      <AppLink href={`/control-escolar/alumnos/${student.studentRecordId}`}>
                        {student.studentIdentifier}
                      </AppLink>
                    </TableCell>
                    <TableCell>{renderNameOrFallback(student.studentDisplayName)}</TableCell>
                    <TableCell>
                      {student.semesterNumber
                        ? `${student.semesterNumber}° semestre`
                        : "No disponible"}
                    </TableCell>
                    <TableCell>
                      <AcademicStatusBadge value={student.enrollmentStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBodySection>
            </DataTable>
          )}
        </Card>

        <Card>
          <h2>Materias</h2>
          {detail.subjects.length === 0 ? (
            <p>No hay materias visibles para este grupo.</p>
          ) : (
            <DataTable caption="Materias visibles del grupo">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Clave</TableHeadCell>
                  <TableHeadCell>Nombre</TableHeadCell>
                  <TableHeadCell align="right">Horas semanales</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {detail.subjects.map((subject) => (
                  <TableRow key={subject.academicOfferingId}>
                    <TableCell>{subject.subjectCode}</TableCell>
                    <TableCell>{subject.subjectName}</TableCell>
                    <TableCell align="right">{subject.weeklyHours ?? "No disponible"}</TableCell>
                  </TableRow>
                ))}
              </TableBodySection>
            </DataTable>
          )}
        </Card>

        <Card>
          <h2>Docentes</h2>
          {detail.teachers.length === 0 ? (
            <p>No hay asignaciones docentes visibles para este grupo.</p>
          ) : (
            <DataTable caption="Asignaciones docentes visibles del grupo">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Identificador institucional</TableHeadCell>
                  <TableHeadCell>Nombre</TableHeadCell>
                  <TableHeadCell>Tipo de asignación</TableHeadCell>
                  <TableHeadCell>Estado</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {detail.teachers.map((teacher) => (
                  <TableRow key={teacher.teachingAssignmentId}>
                    <TableCell>{teacher.teacherIdentifier ?? "No disponible"}</TableCell>
                    <TableCell>{renderNameOrFallback(teacher.teacherDisplayName)}</TableCell>
                    <TableCell>{formatAcademicValue(teacher.assignmentType)}</TableCell>
                    <TableCell>
                      <AcademicStatusBadge value={teacher.assignmentStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBodySection>
            </DataTable>
          )}
        </Card>

        <Card>
          <h2>Horario del grupo</h2>
          {schedule.rows.length === 0 ? (
            <p>No hay horario visible para este grupo en el periodo consultado.</p>
          ) : (
            <DataTable caption="Horario visible del grupo">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Día</TableHeadCell>
                  <TableHeadCell>Inicio</TableHeadCell>
                  <TableHeadCell>Fin</TableHeadCell>
                  <TableHeadCell>Materia</TableHeadCell>
                  <TableHeadCell>Docente</TableHeadCell>
                  <TableHeadCell>Aula / espacio</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {schedule.rows.map((row) => (
                  <TableRow key={row.classSessionId}>
                    <TableCell>{formatWeekday(row.weekday)}</TableCell>
                    <TableCell>{row.startsAt}</TableCell>
                    <TableCell>{row.endsAt}</TableCell>
                    <TableCell>{`${row.subjectCode} · ${row.subjectName}`}</TableCell>
                    <TableCell>{renderNameOrFallback(row.teacherDisplayName)}</TableCell>
                    <TableCell>{row.spaceName ?? row.spaceCode ?? "No disponible"}</TableCell>
                  </TableRow>
                ))}
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
          <PageHeader title="Detalle de grupo" />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar el grupo"
          />
        </Container>
      );
    }

    throw error;
  }
}
