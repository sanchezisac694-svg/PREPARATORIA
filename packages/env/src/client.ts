import type { PublicEnv, SupabasePublicEnv } from "./schema.js";
import { formatEnvError, publicEnvSchema, supabasePublicEnvSchema } from "./schema.js";

export type { PublicEnv, SupabasePublicEnv } from "./schema.js";

export function parsePublicEnv(input: unknown): PublicEnv {
  const result = publicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}

export function parseSupabasePublicEnv(input: unknown): SupabasePublicEnv {
  const result = supabasePublicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}
