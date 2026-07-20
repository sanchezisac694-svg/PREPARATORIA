import type { InstitutionalAuthEnv, RuntimeEnv, ServerEnv } from "./schema.js";
import { parseSupabasePublicEnv } from "./client.js";
import {
  formatEnvError,
  institutionalAuthEnvSchema,
  runtimeEnvSchema,
  serverEnvSchema,
} from "./schema.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/env/server solo puede importarse desde el servidor.");
}

export type { InstitutionalAuthEnv, RuntimeEnv, ServerEnv } from "./schema.js";

export function parseInstitutionalAuthEnv(input: unknown): InstitutionalAuthEnv {
  const result = institutionalAuthEnvSchema.safeParse(input);
  if (!result.success) throw new Error(formatEnvError(result.error));
  return result.data;
}

export function readInstitutionalAuthEnv(
  source: NodeJS.ProcessEnv = process.env,
): InstitutionalAuthEnv {
  return parseInstitutionalAuthEnv({
    AUTH_ATTEMPT_GUARD_SALT: source.AUTH_ATTEMPT_GUARD_SALT,
    INSTITUTIONAL_AUTH_ALIAS_DOMAIN: source.INSTITUTIONAL_AUTH_ALIAS_DOMAIN,
    NIP_RESET_TOKEN_SECRET: source.NIP_RESET_TOKEN_SECRET,
  });
}

export function parseServerEnv(input: unknown): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}

export function readRuntimeEnv(source: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const result = runtimeEnvSchema.safeParse({
    ...(source.ADMIN_BASE_URL ? { ADMIN_BASE_URL: source.ADMIN_BASE_URL } : {}),
    APP_ENV: source.APP_ENV || undefined,
    LOG_LEVEL: source.LOG_LEVEL || undefined,
    ...(source.PORTAL_BASE_URL ? { PORTAL_BASE_URL: source.PORTAL_BASE_URL } : {}),
  });

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}

export function readSupabasePublicEnv(source: NodeJS.ProcessEnv = process.env) {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
  });
}
