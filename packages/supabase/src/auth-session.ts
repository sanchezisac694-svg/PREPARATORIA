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
      "get_current_identity_context" | "invalidate_own_sessions" | "record_own_nip_security_event",
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
  if (
    typeof candidate.auth_user_id !== "string" ||
    (typeof candidate.account_id !== "string" && candidate.account_id !== null) ||
    (typeof candidate.person_id !== "string" && candidate.person_id !== null) ||
    !isAccountStatus(status) ||
    !Array.isArray(roles) ||
    !roles.every(isRole) ||
    !Array.isArray(applications) ||
    !applications.every(isApplication) ||
    typeof sessionValid !== "boolean"
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
