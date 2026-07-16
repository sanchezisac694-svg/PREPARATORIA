import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SsrSupabaseAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/ssr solo puede importarse desde el servidor.");
}

export type SsrClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => unknown;

class LimitedSsrSupabaseAdapter implements SsrSupabaseAdapter {
  readonly runtime = "server";
  readonly #sdkClient: unknown;

  constructor(sdkClient: unknown) {
    this.#sdkClient = sdkClient;
  }

  isInitialized(): boolean {
    return this.#sdkClient !== null && this.#sdkClient !== undefined;
  }
}

export function createSupabaseSsrClient(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: SsrClientFactory = createServerClient,
): SsrSupabaseAdapter {
  const validated = validateSupabasePublicConfig(config);
  const sdkClient = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });
  return new LimitedSsrSupabaseAdapter(sdkClient);
}

export type { SsrCookieAdapter, SsrSupabaseAdapter, SupabasePublicConfig } from "./types.js";
