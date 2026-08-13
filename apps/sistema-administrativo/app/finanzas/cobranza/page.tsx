import {
  Alert,
  AppLink,
  Card,
  Container,
  DataTable,
  Money,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import { FinancialStatusBadge } from "../../_admin/financial-labels";
import { getFinancialReportsService } from "../../../lib/financial-reports";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CollectionsPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const debt = await reports.getDebt({ pageSize: 10 });

  return (
    <Container>
      <PageHeader
        description="Seguimiento administrativo de adeudos derivados del ledger financiero existente."
        title="Cobranza administrativa"
      />

      <Card>
        <Alert tone="warning">
          Esta superficie evita una segunda contabilidad y reutiliza el ledger financiero ya
          existente.
        </Alert>
      </Card>

      <Card>
        <h2>Resumen visible</h2>
        <ul>
          <li>
            Adeudo total pendiente: <Money amount={debt.summary.totalOutstanding} />
          </li>
          <li>
            Adeudo vencido: <Money amount={debt.summary.totalOverdue} />
          </li>
          <li>Cuentas deudoras visibles: {debt.summary.debtorAccounts}</li>
        </ul>
      </Card>

      <Card>
        <h2>Rutas operativas</h2>
        <nav aria-label="Cobranza administrativa">
          <ul>
            <li>
              <AppLink href="/finanzas/cobranza/adeudos">Adeudos</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/cobranza/nuevo">Nuevo caso</AppLink>
            </li>
          </ul>
        </nav>
      </Card>

      <Card>
        <h2>Cuentas con mayor atención</h2>
        {debt.rows.length === 0 ? (
          <Alert tone="info">No hay adeudos visibles para seguimiento en este momento.</Alert>
        ) : (
          <DataTable caption="Resumen administrativo de adeudos">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Alumno</TableHeadCell>
                <TableHeadCell>Antigüedad del adeudo</TableHeadCell>
                <TableHeadCell align="right">Adeudo vencido</TableHeadCell>
                <TableHeadCell>Caso</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {debt.rows.map((row) => (
                <TableRow key={`${row.studentIdentifier}-${row.agingBucket}`}>
                  <TableCell>{row.studentIdentifier}</TableCell>
                  <TableCell>{row.studentDisplayName ?? "Alumno no visible"}</TableCell>
                  <TableCell>{row.agingBucket}</TableCell>
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
