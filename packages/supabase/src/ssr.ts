import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/ssr solo puede importarse desde el servidor.");
}

export type SsrClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookies: SsrCookieAdapter },
) => SupabaseClient;

export function createSupabaseSsrClient(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: SsrClientFactory = createServerClient,
): SupabaseClient {
  const validated = validateSupabasePublicConfig(config);
  return factory(validated.url, validated.publishableKey, { cookies });
}

export type { SsrCookieAdapter, SupabasePublicConfig, TechnicalSupabaseClient } from "./types.js";
