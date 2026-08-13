"use server";

import { randomUUID } from "node:crypto";

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
import {
  changeAuthenticatedNip,
  changeNipPublicMessage,
  createNipAbuseKey,
} from "@preparatoria/supabase/nip-security";
import {
  beginTotpEnrollment,
  createInMemoryMfaAttemptGuard,
  createMfaAbuseKey,
  genericMfaMessage,
  requireMfaStepUp,
  unenrollOwnTotpFactor,
  verifyTotpChallenge,
  verifyTotpEnrollment,
} from "@preparatoria/supabase/mfa-security";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { portalAuthentication } from "../lib/auth";

export interface LoginState {
  readonly error?: string;
  readonly success?: string;
}

export interface MfaActionState {
  readonly error?: string;
  readonly factorId?: string;
  readonly qrCode?: string;
  readonly secret?: string;
  readonly success?: string;
}

const attempts = createInMemoryAuthenticationAttemptGuard();
const mfaAttempts = createInMemoryMfaAttemptGuard();

function clientIp(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || requestHeaders.get("x-real-ip");
}

async function mfaAttemptKey(
  category: Parameters<typeof createMfaAbuseKey>[0]["category"],
): Promise<string> {
  return createMfaAbuseKey({
    category,
    opaqueSubject: clientIp(await headers()) ?? "unknown",
    salt: readInstitutionalAuthEnv().AUTH_ATTEMPT_GUARD_SALT,
  });
}

async function finishLogin(
  result:
    | Awaited<ReturnType<typeof signInAsApplicant>>
    | Awaited<ReturnType<typeof signInWithInstitutionalCredentials>>,
  target: FormDataEntryValue | null,
  authentication: Awaited<ReturnType<typeof portalAuthentication>>,
): Promise<LoginState> {
  if (!result.ok) {
    if (result.error === "APPLICATION_NOT_ALLOWED") redirect("/sin-autorizacion");
    if (result.error === "ACCOUNT_NOT_ACTIVE") redirect("/estado-cuenta");
    return { error: genericInstitutionalLoginMessage };
  }
  if (result.identity.context.mfaRequired && !result.identity.context.mfaSatisfied) {
    const factors = await authentication.listFactors();
    redirect(
      factors.ok && factors.factors.some((factor) => factor.status === "verified")
        ? "/mfa/verificar"
        : "/mfa/requerido",
    );
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
  const authentication = await portalAuthentication();
  return finishLogin(
    await signInAsApplicant(
      {
        application: applications.PORTAL_ESCOLAR,
        email,
        password,
      },
      authentication,
    ),
    formData.get("next"),
    authentication,
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
  const authentication = await portalAuthentication();
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
        authentication,
      },
    ),
    formData.get("next"),
    authentication,
  );
}

export async function logoutAction() {
  await (await portalAuthentication()).signOutCurrentSession();
  redirect("/login");
}

export async function beginMfaEnrollmentAction(
  _state: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  const currentNip = formData.get("currentNip");
  const friendlyName = formData.get("friendlyName");
  if (
    typeof currentNip !== "string" ||
    (typeof friendlyName !== "string" && friendlyName !== null)
  ) {
    return { error: genericMfaMessage };
  }
  const authentication = await portalAuthentication();
  const reauthenticated = await authentication.reauthenticateWithPassword(currentNip);
  if (!reauthenticated.ok) return { error: genericMfaMessage };
  try {
    const enrollment = await beginTotpEnrollment(
      {
        application: applications.PORTAL_ESCOLAR,
        ...(friendlyName ? { friendlyName } : {}),
        recentlyReauthenticated: true,
      },
      { auth: authentication, identity: { getIdentity: authentication.getAuthenticatedIdentity } },
    );
    return {
      factorId: enrollment.factorId,
      qrCode: enrollment.qrCode,
      secret: enrollment.secret,
    };
  } catch {
    return { error: genericMfaMessage };
  }
}

