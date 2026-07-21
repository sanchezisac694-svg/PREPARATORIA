import "server-only";

import { createHmac } from "node:crypto";

import type { Application, Role } from "@preparatoria/authz";

import type { AuthenticationResult } from "./auth-session.js";
import type { AuthenticatorAssuranceLevel } from "./session-security.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/mfa-security solo puede importarse desde el servidor.");
}

export const mfaRequirements = Object.freeze([
  "NOT_REQUIRED",
  "OPTIONAL",
  "RECOMMENDED",
  "REQUIRED",
] as const);
export type MfaRequirement = (typeof mfaRequirements)[number];

export const mfaComplianceStatuses = Object.freeze([
  "NOT_APPLICABLE",
  "NOT_ENROLLED",
  "ENROLLMENT_PENDING",
  "COMPLIANT",
  "GRACE_PERIOD",
  "NON_COMPLIANT",
  "RECOVERY_REQUIRED",
  "ADMINISTRATIVE_REVIEW",
] as const);
export type MfaComplianceStatus = (typeof mfaComplianceStatuses)[number];

export const mfaSecurityEventTypes = Object.freeze([
  "MFA_ENROLLMENT_STARTED",
  "MFA_ENROLLMENT_VERIFIED",
  "MFA_ENROLLMENT_FAILED",
  "MFA_CHALLENGE_STARTED",
  "MFA_CHALLENGE_VERIFIED",
  "MFA_CHALLENGE_FAILED",
  "MFA_FACTOR_UNENROLL_REQUESTED",
  "MFA_FACTOR_UNENROLLED",
  "MFA_FACTOR_UNENROLL_FAILED",
  "MFA_BACKUP_FACTOR_ENROLLED",
  "MFA_REQUIRED_BY_POLICY",
  "MFA_GRACE_PERIOD_STARTED",
  "MFA_COMPLIANCE_ACHIEVED",
  "MFA_COMPLIANCE_LOST",
  "MFA_RECOVERY_REQUESTED",
  "MFA_RECOVERY_APPROVED",
  "MFA_RECOVERY_COMPLETED",
  "MFA_STEP_UP_REQUIRED",
  "MFA_STEP_UP_COMPLETED",
  "MFA_ACCESS_REJECTED",
  "MFA_RECONCILIATION_REQUIRED",
] as const);
export type MfaSecurityEventType = (typeof mfaSecurityEventTypes)[number];

export const mfaSecurityReasonCodes = Object.freeze([
  "USER_ENROLLMENT",
  "POLICY_REQUIRED",
  "BACKUP_FACTOR",
  "USER_UNENROLLMENT",
  "LOST_FACTOR",
  "SUSPECTED_COMPROMISE",
  "ADMINISTRATIVE_RECOVERY",
  "STEP_UP_REQUIRED",
  "SECURITY_POLICY",
  "ACCOUNT_ROLE_CHANGED",
  "RECONCILIATION",
] as const);
export type MfaSecurityReasonCode = (typeof mfaSecurityReasonCodes)[number];

export const mfaErrorCodes = Object.freeze([
  "MFA_NOT_REQUIRED",
  "MFA_ENROLLMENT_REQUIRED",
  "MFA_ALREADY_ENROLLED",
  "MFA_ENROLLMENT_FAILED",
  "MFA_FACTOR_NOT_FOUND",
  "MFA_FACTOR_NOT_VERIFIED",
  "MFA_CHALLENGE_FAILED",
  "MFA_CODE_INVALID",
  "MFA_CODE_EXPIRED",
  "MFA_TOO_MANY_ATTEMPTS",
  "MFA_AAL2_REQUIRED",
  "MFA_POLICY_NOT_SATISFIED",
  "MFA_LAST_REQUIRED_FACTOR",
  "MFA_UNENROLL_FAILED",
  "MFA_RECOVERY_REQUIRED",
  "MFA_RECOVERY_NOT_APPROVED",
  "MFA_SESSION_REFRESH_REQUIRED",
  "MFA_SESSION_INVALIDATED",
  "MFA_PROVIDER_RETRYABLE_FAILURE",
  "MFA_PROVIDER_TERMINAL_FAILURE",
  "MFA_PROVIDER_RESULT_UNKNOWN",
  "IDEMPOTENCY_CONFLICT",
] as const);
export type MfaErrorCode = (typeof mfaErrorCodes)[number];
export const genericMfaMessage =
  "No fue posible completar la verificación reforzada. Intenta nuevamente.";

