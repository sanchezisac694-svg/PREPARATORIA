import { permissions } from "@preparatoria/authz";
import {
  Card,
  Container,
  DataTable,
  DateDisplay,
  DescriptionItem,
  DescriptionList,
  ErrorState,
  MetricCard,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";
import { ControlSchoolError } from "@preparatoria/supabase/control-school";

import {
  AcademicStatusBadge,
  formatBooleanLabel,
  renderOptionalText,
} from "../../_admin/academic-labels";
import { requireControlSchoolAccess } from "../../../lib/control-school";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ControlSchoolStructurePage() {
  try {
    const { service } = await requireControlSchoolAccess([
      permissions.ACADEMIC_PERIODS_READ,
      permissions.ACADEMIC_PLANS_READ,
      permissions.ACADEMIC_SUBJECTS_READ,
      permissions.ACADEMIC_GROUPS_READ,
    ]);
    const structure = await service.getStructure();

    return (
      <Container>
        <PageHeader
          description="Vista administrativa de la estructura académica consolidada desde los read models."
          title="Estructura académica"
        />

        <section className="control-school-metric-grid" aria-label="Resumen estructural">
          <MetricCard label="Ciclos visibles" value={structure.cycles.length} />
          <MetricCard label="Periodos visibles" value={structure.periods.length} />
          <MetricCard label="Planes visibles" value={structure.studyPlans.length} />
          <MetricCard label="Materias visibles" value={structure.subjects.length} />
        </section>

        <Card>
          <h2>Ciclos escolares</h2>
          <DataTable caption="Ciclos escolares visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Inicio</TableHeadCell>
                <TableHeadCell>Fin</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {structure.cycles.map((cycle) => (
                <TableRow key={cycle.schoolCycleId}>
                  <TableCell>{cycle.code}</TableCell>
                  <TableCell>{cycle.name}</TableCell>
                  <TableCell>
                    <DateDisplay value={cycle.startsOn} />
                  </TableCell>
                  <TableCell>
                    <DateDisplay value={cycle.endsOn} />
                  </TableCell>
                  <TableCell>
                    <AcademicStatusBadge value={cycle.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>

        <Card>
          <h2>Periodos académicos</h2>
          <DataTable caption="Periodos académicos visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Secuencia</TableHeadCell>
                <TableHeadCell>Fechas</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {structure.periods.map((period) => (
                <TableRow key={period.academicPeriodId}>
                  <TableCell>{period.code}</TableCell>
                  <TableCell>{period.name}</TableCell>
                  <TableCell>{period.sequenceNumber}</TableCell>
                  <TableCell>{`${period.startsOn} → ${period.endsOn}`}</TableCell>
                  <TableCell>
                    <AcademicStatusBadge value={period.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>

        <Card>
          <h2>Planes de estudio</h2>
          <DataTable caption="Planes de estudio visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Versión</TableHeadCell>
                <TableHeadCell>Semestres</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {structure.studyPlans.map((plan) => (
                <TableRow key={plan.studyPlanId}>
                  <TableCell>{plan.code}</TableCell>
                  <TableCell>{plan.name}</TableCell>
                  <TableCell>{plan.version ?? "No disponible"}</TableCell>
                  <TableCell>{plan.totalSemesters}</TableCell>
                  <TableCell>
                    <AcademicStatusBadge value={plan.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>

        <Card>
          <h2>Semestres y áreas</h2>
          <div className="control-school-structure-grid">
            <div>
              <h3>Semestres</h3>
              <DescriptionList>
                {structure.planSemesters.map((semester) => (
                  <DescriptionItem
                    key={semester.planSemesterId}
                    label={semester.name}
                    value={`Especialización requerida: ${formatBooleanLabel(semester.specializationRequired)}`}
                  />
                ))}
              </DescriptionList>
            </div>
            <div>
              <h3>Áreas de formación</h3>
              <DescriptionList>
                {structure.trainingAreas.map((area) => (
                  <DescriptionItem
                    key={area.trainingAreaId}
                    label={area.name}
                    value={`Desde ${area.startsAtSemester}° semestre · ${renderOptionalText(area.status)}`}
                  />
                ))}
              </DescriptionList>
            </div>
          </div>
        </Card>

        <Card>
          <h2>Materias</h2>
          <DataTable caption="Materias visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Clave</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Nombre corto</TableHeadCell>
                <TableHeadCell>Tipo</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {structure.subjects.map((subject) => (
                <TableRow key={subject.subjectId}>
                  <TableCell>{subject.code}</TableCell>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell>{subject.shortName ?? "No disponible"}</TableCell>
                  <TableCell>{renderOptionalText(subject.subjectType)}</TableCell>
                  <TableCell>
                    <AcademicStatusBadge value={subject.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>

        <Card>
          <h2>Grupos</h2>
          <DataTable caption="Grupos visibles en la estructura">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Clave</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Semestre</TableHeadCell>
                <TableHeadCell>Área</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {structure.groups.map((group) => {
                const area =
                  structure.trainingAreas.find(
                    (candidate) => candidate.trainingAreaId === group.trainingAreaId,
                  )?.name ?? "Sin área";

                return (
                  <TableRow key={group.groupId}>
                    <TableCell>{group.code}</TableCell>
                    <TableCell>{group.name}</TableCell>
                    <TableCell>{`${group.semesterNumber}° semestre`}</TableCell>
                    <TableCell>{area}</TableCell>
                    <TableCell>
                      <AcademicStatusBadge value={group.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBodySection>
          </DataTable>
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof ControlSchoolError) {
      return (
        <Container>
          <PageHeader title="Estructura académica" />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar la estructura"
          />
        </Container>
      );
    }

    throw error;
  }
}
