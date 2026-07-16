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
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
