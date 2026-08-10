import { Card, Container } from "@preparatoria/ui";

import { getFinancialPeriodCloseService } from "../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FinancialClosureDetailPage({
  params,
}: Readonly<{
  params: Promise<{ closureId: string }>;
}>) {
  await requireAdminAccess();
  const { closureId } = await params;
  const closures = await getFinancialPeriodCloseService();
  const detail = await closures.get(closureId);

  return (
    <Container>
      <Card>
        <h1>Cierre operativo financiero</h1>
        <p>
          {detail.academicPeriodCode ?? "PERIODO"} · {detail.businessDate} · v{detail.version} ·{" "}
          {detail.status}
        </p>
      </Card>
      <Card>
        <h2>Snapshot</h2>
        <ul>
          <li>Gross charges: ${detail.grossCharges} MXN</li>
          <li>Net collections: ${detail.netCollections} MXN</li>
          <li>Outstanding: ${detail.outstanding} MXN</li>
          <li>Overdue: ${detail.overdue} MXN</li>
        </ul>
      </Card>
    </Container>
  );
}
