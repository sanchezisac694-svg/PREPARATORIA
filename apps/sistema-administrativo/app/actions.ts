"use server";
import { applications } from "@preparatoria/authz";
import {
  evaluateApplicationAccess,
  safeInternalRedirect,
} from "@preparatoria/supabase/auth-session";
import { redirect } from "next/navigation";
import { adminAuthentication } from "../lib/auth";
export interface LoginState {
  readonly error?: string;
}
export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string" ||
    !email.includes("@") ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 200
  )
    return { error: "No fue posible iniciar sesión con las credenciales proporcionadas." };
  const result = await (
    await adminAuthentication()
  ).signInWithInstitutionalCredentials({ email, password });
  if (!result.ok)
    return { error: "No fue posible iniciar sesión con las credenciales proporcionadas." };
  const decision = evaluateApplicationAccess(
    result.identity.context,
    applications.SISTEMA_ADMINISTRATIVO,
  );
  if (!decision.allowed)
    redirect(decision.state === "APPLICATION_NOT_ALLOWED" ? "/sin-autorizacion" : "/estado-cuenta");
  const target = formData.get("next");
  redirect(safeInternalRedirect(typeof target === "string" ? target : null));
}
export async function logoutAction() {
  await (await adminAuthentication()).signOutCurrentSession();
  redirect("/login");
}
