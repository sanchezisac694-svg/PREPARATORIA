import { accountStatuses, isAccountStatus } from "./account-status.js";
import { applicationRoleMap, isApplication, type Application } from "./applications.js";
import { isPermission, rolePermissionMap, type Permission } from "./permissions.js";
import { isRole, type Role } from "./roles.js";
import { accessReasons, type AccessDecision, type AuthorizationContext } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRoleSet(value: unknown): value is readonly Role[] {
  return Array.isArray(value) && value.every(isRole);
}

function isPermissionSet(value: unknown): value is readonly Permission[] {
  return Array.isArray(value) && value.every(isPermission);
}

export function hasRole(roleSet: readonly Role[], role: Role): boolean;
export function hasRole(roleSet: unknown, role: unknown): boolean;
export function hasRole(roleSet: unknown, role: unknown): boolean {
  return isRoleSet(roleSet) && isRole(role) && roleSet.includes(role);
}

export function hasAnyRole(roleSet: readonly Role[], expectedRoles: readonly Role[]): boolean;
export function hasAnyRole(roleSet: unknown, expectedRoles: unknown): boolean;
export function hasAnyRole(roleSet: unknown, expectedRoles: unknown): boolean {
  return (
    isRoleSet(roleSet) &&
    isRoleSet(expectedRoles) &&
    expectedRoles.some((role) => roleSet.includes(role))
  );
}

export function hasPermission(roleSet: readonly Role[], permission: Permission): boolean;
export function hasPermission(roleSet: unknown, permission: unknown): boolean;
export function hasPermission(roleSet: unknown, permission: unknown): boolean {
  return (
    isRoleSet(roleSet) &&
    isPermission(permission) &&
    roleSet.some((role) => rolePermissionMap[role].includes(permission))
  );
}

export function hasAnyPermission(
  roleSet: readonly Role[],
  expectedPermissions: readonly Permission[],
): boolean;
export function hasAnyPermission(roleSet: unknown, expectedPermissions: unknown): boolean;
export function hasAnyPermission(roleSet: unknown, expectedPermissions: unknown): boolean {
  return (
    isRoleSet(roleSet) &&
    isPermissionSet(expectedPermissions) &&
    expectedPermissions.some((permission) =>
      roleSet.some((role) => rolePermissionMap[role].includes(permission)),
    )
  );
}

export function canAccessApplication(roleSet: readonly Role[], application: Application): boolean;
export function canAccessApplication(roleSet: unknown, application: unknown): boolean;
export function canAccessApplication(roleSet: unknown, application: unknown): boolean {
  if (!isRoleSet(roleSet) || !isApplication(application)) {
    return false;
  }

  const allowedRoles: readonly Role[] = applicationRoleMap[application];

  return roleSet.some((role) => allowedRoles.includes(role));
}

function denied(
  reason: Exclude<AccessDecision["reason"], typeof accessReasons.AUTHORIZED>,
  missingRoles: readonly Role[] = [],
  missingPermissions: readonly Permission[] = [],
): AccessDecision {
  return {
    allowed: false,
    missingPermissions: Object.freeze([...missingPermissions]),
    missingRoles: Object.freeze([...missingRoles]),
    reason,
  };
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && value.length > 0);
}

export function evaluateAccess(context: AuthorizationContext): AccessDecision;
export function evaluateAccess(context: unknown): AccessDecision;
export function evaluateAccess(context: unknown): AccessDecision {
  if (!isRecord(context) || !isRecord(context.identity)) {
    return denied(accessReasons.INVALID_AUTHORIZATION_CONTEXT);
  }

  const identity = context.identity;
  const expectedRoles = context.anyOfRoles ?? [];
  const expectedPermissions = context.allOfPermissions ?? [];

  if (
    !isApplication(context.application) ||
    !isAccountStatus(identity.accountStatus) ||
    typeof identity.personId !== "string" ||
    identity.personId.length === 0 ||
    !isOptionalString(identity.authUserId) ||
    !isOptionalString(identity.profileId) ||
    !isRoleSet(identity.roles) ||
    !isRoleSet(expectedRoles) ||
    !isPermissionSet(expectedPermissions)
  ) {
    return denied(accessReasons.INVALID_AUTHORIZATION_CONTEXT);
  }

  if (identity.accountStatus !== accountStatuses.ACTIVE) {
    return denied(accessReasons.ACCOUNT_NOT_ACTIVE);
  }

  if (!canAccessApplication(identity.roles, context.application)) {
    return denied(accessReasons.APPLICATION_ACCESS_DENIED);
  }

  if (expectedRoles.length > 0 && !hasAnyRole(identity.roles, expectedRoles)) {
    return denied(accessReasons.REQUIRED_ROLE_MISSING, expectedRoles);
  }

  const missingPermissions = expectedPermissions.filter(
    (permission) => !hasPermission(identity.roles, permission),
  );
  if (missingPermissions.length > 0) {
    return denied(accessReasons.REQUIRED_PERMISSION_MISSING, [], missingPermissions);
  }

  return {
    allowed: true,
    reason: accessReasons.AUTHORIZED,
  };
}
