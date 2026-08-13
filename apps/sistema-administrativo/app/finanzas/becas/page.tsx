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

export default async function ScholarshipsPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getBenefits({ pageSize: 10 });

  return (
    <Container>
      <PageHeader
        description="Programas, aplicaciones y ajustes financieros visibles en el reporte institucional."
        title="Becas y beneficios financieros"
      />

      <Card>
        <nav aria-label="Beneficios financieros">
          <ul>
            <li>
              <AppLink href="/finanzas/becas/nuevo">Nuevo programa o asignación</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/descuentos">Descuentos y condonaciones</AppLink>
            </li>
          </ul>
        </nav>
      </Card>

      <Card>
        <h2>Beneficios visibles</h2>
        {page.rows.length === 0 ? (
          <Alert tone="info">No hay beneficios visibles todavía en el corte actual.</Alert>
        ) : (
          <DataTable caption="Beneficios financieros visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Alumno</TableHeadCell>
                <TableHeadCell>Programa</TableHeadCell>
                <TableHeadCell>Tipo</TableHeadCell>
                <TableHeadCell align="right">Importe</TableHeadCell>
                <TableHeadCell>Aplicado</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {page.rows.map((row) => (
                <TableRow key={row.adjustmentId}>
                  <TableCell>{row.studentIdentifier ?? "Sin matrícula"}</TableCell>
                  <TableCell>{row.studentDisplayName}</TableCell>
                  <TableCell>{row.program ?? "Operación directa"}</TableCell>
                  <TableCell>{row.benefitType}</TableCell>
                  <TableCell align="right">
                    <Money amount={row.benefitAmount} />
                  </TableCell>
                  <TableCell>
                    <DateDisplay value={row.appliedAt} withTime />
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.status} />
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
