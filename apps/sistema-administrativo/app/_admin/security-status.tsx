import { StatusBadge } from "@preparatoria/ui";

const statusMap = {
  approved: { label: "Aprobada", tone: "success" },
  completed: { label: "Completada", tone: "success" },
  expired: { label: "Expirada", tone: "warning" },
  pending: { label: "Pendiente", tone: "warning" },
  rejected: { label: "Rechazada", tone: "danger" },
  unverified: { label: "Pendiente de verificación", tone: "warning" },
  verified: { label: "Verificado", tone: "success" },
} as const;

type SecurityStatusBadgeProps = Readonly<{
  status: string;
}>;

export function SecurityStatusBadge({ status }: SecurityStatusBadgeProps) {
  const normalized = status.trim().toLowerCase();
  const mapping = statusMap[normalized as keyof typeof statusMap];

  if (!mapping) {
    return <StatusBadge tone="neutral">{status}</StatusBadge>;
  }

  return <StatusBadge tone={mapping.tone}>{mapping.label}</StatusBadge>;
}
