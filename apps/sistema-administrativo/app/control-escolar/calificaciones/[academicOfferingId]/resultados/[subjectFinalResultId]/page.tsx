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

import { renderOperationalIdentifier } from "../../../../../_admin/grade-labels";
import {
  getGradeManagementSubjectResultHistory,
  GradeManagementUiError,
  requireGradeManagementAccess,
} from "../../../../../../lib/grade-management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubjectResultHistoryPage({
  params,
}: Readonly<{
  params: Promise<{ academicOfferingId: string; subjectFinalResultId: string }>;
}>) {
  const routeParams = await params;

  try {
    await requireGradeManagementAccess([permissions.ACADEMIC_SUBJECT_RESULTS_READ]);
    const history = await getGradeManagementSubjectResultHistory(routeParams.subjectFinalResultId);

    return (
      <Container>
        <PageHeader
          description="Historial del resultado AC/NA devuelto por el backend."
          title="Historial del resultado de materia"
        />

        <Card>
          <p>{`Alumno: ${history.studentIdentifier}`}</p>
          <AppLink href={`/control-escolar/calificaciones/${routeParams.academicOfferingId}`}>
            Volver al offering
          </AppLink>
        </Card>

        <Card>
          <DataTable caption="Historial de resultado de materia">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Fecha</TableHeadCell>
                <TableHeadCell>Resultado anterior</TableHeadCell>
                <TableHeadCell>Resultado actual</TableHeadCell>
                <TableHeadCell>Estado anterior</TableHeadCell>
                <TableHeadCell>Estado actual</TableHeadCell>
                <TableHeadCell>Actor operativo</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {history.history.map((entry) => (
                <TableRow key={entry.historyId}>
                  <TableCell>
                    <DateDisplay value={entry.createdAt} withTime />
                  </TableCell>
                  <TableCell>{entry.previousResult ?? "No disponible"}</TableCell>
                  <TableCell>{entry.resultingResult}</TableCell>
                  <TableCell>{entry.previousStatus ?? "No disponible"}</TableCell>
                  <TableCell>{entry.resultingStatus}</TableCell>
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
          <PageHeader title="Historial del resultado de materia" />
          <ErrorState
            description="No fue posible cargar el historial del resultado."
            title="No fue posible cargar el historial"
          />
        </Container>
      );
    }

    throw error;
  }
}
