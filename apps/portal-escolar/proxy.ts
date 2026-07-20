import { readSupabasePublicEnv } from "@preparatoria/env/server";
import { createAuthenticationService } from "@preparatoria/supabase/auth-session";
import { type NextRequest, NextResponse } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = readSupabasePublicEnv();
  const auth = createAuthenticationService(
    { publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, url: env.NEXT_PUBLIC_SUPABASE_URL },
    {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        for (const value of values) {
          request.cookies.set(value.name, value.value);
        }
        response = NextResponse.next({ request });
        for (const value of values)
          response.cookies.set({ name: value.name, value: value.value, ...value.options });
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  );
  await auth.refreshSession();
  const pathname = request.nextUrl.pathname;
  const publicPath =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname === "/acceso-no-disponible" ||
    pathname === "/estado-cuenta" ||
    pathname === "/sesion-expirada" ||
    pathname === "/sin-autorizacion" ||
    pathname === "/recuperar-acceso" ||
    pathname === "/restablecer-nip";
  if (!publicPath) {
    const identity = await auth.getAuthenticatedIdentity();
    if (!identity.ok) {
      const target = request.nextUrl.clone();
      target.pathname =
        identity.error === "SESSION_VERSION_MISMATCH" ? "/sesion-expirada" : "/login";
      target.search = "";
      return NextResponse.redirect(target);
    }
    if (identity.identity.context.mfaRequired && !identity.identity.context.mfaSatisfied) {
      const mfaPath =
        pathname === "/mfa/verificar" ||
        pathname === "/mfa/requerido" ||
        pathname === "/seguridad/mfa/configurar" ||
        pathname === "/seguridad/mfa/recuperacion";
      if (!mfaPath) {
        const factors = await auth.listFactors();
        const target = request.nextUrl.clone();
        target.pathname =
          factors.ok && factors.factors.some((factor) => factor.status === "verified")
            ? "/mfa/verificar"
            : "/mfa/requerido";
        target.search = "";
        return NextResponse.redirect(target);
      }
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
