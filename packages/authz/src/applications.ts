import { roles, type Role } from "./roles.js";

export const applications = Object.freeze({
  PORTAL_ESCOLAR: "PORTAL_ESCOLAR",
  SISTEMA_ADMINISTRATIVO: "SISTEMA_ADMINISTRATIVO",
} as const);

export type Application = (typeof applications)[keyof typeof applications];

export const applicationValues = Object.freeze(
  Object.values(applications),
) as readonly Application[];

export function isApplication(value: unknown): value is Application {
  return (
    typeof value === "string" && applicationValues.some((application) => application === value)
  );
}

export const applicationRoleMap = Object.freeze({
  [applications.PORTAL_ESCOLAR]: Object.freeze([
    roles.ASPIRANTE,
    roles.ALUMNO,
    roles.TUTOR,
    roles.DOCENTE,
  ]),
  [applications.SISTEMA_ADMINISTRATIVO]: Object.freeze([
    roles.SUPERADMIN,
    roles.ADMINISTRATIVO,
    roles.CONTROL_ESCOLAR,
    roles.PREFECTURA,
    roles.CAJA,
  ]),
}) satisfies Readonly<Record<Application, readonly Role[]>>;
