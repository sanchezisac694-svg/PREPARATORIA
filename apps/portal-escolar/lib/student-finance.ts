import "server-only";

import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createStudentFinanceService } from "@preparatoria/supabase/student-finance";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requirePortalAccess } from "./auth";

export async function requireStudentFinanceAccess() {
  const identity = await requirePortalAccess();
  if (!identity.context.roleCodes.includes("ALUMNO")) {
    redirect("/sin-autorizacion");
  }
  return identity;
}

export async function requireGuardianFinanceAccess() {
  const identity = await requirePortalAccess();
  if (!identity.context.roleCodes.includes("TUTOR")) {
    redirect("/sin-autorizacion");
  }
  return identity;
}

export async function getStudentFinanceService() {
  await requireStudentFinanceAccess();
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createStudentFinanceService(
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

export async function getGuardianFinanceService() {
  await requireGuardianFinanceAccess();
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createStudentFinanceService(
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
