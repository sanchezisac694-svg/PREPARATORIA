import "server-only";

import { createHmac } from "node:crypto";

import type { Role } from "@preparatoria/authz";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/mfa-administration solo puede usarse en servidor.");
}

export const administrativeMfaRecoveryStatuses = Object.freeze([
  "REQUESTED",
  "PENDING_IDENTITY_VERIFICATION",
  "IDENTITY_VERIFIED",
  "APPROVED",
  "EXECUTION_PENDING",
  "EXECUTION_IN_PROGRESS",
  "REENROLLMENT_REQUIRED",
  "REENROLLMENT_IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "RETRYABLE_FAILURE",
  "TERMINAL_FAILURE",
  "RECONCILIATION_REQUIRED",
] as const);
export type AdministrativeMfaRecoveryStatus = (typeof administrativeMfaRecoveryStatuses)[number];

export const administrativeMfaRecoveryReasons = Object.freeze([
  "LOST_ALL_FACTORS",
  "LOST_PRIMARY_DEVICE",
  "COMPROMISED_AUTHENTICATOR",
  "DAMAGED_DEVICE",
  "INACCESSIBLE_AUTHENTICATOR",
  "INSTITUTIONAL_CORRECTIVE_ACTION",
  "SECURITY_INCIDENT",
  "ACCOUNT_RECOVERY",
  "FACTOR_RECONCILIATION",
  "ADMINISTRATIVE_ERROR",
] as const);
export type AdministrativeMfaRecoveryReason = (typeof administrativeMfaRecoveryReasons)[number];

export const mfaIdentityVerificationMethods = Object.freeze([
  "IN_PERSON_WITH_INSTITUTIONAL_RECORD",
  "IN_PERSON_WITH_GOVERNMENT_ID",
  "VERIFIED_BY_CONTROL_ESCOLAR_RECORDS",
  "VERIFIED_BY_AUTHORIZED_GUARDIAN",
  "OTHER_APPROVED_INSTITUTIONAL_PROCEDURE",
] as const);
export type MfaIdentityVerificationMethod = (typeof mfaIdentityVerificationMethods)[number];

export const administrativeMfaRecoveryErrors = Object.freeze([
  "MFA_RECOVERY_NOT_FOUND",
  "MFA_RECOVERY_INVALID_STATE",
  "MFA_RECOVERY_EXPIRED",
  "IDENTITY_VERIFICATION_REQUIRED",
  "APPROVAL_REQUIRED",
  "APPROVER_NOT_AUTHORIZED",
  "REQUESTER_APPROVER_CONFLICT",
  "DUAL_CONTROL_REQUIRED",
  "TARGET_ACCOUNT_NOT_ACTIVE",
  "TARGET_ACCOUNT_BLOCKED",
  "TARGET_ACCOUNT_DISABLED",
  "TARGET_ACCOUNT_NOT_MFA_REQUIRED",
  "NO_VERIFIED_FACTORS",
  "FACTOR_LIST_FAILED",
  "FACTOR_DELETE_FAILED",
  "FACTOR_DELETE_RESULT_UNKNOWN",
  "FACTOR_COUNT_MISMATCH",
  "AUTH_ADMIN_ADAPTER_UNAVAILABLE",
  "AUTH_ADMIN_CREDENTIAL_MISSING",
  "SESSION_REVOCATION_FAILED",
  "SESSION_VERSION_INVALIDATION_FAILED",
  "REENROLLMENT_REQUIRED",
  "REENROLLMENT_NOT_VERIFIED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_OPERATION",
  "RECONCILIATION_REQUIRED",
  "ACTOR_NOT_AUTHORIZED",
  "MFA_RECOVERY_OPERATION_FAILED",
] as const);
export type AdministrativeMfaRecoveryErrorCode = (typeof administrativeMfaRecoveryErrors)[number];

export const genericAdministrativeMfaRecoveryMessage = "No fue posible completar la operación.";

export class AdministrativeMfaRecoveryError extends Error {
  constructor(readonly code: AdministrativeMfaRecoveryErrorCode) {
    super(genericAdministrativeMfaRecoveryMessage);
    this.name = "AdministrativeMfaRecoveryError";
  }
}

