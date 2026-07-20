import "server-only";

import {
  accountStatuses,
  isAccountStatus,
  isApplication,
  isRole,
  type AccountStatus,
  type Application,
  type AuthIdentityContext,
  type Role,
} from "@preparatoria/authz";
import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";
import {
  parseVerifiedInstitutionalClaims,
  type SessionSecurityErrorCode,
} from "./session-security.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/auth-session solo puede importarse desde el servidor.");
}

export const safeAuthenticationErrorCodes = Object.freeze([
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "ACCOUNT_NOT_LINKED",
  "ACCOUNT_NOT_ACTIVE",
  "APPLICATION_NOT_ALLOWED",
  "AUTH_CONTEXT_UNAVAILABLE",
  "AUTHENTICATION_FAILED",
  "SIGN_OUT_FAILED",
  "SESSION_VERSION_CLAIM_MISSING",
  "SESSION_VERSION_CLAIM_INVALID",
  "SESSION_VERSION_MISMATCH",
  "REAUTHENTICATION_REQUIRED",
] as const);
export type SafeAuthenticationError =
  (typeof safeAuthenticationErrorCodes)[number] | SessionSecurityErrorCode;

export type AccountAccessState =
  AccountStatus | "NO_SESSION" | "ACCOUNT_NOT_LINKED" | "APPLICATION_NOT_ALLOWED";

export interface AuthenticatedIdentity {
  readonly context: AuthIdentityContext;
  readonly userId: string;
}

export type AuthenticationResult =
  | { readonly identity: AuthenticatedIdentity; readonly ok: true }
  | { readonly error: SafeAuthenticationError; readonly ok: false };

export interface ApplicationAccessDecision {
  readonly allowed: boolean;
  readonly state: AccountAccessState;
}

interface AuthSessionSdk {
  readonly auth: {
    getClaims(): Promise<{
      data: { claims: Record<string, unknown> | null } | null;
      error: unknown;
    }>;
    mfa: {
      challenge(input: { factorId: string }): Promise<{
        data: { id: string } | null;
        error: unknown;
      }>;
      challengeAndVerify(input: { factorId: string; code: string }): Promise<{
        data: unknown;
        error: unknown;
      }>;
      enroll(input: { factorType: "totp"; friendlyName?: string }): Promise<{
        data: {
          id: string;
          totp: { qr_code: string; secret: string; uri: string };
        } | null;
        error: unknown;
      }>;
      getAuthenticatorAssuranceLevel(): Promise<{
        data: { currentLevel: string | null; nextLevel: string | null } | null;
        error: unknown;
      }>;
      listFactors(): Promise<{
        data: {
          all: Array<{
            factor_type: string;
            friendly_name?: string;
            id: string;
            status: string;
          }>;
        } | null;
        error: unknown;
      }>;
      unenroll(input: { factorId: string }): Promise<{ data: unknown; error: unknown }>;
      verify(input: {
        challengeId: string;
        code: string;
        factorId: string;
      }): Promise<{ data: unknown; error: unknown }>;
    };
    refreshSession(): Promise<{ data: unknown; error: unknown }>;
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<{ data: unknown; error: unknown }>;
    signOut(options?: { scope?: "global" | "local" | "others" }): Promise<{ error: unknown }>;
    updateUser(input: {
      current_password?: string;
      password?: string;
    }): Promise<{ data: unknown; error: unknown }>;
  };
  rpc(
    name:
      | "get_current_identity_context"
      | "invalidate_own_sessions"
      | "record_current_mfa_state"
      | "record_own_nip_security_event",
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type AuthSessionClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => AuthSessionSdk;

function parseContext(value: unknown): AuthIdentityContext | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (typeof row !== "object" || row === null) return null;
  const candidate = row as Record<string, unknown>;
  const status = candidate.account_status;
  const roles = candidate.role_codes;
  const applications = candidate.allowed_applications;
  const sessionValid = candidate.session_valid;
  const mfaRequired = candidate.mfa_required;
  const mfaSatisfied = candidate.mfa_satisfied;
  if (
    typeof candidate.auth_user_id !== "string" ||
    (typeof candidate.account_id !== "string" && candidate.account_id !== null) ||
    (typeof candidate.person_id !== "string" && candidate.person_id !== null) ||
    !isAccountStatus(status) ||
    !Array.isArray(roles) ||
    !roles.every(isRole) ||
    !Array.isArray(applications) ||
    !applications.every(isApplication) ||
    typeof sessionValid !== "boolean" ||
    typeof mfaRequired !== "boolean" ||
    typeof mfaSatisfied !== "boolean"
  ) {
    return null;
  }
  return {
    accountId: candidate.account_id as AuthIdentityContext["accountId"],
    accountStatus: status,
    allowedApplications: applications as Application[],
    authUserId: candidate.auth_user_id as AuthIdentityContext["authUserId"],
    personId: candidate.person_id as AuthIdentityContext["personId"],
    roleCodes: roles as Role[],
    mfaRequired,
    mfaSatisfied,
    sessionValid,
  };
}

export function evaluateApplicationAccess(
  context: AuthIdentityContext | null,
  application: Application,
): ApplicationAccessDecision {
  if (context === null) {
    return { allowed: false, state: "ACCOUNT_NOT_LINKED" };
  }
  if (context.accountStatus !== accountStatuses.ACTIVE) {
    return {
      allowed: false,
      state: context.accountStatus ?? "ACCOUNT_NOT_LINKED",
    };
  }
  if (context.accountId === null || context.personId === null) {
    return { allowed: false, state: "ACCOUNT_NOT_LINKED" };
  }
  if (!context.allowedApplications.includes(application)) {
    return { allowed: false, state: "APPLICATION_NOT_ALLOWED" };
  }
  return { allowed: true, state: accountStatuses.ACTIVE };
}

export function safeInternalRedirect(path: string | null | undefined): string {
  const allowed = new Set(["/", "/inicio", "/dashboard"]);
  return path && allowed.has(path) ? path : "/dashboard";
}

export function createAuthenticationService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: AuthSessionClientFactory = createServerClient as unknown as AuthSessionClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function getAuthenticatedIdentity(): Promise<AuthenticationResult> {
    const claimsResult = await client.auth.getClaims();
    if (
      claimsResult.error ||
      claimsResult.data?.claims === null ||
      typeof claimsResult.data?.claims?.sub !== "string"
    ) {
      return { error: "SESSION_EXPIRED", ok: false };
    }
    let verifiedClaims;
    try {
      verifiedClaims = parseVerifiedInstitutionalClaims(claimsResult.data?.claims);
    } catch (error) {
      return {
        error:
          error instanceof Error && "code" in error
            ? (error.code as SafeAuthenticationError)
            : "SESSION_VERSION_CLAIM_INVALID",
        ok: false,
      };
    }
    const contextResult = await client.rpc("get_current_identity_context");
    if (contextResult.error) {
      return { error: "AUTH_CONTEXT_UNAVAILABLE", ok: false };
    }
    const context = parseContext(contextResult.data);
    if (context === null) {
      return { error: "ACCOUNT_NOT_LINKED", ok: false };
    }
    if (context.accountStatus !== accountStatuses.ACTIVE) {
      return { error: "ACCOUNT_NOT_ACTIVE", ok: false };
    }
    if (!context.sessionValid) {
      return { error: "SESSION_VERSION_MISMATCH", ok: false };
    }
    return {
      identity: { context, userId: verifiedClaims.sub },
      ok: true,
    };
  }

