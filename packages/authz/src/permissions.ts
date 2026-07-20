import { isRole, roles, type Role } from "./roles.js";
import type { RolePermissionMap } from "./types.js";

export const permissions = Object.freeze({
  ACADEMICS_MANAGE: "academics.manage",
  ACADEMICS_READ: "academics.read",
  ADMISSIONS_MANAGE: "admissions.manage",
  ADMISSIONS_READ: "admissions.read",
  ATTENDANCE_MANAGE: "attendance.manage",
  ATTENDANCE_READ: "attendance.read",
  AUDIT_READ: "audit.read",
  DOCUMENTS_MANAGE: "documents.manage",
  DOCUMENTS_READ: "documents.read",
  GRADES_MANAGE: "grades.manage",
  GRADES_READ: "grades.read",
  IDENTITY_MANAGE: "identity.manage",
  IDENTITY_READ: "identity.read",
  PAYMENTS_MANAGE: "payments.manage",
  PAYMENTS_READ: "payments.read",
  REPORTS_EXPORT: "reports.export",
  REPORTS_READ: "reports.read",
  ROLES_ASSIGN: "roles.assign",
  ROLES_READ: "roles.read",
  SETTINGS_MANAGE: "settings.manage",
  SETTINGS_READ: "settings.read",
} as const);

export type Permission = (typeof permissions)[keyof typeof permissions];

export const permissionValues = Object.freeze(Object.values(permissions)) as readonly Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && permissionValues.some((permission) => permission === value);
}

function permissionSet(...values: Permission[]): readonly Permission[] {
  return Object.freeze(values);
}

export const rolePermissionMap = Object.freeze({
  [roles.SUPERADMIN]: permissionSet(
    permissions.IDENTITY_READ,
    permissions.IDENTITY_MANAGE,
    permissions.ROLES_READ,
    permissions.ROLES_ASSIGN,
    permissions.ADMISSIONS_READ,
    permissions.ADMISSIONS_MANAGE,
    permissions.ACADEMICS_READ,
    permissions.ACADEMICS_MANAGE,
    permissions.ATTENDANCE_READ,
    permissions.ATTENDANCE_MANAGE,
    permissions.GRADES_READ,
    permissions.GRADES_MANAGE,
    permissions.PAYMENTS_READ,
    permissions.PAYMENTS_MANAGE,
    permissions.DOCUMENTS_READ,
    permissions.DOCUMENTS_MANAGE,
    permissions.REPORTS_READ,
    permissions.REPORTS_EXPORT,
    permissions.SETTINGS_READ,
    permissions.SETTINGS_MANAGE,
    permissions.AUDIT_READ,
  ),
  [roles.ADMINISTRATIVO]: permissionSet(
    permissions.IDENTITY_READ,
    permissions.ROLES_READ,
    permissions.ADMISSIONS_READ,
    permissions.ADMISSIONS_MANAGE,
    permissions.ACADEMICS_READ,
    permissions.PAYMENTS_READ,
    permissions.DOCUMENTS_READ,
    permissions.DOCUMENTS_MANAGE,
    permissions.REPORTS_READ,
    permissions.REPORTS_EXPORT,
    permissions.SETTINGS_READ,
  ),
  [roles.CONTROL_ESCOLAR]: permissionSet(
    permissions.IDENTITY_READ,
    permissions.ADMISSIONS_READ,
    permissions.ADMISSIONS_MANAGE,
    permissions.ACADEMICS_READ,
    permissions.ACADEMICS_MANAGE,
    permissions.ATTENDANCE_READ,
    permissions.ATTENDANCE_MANAGE,
    permissions.GRADES_READ,
    permissions.GRADES_MANAGE,
    permissions.DOCUMENTS_READ,
    permissions.DOCUMENTS_MANAGE,
    permissions.REPORTS_READ,
    permissions.REPORTS_EXPORT,
  ),
  [roles.CAJA]: permissionSet(
    permissions.IDENTITY_READ,
    permissions.ADMISSIONS_READ,
    permissions.PAYMENTS_READ,
    permissions.PAYMENTS_MANAGE,
    permissions.REPORTS_READ,
  ),
  [roles.DOCENTE]: permissionSet(
    permissions.ACADEMICS_READ,
    permissions.ATTENDANCE_READ,
    permissions.ATTENDANCE_MANAGE,
    permissions.GRADES_READ,
    permissions.GRADES_MANAGE,
    permissions.DOCUMENTS_READ,
  ),
  [roles.TUTOR]: permissionSet(
    permissions.ACADEMICS_READ,
    permissions.ATTENDANCE_READ,
    permissions.GRADES_READ,
    permissions.PAYMENTS_READ,
    permissions.DOCUMENTS_READ,
  ),
  [roles.ALUMNO]: permissionSet(
    permissions.ACADEMICS_READ,
    permissions.ATTENDANCE_READ,
    permissions.GRADES_READ,
    permissions.PAYMENTS_READ,
    permissions.DOCUMENTS_READ,
  ),
  [roles.ASPIRANTE]: permissionSet(
    permissions.ADMISSIONS_READ,
    permissions.PAYMENTS_READ,
    permissions.DOCUMENTS_READ,
  ),
}) satisfies RolePermissionMap;

const noPermissions = Object.freeze([]) as readonly Permission[];

export function permissionsForRole(role: Role): readonly Permission[];
export function permissionsForRole(role: unknown): readonly Permission[];
export function permissionsForRole(role: unknown): readonly Permission[] {
  if (!isRole(role)) {
    return noPermissions;
  }
  return rolePermissionMap[role];
}
