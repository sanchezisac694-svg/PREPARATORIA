import "server-only";

import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type RpcClient = {
  rpc(name: string, input?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

export async function createAdministrativeRpcClient(): Promise<RpcClient> {
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { secure: env.NEXT_PUBLIC_SUPABASE_URL.startsWith("https://") },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values: Array<{ name: string; options?: CookieOptions; value: string }>) => {
          for (const value of values) {
            store.set({ name: value.name, value: value.value, ...value.options });
          }
        },
      },
    },
  ) as unknown as RpcClient;
}

export function extractErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = typeof error.message === "string" ? error.message.trim().toUpperCase() : "";
    return message.length > 0 ? message : null;
  }

  return null;
}
