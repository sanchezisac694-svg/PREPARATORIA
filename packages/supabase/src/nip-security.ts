import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import {
  accountStatuses,
  type Application,
  type AuthIdentityContext,
  type Role,
} from "@preparatoria/authz";

import { evaluateApplicationAccess, type AuthenticationResult } from "./auth-session.js";
import {
  createAuthenticationAttemptKey,
  validateInstitutionalNip,
  type AuthenticationAttemptGuard,
  type InstitutionalIdentifierType,
} from "./institutional-access.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/nip-security solo puede importarse en servidor.");
}

export const nipRecoveryStatuses = Object.freeze([
  "REQUESTED",
  "APPROVED",
  "READY_FOR_RESET",
  "CONSUMED",
  "EXPIRED",
  "CANCELLED",
  "RETRYABLE_FAILURE",
  "TERMINAL_FAILURE",
  "RECONCILIATION_REQUIRED",
] as const);
export type NipRecoveryStatus = (typeof nipRecoveryStatuses)[number];

export const nipSecurityEventTypes = Object.freeze([
  "AUTHENTICATED_NIP_CHANGE_REQUESTED",
  "AUTHENTICATED_NIP_CHANGED",
  "NIP_CHANGE_FAILED",
  "RECOVERY_REQUESTED",
  "RECOVERY_APPROVED",
  "RESET_AUTHORIZATION_ISSUED",
  "RESET_AUTHORIZATION_REVOKED",
  "RESET_AUTHORIZATION_EXPIRED",
  "RESET_ATTEMPTED",
  "RESET_COMPLETED",
  "RESET_FAILED",
  "SESSION_REVOCATION_REQUESTED",
  "SESSION_REVOCATION_COMPLETED",
  "SESSION_REVOCATION_FAILED",
  "RECONCILIATION_REQUIRED",
  "RECOVERY_CANCELLED",
] as const);
export type NipSecurityEventType = (typeof nipSecurityEventTypes)[number];

export const nipSecurityReasonCodes = Object.freeze([
  "USER_INITIATED_CHANGE",
  "VERIFIED_INSTITUTIONAL_RECOVERY",
  "ADMINISTRATIVE_RESET",
  "SUSPECTED_COMPROMISE",
  "USER_REQUEST",
  "CORRECTIVE_ACTION",
  "LOST_CREDENTIAL",
  "SECURITY_POLICY",
  "RECOVERY_CANCELLED",
  "AUTH_RESULT_UNKNOWN",
] as const);
export type NipSecurityReasonCode = (typeof nipSecurityReasonCodes)[number];

export const nipSecurityErrorCodes = Object.freeze([
  "INVALID_CURRENT_NIP",
  "INVALID_NEW_NIP",
  "NIP_CONFIRMATION_MISMATCH",
  "NIP_REUSE_NOT_ALLOWED",
  "ACCOUNT_NOT_ACTIVE",
  "RECOVERY_NOT_FOUND",
  "RECOVERY_NOT_APPROVED",
  "RESET_AUTHORIZATION_NOT_FOUND",
  "RESET_AUTHORIZATION_EXPIRED",
  "RESET_AUTHORIZATION_CONSUMED",
  "RESET_AUTHORIZATION_REVOKED",
  "TOO_MANY_ATTEMPTS",
  "INVALID_STATE_TRANSITION",
  "ACTOR_NOT_AUTHORIZED",
  "IDEMPOTENCY_CONFLICT",
  "AUTH_PROVIDER_RETRYABLE_FAILURE",
  "AUTH_PROVIDER_TERMINAL_FAILURE",
  "AUTH_RESULT_UNKNOWN",
  "SESSION_REVOCATION_FAILED",
  "RECONCILIATION_REQUIRED",
  "NIP_SECURITY_OPERATION_FAILED",
] as const);
export type NipSecurityErrorCode = (typeof nipSecurityErrorCodes)[number];

export const nipAbuseCategories = Object.freeze([
  "CHANGE_NIP",
  "REQUEST_RECOVERY",
  "RESET_NIP",
  "VALIDATE_RESET_TOKEN",
] as const);
export type NipAbuseCategory = (typeof nipAbuseCategories)[number];