export class MfaSecurityError extends Error {
  readonly code: MfaErrorCode;

  constructor(code: MfaErrorCode) {
    super(genericMfaMessage);
    this.name = "MfaSecurityError";
    this.code = code;
  }
}

const requirementByRole: Readonly<Record<Role, MfaRequirement>> = Object.freeze({
  SUPERADMIN: "REQUIRED",
  ADMINISTRATIVO: "REQUIRED",
  CONTROL_ESCOLAR: "REQUIRED",
  PREFECTURA: "REQUIRED",
  CAJA: "REQUIRED",
  DOCENTE: "RECOMMENDED",
  TUTOR: "OPTIONAL",
  ALUMNO: "OPTIONAL",
  ASPIRANTE: "OPTIONAL",
});
const requirementStrength: Readonly<Record<MfaRequirement, number>> = {
  NOT_REQUIRED: 0,
  OPTIONAL: 1,
  RECOMMENDED: 2,
  REQUIRED: 3,
};

export function resolveMfaRequirement(roles: readonly Role[]): MfaRequirement {
  return roles.reduce<MfaRequirement>(
    (strongest, role) =>
      requirementStrength[requirementByRole[role]] > requirementStrength[strongest]
        ? requirementByRole[role]
        : strongest,
    "OPTIONAL",
  );
}

export interface MfaFactorSummary {
  readonly id: string;
  readonly friendlyName?: string;
  readonly status: "verified" | "unverified";
}

export interface EphemeralTotpEnrollment {
  readonly factorId: string;
  readonly qrCode: string;
  readonly secret: string;
  readonly sensitive: true;
  readonly uri: string;
}

export interface AuthMfaPort {
  challengeAndVerify(input: {
    readonly factorId: string;
    readonly code: string;
  }): Promise<{ readonly ok: boolean }>;
  challengeFactor(
    factorId: string,
  ): Promise<{ readonly challengeId: string; readonly ok: true } | { readonly ok: false }>;
  enrollTotp(
    friendlyName?: string,
  ): Promise<({ readonly ok: true } & EphemeralTotpEnrollment) | { readonly ok: false }>;
  getAuthenticatorAssuranceLevel(): Promise<{
    readonly currentLevel: AuthenticatorAssuranceLevel | null;
    readonly nextLevel: AuthenticatorAssuranceLevel | null;
    readonly ok: boolean;
  }>;
  listFactors(): Promise<{ readonly factors: readonly MfaFactorSummary[]; readonly ok: boolean }>;
  refreshSessionAfterMfaChange(): Promise<{ readonly ok: boolean }>;
  signOutAfterMfaRecovery(): Promise<{ readonly ok: boolean }>;
  unenrollFactor(factorId: string): Promise<{ readonly ok: boolean }>;
  verifyChallenge(input: {
    readonly challengeId: string;
    readonly code: string;
    readonly factorId: string;
  }): Promise<{ readonly ok: boolean }>;
}

export interface MfaPersistencePort {
  recordState(input: {
    readonly correlationId: string;
    readonly eventType: MfaSecurityEventType;
    readonly factorCount: number;
    readonly idempotencyKey: string;
    readonly reason: MfaSecurityReasonCode;
    readonly status: MfaComplianceStatus;
  }): Promise<{ readonly ok: boolean }>;
}

export interface MfaIdentityPort {
  getIdentity(): Promise<AuthenticationResult>;
}

function validateFriendlyName(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) return undefined;
  if (
    value.length > 60 ||
    value !== value.trim() ||
    /[<>\u0000-\u001f\u007f]/u.test(value) ||
    /(secret|token|cookie|nip|correo|email|curp)/iu.test(value)
  ) {
    throw new MfaSecurityError("MFA_ENROLLMENT_FAILED");
  }
  return value;
}

