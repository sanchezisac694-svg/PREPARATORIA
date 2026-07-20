"use server";

import { applications } from "@preparatoria/authz";
import { readInstitutionalAuthEnv } from "@preparatoria/env/server";
import { safeInternalRedirect } from "@preparatoria/supabase/auth-session";
import {
  createInMemoryAuthenticationAttemptGuard,
  genericInstitutionalLoginMessage,
  isInstitutionalIdentifierType,
  signInAsApplicant,
  signInWithInstitutionalCredentials,
} from "@preparatoria/supabase/institutional-access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { portalAuthentication } from "../lib/auth";

export interface LoginState {
  readonly error?: string;
}

const attempts = createInMemoryAuthenticationAttemptGuard();

function clientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip");
}

function finishLogin(
  result:
    | Awaited<ReturnType<typeof signInAsApplicant>>
    | Awaited<ReturnType<typeof signInWithInstitutionalCredentials>>,
  target: FormDataEntryValue | null,
): LoginState {
  if (!result.ok) {
    if (result.error === "APPLICATION_NOT_ALLOWED") redirect("/sin-autorizacion");
    if (result.error === "ACCOUNT_NOT_ACTIVE") redirect("/estado-cuenta");
    return { error: genericInstitutionalLoginMessage };
  }
  redirect(safeInternalRedirect(typeof target === "string" ? target : null));
}

export async function applicantLoginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    return { error: genericInstitutionalLoginMessage };
  }
  return finishLogin(
    await signInAsApplicant(
      {
        application: applications.PORTAL_ESCOLAR,
        email,
        password,
      },
      await portalAuthentication(),
    ),
    formData.get("next"),
  );
}

export async function institutionalLoginAction(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = formData.get("identifier");
  const identifierType = formData.get("identifierType");
  const nip = formData.get("nip");
  if (
    typeof identifier !== "string" ||
    !isInstitutionalIdentifierType(identifierType) ||
    typeof nip !== "string"
  ) {
    return { error: genericInstitutionalLoginMessage };
  }
  const env = readInstitutionalAuthEnv();
  return finishLogin(
    await signInWithInstitutionalCredentials(
      {
        aliasDomain: env.INSTITUTIONAL_AUTH_ALIAS_DOMAIN,
        application: applications.PORTAL_ESCOLAR,
        attemptSalt: env.AUTH_ATTEMPT_GUARD_SALT,
        identifier,
        identifierType,
        ipAddress: clientIp(await headers()),
        nip,
      },
      {
        attempts,
        authentication: await portalAuthentication(),
      },
    ),
    formData.get("next"),
  );
}

export async function logoutAction() {
  await (await portalAuthentication()).signOutCurrentSession();
  redirect("/login");
}
