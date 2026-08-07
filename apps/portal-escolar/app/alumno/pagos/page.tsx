import { Alert, AppLink, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getStudentFinanceService } from "../../../lib/student-finance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentPaymentsPage() {
  noStore();
  const service = await getStudentFinanceService();
  const payments = await service.getPayments();

  return (
    <section className="student-portal-stack">
      <h1>Pagos registrados</h1>
      <Alert tone="info">
        Consulta informativa. No hay pagos en línea ni acciones de “Pagar ahora” en esta fase.
      </Alert>
      {payments.length === 0 ? (
        <Card>
          <p>No hay pagos confirmados visibles para esta cuenta.</p>
        </Card>
      ) : (
        payments.map((payment) => (
          <Card key={payment.paymentId}>
            <h2>{payment.receiptNumber ?? "Recibo interno pendiente"}</h2>
            <p>Monto: ${payment.amount} MXN</p>
            <p>Método: {payment.paymentMethod}</p>
            <p>Referencia: {payment.paymentReferenceMasked ?? "No visible"}</p>
            <p>Estado: {payment.status}</p>
            <AppLink href={`/alumno/pagos/${payment.paymentId}`}>Consultar recibo interno</AppLink>
          </Card>
        ))
      )}
    </section>
  );
}
