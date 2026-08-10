import { Card } from "@preparatoria/ui";
import type { ReactNode } from "react";

export function ReportMetric({
  label,
  value,
}: Readonly<{
  label: string;
  value: ReactNode;
}>) {
  return (
    <Card>
      <h2>{label}</h2>
      <p>{value}</p>
    </Card>
  );
}

export function EmptyReport({
  title,
}: Readonly<{
  title: string;
}>) {
  return (
    <Card>
      <h2>{title}</h2>
      <p>No hay registros para los filtros técnicos actuales.</p>
    </Card>
  );
}