function validateCode(code: string): string {
  if (!/^\d{6}$/.test(code)) throw new MfaSecurityError("MFA_CODE_INVALID");
  return code;
}

async function requireIdentity(
  application: Application,
  identity: MfaIdentityPort,
): Promise<Extract<AuthenticationResult, { ok: true }>["identity"]> {
  const result = await identity.getIdentity();
  if (!result.ok) {
    throw new MfaSecurityError(
      result.error === "SESSION_VERSION_MISMATCH"
        ? "MFA_SESSION_INVALIDATED"
        : "MFA_SESSION_INVALIDATED",
    );
  }
  if (result.identity.context.accountStatus !== "ACTIVE") {
    throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  }
  if (!result.identity.context.allowedApplications.includes(application)) {
    throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  }
  return result.identity;
}

async function requireAal2(auth: AuthMfaPort): Promise<void> {
  const level = await auth.getAuthenticatorAssuranceLevel();
  if (!level.ok || level.currentLevel !== "aal2") {
    throw new MfaSecurityError("MFA_AAL2_REQUIRED");
  }
}

export async function beginTotpEnrollment(
  command: {
    readonly application: Application;
    readonly friendlyName?: string;
    readonly recentlyReauthenticated: boolean;
  },
  dependencies: { readonly auth: AuthMfaPort; readonly identity: MfaIdentityPort },
): Promise<EphemeralTotpEnrollment> {
  await requireIdentity(command.application, dependencies.identity);
  if (!command.recentlyReauthenticated) {
    throw new MfaSecurityError("MFA_AAL2_REQUIRED");
  }
  const result = await dependencies.auth.enrollTotp(validateFriendlyName(command.friendlyName));
  if (!result.ok) throw new MfaSecurityError("MFA_ENROLLMENT_FAILED");
  return Object.freeze({
    factorId: result.factorId,
    qrCode: result.qrCode,
    secret: result.secret,
    sensitive: true,
    uri: result.uri,
  });
}

