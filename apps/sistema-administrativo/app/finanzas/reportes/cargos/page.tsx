import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ChargesReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getCharges();

  return (
    <Container>
      <Card>
        <h1>Reporte de cargos</h1>
        <p>Semántica principal: posted_at para generación y due_date para overdue.</p>
      </Card>
      {page.rows.length === 0 ? (
        <EmptyReport title="Cargos" />
      ) : (
        <Card>
          <h2>Primeros registros</h2>
          <ul>
            {page.rows.map((row) => (
              <li key={row.chargeId}>
                {row.studentIdentifier ?? "SIN-CÓDIGO"} · {row.concept} · ${row.outstanding} MXN ·{" "}
                {row.chargeStatus}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
