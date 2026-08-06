import "server-only";

import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createStudentPortalService } from "@preparatoria/supabase/student-portal";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requirePortalAccess } from "./auth";

export async function requireStudentPortalAccess() {
  const identity = await requirePortalAccess();
  if (!identity.context.roleCodes.includes("ALUMNO")) {
    redirect("/sin-autorizacion");
  }
  return identity;
}

export async function getStudentPortalService() {
  await requireStudentPortalAccess();
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createStudentPortalService(
    {
      publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      url: env.NEXT_PUBLIC_SUPABASE_URL,
    },
    {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const value of values) {
          store.set({ name: value.name, value: value.value, ...value.options });
        }
      },
    },
  );
}
