import type { RuntimeEnv, ServerEnv } from "./schema.js";
import { formatEnvError, runtimeEnvSchema, serverEnvSchema } from "./schema.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/env/server solo puede importarse desde el servidor.");
}

export type { RuntimeEnv, ServerEnv } from "./schema.js";

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
