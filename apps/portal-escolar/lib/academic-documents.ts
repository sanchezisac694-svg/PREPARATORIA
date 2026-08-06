import "server-only";

import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createAcademicDocumentsService } from "@preparatoria/supabase/academic-documents";
import { cookies } from "next/headers";

import { requireGuardianPortalAccess } from "./guardian-portal";
import { requireStudentPortalAccess } from "./student-portal";

export async function getStudentAcademicDocumentsService() {
  await requireStudentPortalAccess();
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createAcademicDocumentsService(
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

export async function getGuardianAcademicDocumentsService() {
  await requireGuardianPortalAccess();
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createAcademicDocumentsService(
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
