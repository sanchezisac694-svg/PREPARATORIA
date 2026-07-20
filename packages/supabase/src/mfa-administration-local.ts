import "server-only";

import { createClient } from "@supabase/supabase-js";

import {
  AdministrativeMfaRecoveryError,
  type PrivilegedAuthMfaAdministrationPort,
  type PrivilegedMfaFactor,
} from "./mfa-administration.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/mfa-administration-local solo puede usarse en servidor.");
}

export interface LocalMfaAdministrationConfiguration {
  readonly secretKey?: string;
  readonly url: string;
}

export function validateLocalSupabaseAuthAdminUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new AdministrativeMfaRecoveryError("AUTH_ADMIN_ADAPTER_UNAVAILABLE");
  }
  if (
    parsed.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "host.docker.internal"].includes(parsed.hostname) ||
    parsed.port !== "54321" ||
    parsed.username ||
    parsed.password ||
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search ||
    parsed.hash
  ) {
    throw new AdministrativeMfaRecoveryError("AUTH_ADMIN_ADAPTER_UNAVAILABLE");
  }
  return parsed;
}

export function createLocalPrivilegedAuthMfaAdministrationAdapter(
  configuration: LocalMfaAdministrationConfiguration,
): PrivilegedAuthMfaAdministrationPort {
  const url = validateLocalSupabaseAuthAdminUrl(configuration.url);
  if (!configuration.secretKey?.startsWith("sb_secret_")) {
    throw new AdministrativeMfaRecoveryError("AUTH_ADMIN_CREDENTIAL_MISSING");
  }

  function client() {
    return createClient(url.origin, configuration.secretKey!, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
  }

  async function list(authUserId: string) {
    const { data, error } = await client().auth.admin.mfa.listFactors({ userId: authUserId });
    if (error) return { factors: [] as readonly PrivilegedMfaFactor[], ok: false };
    const factors = data.factors
      .filter((factor) => factor.factor_type === "totp")
      .map((factor): PrivilegedMfaFactor => ({
        createdAt: factor.created_at,
        ephemeralFactorId: factor.id,
        factorType: "totp",
        ...(factor.friendly_name ? { friendlyName: factor.friendly_name } : {}),
        status: factor.status,
        updatedAt: factor.updated_at,
      }));
    return { factors, ok: true };
  }

  return Object.freeze({
    async deleteUserFactor(authUserId: string, ephemeralFactorId: string) {
      const { data, error } = await client().auth.admin.mfa.deleteFactor({
        id: ephemeralFactorId,
        userId: authUserId,
      });
      if (!error && (!data.id || data.id === ephemeralFactorId)) {
        return { outcome: "deleted" as const };
      }
      if (error?.status === 404) return { outcome: "not_found" as const };
      return { outcome: "unknown" as const };
    },
    async inspectUserMfaState(authUserId: string) {
      const result = await list(authUserId);
      return {
        ok: result.ok,
        verifiedTotpCount: result.factors.filter((factor) => factor.status === "verified").length,
      };
    },
    listUserFactors: list,
    async revokeUserSessions(_authUserId: string) {
      void _authUserId;
      // GoTrue cierra todas las sesiones al eliminar un factor verificado. La API JS
      // instalada no ofrece revocación por userId sin disponer de un JWT del usuario.
      return { mechanism: "verified_factor_deletion" as const, ok: true };
    },
  });
}