  return Object.freeze({
    async challengeAndVerify(input: { readonly factorId: string; readonly code: string }) {
      const result = await client.auth.mfa.challengeAndVerify(input);
      return { ok: !result.error };
    },
    async challengeFactor(factorId: string) {
      const result = await client.auth.mfa.challenge({ factorId });
      return result.error || !result.data
        ? ({ ok: false } as const)
        : ({ challengeId: result.data.id, ok: true } as const);
    },
    async enrollTotp(friendlyName?: string) {
      const result = await client.auth.mfa.enroll({
        factorType: "totp",
        ...(friendlyName ? { friendlyName } : {}),
      });
      return result.error || !result.data
        ? ({ ok: false } as const)
        : ({
            factorId: result.data.id,
            ok: true,
            qrCode: result.data.totp.qr_code,
            secret: result.data.totp.secret,
            sensitive: true,
            uri: result.data.totp.uri,
          } as const);
    },
    async getAuthenticatorAssuranceLevel() {
      const result = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      const current = result.data?.currentLevel;
      const next = result.data?.nextLevel;
      const currentLevel: "aal1" | "aal2" | null =
        current === "aal1" || current === "aal2" ? current : null;
      const nextLevel: "aal1" | "aal2" | null = next === "aal1" || next === "aal2" ? next : null;
      return {
        currentLevel,
        nextLevel,
        ok: !result.error,
      };
    },
    async listFactors() {
      const result = await client.auth.mfa.listFactors();
      return {
        factors: (result.data?.all ?? [])
          .filter((factor) => factor.factor_type === "totp")
          .map((factor) => ({
            ...(factor.friendly_name ? { friendlyName: factor.friendly_name } : {}),
            id: factor.id,
            status: factor.status === "verified" ? ("verified" as const) : ("unverified" as const),
          })),
        ok: !result.error,
      };
    },
    async recordCurrentMfaState(input: {
      readonly correlationId: string;
      readonly eventType: string;
      readonly factorCount: number;
      readonly idempotencyKey: string;
      readonly reason: string;
      readonly status: string;
    }) {
      const result = await client.rpc("record_current_mfa_state", {
        requested_correlation_id: input.correlationId,
        requested_event: input.eventType,
        requested_factor_count: input.factorCount,
        requested_idempotency_key: input.idempotencyKey,
        requested_reason: input.reason,
        requested_status: input.status,
      });
      const errorCode =
        typeof result.error === "object" &&
        result.error !== null &&
        "code" in result.error &&
        typeof result.error.code === "string"
          ? result.error.code
          : undefined;
      return { ...(errorCode ? { errorCode } : {}), ok: !result.error };
    },
    async refreshSession(): Promise<{ readonly authenticated: boolean }> {
      const result = await client.auth.getClaims();
      return {
        authenticated:
          !result.error &&
          (() => {
            try {
              parseVerifiedInstitutionalClaims(result.data?.claims);
              return true;
            } catch {
              return false;
            }
          })(),
      };
    },
    async refreshIdentity() {
      return getAuthenticatedIdentity();
    },
    async reauthenticateWithPassword(password: string): Promise<{ readonly ok: boolean }> {
      const claims = await client.auth.getClaims();
      const email = claims.data?.claims?.email;
      if (claims.error || typeof email !== "string" || email.length === 0) {
        return { ok: false };
      }
      const result = await client.auth.signInWithPassword({ email, password });
      return { ok: !result.error };
    },
    async refreshCurrentSession(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.refreshSession();
      return { ok: !result.error };
    },
    async refreshSessionAfterMfaChange(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.refreshSession();
      return { ok: !result.error };
    },
    getAuthenticatedIdentity,
    async signInWithAuthCredentials(input: {
      readonly email: string;
      readonly password: string;
    }): Promise<AuthenticationResult> {
      const result = await client.auth.signInWithPassword(input);
      if (result.error) return { error: "INVALID_CREDENTIALS", ok: false };
      return getAuthenticatedIdentity();
    },
    async signOutCurrentSession(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.signOut({ scope: "local" });
      return { ok: !result.error };
    },
    async signOutAfterMfaRecovery(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.signOut({ scope: "global" });
      return { ok: !result.error };
    },
    async unenrollFactor(factorId: string) {
      const result = await client.auth.mfa.unenroll({ factorId });
      return { ok: !result.error };
    },
    async verifyChallenge(input: {
      readonly challengeId: string;
      readonly code: string;
      readonly factorId: string;
    }) {
      const result = await client.auth.mfa.verify(input);
      return { ok: !result.error };
    },
    async revokeAllSessions(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.signOut({ scope: "global" });
      return { ok: !result.error };
    },
    async updateAuthenticatedPassword(input: {
      readonly currentPassword: string;
      readonly newPassword: string;
    }): Promise<{ readonly ok: boolean }> {
      const claims = await client.auth.getClaims();
      const email = claims.data?.claims?.email;
      if (claims.error || typeof email !== "string" || email.length === 0) {
        return { ok: false };
      }
      const verification = await client.auth.signInWithPassword({
        email,
        password: input.currentPassword,
      });
      if (verification.error) return { ok: false };
      const result = await client.auth.updateUser({
        password: input.newPassword,
      });
      return { ok: !result.error };
    },
    async revokeOtherSessions(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.signOut({ scope: "others" });
      return { ok: !result.error };
    },
    async getVerifiedClaims() {
      const result = await client.auth.getClaims();
      if (result.error) return { error: "SESSION_EXPIRED" as const, ok: false as const };
      try {
        return {
          claims: parseVerifiedInstitutionalClaims(result.data?.claims),
          ok: true as const,
        };
      } catch (error) {
        return {
          error:
            error instanceof Error && "code" in error
              ? (error.code as SessionSecurityErrorCode)
              : ("SESSION_VERSION_CLAIM_INVALID" as const),
          ok: false as const,
        };
      }
    },
    async invalidateOwnSessions(input: {
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
    }): Promise<{ readonly invalidated: boolean; readonly ok: boolean }> {
      const result = await client.rpc("invalidate_own_sessions", {
        requested_correlation_id: input.correlationId,
        requested_event: input.eventType,
        requested_idempotency_key: input.idempotencyKey,
        requested_reason: input.reason,
      });
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        invalidated:
          !result.error &&
          typeof row === "object" &&
          row !== null &&
          (row as Record<string, unknown>).invalidated === true,
        ok: !result.error,
      };
    },
    async recordOwnNipSecurityEvent(input: {
      readonly correlationId: string;
      readonly errorCode?: string;
      readonly eventType: string;
      readonly idempotencyKey: string;
    }): Promise<{ readonly ok: boolean }> {
      const result = await client.rpc("record_own_nip_security_event", {
        requested_correlation_id: input.correlationId,
        requested_error: input.errorCode ?? null,
        requested_event: input.eventType,
        requested_idempotency_key: input.idempotencyKey,
      });
      return { ok: !result.error };
    },
  });
}
