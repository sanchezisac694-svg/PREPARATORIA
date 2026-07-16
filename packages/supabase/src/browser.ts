import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { validateSupabasePublicConfig } from "./config.js";
import type { SupabasePublicConfig } from "./types.js";

export type BrowserClientFactory = (url: string, publishableKey: string) => SupabaseClient;

export function createSupabaseBrowserClient(
  config: SupabasePublicConfig,
  factory: BrowserClientFactory = createBrowserClient,
): SupabaseClient {
  const validated = validateSupabasePublicConfig(config);
  return factory(validated.url, validated.publishableKey);
}

export type { SupabasePublicConfig, TechnicalSupabaseClient } from "./types.js";
