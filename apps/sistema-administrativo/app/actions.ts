"use server";

import { randomUUID } from "node:crypto";

import { applications } from "@preparatoria/authz";
import { readInstitutionalAuthEnv } from "@preparatoria/env/server";
import { safeInternalRedirect } from "@preparatoria/supabase/auth-session";
import {
  createInMemoryAuthenticationAttemptGuard,
  genericInstitutionalLoginMessage,
  isInstitutionalIdentifierType,
  signInWithInstitutionalCredentials,
} from "@preparatoria/supabase/institutional-access";
import {
  changeAuthenticatedNip,
  changeNipPublicMessage,
  createNipAbuseKey,
} from "@preparatoria/supabase/nip-security";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { adminAuthentication } from "../lib/auth";

export interface LoginState {
  readonly error?: string;
  readonly success?: string;
}

const attempts = createInMemoryAuthenticationAttemptGuard();

function clientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip");
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
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: env.INSTITUTIONAL_AUTH_ALIAS_DOMAIN,
      application: applications.SISTEMA_ADMINISTRATIVO,
      attemptSalt: env.AUTH_ATTEMPT_GUARD_SALT,
      identifier,
      identifierType,
      ipAddress: clientIp(await headers()),
      nip,
    },
    {
      attempts,
      authentication: await adminAuthentication(),
    },
  );
  if (!result.ok) {
    if (result.error === "APPLICATION_NOT_ALLOWED") redirect("/sin-autorizacion");
    if (result.error === "ACCOUNT_NOT_ACTIVE") redirect("/estado-cuenta");
    return { error: genericInstitutionalLoginMessage };
  }
  const target = formData.get("next");
  redirect(safeInternalRedirect(typeof target === "string" ? target : null));
}

export async function logoutAction() {
  await (await adminAuthentication()).signOutCurrentSession();
  redirect("/login");
}

export async function changeNipAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const currentNip = formData.get("currentNip");
  const newNip = formData.get("newNip");
  const confirmation = formData.get("confirmation");
  if (
    typeof currentNip !== "string" ||
    typeof newNip !== "string" ||
    typeof confirmation !== "string"
  ) {
    return { error: changeNipPublicMessage };
  }
  const env = readInstitutionalAuthEnv();
  const key = createNipAbuseKey({
    category: "CHANGE_NIP",
    opaqueSubject: clientIp(await headers()) ?? "unknown",
    salt: env.AUTH_ATTEMPT_GUARD_SALT,
  });
  if (!attempts.checkAllowed(key)) return { error: changeNipPublicMessage };
  const authentication = await adminAuthentication();
  try {
    await changeAuthenticatedNip(
      {
        application: applications.SISTEMA_ADMINISTRATIVO,
        confirmation,
        correlationId: randomUUID(),
        currentNip,
        idempotencyKey: randomUUID(),
        newNip,
      },
      {
        audit: {
          async record(event) {
            const result = await authentication.recordOwnNipSecurityEvent({
              correlationId: event.correlationId,
              ...(event.errorCode ? { errorCode: event.errorCode } : {}),
              eventType: event.eventType,
              idempotencyKey: event.idempotencyKey,
            });
            if (!result.ok) throw new Error("NIP_SECURITY_AUDIT_FAILED");
          },
        },
        auth: authentication,
        getIdentity: authentication.getAuthenticatedIdentity,
      },
    );
    attempts.recordSuccess(key);
    return { success: "El NIP fue actualizado." };
  } catch {
    attempts.recordFailure(key);
    return { error: changeNipPublicMessage };
  }
}
