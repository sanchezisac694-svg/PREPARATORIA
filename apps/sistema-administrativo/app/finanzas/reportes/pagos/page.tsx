import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PaymentsReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getPayments();

  return (
    <Container>
      <Card>
        <h1>Reporte de pagos</h1>
        <p>
          Distingue amount, applied amount y unapplied amount sin exponer referencias sensibles.
        </p>
      </Card>
      {page.rows.length === 0 ? (
        <EmptyReport title="Pagos" />
      ) : (
        <Card>
          <h2>Primeros registros</h2>
          <ul>
            {page.rows.map((row) => (
              <li key={row.paymentId}>
                {row.receiptNumber} · {row.method} · ${row.amount} MXN · {row.status}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
