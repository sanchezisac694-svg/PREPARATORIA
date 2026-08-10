export type AdminStatusTone = "danger" | "info" | "neutral" | "success" | "warning";

const labels = new Map<string, string>([
  ["ACTIVE", "Activo"],
  ["APPROVED", "Aprobado"],
  ["CANCELLED", "Cancelado"],
  ["CLOSED", "Cerrado"],
  ["CLOSING", "En cierre"],
  ["COMPLETED", "Completado"],
  ["DRAFT", "Borrador"],
  ["FAILED", "Fallido"],
  ["OPEN", "Abierto"],
  ["PENDING", "Pendiente"],
  ["RECONCILIATION_REQUIRED", "Requiere conciliación"],
  ["REJECTED", "Rechazado"],
  ["REVERSED", "Revertido"],
  ["SUPERSEDED", "Sustituido"],
  ["UNDER_REVIEW", "En revisión"],
]);

const tones = new Map<string, AdminStatusTone>([
  ["ACTIVE", "success"],
  ["APPROVED", "success"],
  ["CANCELLED", "neutral"],
  ["CLOSED", "neutral"],
  ["CLOSING", "warning"],
  ["COMPLETED", "success"],
  ["DRAFT", "neutral"],
  ["FAILED", "danger"],
  ["OPEN", "info"],
  ["PENDING", "warning"],
  ["RECONCILIATION_REQUIRED", "warning"],
  ["REJECTED", "danger"],
  ["REVERSED", "danger"],
  ["SUPERSEDED", "neutral"],
  ["UNDER_REVIEW", "warning"],
]);

export function getAdminStatusLabel(status: string) {
  return labels.get(status) ?? status;
}

export function getAdminStatusTone(status: string): AdminStatusTone {
  return tones.get(status) ?? "neutral";
}
