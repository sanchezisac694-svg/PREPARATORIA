import { Card, Container } from "@preparatoria/ui";

import { getFinancialReportsService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";
import { EmptyReport } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BenefitsReportPage() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const page = await reports.getBenefits();

  return (
    <Container>
      <Card>
        <h1>Reporte de beneficios financieros</h1>
        <p>Separa beca, descuento autorizado, waiver y reversal sin doble conteo.</p>
      </Card>
      {page.rows.length === 0 ? (
        <EmptyReport title="Beneficios" />
      ) : (
        <Card>
          <h2>Primeros registros</h2>
          <ul>
            {page.rows.map((row) => (
              <li key={row.adjustmentId}>
                {row.studentIdentifier ?? "SIN-CÓDIGO"} · {row.benefitType} · ${row.benefitAmount}{" "}
                MXN
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Container>
  );
}
