import "server-only";
import { applications } from "@preparatoria/authz";
import { readSupabasePublicEnv } from "@preparatoria/env/server";
import {
  createAuthenticationService,
  evaluateApplicationAccess,
} from "@preparatoria/supabase/auth-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function portalAuthentication() {
  const store = await cookies();
  const env = readSupabasePublicEnv();
  return createAuthenticationService(
    { publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, url: env.NEXT_PUBLIC_SUPABASE_URL },
    {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const value of values)
          store.set({ name: value.name, value: value.value, ...value.options });
      },
    },
  );
}

export async function requirePortalAccess() {
  const authentication = await portalAuthentication();
  const result = await authentication.getAuthenticatedIdentity();
  if (!result.ok && result.error === "SESSION_VERSION_MISMATCH") redirect("/sesion-expirada");
  if (!result.ok)
    redirect(result.error === "ACCOUNT_NOT_LINKED" ? "/acceso-no-disponible" : "/login");
  if (result.identity.context.mfaRequired && !result.identity.context.mfaSatisfied) {
    const factors = await authentication.listFactors();
    redirect(
      factors.ok && factors.factors.some((factor) => factor.status === "verified")
        ? "/mfa/verificar"
        : "/mfa/requerido",
    );
  }
  const decision = evaluateApplicationAccess(result.identity.context, applications.PORTAL_ESCOLAR);
  if (!decision.allowed)
    redirect(decision.state === "APPLICATION_NOT_ALLOWED" ? "/sin-autorizacion" : "/estado-cuenta");
  return result.identity;
}
