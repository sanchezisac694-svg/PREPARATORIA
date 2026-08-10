import "server-only";

import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createFinancialPeriodCloseService } from "@preparatoria/supabase/financial-period-close";
import { createFinancialReportsService } from "@preparatoria/supabase/financial-reports";
import { cookies } from "next/headers";

export async function getFinancialReportsService() {
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createFinancialReportsService(
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

export async function getFinancialPeriodCloseService() {
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createFinancialPeriodCloseService(
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
