import { EmptyState, MetricCard, Money } from "@preparatoria/ui";
import type { ReactNode } from "react";

export function ReportMetric({
  label,
  value,
}: Readonly<{
  label: string;
  value: ReactNode;
}>) {
  return <MetricCard label={label} value={value} />;
}

export function ReportMoneyMetric({
  amount,
  label,
}: Readonly<{
  amount: `${number}` | `${number}.${number}` | `${number}.${number}${number}`;
  label: string;
}>) {
  return <MetricCard label={label} value={<Money amount={amount} />} />;
}

export function EmptyReport({
  title,
}: Readonly<{
  title: string;
}>) {
  return (
    <EmptyState
      description="No hay registros visibles con los filtros técnicos actuales."
      title={`Sin resultados en ${title.toLowerCase()}`}
    />
  );
}
