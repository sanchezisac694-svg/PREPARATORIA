import type { SupabaseClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/admin-contract solo puede importarse desde el servidor.");
}

export interface PrivilegedClientFactory {
  create(): SupabaseClient;
}
