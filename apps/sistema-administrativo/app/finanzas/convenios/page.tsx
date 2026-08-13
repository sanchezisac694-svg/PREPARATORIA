import {
  Alert,
  AppLink,
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

import { FinancialStatusBadge } from "../../_admin/financial-labels";
import { requireAdminAccess } from "../../../lib/auth";
import { getFinancialReportsService } from "../../../lib/financial-reports";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgreementsPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getAgreements({ pageSize: 10 });

  return (
    <Container>
      <PageHeader
        description="Seguimiento visible de convenios y sus parcialidades derivadas."
        title="Convenios de pago"
      />

      <Card>
        <nav aria-label="Convenios de pago">
          <ul>
            <li>
              <AppLink href="/finanzas/convenios/nuevo">Nuevo convenio</AppLink>
            </li>
          </ul>
        </nav>
      </Card>

      <Card>
        <h2>Convenios visibles</h2>
        {page.rows.length === 0 ? (
          <Alert tone="info">No hay convenios visibles todavía en esta vista.</Alert>
        ) : (
          <DataTable caption="Convenios visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Alumno</TableHeadCell>
                <TableHeadCell align="right">Saldo inicial</TableHeadCell>
                <TableHeadCell align="right">Restante</TableHeadCell>
                <TableHeadCell>Próxima parcialidad</TableHeadCell>
                <TableHeadCell>Evaluación</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {page.rows.map((row) => (
                <TableRow key={row.paymentAgreementId}>
                  <TableCell>{row.studentIdentifier ?? "Sin matrícula"}</TableCell>
                  <TableCell>{row.studentDisplayName}</TableCell>
                  <TableCell align="right">
                    <Money amount={row.initialSnapshot} />
                  </TableCell>
                  <TableCell align="right">
                    <Money amount={row.remaining} />
                  </TableCell>
                  <TableCell>
                    {row.nextInstallment ? <DateDisplay value={row.nextInstallment} /> : "—"}
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.evaluationStatus} />
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.agreementStatus} />
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