export const nipRecoveryAdministrativeRoles = Object.freeze({
  FULL: Object.freeze(["SUPERADMIN", "ADMINISTRATIVO"] as const satisfies readonly Role[]),
  REQUEST_SCHOOL_IDENTITIES: Object.freeze(["CONTROL_ESCOLAR"] as const satisfies readonly Role[]),
});

export const nipRecoveryTransitions = Object.freeze({
  APPROVED: [
    "READY_FOR_RESET",
    "CANCELLED",
    "EXPIRED",
    "RETRYABLE_FAILURE",
    "RECONCILIATION_REQUIRED",
  ],
  CANCELLED: [],
  CONSUMED: [],
  EXPIRED: [],
  READY_FOR_RESET: [
    "CONSUMED",
    "EXPIRED",
    "CANCELLED",
    "RETRYABLE_FAILURE",
    "RECONCILIATION_REQUIRED",
  ],
  RECONCILIATION_REQUIRED: ["READY_FOR_RESET", "CONSUMED", "CANCELLED", "TERMINAL_FAILURE"],
  REQUESTED: ["APPROVED", "CANCELLED", "TERMINAL_FAILURE"],
  RETRYABLE_FAILURE: [
    "READY_FOR_RESET",
    "CANCELLED",
    "TERMINAL_FAILURE",
    "RECONCILIATION_REQUIRED",
  ],
  TERMINAL_FAILURE: [],
} as const) satisfies Readonly<Record<NipRecoveryStatus, readonly NipRecoveryStatus[]>>;

export const changeNipPublicMessage = "No fue posible actualizar el NIP.";
export const recoveryRequestPublicMessage = "La solicitud fue recibida para revisión.";
export const resetNipPublicMessage = "No fue posible restablecer el acceso.";

export class NipSecurityError extends Error {
  readonly code: NipSecurityErrorCode;

  constructor(code: NipSecurityErrorCode, message = resetNipPublicMessage) {
    super(message);
    this.name = "NipSecurityError";
    this.code = code;
  }
}

export interface AuthCredentialSecurityPort {
  updateAuthenticatedPassword(input: {
    readonly currentPassword: string;
    readonly newPassword: string;
  }): Promise<{ readonly ok: boolean }>;
  updatePasswordForAccount(input: {
    readonly accountId: string;
    readonly newPassword: string;
  }): Promise<
    | { readonly outcome: "SUCCESS" }
    | { readonly outcome: "RETRYABLE_FAILURE" | "TERMINAL_FAILURE" | "UNKNOWN" }
  >;
  revokeAllSessions(input: {
    readonly accountId: string;
  }): Promise<{ readonly confirmed: boolean }>;
  revokeOtherSessions(): Promise<{ readonly ok: boolean }>;
}

export interface NipSecurityAuditPort {
  record(input: {
    readonly accountId: string;
    readonly actorAccountId: string | null;
    readonly correlationId: string;
    readonly errorCode?: NipSecurityErrorCode;
    readonly eventType: NipSecurityEventType;
    readonly idempotencyKey: string;
    readonly personId: string;
    readonly reasonCode: NipSecurityReasonCode;
    readonly recoveryRequestId?: string;
  }): Promise<void>;
}

export interface NipRecoveryRecord {
  readonly accountId: string;
  readonly id: string;
  readonly personId: string;
  readonly status: NipRecoveryStatus;
}

export interface NipResetAuthorizationRecord {
  readonly expiresAt: string;
  readonly id: string;
  readonly recoveryRequestId: string;
}

