import { permissions, hasAnyPermission } from "@preparatoria/authz";
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

import { GradeStatusBadge } from "../../../_admin/grade-labels";
import {
  GradeManagementUiError,
  listGradeManagementCorrections,
  requireGradeManagementAccess,
} from "../../../../lib/grade-management";
import {
  applyGradeCorrectionAction,
  approveGradeCorrectionAction,
  beginGradeCorrectionReviewAction,
  cancelGradeCorrectionAction,
  rejectGradeCorrectionAction,
  submitGradeCorrectionAction,
} from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import {
  EmptyResults,
  PaginationControls,
  QueryFilters,
  readPositiveNumberParam,
  readSingleParam,
  StatusFeedback,
  type RouteSearchParams,
} from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

export default async function GradeCorrectionsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};
  const page = readPositiveNumberParam(params, "page", 1);
  const offset = (page - 1) * PAGE_SIZE;
  const academicOfferingId = readSingleParam(params, "offering");
  const studentUnitGradeId = readSingleParam(params, "unitGrade");
  const status = readSingleParam(params, "status");

  try {
    const { identity } = await requireGradeManagementAccess([permissions.ACADEMIC_GRADES_READ]);
    const correctionPage = await listGradeManagementCorrections({
      academicOfferingId: academicOfferingId || null,
      limit: PAGE_SIZE,
      offset,
      status: status || null,
      studentUnitGradeId: studentUnitGradeId || null,
    });
    const pageCount = Math.max(1, Math.ceil(correctionPage.totalRows / correctionPage.pageSize));
    const canCorrect = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_CORRECT,
    ]);

    return (
      <Container>
        <PageHeader
          description="Consulta y opera el workflow real de correcciones sin exponer IDs de identidad."
          title="Correcciones"
        />

        <StatusFeedback params={params} />

        <Card>
          <h2>Filtros disponibles</h2>
          <form className="control-school-filter-form" method="get">
            <QueryFilters title="Filtros de correcciones">
              <Field label="Offering" labelFor="grade-correction-offering">
                <Input
                  defaultValue={academicOfferingId}
                  id="grade-correction-offering"
                  name="offering"
                  placeholder="Identificador exacto"
                />
              </Field>
              <Field label="Unidad" labelFor="grade-correction-unit-grade">
                <Input
                  defaultValue={studentUnitGradeId}
                  id="grade-correction-unit-grade"
                  name="unitGrade"
                  placeholder="Identificador exacto"
                />
              </Field>
              <Field label="Estado" labelFor="grade-correction-status">
                <Select defaultValue={status} id="grade-correction-status" name="status">
                  <option value="">Todos</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="SUBMITTED">Enviada</option>
                  <option value="UNDER_REVIEW">En revisión</option>
                  <option value="APPROVED">Aprobada</option>
                  <option value="REJECTED">Rechazada</option>
                  <option value="APPLIED">Aplicada</option>
                  <option value="CANCELLED">Cancelada</option>
                </Select>
              </Field>
              <div className="control-school-filter-actions">
                <button className="ui-button ui-button--primary ui-button--md" type="submit">
                  Aplicar filtros
                </button>
                <AppLink
                  className="ui-button ui-button--secondary ui-button--md"
                  href="/control-escolar/calificaciones/correcciones"
                >
                  Limpiar
                </AppLink>
              </div>
            </QueryFilters>
          </form>
        </Card>

        <Card>
          <h2>Workflow visible</h2>
          {correctionPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay correcciones visibles con los filtros actuales."
              title="Sin correcciones"
            />
          ) : (
            <>
              <DataTable caption="Correcciones visibles">
                <TableHeadSection>
                  <TableRow>
                    <TableHeadCell>Alumno</TableHeadCell>
                    <TableHeadCell>Unidad</TableHeadCell>
                    <TableHeadCell>Motivo</TableHeadCell>
                    <TableHeadCell>Propuesta</TableHeadCell>
                    <TableHeadCell>Estado</TableHeadCell>
                    <TableHeadCell>Fechas</TableHeadCell>
                    <TableHeadCell>Offering</TableHeadCell>
                    <TableHeadCell>Acciones</TableHeadCell>
                  </TableRow>
                </TableHeadSection>
                <TableBodySection>
                  {correctionPage.rows.map((row) => (
                    <TableRow key={row.correctionId}>
                      <TableCell>{row.studentIdentifier}</TableCell>
                      <TableCell>{`Unidad ${row.unitNumber}`}</TableCell>
                      <TableCell>{row.reasonCode}</TableCell>
                      <TableCell>{`${row.previousRawGrade} → ${row.proposedRawGrade}`}</TableCell>
                      <TableCell>
                        <GradeStatusBadge value={row.status} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>
                            Solicitud: <DateDisplay value={row.requestedAt} withTime />
                          </div>
                          {row.reviewedAt ? (
                            <div>
                              Revisión: <DateDisplay value={row.reviewedAt} withTime />
                            </div>
                          ) : null}
                          {row.appliedAt ? (
                            <div>
                              Aplicación: <DateDisplay value={row.appliedAt} withTime />
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <AppLink href={`/control-escolar/calificaciones/${row.academicOfferingId}`}>
                          Ver offering
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        {canCorrect ? (
                          <div className="control-school-inline-actions">
                            {row.status === "DRAFT" ? (
                              <form action={submitGradeCorrectionAction}>
                                <input name="correctionId" type="hidden" value={row.correctionId} />
                                <input
                                  name="returnPath"
                                  type="hidden"
                                  value="/control-escolar/calificaciones/correcciones"
                                />
                                <button
                                  className="ui-button ui-button--secondary ui-button--sm"
                                  type="submit"
                                >
                                  Enviar
                                </button>
                              </form>
                            ) : null}
                            {row.status === "SUBMITTED" ? (
                              <form action={beginGradeCorrectionReviewAction}>
                                <input name="correctionId" type="hidden" value={row.correctionId} />
                                <input
                                  name="returnPath"
                                  type="hidden"
                                  value="/control-escolar/calificaciones/correcciones"
                                />
                                <button
                                  className="ui-button ui-button--secondary ui-button--sm"
                                  type="submit"
                                >
                                  Iniciar revisión
                                </button>
                              </form>
                            ) : null}
                            {row.status === "APPROVED" ? (
                              <form action={applyGradeCorrectionAction}>
                                <input name="correctionId" type="hidden" value={row.correctionId} />
                                <input
                                  name="returnPath"
                                  type="hidden"
                                  value="/control-escolar/calificaciones/correcciones"
                                />
                                <ConfirmSubmitButton confirmationMessage="¿Confirmas aplicar esta corrección?">
                                  Aplicar
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                            {row.status === "UNDER_REVIEW" ? (
                              <>
                                <form action={approveGradeCorrectionAction}>
                                  <input
                                    name="correctionId"
                                    type="hidden"
                                    value={row.correctionId}
                                  />
                                  <input
                                    name="returnPath"
                                    type="hidden"
                                    value="/control-escolar/calificaciones/correcciones"
                                  />
                                  <ConfirmSubmitButton confirmationMessage="¿Confirmas aprobar esta corrección?">
                                    Aprobar
                                  </ConfirmSubmitButton>
                                </form>
                                <form action={rejectGradeCorrectionAction}>
                                  <input
                                    name="correctionId"
                                    type="hidden"
                                    value={row.correctionId}
                                  />
                                  <input
                                    name="returnPath"
                                    type="hidden"
                                    value="/control-escolar/calificaciones/correcciones"
                                  />
                                  <ConfirmSubmitButton
                                    confirmationMessage="¿Confirmas rechazar esta corrección?"
                                    tone="danger"
                                  >
                                    Rechazar
                                  </ConfirmSubmitButton>
                                </form>
                              </>
                            ) : null}
                            {row.status !== "APPLIED" && row.status !== "CANCELLED" ? (
                              <form action={cancelGradeCorrectionAction}>
                                <input name="correctionId" type="hidden" value={row.correctionId} />
                                <input
                                  name="returnPath"
                                  type="hidden"
                                  value="/control-escolar/calificaciones/correcciones"
                                />
                                <ConfirmSubmitButton
                                  confirmationMessage="¿Confirmas cancelar esta corrección?"
                                  tone="danger"
                                >
                                  Cancelar
                                </ConfirmSubmitButton>
                              </form>
                            ) : null}
                          </div>
                        ) : (
                          "Solo lectura"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBodySection>
              </DataTable>

              <PaginationControls
                currentPage={page}
                pageCount={pageCount}
                pathname="/control-escolar/calificaciones/correcciones"
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
          <PageHeader title="Correcciones" />
          <ErrorState
            description="No fue posible cargar el workflow de correcciones."
            title="No fue posible cargar las correcciones"
          />
        </Container>
      );
    }

    throw error;
  }
}
