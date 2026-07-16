import "server-only";

import type { AdministrativeSupabaseAdapter } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/admin-contract solo puede importarse desde el servidor.");
}

export interface PrivilegedClientFactory {
  create(): AdministrativeSupabaseAdapter;
}

export type { AdministrativeSupabaseAdapter } from "./types.js";
