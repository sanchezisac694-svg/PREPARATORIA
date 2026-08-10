import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AgreementsReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getAgreements();

  return (
    <Container>
      <Card>
        <h1>Reporte de convenios</h1>
        <p>Los convenios organizan recuperación, pero no se contabilizan como ingreso.</p>
      </Card>
      {page.rows.length === 0 ? (
        <EmptyReport title="Convenios" />
      ) : (
        <Card>
          <h2>Primeros registros</h2>
          <ul>
            {page.rows.map((row) => (
              <li key={row.paymentAgreementId}>
                {row.studentIdentifier ?? "SIN-CÓDIGO"} · ${row.remaining} MXN ·{" "}
                {row.evaluationStatus}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
