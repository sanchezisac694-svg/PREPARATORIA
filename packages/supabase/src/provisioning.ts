import "server-only";

import type { AccountStatus, Role } from "@preparatoria/authz";
import { redactSensitive } from "@preparatoria/shared";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/provisioning solo puede importarse desde el servidor.");
}

export const provisioningStages = Object.freeze([
  "PREPARED",
  "AUTH_PENDING",
  "AUTH_CREATED",
  "LINK_PENDING",
  "COMPLETED",
  "RETRYABLE_FAILURE",
  "TERMINAL_FAILURE",
  "COMPENSATION_PENDING",
  "COMPENSATED",
  "CANCELLED",
] as const);

export type ProvisioningStage = (typeof provisioningStages)[number];

export const provisioningDeliveryModes = Object.freeze(["INVITE", "ADMIN_CREATED"] as const);
export type ProvisioningDeliveryMode = (typeof provisioningDeliveryModes)[number];

export const provisioningErrorCodes = Object.freeze({
  ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
  ACCOUNT_PERSON_MISMATCH: "ACCOUNT_PERSON_MISMATCH",
  AUTH_PROVIDER_RETRYABLE_FAILURE: "AUTH_PROVIDER_RETRYABLE_FAILURE",
  AUTH_PROVIDER_TERMINAL_FAILURE: "AUTH_PROVIDER_TERMINAL_FAILURE",
  AUTH_RESULT_UNKNOWN: "AUTH_RESULT_UNKNOWN",
  AUTH_USER_ALREADY_LINKED: "AUTH_USER_ALREADY_LINKED",
  COMPENSATION_FAILED: "COMPENSATION_FAILED",
  COMPENSATION_REQUIRED: "COMPENSATION_REQUIRED",
  FINALIZATION_FAILED: "FINALIZATION_FAILED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INVALID_INITIAL_ROLE: "INVALID_INITIAL_ROLE",
  INVALID_STAGE_TRANSITION: "INVALID_STAGE_TRANSITION",
  PERSON_NOT_FOUND: "PERSON_NOT_FOUND",
} as const);

export type ProvisioningErrorCode =
  (typeof provisioningErrorCodes)[keyof typeof provisioningErrorCodes];

export interface ProvisionIdentityCommand {
  readonly accountId: string;
  readonly deliveryMode: ProvisioningDeliveryMode;
  readonly email: string;
  readonly idempotencyKey: string;
  readonly initialRoleCodes: readonly Role[];
  readonly personId: string;
  readonly requestedAccountStatus: AccountStatus;
  readonly requestedByAccountId?: string;
}

export interface ProvisioningRecord {
  readonly accountId: string;
  readonly authUserCreatedByRequest: boolean | null;
  readonly authUserId: string | null;
  readonly id: string;
  readonly stage: ProvisioningStage;
}

export interface AuthAdminProvisioningResult {
  readonly authUserId: string;
  readonly createdByOperation: boolean;
}

export interface AuthAdminProvisioningPort {
  createOrInviteUser(input: {
    readonly deliveryMode: ProvisioningDeliveryMode;
    readonly email: string;
    readonly idempotencyKey: string;
  }): Promise<AuthAdminProvisioningResult>;
  deleteProvisionedUser(input: {
    readonly authUserId: string;
    readonly idempotencyKey: string;
  }): Promise<{ readonly deleted: boolean }>;
  getProvisionedUser(input: {
    readonly idempotencyKey: string;
  }): Promise<AuthAdminProvisioningResult | null>;
}

export interface IdentityProvisioningPersistencePort {
  finalize(requestId: string, actorAccountId?: string): Promise<ProvisioningRecord>;
  markAuthPending(requestId: string, actorAccountId?: string): Promise<ProvisioningRecord>;
  markCompensation(
    requestId: string,
    succeeded: boolean | null,
    actorAccountId?: string,
  ): Promise<ProvisioningRecord>;
  markFailure(
    requestId: string,
    input: {
      readonly code: ProvisioningErrorCode;
      readonly retryable: boolean;
      readonly safeSummary: string;
    },
    actorAccountId?: string,
  ): Promise<ProvisioningRecord>;
  prepare(command: Omit<ProvisionIdentityCommand, "email">): Promise<ProvisioningRecord>;
  recordAuthCreated(
    requestId: string,
    result: AuthAdminProvisioningResult,
    actorAccountId?: string,
  ): Promise<ProvisioningRecord>;
}

export class ProvisioningError extends Error {
  readonly code: ProvisioningErrorCode;
  readonly retryable: boolean;

