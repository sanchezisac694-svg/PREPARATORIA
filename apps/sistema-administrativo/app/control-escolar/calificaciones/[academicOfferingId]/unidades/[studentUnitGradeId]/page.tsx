import { permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  DateDisplay,
  ErrorState,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import { formatGradeValue, renderOperationalIdentifier } from "../../../../../_admin/grade-labels";
import {
  getGradeManagementUnitGradeHistory,
  GradeManagementUiError,
  requireGradeManagementAccess,
} from "../../../../../../lib/grade-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UnitGradeHistoryPage({
  params,
}: Readonly<{
  params: Promise<{ academicOfferingId: string; studentUnitGradeId: string }>;
}>) {
  const routeParams = await params;

  try {
    await requireGradeManagementAccess([permissions.ACADEMIC_GRADES_READ]);
    const history = await getGradeManagementUnitGradeHistory(routeParams.studentUnitGradeId);

    return (
      <Container>
        <PageHeader
          description="Historial de cambios por unidad resuelto por el backend."
          title={`Historial Unidad ${history.unitNumber}`}
        />

        <Card>
          <p>{`Alumno: ${history.studentIdentifier}`}</p>
          <AppLink href={`/control-escolar/calificaciones/${routeParams.academicOfferingId}`}>
            Volver al offering
          </AppLink>
        </Card>

        <Card>
          <DataTable caption="Historial de cambios de la unidad">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Fecha</TableHeadCell>
                <TableHeadCell>Motivo</TableHeadCell>
                <TableHeadCell>Estado anterior</TableHeadCell>
                <TableHeadCell>Estado resultante</TableHeadCell>
                <TableHeadCell>Raw anterior</TableHeadCell>
                <TableHeadCell>Raw resultante</TableHeadCell>
                <TableHeadCell>Actor operativo</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {history.history.map((entry) => (
                <TableRow key={entry.historyId}>
                  <TableCell>
                    <DateDisplay value={entry.createdAt} withTime />
                  </TableCell>
                  <TableCell>{entry.reasonCode}</TableCell>
                  <TableCell>{entry.previousStatus ?? "No disponible"}</TableCell>
                  <TableCell>{entry.resultingStatus}</TableCell>
                  <TableCell>{formatGradeValue(entry.previousRawGrade)}</TableCell>
                  <TableCell>{formatGradeValue(entry.resultingRawGrade)}</TableCell>
                  <TableCell>{renderOperationalIdentifier(entry.actorIdentifier)}</TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof GradeManagementUiError) {
      return (
        <Container>
          <PageHeader title="Historial de unidad" />
          <ErrorState
            description="No fue posible cargar el historial de la unidad seleccionada."
            title="No fue posible cargar el historial"
          />
        </Container>
      );
    }

    throw error;
  }
}
