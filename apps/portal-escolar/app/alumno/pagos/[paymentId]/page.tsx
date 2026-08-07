import { Alert, Card } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";

import { getStudentFinanceService } from "../../../../lib/student-finance";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentPaymentReceiptPage({
  params,
}: Readonly<{
  params: Promise<{ paymentId: string }>;
}>) {
  noStore();
  const { paymentId } = await params;
  const service = await getStudentFinanceService();
  const [payment, receipt] = await Promise.all([
    service.getPayment(paymentId),
    service.getReceipt(paymentId),
  ]);

  return (
    <section className="student-portal-stack">
      <h1>Recibo interno</h1>
      <Alert tone="info">{receipt.legend}</Alert>
      <Card>
        <h2>{receipt.receiptNumber}</h2>
        <p>Monto: ${receipt.amount} MXN</p>
        <p>Método: {receipt.paymentMethod}</p>
        <p>Referencia: {receipt.paymentReferenceMasked ?? "No visible"}</p>
        <p>Emitido: {new Date(receipt.issuedAt).toLocaleString("es-MX")}</p>
        <p>Estado: {receipt.status}</p>
      </Card>
      <Card>
        <h2>Aplicaciones registradas</h2>
        {payment.allocations.length === 0 ? (
          <p>Este pago aún no tiene aplicaciones visibles.</p>
        ) : (
          <ul>
            {payment.allocations.map((allocation, index) => (
              <li key={`${allocation.effectiveAt}-${index}`}>
                {allocation.conceptName}: ${allocation.amount} MXN ({allocation.status})
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
