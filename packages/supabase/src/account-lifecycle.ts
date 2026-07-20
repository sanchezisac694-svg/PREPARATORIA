import "server-only";

import type { AccountStatus, Role } from "@preparatoria/authz";
import { redactSensitive } from "@preparatoria/shared";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/account-lifecycle solo puede importarse desde el servidor.",
  );
}

export const accountLifecycleEventTypes = Object.freeze([
  "INVITATION_PREPARED",
  "INVITATION_ISSUED",
  "ACTIVATION_CONFIRMED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_REACTIVATED",
  "ACCOUNT_BLOCKED",
  "ACCOUNT_UNBLOCKED",
  "ACCOUNT_DISABLED",
  "ACCOUNT_REENABLED",
  "ACTIVATION_CANCELLED",
  "INVITATION_EXPIRED",
] as const);
export type AccountLifecycleEventType = (typeof accountLifecycleEventTypes)[number];

export const accountLifecycleReasonCodes = Object.freeze([
  "INITIAL_INVITATION",
  "INVITATION_CONFIRMED",
  "ACTIVATION_COMPLETED",
  "ADMINISTRATIVE_SUSPENSION",
  "SECURITY_REVIEW",
  "TOO_MANY_FAILED_ATTEMPTS",
  "INSTITUTIONAL_REQUEST",
  "USER_DEPARTURE",
  "RECORD_CORRECTION",
  "REACTIVATION_APPROVED",
  "INVITATION_EXPIRED",
  "ACTIVATION_CANCELLED",
] as const);
export type AccountLifecycleReasonCode = (typeof accountLifecycleReasonCodes)[number];

export const accountLifecycleErrorCodes = Object.freeze([
  "ACCOUNT_NOT_FOUND",
  "PERSON_NOT_FOUND",
  "AUTH_USER_NOT_LINKED",
  "INVALID_ACCOUNT_TRANSITION",
  "IDEMPOTENCY_CONFLICT",
  "INVITATION_EXPIRED",
  "INVITATION_NOT_PREPARED",
  "ACCOUNT_ALREADY_ACTIVE",
  "ACCOUNT_ALREADY_DISABLED",
  "ACTOR_NOT_AUTHORIZED",
  "INVALID_REASON_CODE",
  "CONCURRENT_TRANSITION",
  "LIFECYCLE_OPERATION_FAILED",
] as const);
export type AccountLifecycleErrorCode = (typeof accountLifecycleErrorCodes)[number];

export const initialLifecycleAdministrativeRoles = Object.freeze({
  ALL_OPERATIONS: Object.freeze(["SUPERADMIN"] as const satisfies readonly Role[]),
  STANDARD_OPERATIONS: Object.freeze(["ADMINISTRATIVO"] as const satisfies readonly Role[]),
  SCHOOL_IDENTITY_OPERATIONS: Object.freeze(["CONTROL_ESCOLAR"] as const satisfies readonly Role[]),
});

export interface AccountLifecycleCommand {
  readonly accountId: string;
  readonly correlationId?: string;
  readonly idempotencyKey: string;
  readonly operation: AccountLifecycleEventType;
  readonly reasonCode: AccountLifecycleReasonCode;
  readonly resultingStatus: AccountStatus;
  readonly safeReasonSummary?: string;
}

export interface AccountLifecycleResult {
  readonly accountId: string;
  readonly eventType: AccountLifecycleEventType;
  readonly idempotencyKey: string;
  readonly personId: string;
  readonly status: AccountStatus;
}

export interface AccountLifecyclePersistencePort {
  execute(
    command: AccountLifecycleCommand,
    actorAccountId: string,
  ): Promise<AccountLifecycleResult>;
}

export class AccountLifecycleError extends Error {
  readonly code: AccountLifecycleErrorCode;

  constructor(code: AccountLifecycleErrorCode, cause?: unknown) {
    super("No fue posible completar la operación de ciclo de vida.", { cause });
    this.name = "AccountLifecycleError";
    this.code = code;
  }
}

export function safeAccountLifecycleDiagnostic(value: unknown): unknown {
  return redactSensitive(value);
}

export async function manageInstitutionalAccountLifecycle(
  command: AccountLifecycleCommand,
  actorAccountId: string,
  persistence: AccountLifecyclePersistencePort,
): Promise<AccountLifecycleResult> {
  try {
    return await persistence.execute(command, actorAccountId);
  } catch (error) {
    if (error instanceof AccountLifecycleError) {
      throw error;
    }
    throw new AccountLifecycleError("LIFECYCLE_OPERATION_FAILED", error);
  }
}
