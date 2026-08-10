import { Alert, AppLink, Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../lib/financial-reports";
import { requireAdminAccess } from "../../../lib/auth";
import { ReportMetric } from "./_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialReportsDashboardPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const summary = await reports.getSummary();

  return (
    <Container>
      <Card>
        <h1>Reportes financieros</h1>
        <p>
          Vista administrativa derivada exclusivamente del ledger existente. No crea una segunda
          contabilidad.
        </p>
        <Alert tone="warning">
          La exportación CSV se genera del lado del servidor y mantiene whitelist de columnas.
        </Alert>
      </Card>

      <ReportMetric label="Gross charges" value={`$${summary.grossCharges} MXN`} />
      <ReportMetric label="Net collections" value={`$${summary.netCollections} MXN`} />
      <ReportMetric label="Outstanding" value={`$${summary.outstanding} MXN`} />
      <ReportMetric label="Overdue" value={`$${summary.overdue} MXN`} />
      <ReportMetric
        label="Benefits"
        value={`$${summary.discounts} + $${summary.scholarshipAdjustments} + $${summary.waivers} MXN`}
      />
      <ReportMetric label="Cash today" value={`$${summary.confirmedPayments} MXN`} />

      <Card>
        <h2>Rutas disponibles</h2>
        <nav aria-label="Reportes financieros">
          <ul>
            <li>
              <AppLink href="/finanzas/reportes/resumen">Resumen</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/cargos">Cargos</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/pagos">Pagos</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/adeudos">Adeudos</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/caja">Caja</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/beneficios">Beneficios</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/reportes/convenios">Convenios</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