export interface NipRecoveryPersistencePort {
  approve(input: {
    readonly actorAccountId: string;
    readonly expiresAt: string;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
  }): Promise<NipRecoveryRecord>;
  cancel(input: {
    readonly actorAccountId: string;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
  }): Promise<NipRecoveryRecord>;
  completeReset(input: {
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
    readonly tokenDigest: string;
  }): Promise<NipRecoveryRecord>;
  invalidateSessionsAfterReset(input: {
    readonly accountId: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly ok: boolean }>;
  issueAuthorization(input: {
    readonly actorAccountId: string;
    readonly expiresAt: string;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
    readonly tokenDigest: string;
  }): Promise<NipResetAuthorizationRecord>;
  markReconciliationRequired(input: {
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
  }): Promise<NipRecoveryRecord>;
  markResetAttempt(tokenDigest: string): Promise<NipResetAuthorizationRecord>;
  markResetFailure(input: {
    readonly errorCode: NipSecurityErrorCode;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
    readonly retryable: boolean;
  }): Promise<NipRecoveryRecord>;
  request(input: {
    readonly accountId: string;
    readonly actorAccountId: string;
    readonly correlationId: string;
    readonly idempotencyKey: string;
    readonly personId: string;
    readonly reasonCode: NipSecurityReasonCode;
  }): Promise<NipRecoveryRecord>;
  resolveAuthorization(tokenDigest: string): Promise<{
    readonly accountId: string;
    readonly authorization: NipResetAuthorizationRecord;
    readonly personId: string;
    readonly recovery: NipRecoveryRecord;
  } | null>;
  revokeAuthorization(input: {
    readonly actorAccountId: string;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
  }): Promise<NipResetAuthorizationRecord>;
}

export interface ResetAuthorizationDeliveryPort {
  deliver(input: {
    readonly authorizationId: string;
    readonly expiresAt: string;
    readonly token: string;
  }): Promise<{ readonly accepted: boolean }>;
}

export function isValidNipRecoveryTransition(
  previous: NipRecoveryStatus,
  next: NipRecoveryStatus,
): boolean {
  return (nipRecoveryTransitions[previous] as readonly NipRecoveryStatus[]).includes(next);
}

export function generateNipResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function digestNipResetToken(token: string, secret: string): string {
  if (token.length < 32 || secret.length < 32) {
    throw new NipSecurityError("NIP_SECURITY_OPERATION_FAILED");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function safeTokenDigestEquals(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function createNipAbuseKey(input: {
  readonly category: NipAbuseCategory;
  readonly opaqueSubject: string;
  readonly salt: string;
}): string {
  return createHmac("sha256", input.salt)
    .update(`${input.category}\0${input.opaqueSubject}`)
    .digest("hex");
}

function requireActiveContext(
  authentication: AuthenticationResult,
  application: Application,
): AuthIdentityContext & { readonly accountId: string; readonly personId: string } {
  if (!authentication.ok) throw new NipSecurityError("ACCOUNT_NOT_ACTIVE", changeNipPublicMessage);
  const decision = evaluateApplicationAccess(authentication.identity.context, application);
  if (
    !decision.allowed ||
    authentication.identity.context.accountStatus !== accountStatuses.ACTIVE ||
    authentication.identity.context.accountId === null ||
    authentication.identity.context.personId === null
  ) {
    throw new NipSecurityError("ACCOUNT_NOT_ACTIVE", changeNipPublicMessage);
  }
  return authentication.identity.context as AuthIdentityContext & {
    readonly accountId: string;
    readonly personId: string;
  };
}

export async function changeAuthenticatedNip(
  command: {
    readonly application: Application;
    readonly confirmation: string;
    readonly correlationId: string;
    readonly currentNip: string;
    readonly idempotencyKey: string;
    readonly newNip: string;
  },
  dependencies: {
    readonly audit: NipSecurityAuditPort;
    readonly auth: Pick<AuthCredentialSecurityPort, "updateAuthenticatedPassword"> & {
      invalidateOwnSessions(input: {
        readonly correlationId: string;
        readonly eventType: "PASSWORD_CHANGE_INVALIDATION";
        readonly idempotencyKey: string;
        readonly reason: "NIP_CHANGED";
      }): Promise<{ readonly invalidated: boolean; readonly ok: boolean }>;
      revokeAllSessions(): Promise<{ readonly ok: boolean }>;
    };
    readonly getIdentity: () => Promise<AuthenticationResult>;
  },
): Promise<{ readonly changed: true; readonly otherSessionsRevoked: boolean }> {
  let currentNip: string;
  let newNip: string;
  try {
    currentNip = validateInstitutionalNip(command.currentNip);
    newNip = validateInstitutionalNip(command.newNip);
  } catch {
    throw new NipSecurityError("INVALID_NEW_NIP", changeNipPublicMessage);
  }
  if (newNip !== command.confirmation) {
    throw new NipSecurityError("NIP_CONFIRMATION_MISMATCH", changeNipPublicMessage);
  }
  if (currentNip === newNip) {
    throw new NipSecurityError("NIP_REUSE_NOT_ALLOWED", changeNipPublicMessage);
  }
  const context = requireActiveContext(await dependencies.getIdentity(), command.application);
  await dependencies.audit.record({
    accountId: context.accountId,
    actorAccountId: context.accountId,
    correlationId: command.correlationId,
    eventType: "AUTHENTICATED_NIP_CHANGE_REQUESTED",
    idempotencyKey: `${command.idempotencyKey}:requested`,
    personId: context.personId,
    reasonCode: "USER_INITIATED_CHANGE",
  });
  const changed = await dependencies.auth.updateAuthenticatedPassword({
    currentPassword: currentNip,
    newPassword: newNip,
  });
  if (!changed.ok) {
    await dependencies.audit.record({
      accountId: context.accountId,
      actorAccountId: context.accountId,
      correlationId: command.correlationId,
      errorCode: "INVALID_CURRENT_NIP",
      eventType: "NIP_CHANGE_FAILED",
      idempotencyKey: `${command.idempotencyKey}:failed`,
      personId: context.personId,
      reasonCode: "USER_INITIATED_CHANGE",
    });
    throw new NipSecurityError("INVALID_CURRENT_NIP", changeNipPublicMessage);
  }
  await dependencies.audit.record({
    accountId: context.accountId,
    actorAccountId: context.accountId,
    correlationId: command.correlationId,
    eventType: "AUTHENTICATED_NIP_CHANGED",
    idempotencyKey: `${command.idempotencyKey}:changed`,
    personId: context.personId,
    reasonCode: "USER_INITIATED_CHANGE",
  });
  const invalidation = await dependencies.auth.invalidateOwnSessions({
    correlationId: command.correlationId,
    eventType: "PASSWORD_CHANGE_INVALIDATION",
    idempotencyKey: `${command.idempotencyKey}:session-version`,
    reason: "NIP_CHANGED",
  });
  if (!invalidation.ok) {
    throw new NipSecurityError("RECONCILIATION_REQUIRED", changeNipPublicMessage);
  }
  const revocation = await dependencies.auth.revokeAllSessions();
  return { changed: true, otherSessionsRevoked: revocation.ok };
}

export async function requestInstitutionalNipRecovery(
  command: Parameters<NipRecoveryPersistencePort["request"]>[0],
  persistence: NipRecoveryPersistencePort,
): Promise<NipRecoveryRecord> {
  return persistence.request(command);
}

export async function approveInstitutionalNipRecovery(
  command: Parameters<NipRecoveryPersistencePort["approve"]>[0],
  persistence: NipRecoveryPersistencePort,
): Promise<NipRecoveryRecord> {
  return persistence.approve(command);
}

export async function issueNipResetAuthorization(
  command: {
    readonly actorAccountId: string;
    readonly expiresAt: string;
    readonly idempotencyKey: string;
    readonly recoveryRequestId: string;
    readonly tokenSecret: string;
  },
  dependencies: {
    readonly delivery: ResetAuthorizationDeliveryPort;
    readonly persistence: NipRecoveryPersistencePort;
  },
): Promise<{ readonly authorizationId: string; readonly delivered: boolean }> {
  const token = generateNipResetToken();
  const tokenDigest = digestNipResetToken(token, command.tokenSecret);
  const authorization = await dependencies.persistence.issueAuthorization({
    actorAccountId: command.actorAccountId,
    expiresAt: command.expiresAt,
    idempotencyKey: command.idempotencyKey,
    recoveryRequestId: command.recoveryRequestId,
    tokenDigest,
  });
  const delivery = await dependencies.delivery.deliver({
    authorizationId: authorization.id,
    expiresAt: authorization.expiresAt,
    token,
  });
  return { authorizationId: authorization.id, delivered: delivery.accepted };
}

export async function resetNipWithAuthorization(
  command: {
    readonly confirmation: string;
    readonly idempotencyKey: string;
    readonly newNip: string;
    readonly token: string;
    readonly tokenSecret: string;
  },
  dependencies: {
    readonly auth: Pick<
      AuthCredentialSecurityPort,
      "revokeAllSessions" | "updatePasswordForAccount"
    >;
    readonly attempts: AuthenticationAttemptGuard;
    readonly persistence: NipRecoveryPersistencePort;
  },
): Promise<{ readonly reset: true; readonly sessionsRevoked: boolean }> {
  let newNip: string;
  try {
    newNip = validateInstitutionalNip(command.newNip);
  } catch {
    throw new NipSecurityError("INVALID_NEW_NIP");
  }
  if (newNip !== command.confirmation) {
    throw new NipSecurityError("NIP_CONFIRMATION_MISMATCH");
  }
  const digest = digestNipResetToken(command.token, command.tokenSecret);
  const attemptKey = createAuthenticationAttemptKey({
    identifierType: "ADMINISTRATIVE_ID" as InstitutionalIdentifierType,
    ipAddress: null,
    normalizedIdentifier: `RST-${digest.slice(0, 12).toUpperCase()}`,
    salt: command.tokenSecret,
  });
  if (!dependencies.attempts.checkAllowed(attemptKey)) {
    throw new NipSecurityError("TOO_MANY_ATTEMPTS");
  }
  const resolved = await dependencies.persistence.resolveAuthorization(digest);
  if (resolved === null) {
    dependencies.attempts.recordFailure(attemptKey);
    throw new NipSecurityError("RESET_AUTHORIZATION_NOT_FOUND");
  }
  await dependencies.persistence.markResetAttempt(digest);
  const authResult = await dependencies.auth.updatePasswordForAccount({
    accountId: resolved.accountId,
    newPassword: newNip,
  });
  if (authResult.outcome === "UNKNOWN") {
    await dependencies.persistence.markReconciliationRequired({
      idempotencyKey: `${command.idempotencyKey}:reconcile`,
      recoveryRequestId: resolved.recovery.id,
    });
    throw new NipSecurityError("RECONCILIATION_REQUIRED");
  }
  if (authResult.outcome !== "SUCCESS") {
    await dependencies.persistence.markResetFailure({
      errorCode:
        authResult.outcome === "RETRYABLE_FAILURE"
          ? "AUTH_PROVIDER_RETRYABLE_FAILURE"
          : "AUTH_PROVIDER_TERMINAL_FAILURE",
      idempotencyKey: `${command.idempotencyKey}:failed`,
      recoveryRequestId: resolved.recovery.id,
      retryable: authResult.outcome === "RETRYABLE_FAILURE",
    });
    throw new NipSecurityError(
      authResult.outcome === "RETRYABLE_FAILURE"
        ? "AUTH_PROVIDER_RETRYABLE_FAILURE"
        : "AUTH_PROVIDER_TERMINAL_FAILURE",
    );
  }
  await dependencies.persistence.completeReset({
    idempotencyKey: `${command.idempotencyKey}:complete`,
    recoveryRequestId: resolved.recovery.id,
    tokenDigest: digest,
  });
  const invalidated = await dependencies.persistence.invalidateSessionsAfterReset({
    accountId: resolved.accountId,
    idempotencyKey: `${command.idempotencyKey}:session-version`,
  });
  if (!invalidated.ok) {
    await dependencies.persistence.markReconciliationRequired({
      idempotencyKey: `${command.idempotencyKey}:session-reconcile`,
      recoveryRequestId: resolved.recovery.id,
    });
    throw new NipSecurityError("RECONCILIATION_REQUIRED");
  }
  const revoked = await dependencies.auth.revokeAllSessions({
    accountId: resolved.accountId,
  });
  dependencies.attempts.recordSuccess(attemptKey);
  return { reset: true, sessionsRevoked: revoked.confirmed };
}

export async function revokeNipResetAuthorization(
  command: Parameters<NipRecoveryPersistencePort["revokeAuthorization"]>[0],
  persistence: NipRecoveryPersistencePort,
): Promise<NipResetAuthorizationRecord> {
  return persistence.revokeAuthorization(command);
}

export async function cancelNipRecovery(
  command: Parameters<NipRecoveryPersistencePort["cancel"]>[0],
  persistence: NipRecoveryPersistencePort,
): Promise<NipRecoveryRecord> {
  return persistence.cancel(command);
}

export async function reconcileNipRecovery(
  command: Parameters<NipRecoveryPersistencePort["markReconciliationRequired"]>[0],
  persistence: NipRecoveryPersistencePort,
): Promise<NipRecoveryRecord> {
  return persistence.markReconciliationRequired(command);
}
