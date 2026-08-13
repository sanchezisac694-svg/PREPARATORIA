import { permissions, hasAnyPermission } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  ErrorState,
  MetricCard,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import { GradeStatusBadge, renderTeacher } from "../../../_admin/grade-labels";
import {
  GradeManagementUiError,
  listMyGradeManagementOfferings,
  requireGradeManagementAccess,
} from "../../../../lib/grade-management";
import {
  EmptyResults,
  PaginationControls,
  readPositiveNumberParam,
  readSingleParam,
  StatusFeedback,
  type RouteSearchParams,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export default async function MyGradeOfferingsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const academicPeriodId = readSingleParam(params, "period");
  const windowStatus = readSingleParam(params, "windowStatus");
  const offeringStatus = readSingleParam(params, "offeringStatus");

  try {
    const { identity } = await requireGradeManagementAccess([permissions.ACADEMIC_GRADES_READ]);
    const offeringPage = await listMyGradeManagementOfferings({
      academicPeriodId: academicPeriodId || null,
      limit: PAGE_SIZE,
      offset,
      offeringStatus: offeringStatus || null,
      windowStatus: windowStatus || null,
    });
    const pageCount = Math.max(1, Math.ceil(offeringPage.totalRows / offeringPage.pageSize));
    const canCapture = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_CAPTURE,
    ]);
    const canFinalize = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_FINALIZE,
    ]);

    return (
      <Container>
        <PageHeader
          description="Carga propia del actor docente resuelta por sesión, sin seleccionar teacherId."
          title="Mi carga docente"
        />

        <StatusFeedback params={params} />

        <section className="control-school-metric-grid" aria-label="Resumen docente">
          <MetricCard label="Offerings asignados" value={offeringPage.totalRows} />
          <MetricCard label="Filas en página" value={offeringPage.rows.length} />
        </section>

        <Card>
          <h2>Estado de la carga propia</h2>
          <p>
            {canCapture
              ? "Tu cuenta puede capturar calificaciones donde el backend confirme ownership docente."
              : "Tu cuenta se encuentra en modo de solo lectura para esta superficie."}
          </p>
          <p>
            {canFinalize
              ? "También puedes finalizar unidades cuando el estado real lo permita."
              : "La finalización seguirá dependiendo del permiso efectivo del actor."}
          </p>
        </Card>

        <Card>
          <h2>Offerings propios</h2>
          {offeringPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay offerings propios visibles para este actor."
              title="Sin grupos asignados"
            />
          ) : (
            <>
              <DataTable caption="Carga docente propia">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Periodo</TableHeadCell>
                    <TableHeadCell>Grupo</TableHeadCell>
                    <TableHeadCell>Materia</TableHeadCell>
                    <TableHeadCell>Docente visible</TableHeadCell>
                    <TableHeadCell>Ventanas</TableHeadCell>
                    <TableHeadCell>Captura</TableHeadCell>
                    <TableHeadCell>Detalle</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {offeringPage.rows.map((row) => (
                    <TableRow key={row.academicOfferingId}>
                      <TableCell>{row.academicPeriod.name}</TableCell>
                      <TableCell>{`${row.group.code} · ${row.group.name}`}</TableCell>
                      <TableCell>{`${row.subject.code} · ${row.subject.name}`}</TableCell>
                      <TableCell>{renderTeacher(row.teacher?.teacherDisplayName)}</TableCell>
                      <TableCell>
                        <div className="control-school-badge-row">
                          <GradeStatusBadge value={row.offeringStatus} />
                          <span>{`${row.windowSummary.openCount} abiertas`}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{`${row.captureSummary.capturedCount} capturadas`}</div>
                        <div>{`${row.captureSummary.reviewedCount} revisadas`}</div>
                        <div>{`${row.captureSummary.finalizedCount} finalizadas`}</div>
                      </TableCell>
                      <TableCell>
                        <AppLink href={`/control-escolar/calificaciones/${row.academicOfferingId}`}>
                          Abrir offering
                        </AppLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>
              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/calificaciones/mis-grupos"
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
          <PageHeader title="Mi carga docente" />
          <ErrorState
            description="No fue posible cargar la carga docente desde el contrato público."
            title="No fue posible cargar los grupos"
          />
        </Container>
      );
    }

    throw error;
  }
}
