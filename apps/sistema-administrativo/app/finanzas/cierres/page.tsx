import { AppLink, Card, Container } from "@preparatoria/ui";

import { getFinancialPeriodCloseService } from "../../../lib/financial-reports";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialClosuresPage() {
  await requireAdminAccess();
  const closures = await getFinancialPeriodCloseService();
  const page = await closures.list();

  return (
    <Container>
      <Card>
        <h1>Cierres operativos financieros</h1>
        <p>
          El cierre congela evidencia histórica. No bloquea pagos tardíos, reversals ni ajustes
          posteriores.
        </p>
        <p>
          <AppLink href="/finanzas/cierres/nuevo">Nuevo cierre</AppLink>
        </p>
      </Card>

      <Card>
        <h2>Historial</h2>
        <ul>
          {page.rows.map((row) => (
            <li key={row.closureId}>
              <AppLink href={`/finanzas/cierres/${row.closureId}`}>
                {row.academicPeriodCode ?? "PERIODO"} · {row.businessDate} · v{row.version} ·{" "}
                {row.status}
              </AppLink>
            </li>
          ))}
        </ul>
      </Card>
    </Container>
  );
}
