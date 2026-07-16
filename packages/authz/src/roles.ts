export const roles = Object.freeze({
  ADMINISTRATIVO: "ADMINISTRATIVO",
  ALUMNO: "ALUMNO",
  ASPIRANTE: "ASPIRANTE",
  CAJA: "CAJA",
  CONTROL_ESCOLAR: "CONTROL_ESCOLAR",
  DOCENTE: "DOCENTE",
  SUPERADMIN: "SUPERADMIN",
  TUTOR: "TUTOR",
} as const);

export type Role = (typeof roles)[keyof typeof roles];

export const roleValues = Object.freeze(Object.values(roles)) as readonly Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roleValues.some((role) => role === value);
}

export const roleLabels = Object.freeze({
  [roles.ADMINISTRATIVO]: "Administrativo",
  [roles.ALUMNO]: "Alumno",
  [roles.ASPIRANTE]: "Aspirante",
  [roles.CAJA]: "Caja",
  [roles.CONTROL_ESCOLAR]: "Control escolar",
  [roles.DOCENTE]: "Docente",
  [roles.SUPERADMIN]: "Superadministrador",
  [roles.TUTOR]: "Tutor",
}) satisfies Readonly<Record<Role, string>>;