  constructor(code: ProvisioningErrorCode, retryable: boolean, cause?: unknown) {
    super("No fue posible completar el aprovisionamiento institucional.", { cause });
    this.name = "ProvisioningError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function safeProvisioningDiagnostic(value: unknown): unknown {
  return redactSensitive(value);
}

function asProvisioningError(error: unknown): ProvisioningError {
  if (error instanceof ProvisioningError) {
    return error;
  }
  return new ProvisioningError(provisioningErrorCodes.AUTH_RESULT_UNKNOWN, false, error);
}

export async function provisionInstitutionalIdentity(
  command: ProvisionIdentityCommand,
  dependencies: {
    readonly authAdmin: AuthAdminProvisioningPort;
    readonly persistence: IdentityProvisioningPersistencePort;
  },
): Promise<ProvisioningRecord> {
  const actor = command.requestedByAccountId;
  let record = await dependencies.persistence.prepare({
    accountId: command.accountId,
    deliveryMode: command.deliveryMode,
    idempotencyKey: command.idempotencyKey,
    initialRoleCodes: command.initialRoleCodes,
    personId: command.personId,
    requestedAccountStatus: command.requestedAccountStatus,
    ...(actor === undefined ? {} : { requestedByAccountId: actor }),
  });

  if (record.stage === "COMPLETED") {
    return record;
  }
  if (record.stage === "COMPENSATION_PENDING" || record.stage === "COMPENSATED") {
    throw new ProvisioningError(provisioningErrorCodes.COMPENSATION_REQUIRED, false);
  }
  if (record.stage === "TERMINAL_FAILURE" || record.stage === "CANCELLED") {
    throw new ProvisioningError(provisioningErrorCodes.INVALID_STAGE_TRANSITION, false);
  }

  let authResult: AuthAdminProvisioningResult | null =
    record.authUserId === null
      ? null
      : {
          authUserId: record.authUserId,
          createdByOperation: record.authUserCreatedByRequest === true,
        };

  if (record.stage === "AUTH_PENDING") {
    authResult = await dependencies.authAdmin.getProvisionedUser({
      idempotencyKey: command.idempotencyKey,
    });
    if (authResult === null) {
      await dependencies.persistence.markCompensation(record.id, null, actor);
      throw new ProvisioningError(provisioningErrorCodes.AUTH_RESULT_UNKNOWN, false);
    }
    record = await dependencies.persistence.recordAuthCreated(record.id, authResult, actor);
  }

  if (record.stage === "PREPARED" || record.stage === "RETRYABLE_FAILURE") {
    record = await dependencies.persistence.markAuthPending(record.id, actor);
    try {
      authResult = await dependencies.authAdmin.createOrInviteUser({
        deliveryMode: command.deliveryMode,
        email: command.email,
        idempotencyKey: command.idempotencyKey,
      });
    } catch (error) {
      const normalized = asProvisioningError(error);
      if (normalized.code === provisioningErrorCodes.AUTH_RESULT_UNKNOWN) {
        await dependencies.persistence.markCompensation(record.id, null, actor);
      } else {
        await dependencies.persistence.markFailure(
          record.id,
          {
            code: normalized.code,
            retryable: normalized.retryable,
            safeSummary: "El proveedor de identidad no completó la operación.",
          },
          actor,
        );
      }
      throw normalized;
    }
    record = await dependencies.persistence.recordAuthCreated(record.id, authResult, actor);
  }

  if (record.stage !== "AUTH_CREATED" && record.stage !== "LINK_PENDING") {
    throw new ProvisioningError(provisioningErrorCodes.INVALID_STAGE_TRANSITION, false);
  }

  try {
    return await dependencies.persistence.finalize(record.id, actor);
  } catch (error) {
    const failure = new ProvisioningError(provisioningErrorCodes.FINALIZATION_FAILED, true, error);

    if (authResult?.createdByOperation !== true) {
      await dependencies.persistence.markFailure(
        record.id,
        {
          code: failure.code,
          retryable: failure.retryable,
          safeSummary: "La vinculación institucional no pudo finalizar.",
        },
        actor,
      );
      throw failure;
    }

    await dependencies.persistence.markCompensation(record.id, null, actor);
    try {
      const compensation = await dependencies.authAdmin.deleteProvisionedUser({
        authUserId: authResult.authUserId,
        idempotencyKey: command.idempotencyKey,
      });
      if (!compensation.deleted) {
        throw new Error("Compensation was not confirmed.");
      }
      await dependencies.persistence.markCompensation(record.id, true, actor);
    } catch (compensationError) {
      await dependencies.persistence.markCompensation(record.id, false, actor);
      throw new ProvisioningError(
        provisioningErrorCodes.COMPENSATION_FAILED,
        true,
        compensationError,
      );
    }
    throw failure;
  }
}
