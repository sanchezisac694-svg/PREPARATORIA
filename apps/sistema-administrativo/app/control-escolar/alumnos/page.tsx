import { permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  ErrorState,
  Field,
  Input,
  MetricCard,
  PageHeader,
  Select,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";
import { ControlSchoolError } from "@preparatoria/supabase/control-school";

import { AcademicStatusBadge, renderNameOrFallback } from "../../_admin/academic-labels";
import { requireControlSchoolAccess } from "../../../lib/control-school";
import {
  EmptyResults,
  PaginationControls,
  QueryFilters,
  readPositiveNumberParam,
  readSingleParam,
  type RouteSearchParams,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export default async function ControlSchoolStudentsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const searchText = readSingleParam(params, "search");
  const studentStatus = readSingleParam(params, "status");
  const semesterRaw = readSingleParam(params, "semester");
  const periodId = readSingleParam(params, "period");
  const groupId = readSingleParam(params, "group");
  const semesterNumber = semesterRaw ? Number.parseInt(semesterRaw, 10) : null;

  try {
    const { service } = await requireControlSchoolAccess([permissions.ACADEMIC_STUDENTS_READ]);
    const [structure, studentPage] = await Promise.all([
      service.getStructure(),
      service.listStudents({
        academicPeriodId: periodId || null,
        groupId: groupId || null,
        limit: PAGE_SIZE,
        offset,
        searchText: searchText || null,
        semesterNumber: Number.isFinite(semesterNumber) ? semesterNumber : null,
        studentStatus: studentStatus || null,
      }),
    ]);
    const pageCount = Math.max(1, Math.ceil(studentPage.totalRows / studentPage.pageSize));

    return (
      <Container>
        <PageHeader
          description="Consulta administrativa de alumnado con filtros reales y paginación SSR."
          title="Alumnos"
        />

        <section className="control-school-metric-grid" aria-label="Resumen de alumnos">
          <MetricCard label="Alumnos visibles" value={studentPage.totalRows} />
          <MetricCard
            description="Resultados cargados en esta vista."
            label="Filas en página"
            value={studentPage.rows.length}
          />
        </section>

        <Card>
          <h2>Filtros disponibles</h2>
          <form className="control-school-filter-form" method="get">
            <QueryFilters>
              <Field label="Búsqueda" labelFor="student-search">
                <Input
                  defaultValue={searchText}
                  id="student-search"
                  name="search"
                  placeholder="Matrícula o nombre institucional"
                />
              </Field>
              <Field label="Estatus del alumno" labelFor="student-status">
                <Select defaultValue={studentStatus} id="student-status" name="status">
                  <option value="">Todos</option>
                  {Array.from(new Set(studentPage.rows.map((row) => row.studentStatus))).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <Field label="Semestre" labelFor="student-semester">
                <Select defaultValue={semesterRaw} id="student-semester" name="semester">
                  <option value="">Todos</option>
                  {Array.from(new Set(structure.planSemesters.map((row) => row.semesterNumber)))
                    .sort((left, right) => left - right)
                    .map((value) => (
                      <option key={value} value={value}>
                        {`${value}° semestre`}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Grupo" labelFor="student-group">
                <Select defaultValue={groupId} id="student-group" name="group">
                  <option value="">Todos</option>
                  {structure.groups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {`${group.code} · ${group.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Periodo" labelFor="student-period">
                <Select defaultValue={periodId} id="student-period" name="period">
                  <option value="">Todos</option>
                  {structure.periods.map((period) => (
                    <option key={period.academicPeriodId} value={period.academicPeriodId}>
                      {`${period.code} · ${period.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="control-school-filter-actions">
                <button className="ui-button ui-button--primary ui-button--md" type="submit">
                  Aplicar filtros
                </button>
                <AppLink
                  className="ui-button ui-button--secondary ui-button--md"
                  href="/control-escolar/alumnos"
                >
                  Limpiar
                </AppLink>
              </div>
            </QueryFilters>
          </form>
        </Card>

        <Card>
          <h2>Listado administrativo</h2>
          {studentPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay alumnos que coincidan con los filtros seleccionados."
              title="Sin resultados"
            />
          ) : (
            <>
              <DataTable caption="Listado administrativo de alumnos">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Matrícula</TableHeadCell>
                    <TableHeadCell>Nombre</TableHeadCell>
                    <TableHeadCell>Semestre</TableHeadCell>
                    <TableHeadCell>Grupo</TableHeadCell>
                    <TableHeadCell>Área</TableHeadCell>
                    <TableHeadCell>Periodo</TableHeadCell>
                    <TableHeadCell>Estatus alumno</TableHeadCell>
                    <TableHeadCell>Inscripción</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {studentPage.rows.map((student) => (
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
                      <TableCell>{student.group?.code ?? "Sin grupo"}</TableCell>
                      <TableCell>{student.trainingArea?.name ?? "Sin área"}</TableCell>
                      <TableCell>{student.academicPeriod?.name ?? "Sin periodo"}</TableCell>
                      <TableCell>
                        <AcademicStatusBadge value={student.studentStatus} />
                      </TableCell>
                      <TableCell>
                        <AcademicStatusBadge value={student.enrollmentStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>

              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/alumnos"
                searchParams={params}
              />
            </>
          )}
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof ControlSchoolError) {
      return (
        <Container>
          <PageHeader
            description="Consulta administrativa de alumnado con filtros reales y paginación SSR."
            title="Alumnos"
          />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar el listado"
          />
        </Container>
      );
    }

    throw error;
  }
}
