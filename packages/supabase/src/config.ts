import { parseSupabasePublicEnv } from "@preparatoria/env/client";

import type { SupabasePublicConfig } from "./types.js";

export function validateSupabasePublicConfig(input: SupabasePublicConfig): SupabasePublicConfig {
  const parsed = parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: input.publishableKey,
    NEXT_PUBLIC_SUPABASE_URL: input.url,
  });

  return {
    publishableKey: parsed.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    url: parsed.NEXT_PUBLIC_SUPABASE_URL,
  };
}
