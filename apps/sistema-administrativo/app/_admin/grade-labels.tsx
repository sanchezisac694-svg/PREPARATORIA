import { StatusBadge } from "@preparatoria/ui";

const labels = new Map<string, string>([
  ["AC", "AC · Acreditado"],
  ["NA", "NA · No acreditado"],
  ["PENDING", "Pendiente"],
  ["MANUAL_REVIEW_REQUIRED", "Revisión institucional requerida"],
  ["DRAFT", "Borrador"],
  ["CAPTURED", "Capturada"],
  ["REVIEWED", "Revisada"],
  ["FINALIZED", "Finalizada"],
  ["CORRECTED", "Corregida"],
  ["CANCELLED", "Cancelada"],
  ["OPEN", "Abierta"],
  ["CLOSED", "Cerrada"],
  ["UNIT_CAPTURE", "Captura por unidad"],
  ["FINAL_REVIEW", "Revisión final"],
  ["CORRECTION", "Corrección"],
  ["SUBMITTED", "Enviada"],
  ["UNDER_REVIEW", "En revisión"],
  ["APPROVED", "Aprobada"],
  ["REJECTED", "Rechazada"],
  ["APPLIED", "Aplicada"],
  ["CONFIRMED", "Confirmado"],
  ["CALCULATED", "Calculado"],
  ["COMPLETE", "Completo"],
  ["INCOMPLETE", "Incompleto"],
  ["ACTIVE", "Activo"],
  ["PRIMARY", "Principal"],
  ["SECONDARY", "Secundaria"],
]);

const tones = new Map<string, "danger" | "info" | "neutral" | "success" | "warning">([
  ["AC", "success"],
  ["OPEN", "success"],
  ["FINALIZED", "success"],
  ["CONFIRMED", "success"],
  ["APPROVED", "success"],
  ["APPLIED", "success"],
  ["CAPTURED", "info"],
  ["REVIEWED", "info"],
  ["CALCULATED", "info"],
  ["COMPLETE", "info"],
  ["PENDING", "neutral"],
  ["DRAFT", "neutral"],
  ["INCOMPLETE", "neutral"],
  ["ACTIVE", "neutral"],
  ["CLOSED", "warning"],
  ["UNDER_REVIEW", "warning"],
  ["MANUAL_REVIEW_REQUIRED", "warning"],
  ["REJECTED", "warning"],
  ["CANCELLED", "warning"],
  ["NA", "danger"],
]);

function normalize(value: string) {
  return value.trim().toUpperCase();
}

export function formatGradeValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "No definida";
  }

  return value.toLocaleString("es-MX", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function formatGradeLabel(value: string | null | undefined) {
  if (!value) {
    return "No disponible";
  }

  const normalized = normalize(value);
  const explicit = labels.get(normalized);
  if (explicit) {
    return explicit;
  }

  return normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

export function getGradeTone(value: string | null | undefined) {
  if (!value) {
    return "neutral" as const;
  }

  return tones.get(normalize(value)) ?? "neutral";
}

export function GradeStatusBadge({
  value,
}: Readonly<{
  value: string | null | undefined;
}>) {
  return <StatusBadge tone={getGradeTone(value)}>{formatGradeLabel(value)}</StatusBadge>;
}

export function renderGradeBoolean(value: boolean | null | undefined) {
  if (value === true) {
    return "Sí";
  }

  if (value === false) {
    return "No";
  }

  return "No disponible";
}

export function renderDisplayName(
  value: string | null | undefined,
  fallback = "Nombre no disponible",
) {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function renderTeacher(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "Docente no disponible";
}

export function renderOperationalIdentifier(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "No disponible";
}

export function renderWindowAvailability(isActiveNow: boolean) {
  return isActiveNow ? "Captura disponible" : "Captura no disponible";
}
