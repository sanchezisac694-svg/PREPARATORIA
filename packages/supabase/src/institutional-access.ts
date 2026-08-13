import "server-only";

import { createHmac } from "node:crypto";

import { accountStatuses, type Application, type AuthIdentityContext } from "@preparatoria/authz";

import {
  evaluateApplicationAccess,
  type AuthenticatedIdentity,
  type AuthenticationResult,
} from "./auth-session.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/institutional-access solo puede importarse en servidor.");
}

export const institutionalIdentifierTypes = Object.freeze([
  "NUMERO_CONTROL",
  "MATRICULA",
  "EMPLOYEE_ID",
  "ADMINISTRATIVE_ID",
] as const);
export type InstitutionalIdentifierType = (typeof institutionalIdentifierTypes)[number];

export const institutionalLoginErrorCodes = Object.freeze([
  "INVALID_IDENTIFIER_FORMAT",
  "INVALID_NIP_FORMAT",
  "INVALID_CREDENTIALS",
  "TOO_MANY_ATTEMPTS",
  "ACCOUNT_NOT_ACTIVE",
  "APPLICATION_NOT_ALLOWED",
  "AUTH_CONTEXT_UNAVAILABLE",
  "AUTHENTICATION_FAILED",
] as const);
export type InstitutionalLoginErrorCode = (typeof institutionalLoginErrorCodes)[number];

export const genericInstitutionalLoginMessage =
  "No fue posible iniciar sesión con los datos proporcionados.";

const identifierPattern = /^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/;
const aliasDomainPattern =
  /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const nipPattern = /^[\x21-\x7e]{6,64}$/;

const aliasPrefixes: Readonly<Record<InstitutionalIdentifierType, string>> = Object.freeze({
  ADMINISTRATIVE_ID: "adm",
  EMPLOYEE_ID: "emp",
  MATRICULA: "mat",
  NUMERO_CONTROL: "nc",
});

export class InstitutionalAccessError extends Error {
  readonly code: InstitutionalLoginErrorCode;

  constructor(code: InstitutionalLoginErrorCode) {
    super(genericInstitutionalLoginMessage);
    this.name = "InstitutionalAccessError";
    this.code = code;
  }
}

export function isInstitutionalIdentifierType(
  value: unknown,
): value is InstitutionalIdentifierType {
  return institutionalIdentifierTypes.some((type) => type === value);
}

export function normalizeInstitutionalIdentifier(input: string): string {
  const normalized = input.trim().toUpperCase();
  if (!identifierPattern.test(normalized)) {
    throw new InstitutionalAccessError("INVALID_IDENTIFIER_FORMAT");
  }
  return normalized;
}

export function validateInstitutionalNip(input: string): string {
  if (input !== input.trim() || !nipPattern.test(input)) {
    throw new InstitutionalAccessError("INVALID_NIP_FORMAT");
  }
  return input;
}

export function deriveInstitutionalAuthAlias(input: {
  readonly domain: string;
  readonly identifierType: InstitutionalIdentifierType;
  readonly normalizedIdentifier: string;
}): string {
  if (
    !aliasDomainPattern.test(input.domain) ||
    input.domain !== input.domain.toLowerCase() ||
    normalizeInstitutionalIdentifier(input.normalizedIdentifier) !== input.normalizedIdentifier
  ) {
    throw new InstitutionalAccessError("INVALID_IDENTIFIER_FORMAT");
  }
  return `${aliasPrefixes[input.identifierType]}-${input.normalizedIdentifier.toLowerCase()}@${
    input.domain
  }`;
}

export function createAuthenticationAttemptKey(input: {
  readonly identifierType: InstitutionalIdentifierType;
  readonly ipAddress: string | null;
  readonly normalizedIdentifier: string;
  readonly salt: string;
}): string {
  if (input.salt.length < 32) throw new InstitutionalAccessError("AUTHENTICATION_FAILED");
  const ipAddress = (input.ipAddress ?? "unknown").trim().slice(0, 64).toLowerCase();
  return createHmac("sha256", input.salt)
    .update(
      `${ipAddress}\0${input.identifierType}\0${normalizeInstitutionalIdentifier(
        input.normalizedIdentifier,
      )}`,
    )
    .digest("hex");
}

export interface AuthenticationAttemptGuard {
  checkAllowed(key: string): boolean;
  recordFailure(key: string): void;
  recordSuccess(key: string): void;
}

export function createInMemoryAuthenticationAttemptGuard(
  options: {
    readonly maxFailures?: number;
    readonly now?: () => number;
    readonly windowMs?: number;
  } = {},
): AuthenticationAttemptGuard {
  const maxFailures = options.maxFailures ?? 5;
  const now = options.now ?? Date.now;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const attempts = new Map<string, { failures: number; windowStartedAt: number }>();

  function current(key: string) {
    const record = attempts.get(key);
    if (record && now() - record.windowStartedAt < windowMs) return record;
    if (record) attempts.delete(key);
    return undefined;
  }

  return Object.freeze({
    checkAllowed(key: string) {
      return (current(key)?.failures ?? 0) < maxFailures;
    },
    recordFailure(key: string) {
      const record = current(key);
      attempts.set(
        key,
        record
          ? { ...record, failures: record.failures + 1 }
          : { failures: 1, windowStartedAt: now() },
      );
    },
    recordSuccess(key: string) {
      attempts.delete(key);
    },
  });
}

