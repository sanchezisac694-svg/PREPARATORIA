import { permissions, hasAnyPermission } from "@preparatoria/authz";
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

import {
  GradeStatusBadge,
  renderOperationalIdentifier,
  renderTeacher,
} from "../../_admin/grade-labels";
import { requireControlSchoolAccess } from "../../../lib/control-school";
import {
  GradeManagementUiError,
  listGradeManagementOfferings,
} from "../../../lib/grade-management";
import {
  EmptyResults,
  GradeModuleNav,
  PaginationControls,
  QueryFilters,
  readPositiveNumberParam,
  readSingleParam,
  StatusFeedback,
  type RouteSearchParams,
} from "./_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export default async function GradeManagementPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const academicPeriodId = readSingleParam(params, "period");
  const groupId = readSingleParam(params, "group");
  const subjectId = readSingleParam(params, "subject");
  const teacherIdentifier = readSingleParam(params, "teacher");
  const academicOfferingId = readSingleParam(params, "offering");
  const windowStatus = readSingleParam(params, "windowStatus");
  const offeringStatus = readSingleParam(params, "offeringStatus");

  try {
    const { identity, service } = await requireControlSchoolAccess([
      permissions.ACADEMIC_GRADES_READ,
    ]);
    const [structure, offeringPage] = await Promise.all([
      service.getStructure(),
      listGradeManagementOfferings({
        academicOfferingId: academicOfferingId || null,
        academicPeriodId: academicPeriodId || null,
        groupId: groupId || null,
        limit: PAGE_SIZE,
        offset,
        offeringStatus: offeringStatus || null,
        subjectId: subjectId || null,
        teacherIdentifier: teacherIdentifier || null,
        windowStatus: windowStatus || null,
      }),
    ]);
    const pageCount = Math.max(1, Math.ceil(offeringPage.totalRows / offeringPage.pageSize));
    const canManageWindows = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADE_WINDOWS_MANAGE,
    ]);
    const canReadOwnTeachingLoad = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_CAPTURE,
      permissions.ACADEMIC_GRADES_REVIEW,
      permissions.ACADEMIC_GRADES_FINALIZE,
    ]);

    return (
      <Container>
        <PageHeader
          description="Consulta administrativa de offerings, ventanas y estado general de captura usando el contrato público de calificaciones."
          title="Calificaciones"
        />

        <StatusFeedback params={params} />

        <section className="control-school-metric-grid" aria-label="Resumen de calificaciones">
          <MetricCard label="Offerings visibles" value={offeringPage.totalRows} />
          <MetricCard label="Filas en página" value={offeringPage.rows.length} />
          <MetricCard
            description="Alumnado total acumulado en esta página."
            label="Alumnos visibles"
            value={offeringPage.rows.reduce((sum, row) => sum + row.studentCount, 0)}
          />
        </section>

        <Card>
          <h2>Rutas del módulo</h2>
          <GradeModuleNav />
          <ul>
            {canReadOwnTeachingLoad ? (
              <li>
                <AppLink href="/control-escolar/calificaciones/mis-grupos">
                  Ver mi carga docente
                </AppLink>
              </li>
            ) : null}
            {canManageWindows ? (
              <li>
                <AppLink href="/control-escolar/calificaciones/ventanas">
                  Administrar ventanas de captura
                </AppLink>
              </li>
            ) : null}
          </ul>
        </Card>

        <Card>
          <h2>Filtros disponibles</h2>
          <form className="control-school-filter-form" method="get">
            <QueryFilters title="Filtros de calificaciones">
              <Field label="Periodo" labelFor="grade-period">
                <Select defaultValue={academicPeriodId} id="grade-period" name="period">
                  <option value="">Todos</option>
                  {structure.periods.map((period) => (
                    <option key={period.academicPeriodId} value={period.academicPeriodId}>
                      {`${period.code} · ${period.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Grupo" labelFor="grade-group">
                <Select defaultValue={groupId} id="grade-group" name="group">
                  <option value="">Todos</option>
                  {structure.groups.map((group) => (
                    <option key={group.groupId} value={group.groupId}>
                      {`${group.code} · ${group.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Materia" labelFor="grade-subject">
                <Select defaultValue={subjectId} id="grade-subject" name="subject">
                  <option value="">Todas</option>
                  {structure.subjects.map((subject) => (
                    <option key={subject.subjectId} value={subject.subjectId}>
                      {`${subject.code} · ${subject.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Docente operativo" labelFor="grade-teacher">
                <Input
                  defaultValue={teacherIdentifier}
                  id="grade-teacher"
                  name="teacher"
                  placeholder="Identificador institucional"
                />
              </Field>
              <Field label="Offering" labelFor="grade-offering">
                <Input
                  defaultValue={academicOfferingId}
                  id="grade-offering"
                  name="offering"
                  placeholder="Identificador exacto del offering"
                />
              </Field>
              <Field label="Estado de ventana" labelFor="grade-window-status">
                <Select defaultValue={windowStatus} id="grade-window-status" name="windowStatus">
                  <option value="">Todos</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="OPEN">Abierta</option>
                  <option value="CLOSED">Cerrada</option>
                  <option value="CANCELLED">Cancelada</option>
                </Select>
              </Field>
              <Field label="Estado del offering" labelFor="grade-offering-status">
                <Select
                  defaultValue={offeringStatus}
                  id="grade-offering-status"
                  name="offeringStatus"
                >
                  <option value="">Todos</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                  <option value="CANCELLED">Cancelado</option>
                </Select>
              </Field>
              <div className="control-school-filter-actions">
                <button className="ui-button ui-button--primary ui-button--md" type="submit">
                  Aplicar filtros
                </button>
                <AppLink
                  className="ui-button ui-button--secondary ui-button--md"
                  href="/control-escolar/calificaciones"
                >
                  Limpiar
                </AppLink>
              </div>
            </QueryFilters>
          </form>
        </Card>

        <Card>
          <h2>Offerings visibles</h2>
          {offeringPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay offerings visibles con los filtros actuales."
              title="Sin resultados"
            />
          ) : (
            <>
              <DataTable caption="Offerings visibles para gestión de calificaciones">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Periodo</TableHeadCell>
                    <TableHeadCell>Grupo</TableHeadCell>
                    <TableHeadCell>Materia</TableHeadCell>
                    <TableHeadCell>Semestre</TableHeadCell>
                    <TableHeadCell>Área</TableHeadCell>
                    <TableHeadCell>Docente</TableHeadCell>
                    <TableHeadCell align="right">Alumnos</TableHeadCell>
                    <TableHeadCell>Offering</TableHeadCell>
                    <TableHeadCell>Ventanas</TableHeadCell>
                    <TableHeadCell>Captura</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {offeringPage.rows.map((row) => (
                    <TableRow key={row.academicOfferingId}>
                      <TableCell>{row.academicPeriod.name}</TableCell>
                      <TableCell>{`${row.group.code} · ${row.group.name}`}</TableCell>
                      <TableCell>{`${row.subject.code} · ${row.subject.name}`}</TableCell>
                      <TableCell>{`${row.semesterNumber}° semestre`}</TableCell>
                      <TableCell>{row.trainingArea?.name ?? "No disponible"}</TableCell>
                      <TableCell>{renderTeacher(row.teacher?.teacherDisplayName)}</TableCell>
                      <TableCell align="right">{row.studentCount}</TableCell>
                      <TableCell>
                        <AppLink href={`/control-escolar/calificaciones/${row.academicOfferingId}`}>
                          Ver detalle
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <div className="control-school-badge-row">
                          <GradeStatusBadge value={row.offeringStatus} />
                          <span>{`${row.windowSummary.openCount} abiertas · ${row.windowSummary.closedCount} cerradas`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{`${row.captureSummary.capturedCount} capturadas`}</div>
                          <div>{`${row.captureSummary.reviewedCount} revisadas`}</div>
                          <div>{`${row.captureSummary.finalizedCount} finalizadas`}</div>
                          <div>{`${row.captureSummary.confirmedResultCount} resultados confirmados`}</div>
                          <div>{renderOperationalIdentifier(row.teacher?.teacherIdentifier)}</div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>

              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/calificaciones"
                searchParams={params}
              />
            </>
          )}
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof GradeManagementUiError) {
      return (
        <Container>
          <PageHeader title="Calificaciones" />
          <ErrorState
            description="No fue posible cargar la superficie administrativa de calificaciones."
            title="No fue posible cargar el listado"
          />
        </Container>
      );
    }

    throw error;
  }
}
