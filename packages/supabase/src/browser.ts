import { createBrowserClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { BrowserSupabaseAdapter, SupabasePublicConfig } from "./types.js";

export type BrowserClientFactory = (url: string, publishableKey: string) => unknown;

class LimitedBrowserSupabaseAdapter implements BrowserSupabaseAdapter {
  readonly runtime = "browser";
  readonly #sdkClient: unknown;

  constructor(sdkClient: unknown) {
    this.#sdkClient = sdkClient;
  }

  isInitialized(): boolean {
    return this.#sdkClient !== null && this.#sdkClient !== undefined;
  }
}

export function createSupabaseBrowserClient(
  config: SupabasePublicConfig,
  factory: BrowserClientFactory = createBrowserClient,
): BrowserSupabaseAdapter {
  const validated = validateSupabasePublicConfig(config);
  const sdkClient = factory(validated.url, validated.publishableKey);
  return new LimitedBrowserSupabaseAdapter(sdkClient);
}

export type { BrowserSupabaseAdapter, SupabasePublicConfig } from "./types.js";
