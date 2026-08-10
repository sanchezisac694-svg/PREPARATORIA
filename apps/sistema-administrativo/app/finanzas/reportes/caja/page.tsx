import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CashReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getCash();

  return (
    <Container>
      <Card>
        <h1>Reporte de caja</h1>
        <p>No crea una segunda fórmula de expected cash; reutiliza la del Bloque 2.</p>
      </Card>
      {page.rows.length === 0 ? (
        <EmptyReport title="Caja" />
      ) : (
        <Card>
          <h2>Primeras sesiones</h2>
          <ul>
            {page.rows.map((row) => (
              <li key={row.cashSessionId}>
                {row.cashRegisterCode ?? "SIN-CAJA"} · ${row.opening} MXN · {row.sessionStatus}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