export async function getMfaAssuranceState(auth: AuthMfaPort) {
  const result = await auth.getAuthenticatorAssuranceLevel();
  if (!result.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  return Object.freeze({
    currentLevel: result.currentLevel,
    nextLevel: result.nextLevel,
    satisfied: result.currentLevel === "aal2",
  });
}

export async function beginMfaChallenge(factorId: string, auth: AuthMfaPort) {
  const result = await auth.challengeFactor(factorId);
  if (!result.ok) throw new MfaSecurityError("MFA_CHALLENGE_FAILED");
  return Object.freeze({ challengeId: result.challengeId, sensitive: true as const });
}

export async function listOwnMfaFactors(auth: AuthMfaPort) {
  const result = await auth.listFactors();
  if (!result.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  return Object.freeze(
    result.factors.map((factor, factorIndex) =>
      Object.freeze({
        factorIndex,
        ...(factor.friendlyName ? { friendlyName: factor.friendlyName } : {}),
        status: factor.status,
      }),
    ),
  );
}

export async function verifyTotpEnrollment(
  command: {
    readonly application: Application;
    readonly code: string;
    readonly correlationId: string;
    readonly factorId: string;
    readonly idempotencyKey: string;
    readonly reason: "USER_ENROLLMENT" | "BACKUP_FACTOR";
  },
  dependencies: {
    readonly auth: AuthMfaPort;
    readonly identity: MfaIdentityPort;
    readonly persistence: MfaPersistencePort;
  },
): Promise<{ readonly factorCount: number; readonly verified: true }> {
  await requireIdentity(command.application, dependencies.identity);
  const verified = await dependencies.auth.challengeAndVerify({
    code: validateCode(command.code),
    factorId: command.factorId,
  });
  if (!verified.ok) throw new MfaSecurityError("MFA_CHALLENGE_FAILED");
  await requireAal2(dependencies.auth);
  const factors = await dependencies.auth.listFactors();
  if (!factors.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  const count = factors.factors.filter((factor) => factor.status === "verified").length;
  const persisted = await dependencies.persistence.recordState({
    correlationId: command.correlationId,
    eventType:
      command.reason === "BACKUP_FACTOR" ? "MFA_BACKUP_FACTOR_ENROLLED" : "MFA_ENROLLMENT_VERIFIED",
    factorCount: count,
    idempotencyKey: command.idempotencyKey,
    reason: command.reason,
    status: "COMPLIANT",
  });
  if (!persisted.ok) throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  const refreshed = await dependencies.auth.refreshSessionAfterMfaChange();
  if (!refreshed.ok) await dependencies.auth.signOutAfterMfaRecovery();
  return { factorCount: count, verified: true };
}

export async function verifyTotpChallenge(
  command: { readonly code: string; readonly factorId: string },
  auth: AuthMfaPort,
): Promise<{ readonly verified: true }> {
  const result = await auth.challengeAndVerify({
    code: validateCode(command.code),
    factorId: command.factorId,
  });
  if (!result.ok) throw new MfaSecurityError("MFA_CHALLENGE_FAILED");
  await requireAal2(auth);
  return { verified: true };
}

export async function unenrollOwnTotpFactor(
  command: {
    readonly application: Application;
    readonly correlationId: string;
    readonly factorId: string;
    readonly idempotencyKey: string;
    readonly mfaRequired: boolean;
    readonly recentlyReauthenticated: boolean;
  },
  dependencies: {
    readonly auth: AuthMfaPort;
    readonly identity: MfaIdentityPort;
    readonly persistence: MfaPersistencePort;
  },
): Promise<{ readonly remainingFactors: number; readonly unenrolled: true }> {
  await requireIdentity(command.application, dependencies.identity);
  await requireAal2(dependencies.auth);
  if (!command.recentlyReauthenticated) {
    throw new MfaSecurityError("MFA_AAL2_REQUIRED");
  }
  const factors = await dependencies.auth.listFactors();
  if (!factors.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  const verified = factors.factors.filter((factor) => factor.status === "verified");
  if (!verified.some((factor) => factor.id === command.factorId)) {
    throw new MfaSecurityError("MFA_FACTOR_NOT_FOUND");
  }
  if (command.mfaRequired && verified.length <= 1) {
    throw new MfaSecurityError("MFA_LAST_REQUIRED_FACTOR");
  }
  if (!(await dependencies.auth.unenrollFactor(command.factorId)).ok) {
    throw new MfaSecurityError("MFA_UNENROLL_FAILED");
  }
  const remaining = verified.length - 1;
  const persisted = await dependencies.persistence.recordState({
    correlationId: command.correlationId,
    eventType: "MFA_FACTOR_UNENROLLED",
    factorCount: remaining,
    idempotencyKey: command.idempotencyKey,
    reason: "USER_UNENROLLMENT",
    status: remaining > 0 ? "COMPLIANT" : "NOT_ENROLLED",
  });
  if (!persisted.ok) throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  await dependencies.auth.signOutAfterMfaRecovery();
  return { remainingFactors: remaining, unenrolled: true };
}

export async function unenrollOwnMfaFactor(
  command: Parameters<typeof unenrollOwnTotpFactor>[0],
  dependencies: Parameters<typeof unenrollOwnTotpFactor>[1],
) {
  return unenrollOwnTotpFactor(command, dependencies);
}

export async function beginBackupFactorEnrollment(
  command: Parameters<typeof beginTotpEnrollment>[0],
  dependencies: Parameters<typeof beginTotpEnrollment>[1],
) {
  await requireAal2(dependencies.auth);
  return beginTotpEnrollment(command, dependencies);
}

export async function requireMfaCompliance(application: Application, identity: MfaIdentityPort) {
  const current = await requireIdentity(application, identity);
  if (current.context.mfaRequired && !current.context.mfaSatisfied) {
    throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  }
  return current;
}

export async function requireMfaStepUp(
  command: {
    readonly application: Application;
    readonly redirectTo: string;
  },
  dependencies: { readonly auth: AuthMfaPort; readonly identity: MfaIdentityPort },
): Promise<{ readonly redirectTo: string }> {
  await requireIdentity(command.application, dependencies.identity);
  await requireAal2(dependencies.auth);
  const allowed = new Set(["/dashboard", "/seguridad/mfa", "/seguridad/cambiar-nip"]);
  if (!allowed.has(command.redirectTo)) {
    throw new MfaSecurityError("MFA_POLICY_NOT_SATISFIED");
  }
  return { redirectTo: command.redirectTo };
}

export async function requireStepUpAuthentication(
  command: Parameters<typeof requireMfaStepUp>[0],
  dependencies: Parameters<typeof requireMfaStepUp>[1],
) {
  return requireMfaStepUp(command, dependencies);
}

export interface MfaRecoveryPort {
  completeApprovedRecovery(): Promise<{ readonly completed: boolean; readonly ok: boolean }>;
}

export async function requestMfaRecovery(
  command: {
    readonly application: Application;
    readonly correlationId: string;
    readonly idempotencyKey: string;
  },
  dependencies: {
    readonly identity: MfaIdentityPort;
    readonly persistence: MfaPersistencePort;
  },
) {
  await requireIdentity(command.application, dependencies.identity);
  const recorded = await dependencies.persistence.recordState({
    correlationId: command.correlationId,
    eventType: "MFA_RECOVERY_REQUESTED",
    factorCount: 0,
    idempotencyKey: command.idempotencyKey,
    reason: "ADMINISTRATIVE_RECOVERY",
    status: "RECOVERY_REQUIRED",
  });
  if (!recorded.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  return { requested: true as const };
}

export async function completeMfaRecovery(
  command: {
    readonly approved: boolean;
    readonly correlationId: string;
    readonly idempotencyKey: string;
  },
  dependencies: {
    readonly auth: Pick<AuthMfaPort, "signOutAfterMfaRecovery">;
    readonly persistence: MfaPersistencePort;
    readonly recovery: MfaRecoveryPort;
  },
) {
  if (!command.approved) throw new MfaSecurityError("MFA_RECOVERY_NOT_APPROVED");
  const recovery = await dependencies.recovery.completeApprovedRecovery();
  if (!recovery.ok || !recovery.completed) {
    throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  }
  const recorded = await dependencies.persistence.recordState({
    correlationId: command.correlationId,
    eventType: "MFA_RECOVERY_COMPLETED",
    factorCount: 0,
    idempotencyKey: command.idempotencyKey,
    reason: "ADMINISTRATIVE_RECOVERY",
    status: "NOT_ENROLLED",
  });
  if (!recorded.ok) throw new MfaSecurityError("MFA_PROVIDER_RESULT_UNKNOWN");
  await dependencies.auth.signOutAfterMfaRecovery();
  return { completed: true as const };
}

export const mfaAbuseCategories = Object.freeze([
  "MFA_ENROLLMENT_VERIFY",
  "MFA_LOGIN_CHALLENGE",
  "MFA_STEP_UP",
  "MFA_UNENROLL",
  "MFA_RECOVERY_REQUEST",
] as const);
export type MfaAbuseCategory = (typeof mfaAbuseCategories)[number];

export function createMfaAbuseKey(input: {
  readonly category: MfaAbuseCategory;
  readonly opaqueSubject: string;
  readonly salt: string;
}): string {
  return `${input.category}:${createHmac("sha256", input.salt)
    .update(input.opaqueSubject)
    .digest("hex")}`;
}

export function createInMemoryMfaAttemptGuard(
  limit = 5,
  windowMs = 15 * 60 * 1000,
  now: () => number = Date.now,
) {
  const attempts = new Map<string, number[]>();
  return Object.freeze({
    checkAllowed(key: string): boolean {
      const threshold = now() - windowMs;
      const current = (attempts.get(key) ?? []).filter((value) => value > threshold);
      attempts.set(key, current);
      return current.length < limit;
    },
    recordFailure(key: string): void {
      attempts.set(key, [...(attempts.get(key) ?? []), now()]);
    },
    recordSuccess(key: string): void {
      attempts.delete(key);
    },
  });
}
