import {
  Alert,
  AppLink,
  Card,
  Container,
  DataTable,
  DateDisplay,
  MetricCard,
  Money,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import { FinancialStatusBadge } from "../_admin/financial-labels";
import { getCashRegisterAdapter } from "../../lib/cash-register";
import { getFinancialReportsService } from "../../lib/financial-reports";
import { requireAdminAccess } from "../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CajaPage() {
  await requireAdminAccess();

  const [adapter, reports] = await Promise.all([
    getCashRegisterAdapter(),
    getFinancialReportsService(),
  ]);
  const [{ activeSession, registers }, cashReport] = await Promise.all([
    adapter.getOverview(),
    reports.getCash({ pageSize: 5 }),
  ]);

  return (
    <Container>
      <PageHeader
        description="Operación presencial sobre la infraestructura financiera existente."
        title="Caja escolar"
      />

      <div className="dashboard-metric-grid">
        <MetricCard
          description="Cajas visibles para la cuenta autenticada."
          label="Cajas disponibles"
          value={registers.length}
        />
        <MetricCard
          description="Turno operativo actual, si existe."
          label="Turno activo"
          value={
            activeSession ? <FinancialStatusBadge value={activeSession.status} /> : "Sin turno"
          }
        />
        <MetricCard
          description="Monto de apertura del turno actual."
          label="Apertura visible"
          value={activeSession ? <Money amount={activeSession.openingAmount} /> : <span>—</span>}
        />
      </div>

      <Card>
        <h2>Estado operativo</h2>
        {activeSession ? (
          <ul>
            <li>
              Fecha de operación: <DateDisplay value={activeSession.businessDate} />
            </li>
            <li>
              Estado: <FinancialStatusBadge value={activeSession.status} />
            </li>
            <li>
              Efectivo esperado:{" "}
              {activeSession.expectedCashAmount ? (
                <Money amount={activeSession.expectedCashAmount} />
              ) : (
                "Pendiente de conciliación"
              )}
            </li>
          </ul>
        ) : (
          <Alert tone="info">
            No existe un turno visible en esta vista. La apertura controlada se realiza desde la
            pantalla de turno.
          </Alert>
        )}
      </Card>

      <Card>
        <h2>Acciones disponibles</h2>
        <nav aria-label="Operación de caja">
          <ul>
            <li>
              <AppLink href="/caja/turno">Turno actual</AppLink>
            </li>
            <li>
              <AppLink href="/caja/cobros/nuevo">Nuevo cobro presencial</AppLink>
            </li>
            <li>
              <AppLink href="/caja/movimientos">Movimientos manuales</AppLink>
            </li>
            <li>
              <AppLink href="/caja/arqueo">Arqueo</AppLink>
            </li>
            <li>
              <AppLink href="/caja/cierre">Cierre</AppLink>
            </li>
          </ul>
        </nav>
      </Card>

      <Card>
        <h2>Últimas sesiones visibles</h2>
        {cashReport.rows.length === 0 ? (
          <Alert tone="info">
            Todavía no hay sesiones de caja visibles en el reporte operativo.
          </Alert>
        ) : (
          <DataTable caption="Sesiones recientes de caja">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Caja</TableHeadCell>
                <TableHeadCell>Fecha</TableHeadCell>
                <TableHeadCell align="right">Apertura</TableHeadCell>
                <TableHeadCell align="right">Esperado</TableHeadCell>
                <TableHeadCell>Turno</TableHeadCell>
                <TableHeadCell>Conciliación</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {cashReport.rows.map((row) => (
                <TableRow key={row.cashSessionId}>
                  <TableCell>
                    {row.cashRegisterName ?? row.cashRegisterCode ?? "Caja sin nombre"}
                  </TableCell>
                  <TableCell>
                    <DateDisplay value={row.businessDate} />
                  </TableCell>
                  <TableCell align="right">
                    <Money amount={row.opening} />
                  </TableCell>
                  <TableCell align="right">
                    {row.expected ? <Money amount={row.expected} /> : "—"}
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.sessionStatus} />
                  </TableCell>
                  <TableCell>
                    <FinancialStatusBadge value={row.reconciliationStatus} />
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