export interface PrivilegedMfaFactor {
  readonly createdAt?: string;
  readonly ephemeralFactorId: string;
  readonly factorType: "totp";
  readonly friendlyName?: string;
  readonly status: "verified" | "unverified";
  readonly updatedAt?: string;
}

export interface PrivilegedAuthMfaAdministrationPort {
  deleteUserFactor(
    authUserId: string,
    ephemeralFactorId: string,
  ): Promise<{ readonly outcome: "deleted" | "not_found" | "unknown" }>;
  inspectUserMfaState(
    authUserId: string,
  ): Promise<{ readonly ok: boolean; readonly verifiedTotpCount: number }>;
  listUserFactors(
    authUserId: string,
  ): Promise<{ readonly factors: readonly PrivilegedMfaFactor[]; readonly ok: boolean }>;
  revokeUserSessions(authUserId: string): Promise<{
    readonly mechanism: "verified_factor_deletion" | "provider_unavailable";
    readonly ok: boolean;
  }>;
}

export interface AdministrativeMfaActor {
  readonly accountId: string;
  readonly aal: "aal1" | "aal2";
  readonly roles: readonly Role[];
  readonly sessionValid: boolean;
}

export interface AdministrativeMfaRecoveryRepository {
  approve(input: {
    readonly actorId: string;
    readonly expiresAt: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  beginExecution(input: {
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  }): Promise<{
    readonly authUserId: string;
    readonly recoveryId: string;
    readonly sessionVersion: number;
  }>;
  cancel(input: {
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  complete(input: {
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
    readonly verifiedFactorCount: number;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  completeFactorOperation(input: {
    readonly actorId: string;
    readonly errorCode?: AdministrativeMfaRecoveryErrorCode;
    readonly idempotencyKey: string;
    readonly operationId: string;
    readonly outcome: "DELETED" | "NOT_FOUND" | "RESULT_UNKNOWN" | "RETRYABLE_FAILURE";
    readonly recoveryId: string;
  }): Promise<void>;
  markReconciliation(input: {
    readonly actorId: string;
    readonly errorCode: AdministrativeMfaRecoveryErrorCode;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  markReenrollmentRequired(input: {
    readonly actorId: string;
    readonly factorCount: number;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  recordFactorOperation(input: {
    readonly actorId: string;
    readonly digest: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
    readonly status: "VERIFIED" | "UNVERIFIED";
  }): Promise<string>;
  recordVerification(input: {
    readonly actorId: string;
    readonly idempotencyKey: string;
    readonly method: MfaIdentityVerificationMethod;
    readonly recoveryId: string;
  }): Promise<AdministrativeMfaRecoveryStatus>;
  request(input: {
    readonly actorId: string;
    readonly correlationId: string;
    readonly idempotencyKey: string;
    readonly normalizedInstitutionalIdentifier: string;
    readonly reason: AdministrativeMfaRecoveryReason;
  }): Promise<{ readonly recoveryId: string; readonly status: AdministrativeMfaRecoveryStatus }>;
}

const fullOperators: readonly Role[] = ["SUPERADMIN", "ADMINISTRATIVO"];
const requestOperators: readonly Role[] = [...fullOperators, "CONTROL_ESCOLAR"];

function requireOperator(actor: AdministrativeMfaActor, allowedRoles: readonly Role[]): void {
  if (
    !actor.sessionValid ||
    actor.aal !== "aal2" ||
    !actor.roles.some((role) => allowedRoles.includes(role))
  ) {
    throw new AdministrativeMfaRecoveryError("ACTOR_NOT_AUTHORIZED");
  }
}

export function createMfaFactorReferenceDigest(input: {
  readonly authUserId: string;
  readonly ephemeralFactorId: string;
  readonly secret: string;
}): string {
  if (input.secret.length < 32) {
    throw new AdministrativeMfaRecoveryError("MFA_RECOVERY_OPERATION_FAILED");
  }
  return createHmac("sha256", input.secret)
    .update(`${input.authUserId}:${input.ephemeralFactorId}`)
    .digest("hex");
}

export async function requestAdministrativeMfaRecovery(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly correlationId: string;
    readonly idempotencyKey: string;
    readonly normalizedInstitutionalIdentifier: string;
    readonly reason: AdministrativeMfaRecoveryReason;
  },
  repository: AdministrativeMfaRecoveryRepository,
) {
  requireOperator(command.actor, requestOperators);
  return repository.request({
    actorId: command.actor.accountId,
    correlationId: command.correlationId,
    idempotencyKey: command.idempotencyKey,
    normalizedInstitutionalIdentifier: command.normalizedInstitutionalIdentifier,
    reason: command.reason,
  });
}

export async function recordMfaIdentityVerification(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly idempotencyKey: string;
    readonly method: MfaIdentityVerificationMethod;
    readonly recoveryId: string;
  },
  repository: AdministrativeMfaRecoveryRepository,
) {
  requireOperator(command.actor, requestOperators);
  return repository.recordVerification({
    actorId: command.actor.accountId,
    idempotencyKey: command.idempotencyKey,
    method: command.method,
    recoveryId: command.recoveryId,
  });
}

export async function approveAdministrativeMfaRecovery(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly expiresAt: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  },
  repository: AdministrativeMfaRecoveryRepository,
) {
  requireOperator(command.actor, fullOperators);
  return repository.approve({
    actorId: command.actor.accountId,
    expiresAt: command.expiresAt,
    idempotencyKey: command.idempotencyKey,
    recoveryId: command.recoveryId,
  });
}

export async function executeAdministrativeMfaRecovery(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly digestSecret: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  },
  dependencies: {
    readonly auth: PrivilegedAuthMfaAdministrationPort;
    readonly repository: AdministrativeMfaRecoveryRepository;
  },
): Promise<{ readonly factorsRemoved: number; readonly status: AdministrativeMfaRecoveryStatus }> {
  requireOperator(command.actor, fullOperators);
  const execution = await dependencies.repository.beginExecution({
    actorId: command.actor.accountId,
    idempotencyKey: command.idempotencyKey,
    recoveryId: command.recoveryId,
  });
  const listed = await dependencies.auth.listUserFactors(execution.authUserId);
  if (!listed.ok) {
    await dependencies.repository.markReconciliation({
      actorId: command.actor.accountId,
      errorCode: "FACTOR_LIST_FAILED",
      idempotencyKey: `${command.idempotencyKey}:reconcile`,
      recoveryId: command.recoveryId,
    });
    throw new AdministrativeMfaRecoveryError("RECONCILIATION_REQUIRED");
  }
  const verified = listed.factors.filter(
    (factor) => factor.factorType === "totp" && factor.status === "verified",
  );
  if (verified.length === 0) {
    await dependencies.repository.markReenrollmentRequired({
      actorId: command.actor.accountId,
      factorCount: 0,
      idempotencyKey: `${command.idempotencyKey}:reenroll`,
      recoveryId: command.recoveryId,
    });
    return { factorsRemoved: 0, status: "REENROLLMENT_REQUIRED" };
  }
  let removed = 0;
  for (const factor of verified) {
    const digest = createMfaFactorReferenceDigest({
      authUserId: execution.authUserId,
      ephemeralFactorId: factor.ephemeralFactorId,
      secret: command.digestSecret,
    });
    const operationId = await dependencies.repository.recordFactorOperation({
      actorId: command.actor.accountId,
      digest,
      idempotencyKey: `${command.idempotencyKey}:record:${digest.slice(0, 12)}`,
      recoveryId: command.recoveryId,
      status: "VERIFIED",
    });
    const result = await dependencies.auth.deleteUserFactor(
      execution.authUserId,
      factor.ephemeralFactorId,
    );
    const outcome =
      result.outcome === "deleted"
        ? "DELETED"
        : result.outcome === "not_found"
          ? "NOT_FOUND"
          : "RESULT_UNKNOWN";
    await dependencies.repository.completeFactorOperation({
      actorId: command.actor.accountId,
      ...(outcome === "RESULT_UNKNOWN"
        ? { errorCode: "FACTOR_DELETE_RESULT_UNKNOWN" as const }
        : {}),
      idempotencyKey: `${command.idempotencyKey}:complete:${digest.slice(0, 12)}`,
      operationId,
      outcome,
      recoveryId: command.recoveryId,
    });
    if (outcome === "RESULT_UNKNOWN") {
      await dependencies.repository.markReconciliation({
        actorId: command.actor.accountId,
        errorCode: "FACTOR_DELETE_RESULT_UNKNOWN",
        idempotencyKey: `${command.idempotencyKey}:unknown`,
        recoveryId: command.recoveryId,
      });
      throw new AdministrativeMfaRecoveryError("RECONCILIATION_REQUIRED");
    }
    removed += 1;
  }
  await dependencies.auth.revokeUserSessions(execution.authUserId);
  const inspected = await dependencies.auth.inspectUserMfaState(execution.authUserId);
  if (!inspected.ok || inspected.verifiedTotpCount !== 0) {
    await dependencies.repository.markReconciliation({
      actorId: command.actor.accountId,
      errorCode: "FACTOR_COUNT_MISMATCH",
      idempotencyKey: `${command.idempotencyKey}:count`,
      recoveryId: command.recoveryId,
    });
    throw new AdministrativeMfaRecoveryError("RECONCILIATION_REQUIRED");
  }
  const status = await dependencies.repository.markReenrollmentRequired({
    actorId: command.actor.accountId,
    factorCount: verified.length,
    idempotencyKey: `${command.idempotencyKey}:reenroll`,
    recoveryId: command.recoveryId,
  });
  return { factorsRemoved: removed, status };
}

export const retryAdministrativeMfaRecovery = executeAdministrativeMfaRecovery;

export async function reconcileAdministrativeMfaRecovery(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly authUserId: string;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  },
  dependencies: {
    readonly auth: PrivilegedAuthMfaAdministrationPort;
    readonly repository: AdministrativeMfaRecoveryRepository;
  },
) {
  requireOperator(command.actor, fullOperators);
  const state = await dependencies.auth.inspectUserMfaState(command.authUserId);
  if (!state.ok) throw new AdministrativeMfaRecoveryError("RECONCILIATION_REQUIRED");
  if (state.verifiedTotpCount > 0) {
    return dependencies.repository.markReconciliation({
      actorId: command.actor.accountId,
      errorCode: "FACTOR_COUNT_MISMATCH",
      idempotencyKey: command.idempotencyKey,
      recoveryId: command.recoveryId,
    });
  }
  return dependencies.repository.markReenrollmentRequired({
    actorId: command.actor.accountId,
    factorCount: 0,
    idempotencyKey: command.idempotencyKey,
    recoveryId: command.recoveryId,
  });
}

export async function cancelAdministrativeMfaRecovery(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
  },
  repository: AdministrativeMfaRecoveryRepository,
) {
  requireOperator(command.actor, requestOperators);
  return repository.cancel({
    actorId: command.actor.accountId,
    idempotencyKey: command.idempotencyKey,
    recoveryId: command.recoveryId,
  });
}

export async function completeMfaRecoveryAfterReenrollment(
  command: {
    readonly actor: AdministrativeMfaActor;
    readonly idempotencyKey: string;
    readonly recoveryId: string;
    readonly verifiedFactorCount: number;
  },
  repository: AdministrativeMfaRecoveryRepository,
) {
  requireOperator(command.actor, fullOperators);
  if (command.verifiedFactorCount < 1) {
    throw new AdministrativeMfaRecoveryError("REENROLLMENT_NOT_VERIFIED");
  }
  return repository.complete({
    actorId: command.actor.accountId,
    idempotencyKey: command.idempotencyKey,
    recoveryId: command.recoveryId,
    verifiedFactorCount: command.verifiedFactorCount,
  });
}

export const administrativeMfaAbuseCategories = Object.freeze([
  "MFA_ADMIN_RECOVERY_REQUEST",
  "MFA_ADMIN_IDENTITY_VERIFICATION",
  "MFA_ADMIN_RECOVERY_APPROVAL",
  "MFA_ADMIN_RECOVERY_EXECUTION",
  "MFA_ADMIN_RECOVERY_RETRY",
  "MFA_ADMIN_RECOVERY_RECONCILIATION",
] as const);
export type AdministrativeMfaAbuseCategory = (typeof administrativeMfaAbuseCategories)[number];

export function createAdministrativeMfaAbuseKey(input: {
  readonly actor: string;
  readonly category: AdministrativeMfaAbuseCategory;
  readonly salt: string;
  readonly target: string;
}): string {
  return `${input.category}:${createHmac("sha256", input.salt)
    .update(`${input.actor}:${input.target}`)
    .digest("hex")}`;
}
