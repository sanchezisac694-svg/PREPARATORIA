import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/session-security solo puede importarse desde el servidor.",
  );
}

export const sessionSecurityErrorCodes = Object.freeze([
  "SESSION_VERSION_CLAIM_MISSING",
  "SESSION_VERSION_CLAIM_INVALID",
  "SESSION_VERSION_MISMATCH",
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_NOT_ACTIVE",
  "SESSION_ALREADY_INVALIDATED",
  "IDEMPOTENCY_CONFLICT",
  "SESSION_REVOCATION_RETRYABLE_FAILURE",
  "SESSION_REVOCATION_TERMINAL_FAILURE",
  "SESSION_REVOCATION_RESULT_UNKNOWN",
  "SESSION_REFRESH_REQUIRED",
  "REAUTHENTICATION_REQUIRED",
  "SESSION_VERSION_OVERFLOW",
  "ACTOR_NOT_AUTHORIZED",
  "RECONCILIATION_REQUIRED",
  "SESSION_SECURITY_OPERATION_FAILED",
] as const);
export type SessionSecurityErrorCode = (typeof sessionSecurityErrorCodes)[number];

export const genericSessionSecurityMessage = "Tu sesión ya no es válida. Inicia sesión nuevamente.";

export interface VerifiedInstitutionalClaims {
  readonly aal: AuthenticatorAssuranceLevel;
  readonly sessionId?: string;
  readonly sessionVersion: bigint;
  readonly sub: string;
}

export const authenticatorAssuranceLevels = Object.freeze(["aal1", "aal2"] as const);
export type AuthenticatorAssuranceLevel = (typeof authenticatorAssuranceLevels)[number];

export function parseAuthenticatorAssuranceLevel(value: unknown): AuthenticatorAssuranceLevel {
  if (value !== "aal1" && value !== "aal2") {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_INVALID");
  }
  return value;
}

export class SessionSecurityError extends Error {
  readonly code: SessionSecurityErrorCode;

  constructor(code: SessionSecurityErrorCode) {
    super(genericSessionSecurityMessage);
    this.name = "SessionSecurityError";
    this.code = code;
  }
}

export function parseInstitutionalSessionVersionClaim(value: unknown): bigint {
  if (value === undefined || value === null) {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_MISSING");
  }
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_INVALID");
  }
  return BigInt(value);
}

export function parseVerifiedInstitutionalClaims(value: unknown): VerifiedInstitutionalClaims {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_INVALID");
  }
  const claims = value as Record<string, unknown>;
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_INVALID");
  }
  const sessionVersion = parseInstitutionalSessionVersionClaim(claims.session_version);
  if (claims.session_id !== undefined && typeof claims.session_id !== "string") {
    throw new SessionSecurityError("SESSION_VERSION_CLAIM_INVALID");
  }
  return {
    aal: parseAuthenticatorAssuranceLevel(claims.aal),
    ...(typeof claims.session_id === "string" ? { sessionId: claims.session_id } : {}),
    sessionVersion,
    sub: claims.sub,
  };
}

export interface AuthSessionSecurityPort {
  getVerifiedClaims(): Promise<
    | { readonly claims: VerifiedInstitutionalClaims; readonly ok: true }
    | { readonly error: SessionSecurityErrorCode; readonly ok: false }
  >;
  refreshCurrentSession(): Promise<{ readonly ok: boolean }>;
  revokeAllSessions(): Promise<{ readonly ok: boolean }>;
  revokeOtherSessions(): Promise<{ readonly ok: boolean }>;
  signOutCurrentSession(): Promise<{ readonly ok: boolean }>;
}

export interface InstitutionalSessionPersistencePort {
  invalidate(input: {
    readonly correlationId: string;
    readonly eventType:
      | "GLOBAL_SESSION_REVOCATION_REQUESTED"
      | "OTHER_SESSIONS_REVOCATION_REQUESTED"
      | "PASSWORD_CHANGE_INVALIDATION"
      | "PASSWORD_RESET_INVALIDATION"
      | "SESSION_VERSION_INCREMENTED";
    readonly idempotencyKey: string;
    readonly reason:
      | "ADMINISTRATIVE_REVOCATION"
      | "NIP_CHANGED"
      | "NIP_RESET"
      | "SUSPECTED_COMPROMISE"
      | "USER_LOGOUT_ALL";
  }): Promise<{ readonly invalidated: boolean; readonly ok: boolean }>;
}

export async function invalidateInstitutionalSessions(
  command: {
    readonly authScope: "global" | "others";
    readonly correlationId: string;
    readonly eventType: Parameters<
      InstitutionalSessionPersistencePort["invalidate"]
    >[0]["eventType"];
    readonly idempotencyKey: string;
    readonly reason: Parameters<InstitutionalSessionPersistencePort["invalidate"]>[0]["reason"];
  },
  dependencies: {
    readonly auth: Pick<AuthSessionSecurityPort, "revokeAllSessions" | "revokeOtherSessions">;
    readonly persistence: InstitutionalSessionPersistencePort;
  },
): Promise<{ readonly invalidated: true; readonly revocationConfirmed: boolean }> {
  const institutional = await dependencies.persistence.invalidate(command);
  if (!institutional.ok) throw new SessionSecurityError("SESSION_SECURITY_OPERATION_FAILED");
  const authResult =
    command.authScope === "global"
      ? await dependencies.auth.revokeAllSessions()
      : await dependencies.auth.revokeOtherSessions();
  return { invalidated: true, revocationConfirmed: authResult.ok };
}
