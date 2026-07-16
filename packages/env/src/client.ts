import type { PublicEnv } from "./schema.js";
import { formatEnvError, publicEnvSchema } from "./schema.js";

export type { PublicEnv } from "./schema.js";

export function parsePublicEnv(input: unknown): PublicEnv {
  const result = publicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return result.data;
}
