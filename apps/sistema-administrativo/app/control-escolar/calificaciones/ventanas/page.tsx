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

import { GradeStatusBadge, renderWindowAvailability } from "../../../_admin/grade-labels";
import { requireControlSchoolAccess } from "../../../../lib/control-school";
import {
  GradeManagementUiError,
  listGradeManagementWindows,
} from "../../../../lib/grade-management";
import {
  cancelGradeWindowAction,
  closeGradeWindowAction,
  createGradeWindowAction,
  openGradeWindowAction,
} from "../actions";
import { EmptyResults, StatusFeedback, type RouteSearchParams } from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GradeWindowsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const params = (await searchParams) ?? {};

  try {
    const { identity, service } = await requireControlSchoolAccess([
      permissions.ACADEMIC_GRADE_WINDOWS_MANAGE,
    ]);
    const [structure, windowPage] = await Promise.all([
      service.getStructure(),
      listGradeManagementWindows({
        academicPeriodId: typeof params.period === "string" ? params.period : null,
        limit: 50,
        offset: 0,
        status: typeof params.status === "string" ? params.status : null,
        windowType: typeof params.type === "string" ? params.type : null,
      }),
    ]);
    const canManage = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADE_WINDOWS_MANAGE,
    ]);

    return (
      <Container>
        <PageHeader
          description="Administra ventanas de captura reutilizando únicamente los wrappers públicos existentes."
          title="Ventanas de captura"
        />

        <StatusFeedback params={params} />

        <Card>
          <h2>Nueva ventana</h2>
          <form action={createGradeWindowAction} className="control-school-filter-form">
            <div className="control-school-filters">
              <Field label="Periodo" labelFor="grade-window-period">
                <Select id="grade-window-period" name="academicPeriodId">
                  {structure.periods.map((period) => (
                    <option key={period.academicPeriodId} value={period.academicPeriodId}>
                      {`${period.code} · ${period.name}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo" labelFor="grade-window-type">
                <Select defaultValue="UNIT_CAPTURE" id="grade-window-type" name="gradeWindowType">
                  <option value="UNIT_CAPTURE">Captura por unidad</option>
                  <option value="FINAL_REVIEW">Revisión final</option>
                  <option value="CORRECTION">Corrección</option>
                </Select>
              </Field>
              <Field label="Unidad" labelFor="grade-window-unit">
                <Select id="grade-window-unit" name="unitNumber">
                  <option value="">Sin unidad específica</option>
                  <option value="1">Unidad 1</option>
                  <option value="2">Unidad 2</option>
                  <option value="3">Unidad 3</option>
                </Select>
              </Field>
              <Field label="Apertura" labelFor="grade-window-opens">
                <Input id="grade-window-opens" name="opensAt" type="datetime-local" />
              </Field>
              <Field label="Cierre" labelFor="grade-window-closes">
                <Input id="grade-window-closes" name="closesAt" type="datetime-local" />
              </Field>
              <div className="control-school-filter-actions">
                <button className="ui-button ui-button--primary ui-button--md" type="submit">
                  Crear ventana
                </button>
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <h2>Ventanas visibles</h2>
          {windowPage.rows.length === 0 ? (
            <EmptyResults
              description="No hay ventanas visibles para el corte actual."
              title="Sin ventanas"
            />
          ) : (
            <DataTable caption="Ventanas de captura visibles">
              <TableHeadSection>
                <TableRow>
                  <TableHeadCell>Periodo</TableHeadCell>
                  <TableHeadCell>Tipo</TableHeadCell>
                  <TableHeadCell>Unidad</TableHeadCell>
                  <TableHeadCell>Estado</TableHeadCell>
                  <TableHeadCell>Apertura</TableHeadCell>
                  <TableHeadCell>Cierre</TableHeadCell>
                  <TableHeadCell>Vigencia</TableHeadCell>
                  <TableHeadCell>Acciones</TableHeadCell>
                </TableRow>
              </TableHeadSection>
              <TableBodySection>
                {windowPage.rows.map((row) => (
                  <TableRow key={row.gradeCaptureWindowId}>
                    <TableCell>{row.academicPeriod.name}</TableCell>
                    <TableCell>{row.windowType}</TableCell>
                    <TableCell>
                      {row.unitNumber ? `Unidad ${row.unitNumber}` : "No aplica"}
                    </TableCell>
                    <TableCell>
                      <GradeStatusBadge value={row.status} />
                    </TableCell>
                    <TableCell>
                      <DateDisplay value={row.opensAt} withTime />
                    </TableCell>
                    <TableCell>
                      <DateDisplay value={row.closesAt} withTime />
                    </TableCell>
                    <TableCell>{renderWindowAvailability(row.isActiveNow)}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <div className="control-school-inline-actions">
                          {row.canOpen ? (
                            <form action={openGradeWindowAction}>
                              <input
                                name="gradeCaptureWindowId"
                                type="hidden"
                                value={row.gradeCaptureWindowId}
                              />
                              <button
                                className="ui-button ui-button--secondary ui-button--sm"
                                type="submit"
                              >
                                Abrir
                              </button>
                            </form>
                          ) : null}
                          {row.canClose ? (
                            <form action={closeGradeWindowAction}>
                              <input
                                name="gradeCaptureWindowId"
                                type="hidden"
                                value={row.gradeCaptureWindowId}
                              />
                              <button
                                className="ui-button ui-button--secondary ui-button--sm"
                                type="submit"
                              >
                                Cerrar
                              </button>
                            </form>
                          ) : null}
                          {row.canCancel ? (
                            <form action={cancelGradeWindowAction}>
                              <input
                                name="gradeCaptureWindowId"
                                type="hidden"
                                value={row.gradeCaptureWindowId}
                              />
                              <button
                                className="ui-button ui-button--secondary ui-button--sm"
                                type="submit"
                              >
                                Cancelar
                              </button>
                            </form>
                          ) : null}
                        </div>
                      ) : (
                        <AppLink href="/sin-autorizacion">Sin autorización</AppLink>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBodySection>
            </DataTable>
          )}
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof GradeManagementUiError) {
      return (
        <Container>
          <PageHeader title="Ventanas de captura" />
          <ErrorState
            description="No fue posible cargar la administración de ventanas."
            title="No fue posible cargar las ventanas"
          />
        </Container>
      );
    }

    throw error;
  }
}
