import { permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  ErrorState,
  Field,
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

import { AcademicStatusBadge } from "../../_admin/academic-labels";
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

export default async function ControlSchoolGroupsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const semesterRaw = readSingleParam(params, "semester");
  const periodId = readSingleParam(params, "period");
  const trainingAreaId = readSingleParam(params, "area");
  const status = readSingleParam(params, "status");
  const semesterNumber = semesterRaw ? Number.parseInt(semesterRaw, 10) : null;

  try {
    const { service } = await requireControlSchoolAccess([permissions.ACADEMIC_GROUPS_READ]);
    const [structure, groupPage] = await Promise.all([
      service.getStructure(),
      service.listGroups({
        academicPeriodId: periodId || null,
        limit: PAGE_SIZE,
        offset,
        semesterNumber: Number.isFinite(semesterNumber) ? semesterNumber : null,
        status: status || null,
        trainingAreaId: trainingAreaId || null,
      }),
    ]);
    const pageCount = Math.max(1, Math.ceil(groupPage.totalRows / groupPage.pageSize));
    const studentsOnPage = groupPage.rows.reduce((sum, row) => sum + row.studentCount, 0);

    return (
      <Container>
        <PageHeader
          description="Consulta administrativa de grupos, composición visible y acceso al horario publicado."
          title="Grupos"
        />

        <section className="control-school-metric-grid" aria-label="Resumen de grupos">
          <MetricCard label="Grupos visibles" value={groupPage.totalRows} />
          <MetricCard
            description="Suma de alumnado en la página actual."
            label="Alumnos en página"
            value={studentsOnPage}
          />
        </section>

        <Card>
          <h2>Filtros disponibles</h2>
          <form className="control-school-filter-form" method="get">
            <QueryFilters>
              <Field label="Periodo" labelFor="group-period">
                <Select defaultValue={periodId} id="group-period" name="period">
                  <option value="">Todos</option>
                  {structure.periods.map((period) => (
                    <option key={period.academicPeriodId} value={period.academicPeriodId}>
                      {`${period.code} · ${period.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Semestre" labelFor="group-semester">
                <Select defaultValue={semesterRaw} id="group-semester" name="semester">
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
              <Field label="Área" labelFor="group-area">
                <Select defaultValue={trainingAreaId} id="group-area" name="area">
                  <option value="">Todas</option>
                  {structure.trainingAreas.map((area) => (
                    <option key={area.trainingAreaId} value={area.trainingAreaId}>
                      {area.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado" labelFor="group-status">
                <Select defaultValue={status} id="group-status" name="status">
                  <option value="">Todos</option>
                  {Array.from(new Set(groupPage.rows.map((row) => row.status))).map((value) => (
                    <option key={value} value={value}>
                      {value}
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
                  href="/control-escolar/grupos"
                >
                  Limpiar
                </AppLink>
              </div>
            </QueryFilters>
          </form>
        </Card>

        <Card>
          <h2>Listado administrativo</h2>
          {groupPage.rows.length === 0 ? (
            <EmptyResults
              description="No se encontraron grupos para este periodo."
              title="Sin grupos visibles"
            />
          ) : (
            <>
              <DataTable caption="Listado administrativo de grupos">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Clave</TableHeadCell>
                    <TableHeadCell>Nombre</TableHeadCell>
                    <TableHeadCell>Semestre</TableHeadCell>
                    <TableHeadCell>Periodo</TableHeadCell>
                    <TableHeadCell>Área</TableHeadCell>
                    <TableHeadCell align="right">Alumnos</TableHeadCell>
                    <TableHeadCell>Estado</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {groupPage.rows.map((group) => (
                    <TableRow key={group.groupId}>
                      <TableCell>
                        <AppLink href={`/control-escolar/grupos/${group.groupId}`}>
                          {group.code}
                        </AppLink>
                      </TableCell>
                      <TableCell>{group.name}</TableCell>
                      <TableCell>{`${group.semesterNumber}° semestre`}</TableCell>
                      <TableCell>{group.academicPeriod.name}</TableCell>
                      <TableCell>{group.trainingArea?.name ?? "Sin área"}</TableCell>
                      <TableCell align="right">{group.studentCount}</TableCell>
                      <TableCell>
                        <AcademicStatusBadge value={group.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>

              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/grupos"
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
          <PageHeader title="Grupos" />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar los grupos"
          />
        </Container>
      );
    }

    throw error;
  }
}
