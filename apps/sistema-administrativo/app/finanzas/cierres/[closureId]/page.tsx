import {
  Card,
  Container,
  DateDisplay,
  Money,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@preparatoria/ui";

import { getAdminStatusLabel, getAdminStatusTone } from "../../../_admin/status";
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
      <PageHeader
        description="Detalle histórico del cierre operativo financiero generado desde el backend real existente."
        title="Cierre operativo financiero"
      />

      <SectionCard
        description="El cierre preserva la fotografía histórica del periodo sin impedir operaciones posteriores en el ledger."
        title={detail.academicPeriodCode ?? "Periodo"}
      >
        <div className="dashboard-role-list">
          <StatusBadge tone={getAdminStatusTone(detail.status)}>
            {getAdminStatusLabel(detail.status)}
          </StatusBadge>
          <StatusBadge tone="neutral">{`Versión ${detail.version}`}</StatusBadge>
          <StatusBadge tone="info">
            <DateDisplay value={detail.businessDate} />
          </StatusBadge>
        </div>
      </SectionCard>

      <Card variant="metric">
        <h2>Snapshot financiero</h2>
        <ul>
          <li>
            Cargos brutos: <Money amount={detail.grossCharges} />
          </li>
          <li>
            Cobranza neta: <Money amount={detail.netCollections} />
          </li>
          <li>
            Saldo pendiente: <Money amount={detail.outstanding} />
          </li>
          <li>
            Saldo vencido: <Money amount={detail.overdue} />
          </li>
        </ul>
      </Card>
    </Container>
  );
}