export async function verifyMfaEnrollmentAction(
  _state: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  const code = formData.get("code");
  const factorId = formData.get("factorId");
  if (typeof code !== "string" || typeof factorId !== "string" || factorId.length === 0) {
    return { error: genericMfaMessage };
  }
  const attemptKey = await mfaAttemptKey("MFA_ENROLLMENT_VERIFY");
  if (!mfaAttempts.checkAllowed(attemptKey)) return { error: genericMfaMessage };
  const authentication = await portalAuthentication();
  const factors = await authentication.listFactors();
  const factor = factors.factors.find(
    (candidate) => candidate.id === factorId && candidate.status === "unverified",
  );
  const hasVerifiedFactor = factors.factors.some((candidate) => candidate.status === "verified");
  if (!factors.ok || !factor) return { error: genericMfaMessage };
  try {
    await verifyTotpEnrollment(
      {
        application: applications.PORTAL_ESCOLAR,
        code,
        correlationId: randomUUID(),
        factorId: factor.id,
        idempotencyKey: randomUUID(),
        reason: hasVerifiedFactor ? "BACKUP_FACTOR" : "USER_ENROLLMENT",
      },
      {
        auth: authentication,
        identity: { getIdentity: authentication.getAuthenticatedIdentity },
        persistence: { recordState: authentication.recordCurrentMfaState },
      },
    );
    mfaAttempts.recordSuccess(attemptKey);
  } catch {
    mfaAttempts.recordFailure(attemptKey);
    return { error: genericMfaMessage };
  }
  redirect("/dashboard");
}

export async function verifyMfaChallengeAction(
  _state: MfaActionState,
  formData: FormData,
): Promise<MfaActionState> {
  const code = formData.get("code");
  if (typeof code !== "string") return { error: genericMfaMessage };
  const attemptKey = await mfaAttemptKey("MFA_LOGIN_CHALLENGE");
  if (!mfaAttempts.checkAllowed(attemptKey)) return { error: genericMfaMessage };
  const authentication = await portalAuthentication();
  const factors = await authentication.listFactors();
  const factor = factors.factors.find((candidate) => candidate.status === "verified");
  if (!factors.ok || !factor) return { error: genericMfaMessage };
  try {
    await verifyTotpChallenge({ code, factorId: factor.id }, authentication);
    mfaAttempts.recordSuccess(attemptKey);
  } catch {
    mfaAttempts.recordFailure(attemptKey);
    return { error: genericMfaMessage };
  }
  redirect("/dashboard");
}

export async function unenrollMfaFactorAction(formData: FormData) {
  const currentNip = formData.get("currentNip");
  const factorIndex = Number(formData.get("factorIndex"));
  if (typeof currentNip !== "string" || !Number.isSafeInteger(factorIndex) || factorIndex < 0) {
    redirect("/seguridad/mfa");
  }
  const authentication = await portalAuthentication();
  if (!(await authentication.reauthenticateWithPassword(currentNip)).ok) {
    redirect("/seguridad/mfa");
  }
  const identity = await authentication.getAuthenticatedIdentity();
  const factors = await authentication.listFactors();
  const verified = factors.factors.filter((factor) => factor.status === "verified");
  const factor = verified[factorIndex];
  if (!identity.ok || !factors.ok || !factor) redirect("/seguridad/mfa");
  try {
    await unenrollOwnTotpFactor(
      {
        application: applications.PORTAL_ESCOLAR,
        correlationId: randomUUID(),
        factorId: factor.id,
        idempotencyKey: randomUUID(),
        mfaRequired: identity.identity.context.mfaRequired,
        recentlyReauthenticated: true,
      },
      {
        auth: authentication,
        identity: { getIdentity: authentication.getAuthenticatedIdentity },
        persistence: { recordState: authentication.recordCurrentMfaState },
      },
    );
  } catch {
    redirect("/seguridad/mfa");
  }
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
  const requestHeaders = await headers();
  const key = createNipAbuseKey({
    category: "CHANGE_NIP",
    opaqueSubject: clientIp(requestHeaders) ?? "unknown",
    salt: env.AUTH_ATTEMPT_GUARD_SALT,
  });
  if (!attempts.checkAllowed(key)) return { error: changeNipPublicMessage };
  const authentication = await portalAuthentication();
  try {
    await requireMfaStepUp(
      {
        application: applications.PORTAL_ESCOLAR,
        redirectTo: "/seguridad/cambiar-nip",
      },
      { auth: authentication, identity: { getIdentity: authentication.getAuthenticatedIdentity } },
    );
    await changeAuthenticatedNip(
      {
        application: applications.PORTAL_ESCOLAR,
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
    redirect("/login");
  } catch {
    attempts.recordFailure(key);
    return { error: changeNipPublicMessage };
  }
}
