import type { AccountStatus } from "./account-status.js";
import type { Application } from "./applications.js";
import type { Permission } from "./permissions.js";
import type { Role } from "./roles.js";

declare const authUserIdBrand: unique symbol;
declare const personIdBrand: unique symbol;
declare const profileIdBrand: unique symbol;

export type AuthUserId = string & { readonly [authUserIdBrand]: "AuthUserId" };
export type PersonId = string & { readonly [personIdBrand]: "PersonId" };
export type ProfileId = string & { readonly [profileIdBrand]: "ProfileId" };

export interface InstitutionalIdentity {
  readonly accountStatus: AccountStatus;
  readonly authUserId?: AuthUserId;
  readonly personId: PersonId;
  readonly profileId?: ProfileId;
  readonly roles: readonly Role[];
}

export type RolePermissionMap = Readonly<Record<Role, readonly Permission[]>>;

export const accessReasons = Object.freeze({
  ACCOUNT_NOT_ACTIVE: "ACCOUNT_NOT_ACTIVE",
  APPLICATION_ACCESS_DENIED: "APPLICATION_ACCESS_DENIED",
  AUTHORIZED: "AUTHORIZED",
  INVALID_AUTHORIZATION_CONTEXT: "INVALID_AUTHORIZATION_CONTEXT",
  REQUIRED_PERMISSION_MISSING: "REQUIRED_PERMISSION_MISSING",
  REQUIRED_ROLE_MISSING: "REQUIRED_ROLE_MISSING",
} as const);

export type AccessReason = (typeof accessReasons)[keyof typeof accessReasons];
export type AccessDenialReason = Exclude<AccessReason, typeof accessReasons.AUTHORIZED>;

export interface AuthorizationContext {
  readonly allOfPermissions?: readonly Permission[];
  readonly anyOfRoles?: readonly Role[];
  readonly application: Application;
  readonly identity: InstitutionalIdentity;
}

export type AccessDecision =
  | {
      readonly allowed: true;
      readonly reason: typeof accessReasons.AUTHORIZED;
    }
  | {
      readonly allowed: false;
      readonly missingPermissions: readonly Permission[];
      readonly missingRoles: readonly Role[];
      readonly reason: AccessDenialReason;
    };
