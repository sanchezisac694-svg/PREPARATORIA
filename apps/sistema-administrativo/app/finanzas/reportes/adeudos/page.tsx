import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DebtReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const debt = await reports.getDebt();

  return (
    <Container>
      <Card>
        <h1>Reporte de adeudos</h1>
        <p>Reutiliza la posición de deuda y el aging existentes del Bloque 4.</p>
      </Card>
      <Card>
        <h2>Resumen</h2>
        <ul>
          <li>Total outstanding: ${debt.summary.totalOutstanding} MXN</li>
          <li>Total overdue: ${debt.summary.totalOverdue} MXN</li>
          <li>Debtor accounts: {debt.summary.debtorAccounts}</li>
        </ul>
      </Card>
      {debt.rows.length === 0 ? (
        <EmptyReport title="Adeudos" />
      ) : (
        <Card>
          <h2>Primeros registros</h2>
          <ul>
            {debt.rows.map((row) => (
              <li key={`${row.studentIdentifier}-${row.agingBucket}`}>
                {row.studentIdentifier} · {row.agingBucket} · ${row.totalOverdue} MXN
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
