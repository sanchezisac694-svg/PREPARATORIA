import { StatusBadge, type ReactNode } from "@preparatoria/ui";

const financialStatusMap = {
  ACTIVE: ["Activa", "success"],
  APPROVED: ["Aprobada", "success"],
  BALANCED: ["Balanceado", "success"],
  BROKEN: ["Incumplido", "danger"],
  CANCELLED: ["Cancelado", "neutral"],
  CLOSED: ["Cerrado", "neutral"],
  COMPLETED: ["Completado", "success"],
  COMPLETED_WITH_ERRORS: ["Completado con observaciones", "warning"],
  CLOSING: ["En cierre", "warning"],
  CURRENT: ["Vigente", "neutral"],
  DEFAULTED: ["Incumplido", "danger"],
  DRAFT: ["Borrador", "neutral"],
  DUE: ["Con vencimiento", "warning"],
  EXPLICITLY_EXCLUDED: ["Excluido", "neutral"],
  FAILED: ["Fallido", "danger"],
  FIXED_AMOUNT: ["Monto fijo", "info"],
  FULFILLED: ["Cumplido", "success"],
  GENERATED: ["Generado", "success"],
  MANUAL_REVIEW_REQUIRED: ["Revisión institucional", "warning"],
  ON_TRACK: ["En seguimiento", "info"],
  OPEN: ["Abierto", "info"],
  OVERAGE: ["Sobrante", "warning"],
  OVERDUE: ["Vencido", "danger"],
  PARTIALLY_PAID: ["Pago parcial", "info"],
  PAST_DUE: ["Parcialidades vencidas", "danger"],
  PENDING: ["Pendiente", "warning"],
  PERCENTAGE: ["Porcentaje", "info"],
  PREVIEWED: ["Vista previa lista", "info"],
  PROCESSING: ["En proceso", "info"],
  PROMISE_PENDING: ["Compromiso pendiente", "warning"],
  RECORDED: ["Registrado", "info"],
  RECONCILIATION_REQUIRED: ["Conciliación requerida", "warning"],
  RESOLVED: ["Resuelto", "success"],
  REVIEW_REQUIRED: ["Revisión requerida", "warning"],
  REVERSED: ["Revertido", "neutral"],
  SKIPPED: ["Omitido", "neutral"],
  SHORTAGE: ["Faltante", "danger"],
  SUSPENDED: ["Suspendido", "warning"],
  UNDER_REVIEW: ["En revisión", "warning"],
} as const satisfies Record<
  string,
  readonly [string, "danger" | "info" | "neutral" | "success" | "warning"]
>;

export function getFinancialLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const mapping = financialStatusMap[value as keyof typeof financialStatusMap];
  return mapping ? mapping[0] : value;
}

export function FinancialStatusBadge({ value }: Readonly<{ value: string | null | undefined }>) {
  if (!value) {
    return <StatusBadge tone="neutral">Sin estado</StatusBadge>;
  }

  const mapping = financialStatusMap[value as keyof typeof financialStatusMap];
  if (!mapping) {
    return <StatusBadge tone="neutral">{value}</StatusBadge>;
  }

  return <StatusBadge tone={mapping[1]}>{mapping[0]}</StatusBadge>;
}

export function FinancialPlainValue({ value }: Readonly<{ value: ReactNode }>) {
  return <span>{value}</span>;
}
