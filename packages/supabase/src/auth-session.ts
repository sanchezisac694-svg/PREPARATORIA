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
] as const);
export type SafeAuthenticationError = (typeof safeAuthenticationErrorCodes)[number];

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
    getClaims(): Promise<{ data: { claims: { sub?: string } | null } | null; error: unknown }>;
    signInWithPassword(input: {
      email: string;
      password: string;
    }): Promise<{ data: unknown; error: unknown }>;
    signOut(): Promise<{ error: unknown }>;
  };
  rpc(name: "get_current_identity_context"): Promise<{ data: unknown; error: unknown }>;
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
  if (
    typeof candidate.auth_user_id !== "string" ||
    typeof candidate.account_id !== "string" ||
    typeof candidate.person_id !== "string" ||
    !isAccountStatus(status) ||
    !Array.isArray(roles) ||
    !roles.every(isRole) ||
    !Array.isArray(applications) ||
    !applications.every(isApplication)
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
  };
}

export function evaluateApplicationAccess(
  context: AuthIdentityContext | null,
  application: Application,
): ApplicationAccessDecision {
  if (context === null || context.accountId === null || context.personId === null) {
    return { allowed: false, state: "ACCOUNT_NOT_LINKED" };
  }
  if (context.accountStatus !== accountStatuses.ACTIVE) {
    return {
      allowed: false,
      state: context.accountStatus ?? "ACCOUNT_NOT_LINKED",
    };
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
    const userId = claimsResult.data?.claims?.sub;
    if (claimsResult.error || typeof userId !== "string" || userId.length === 0) {
      return { error: "SESSION_EXPIRED", ok: false };
    }
    const contextResult = await client.rpc("get_current_identity_context");
    if (contextResult.error) {
      return { error: "AUTH_CONTEXT_UNAVAILABLE", ok: false };
    }
    const context = parseContext(contextResult.data);
    if (context === null) {
      return { error: "ACCOUNT_NOT_LINKED", ok: false };
    }
    return {
      identity: { context, userId },
      ok: true,
    };
  }

  return Object.freeze({
    async refreshSession(): Promise<{ readonly authenticated: boolean }> {
      const result = await client.auth.getClaims();
      return {
        authenticated:
          !result.error &&
          typeof result.data?.claims?.sub === "string" &&
          result.data.claims.sub.length > 0,
      };
    },
    async refreshIdentity() {
      return getAuthenticatedIdentity();
    },
    getAuthenticatedIdentity,
    async signInWithInstitutionalCredentials(input: {
      readonly email: string;
      readonly password: string;
    }): Promise<AuthenticationResult> {
      const result = await client.auth.signInWithPassword(input);
      if (result.error) return { error: "INVALID_CREDENTIALS", ok: false };
      return getAuthenticatedIdentity();
    },
    async signOutCurrentSession(): Promise<{ readonly ok: boolean }> {
      const result = await client.auth.signOut();
      return { ok: !result.error };
    },
  });
}
