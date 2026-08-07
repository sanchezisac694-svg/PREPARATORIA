import { Alert, AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getStudentFinanceService } from "../../../lib/student-finance";
import { StudentPortalEmpty, StudentPortalMetric, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentFinancialStatementPage() {
  noStore();
  const service = await getStudentFinanceService();
  const [summary, statement] = await Promise.all([
    service.getSummary(),
    service.getAccountStatement(),
  ]);

  return (
    <section className="student-portal-stack">
      <h1>Estado de cuenta</h1>
      <Alert tone="info">
        Comprobante interno de registro de pago. No constituye CFDI ni comprobante fiscal.
      </Alert>
      <StudentPortalSection title="Resumen financiero">
        <div className="student-portal-grid">
          <StudentPortalMetric label="Saldo total" value={`$${summary.totalBalance} MXN`} />
          <StudentPortalMetric label="Cargos abiertos" value={summary.openChargeCount} />
          <StudentPortalMetric label="Pagos registrados" value={summary.paymentCount} />
        </div>
      </StudentPortalSection>
      <StudentPortalSection title="Movimientos visibles">
        {statement.movements.length === 0 ? (
          <StudentPortalEmpty message="No hay movimientos publicados para esta cuenta." />
        ) : (
          statement.movements.map((movement, index) => (
            <Card key={`${movement.effectiveAt}-${index}`}>
              <h2>{movement.conceptName}</h2>
              <p>Tipo: {movement.movementType}</p>
              <p>Monto: ${movement.amount} MXN</p>
              <p>Saldo acumulado: ${movement.balance} MXN</p>
              <p>Referencia: {movement.referenceMasked ?? "No visible"}</p>
              <p>Fecha efectiva: {new Date(movement.effectiveAt).toLocaleString("es-MX")}</p>
            </Card>
          ))
        )}
      </StudentPortalSection>
      <AppLink href="/alumno/pagos">Consultar pagos registrados</AppLink>
    </section>
  );
}
