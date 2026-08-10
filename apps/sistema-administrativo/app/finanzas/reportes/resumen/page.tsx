import { AppLink, Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { ReportMetric } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialSummaryReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const summary = await reports.getSummary();

  return (
    <Container>
      <Card>
        <h1>Resumen financiero</h1>
        <p>Todos los agregados se resuelven desde un mismo snapshot server-side.</p>
        <p>
          <AppLink href="/finanzas/reportes/resumen/export">Exportar CSV</AppLink>
        </p>
      </Card>

      <ReportMetric label="Gross charges" value={`$${summary.grossCharges} MXN`} />
      <ReportMetric label="Credit adjustments" value={`$${summary.creditAdjustments} MXN`} />
      <ReportMetric label="Discounts" value={`$${summary.discounts} MXN`} />
      <ReportMetric label="Waivers" value={`$${summary.waivers} MXN`} />
      <ReportMetric
        label="Scholarship adjustments"
        value={`$${summary.scholarshipAdjustments} MXN`}
      />
      <ReportMetric label="Net charges" value={`$${summary.netCharges} MXN`} />
      <ReportMetric label="Confirmed payments" value={`$${summary.confirmedPayments} MXN`} />
      <ReportMetric label="Reversed payments" value={`$${summary.reversedPayments} MXN`} />
      <ReportMetric label="Net collections" value={`$${summary.netCollections} MXN`} />
      <ReportMetric label="Outstanding" value={`$${summary.outstanding} MXN`} />
      <ReportMetric label="Overdue" value={`$${summary.overdue} MXN`} />

      <Card>
        <h2>Indicadores auxiliares</h2>
        <ul>
          <li>Charge count: {summary.chargeCount}</li>
          <li>Payment count: {summary.paymentCount}</li>
          <li>Debtor account count: {summary.debtorAccountCount}</li>
        </ul>
        <p>La exportación real se realiza desde la ruta server-side.</p>
      </Card>
    </Container>
  );
}