export interface InstitutionalLoginCommand {
  readonly aliasDomain: string;
  readonly application: Application;
  readonly attemptSalt: string;
  readonly identifier: string;
  readonly identifierType: InstitutionalIdentifierType;
  readonly ipAddress: string | null;
  readonly nip: string;
}

export interface ApplicantLoginCommand {
  readonly application: Application;
  readonly email: string;
  readonly password: string;
}

export type InstitutionalLoginResult =
  | { readonly identity: AuthenticatedIdentity; readonly ok: true }
  | { readonly error: InstitutionalLoginErrorCode; readonly ok: false };

export interface PasswordAuthenticationPort {
  signInWithAuthCredentials(input: {
    readonly email: string;
    readonly password: string;
  }): Promise<AuthenticationResult>;
}

function authorizeAuthenticatedIdentity(
  result: AuthenticationResult,
  application: Application,
): InstitutionalLoginResult {
  if (!result.ok) {
    return {
      error:
        result.error === "AUTH_CONTEXT_UNAVAILABLE"
          ? "AUTH_CONTEXT_UNAVAILABLE"
          : result.error === "ACCOUNT_NOT_ACTIVE"
            ? "ACCOUNT_NOT_ACTIVE"
            : "INVALID_CREDENTIALS",
      ok: false,
    };
  }
  if (
    result.identity.context.accountStatus === accountStatuses.ACTIVE &&
    result.identity.context.mfaRequired &&
    !result.identity.context.mfaSatisfied
  ) {
    if (!result.identity.context.sessionValid) {
      return { error: "ACCOUNT_NOT_ACTIVE", ok: false };
    }
    if (!result.identity.context.allowedApplications.includes(application)) {
      return { error: "APPLICATION_NOT_ALLOWED", ok: false };
    }
    return result;
  }
  const decision = evaluateApplicationAccess(result.identity.context, application);
  if (!decision.allowed) {
    return {
      error:
        decision.state === "APPLICATION_NOT_ALLOWED"
          ? "APPLICATION_NOT_ALLOWED"
          : "ACCOUNT_NOT_ACTIVE",
      ok: false,
    };
  }
  return result;
}

export async function signInWithInstitutionalCredentials(
  command: InstitutionalLoginCommand,
  dependencies: {
    readonly attempts: AuthenticationAttemptGuard;
    readonly authentication: PasswordAuthenticationPort;
  },
): Promise<InstitutionalLoginResult> {
  let normalizedIdentifier: string;
  let nip: string;
  try {
    normalizedIdentifier = normalizeInstitutionalIdentifier(command.identifier);
    nip = validateInstitutionalNip(command.nip);
  } catch (error) {
    return {
      error: error instanceof InstitutionalAccessError ? error.code : "AUTHENTICATION_FAILED",
      ok: false,
    };
  }

  const key = createAuthenticationAttemptKey({
    identifierType: command.identifierType,
    ipAddress: command.ipAddress,
    normalizedIdentifier,
    salt: command.attemptSalt,
  });
  if (!dependencies.attempts.checkAllowed(key)) {
    return { error: "TOO_MANY_ATTEMPTS", ok: false };
  }

  const alias = deriveInstitutionalAuthAlias({
    domain: command.aliasDomain,
    identifierType: command.identifierType,
    normalizedIdentifier,
  });
  const authentication = await dependencies.authentication.signInWithAuthCredentials({
    email: alias,
    password: nip,
  });
  if (!authentication.ok) {
    dependencies.attempts.recordFailure(key);
    return authorizeAuthenticatedIdentity(authentication, command.application);
  }

  const authorized = authorizeAuthenticatedIdentity(authentication, command.application);
  if (authorized.ok) dependencies.attempts.recordSuccess(key);
  return authorized;
}

export async function signInAsApplicant(
  command: ApplicantLoginCommand,
  authentication: PasswordAuthenticationPort,
): Promise<InstitutionalLoginResult> {
  if (
    !command.email.includes("@") ||
    command.email.length > 254 ||
    command.password.length < 8 ||
    command.password.length > 200
  ) {
    return { error: "INVALID_CREDENTIALS", ok: false };
  }
  return authorizeAuthenticatedIdentity(
    await authentication.signInWithAuthCredentials({
      email: command.email,
      password: command.password,
    }),
    command.application,
  );
}

export function isActiveInstitutionalContext(context: AuthIdentityContext): boolean {
  return context.accountStatus === accountStatuses.ACTIVE;
}
