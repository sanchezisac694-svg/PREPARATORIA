import { StatusBadge, type ReactNode } from "@preparatoria/ui";

const explicitLabels = new Map<string, string>([
  ["ACTIVE", "Activo"],
  ["INACTIVE", "Inactivo"],
  ["RETIRED", "Retirado"],
  ["PUBLISHED", "Publicado"],
  ["DRAFT", "Borrador"],
  ["UNDER_REVIEW", "En revisión"],
  ["APPROVED", "Aprobado"],
  ["CLOSED", "Cerrado"],
  ["CANCELLED", "Cancelado"],
  ["ENROLLED", "Inscrito"],
  ["COMPLETED", "Completado"],
  ["WITHDRAWN", "Baja"],
  ["SUSPENDED", "Suspendido"],
  ["LOCKED", "Bloqueado"],
  ["PLANNED", "Planeado"],
  ["REGULAR_CLASS", "Clase regular"],
  ["TEMPORARY", "Temporal"],
  ["PRIMARY", "Principal"],
  ["SECONDARY", "Secundaria"],
  ["PROMOTED", "Promovido"],
  ["RETAINED", "Permanece en semestre"],
  ["MANUAL_REVIEW_REQUIRED", "Revisión institucional"],
]);

const toneLabels = new Map<string, "danger" | "info" | "neutral" | "success" | "warning">([
  ["ACTIVE", "success"],
  ["ENROLLED", "success"],
  ["PUBLISHED", "success"],
  ["APPROVED", "success"],
  ["COMPLETED", "info"],
  ["CLOSED", "info"],
  ["INACTIVE", "neutral"],
  ["CANCELLED", "warning"],
  ["WITHDRAWN", "warning"],
  ["SUSPENDED", "warning"],
  ["UNDER_REVIEW", "warning"],
  ["DRAFT", "neutral"],
  ["LOCKED", "neutral"],
  ["RETIRED", "neutral"],
]);

const weekdayLabels = new Map<number, string>([
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [7, "Domingo"],
]);

function normalizeValue(value: string) {
  return value.trim().toUpperCase();
}

export function formatAcademicValue(value: string | null | undefined) {
  if (!value) {
    return "Sin dato";
  }

  const normalized = normalizeValue(value);
  const explicit = explicitLabels.get(normalized);
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

export function getAcademicStatusTone(value: string | null | undefined) {
  if (!value) {
    return "neutral" as const;
  }

  return toneLabels.get(normalizeValue(value)) ?? "neutral";
}

export function AcademicStatusBadge({
  value,
}: Readonly<{
  value: string | null | undefined;
}>) {
  return (
    <StatusBadge tone={getAcademicStatusTone(value)}>{formatAcademicValue(value)}</StatusBadge>
  );
}

export function formatWeekday(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "Día no disponible";
  }

  return weekdayLabels.get(value) ?? `Día ${value}`;
}

export function formatBooleanLabel(value: boolean) {
  return value ? "Sí" : "No";
}

export function renderNameOrFallback(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value.trim() : "Nombre no disponible";
}

export function renderStudentHeading(
  identifier: string,
  displayName: string | null | undefined,
): {
  readonly subtitle: string | null;
  readonly title: string;
} {
  if (displayName && displayName.trim().length > 0) {
    return { subtitle: identifier, title: displayName.trim() };
  }

  return {
    subtitle: "Nombre institucional no disponible",
    title: identifier,
  };
}

export function renderOptionalText(
  value: string | null | undefined,
  fallback = "No disponible",
): ReactNode {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}
