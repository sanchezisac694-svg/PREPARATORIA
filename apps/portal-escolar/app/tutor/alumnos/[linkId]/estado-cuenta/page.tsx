import { Alert, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getGuardianFinanceService } from "../../../../../lib/student-finance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentFinancialStatementPage({
  params,
}: Readonly<{
  params: Promise<{ linkId: string }>;
}>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianFinanceService();
  const summary = await service.getGuardianSummary(linkId);

  if ("error" in summary) {
    return (
      <section className="student-portal-stack">
        <h1>Estado de cuenta</h1>
        <Alert tone="warning">FINANCE_SCOPE_DENIED</Alert>
        <Card>
          <p>El acceso financiero no está habilitado para este vínculo institucional.</p>
        </Card>
      </section>
    );
  }

  return (
    <section className="student-portal-stack">
      <h1>Estado de cuenta</h1>
      <Alert tone="warning">FINANCE_SCOPE_DENIED</Alert>
      <Card>
        <p>
          La política estándar mantiene el acceso financiero deshabilitado para vínculos de tutor.
        </p>
      </Card>
    </section>
  );
}
