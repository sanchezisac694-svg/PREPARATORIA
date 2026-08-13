import { permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  DateDisplay,
  ErrorState,
  Field,
  Input,
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

export default async function ControlSchoolEnrollmentsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const searchText = readSingleParam(params, "search");
  const status = readSingleParam(params, "status");
  const semesterRaw = readSingleParam(params, "semester");
  const periodId = readSingleParam(params, "period");
  const groupId = readSingleParam(params, "group");
  const semesterNumber = semesterRaw ? Number.parseInt(semesterRaw, 10) : null;

  try {
    const { service } = await requireControlSchoolAccess([permissions.ACADEMIC_ENROLLMENTS_READ]);
    const [structure, enrollmentPage] = await Promise.all([
      service.getStructure(),
      service.listEnrollments({
        academicPeriodId: periodId || null,
        groupId: groupId || null,
        limit: PAGE_SIZE,
        offset,
        searchText: searchText || null,
        semesterNumber: Number.isFinite(semesterNumber) ? semesterNumber : null,
        status: status || null,
      }),
    ]);
    const pageCount = Math.max(1, Math.ceil(enrollmentPage.totalRows / enrollmentPage.pageSize));

    return (
      <Container>
        <PageHeader
          description="Consulta administrativa de inscripciones activas, concluidas o canceladas."
          title="Inscripciones"
        />

        <Card>
          <h2>Filtros disponibles</h2>
          <form className="control-school-filter-form" method="get">
            <QueryFilters>
              <Field label="Búsqueda" labelFor="enrollment-search">
                <Input
                  defaultValue={searchText}
                  id="enrollment-search"
                  name="search"
                  placeholder="Matrícula o nombre institucional"
                />
              </Field>
              <Field label="Periodo" labelFor="enrollment-period">
                <Select defaultValue={periodId} id="enrollment-period" name="period">
                  <option value="">Todos</option>
                  {structure.periods.map((period) => (
                    <option key={period.academicPeriodId} value={period.academicPeriodId}>
                      {`${period.code} · ${period.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Semestre" labelFor="enrollment-semester">
                <Select defaultValue={semesterRaw} id="enrollment-semester" name="semester">
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
              <Field label="Grupo" labelFor="enrollment-group">
                <Select defaultValue={groupId} id="enrollment-group" name="group">
                  <option value="">Todos</option>
                  {structure.groups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {`${group.code} · ${group.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado" labelFor="enrollment-status">
                <Select defaultValue={status} id="enrollment-status" name="status">
                  <option value="">Todos</option>
                  {Array.from(new Set(enrollmentPage.rows.map((row) => row.status))).map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </Select>
              </Field>
              <div className="control-school-filter-actions">
                <button className="ui-button ui-button--primary ui-button--md" type="submit">
                  Aplicar filtros
                </button>
                <AppLink
                  className="ui-button ui-button--secondary ui-button--md"
                  href="/control-escolar/inscripciones"
                >
                  Limpiar
                </AppLink>
              </div>
            </QueryFilters>
          </form>
        </Card>

        <Card>
          <h2>Listado administrativo</h2>
          {enrollmentPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay inscripciones disponibles para los criterios seleccionados."
              title="Sin inscripciones visibles"
            />
          ) : (
            <>
              <DataTable caption="Inscripciones visibles">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Matrícula</TableHeadCell>
                    <TableHeadCell>Nombre</TableHeadCell>
                    <TableHeadCell>Periodo</TableHeadCell>
                    <TableHeadCell>Semestre</TableHeadCell>
                    <TableHeadCell>Grupo</TableHeadCell>
                    <TableHeadCell>Estado</TableHeadCell>
                    <TableHeadCell>Inscripción</TableHeadCell>
                    <TableHeadCell>Conclusión / cancelación</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {enrollmentPage.rows.map((row) => (
                    <TableRow key={row.periodEnrollmentId}>
                      <TableCell>
                        <AppLink href={`/control-escolar/alumnos/${row.studentRecordId}`}>
                          {row.studentIdentifier}
                        </AppLink>
                      </TableCell>
                      <TableCell>{renderNameOrFallback(row.studentDisplayName)}</TableCell>
                      <TableCell>{row.academicPeriod.name}</TableCell>
                      <TableCell>{`${row.semesterNumber}° semestre`}</TableCell>
                      <TableCell>{row.group?.name ?? "Sin grupo"}</TableCell>
                      <TableCell>
                        <AcademicStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.enrolledAt ? <DateDisplay value={row.enrolledAt} /> : "No disponible"}
                      </TableCell>
                      <TableCell>
                        {row.completedAt ? (
                          <DateDisplay value={row.completedAt} />
                        ) : row.cancelledAt ? (
                          <DateDisplay value={row.cancelledAt} />
                        ) : (
                          "Sin cierre"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>

              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/inscripciones"
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
          <PageHeader title="Inscripciones" />
          <ErrorState
            description="No fue posible cargar la información de Control Escolar."
            title="No fue posible cargar las inscripciones"
          />
        </Container>
      );
    }

    throw error;
  }
}
