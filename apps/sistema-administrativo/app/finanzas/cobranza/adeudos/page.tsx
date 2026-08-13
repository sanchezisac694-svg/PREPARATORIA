import {
  Alert,
  Card,
  Container,
  DataTable,
  DateDisplay,
  Money,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import { FinancialStatusBadge } from "../../../_admin/financial-labels";
import { requireAdminAccess } from "../../../../lib/auth";
import { getFinancialReportsService } from "../../../../lib/financial-reports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OverdueAccountsPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const debt = await reports.getDebt({ pageSize: 25 });

  return (
    <Container>
      <PageHeader
        description="Listado server-side, paginado, de cuentas con adeudo derivado y caso visible."
        title="Adeudos"
      />

      <Card>
        <h2>Vista administrativa</h2>
        <Alert tone="info">
          Esta pantalla reutiliza el reporte real de adeudos. No recalcula vencimientos ni saldos en
          React y no expone UUID internos, correos ni teléfonos.
        </Alert>
      </Card>

      <Card>
        {debt.rows.length === 0 ? (
          <Alert tone="info">No hay cuentas con adeudo visible en el corte actual.</Alert>
        ) : (
          <DataTable caption="Adeudos administrativos visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Alumno</TableHeadCell>
                <TableHeadCell>Grupo</TableHeadCell>
                <TableHeadCell>Semestre</TableHeadCell>
                <TableHeadCell>Vencimiento más antiguo</TableHeadCell>
                <TableHeadCell align="right">Saldo pendiente</TableHeadCell>
                <TableHeadCell align="right">Adeudo vencido</TableHeadCell>
                <TableHeadCell>Caso</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {debt.rows.map((row) => (
                <TableRow key={`${row.studentIdentifier}-${row.agingBucket}`}>
                  <TableCell>{row.studentIdentifier}</TableCell>
                  <TableCell>{row.studentDisplayName ?? "Alumno no visible"}</TableCell>
                  <TableCell>{row.groupName ?? "Sin grupo"}</TableCell>
                  <TableCell>{row.semesterNumber ?? "—"}</TableCell>
                  <TableCell>
                    {row.oldestOverdueDate ? <DateDisplay value={row.oldestOverdueDate} /> : "—"}
                  </TableCell>
                  <TableCell align="right">
                    <Money amount={row.totalOutstanding} />
                  </TableCell>
                  <TableCell align="right">
                    <Money amount={row.totalOverdue} />
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.caseStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        )}
      </Card>
    </Container>
  );
}
