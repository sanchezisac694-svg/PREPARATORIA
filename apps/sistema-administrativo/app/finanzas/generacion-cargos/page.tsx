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

export default async function ChargeGenerationPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getCharges({ pageSize: 10 });

  return (
    <Container>
      <PageHeader
        description="Vista operativa de cargos ya generados y acceso al flujo controlado de lotes."
        title="Generación institucional de cargos"
      />

      <Card>
        <h2>Flujo disponible</h2>
        <p>Preview obligatorio, revisión, aprobación y ejecución segregada.</p>
        <nav aria-label="Generación de cargos">
          <ul>
            <li>
              <AppLink href="/finanzas/generacion-cargos/nuevo">Nuevo lote</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/generacion-cargos/reglas">Reglas</AppLink>
            </li>
          </ul>
        </nav>
      </Card>

      <Card>
        <h2>Cargos visibles</h2>
        {page.rows.length === 0 ? (
          <Alert tone="info">No hay cargos visibles todavía en el reporte operativo.</Alert>
        ) : (
          <DataTable caption="Cargos generados visibles">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Alumno</TableHeadCell>
                <TableHeadCell>Concepto</TableHeadCell>
                <TableHeadCell>Vencimiento</TableHeadCell>
                <TableHeadCell align="right">Importe original</TableHeadCell>
                <TableHeadCell align="right">Saldo pendiente</TableHeadCell>
                <TableHeadCell>Estado</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {page.rows.map((row) => (
                <TableRow key={row.chargeId}>
                  <TableCell>{row.studentIdentifier ?? "Sin matrícula"}</TableCell>
                  <TableCell>{row.studentDisplayName}</TableCell>
                  <TableCell>{row.concept}</TableCell>
                  <TableCell>{row.dueDate ? <DateDisplay value={row.dueDate} /> : "—"}</TableCell>
                  <TableCell align="right">
                    <Money amount={row.originalAmount} />
                  </TableCell>
                  <TableCell align="right">
                    <Money amount={row.outstanding} />
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.chargeStatus} />
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
