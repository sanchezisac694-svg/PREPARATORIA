import "server-only";

import { hasAnyPermission, type Permission } from "@preparatoria/authz";
import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createControlSchoolService } from "@preparatoria/supabase/control-school";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminAccess } from "./auth";

export async function getControlSchoolService() {
  const store = await cookies();
  const env = readSupabasePublicEnv();

  return createControlSchoolService(
    { publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, url: env.NEXT_PUBLIC_SUPABASE_URL },
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

export async function requireControlSchoolAccess(requiredPermissions: readonly Permission[]) {
  const identity = await requireAdminAccess();

  if (
    requiredPermissions.length > 0 &&
    !hasAnyPermission(identity.context.roleCodes, requiredPermissions)
  ) {
    redirect("/sin-autorizacion");
  }

  return {
    identity,
    service: await getControlSchoolService(),
  };
}
