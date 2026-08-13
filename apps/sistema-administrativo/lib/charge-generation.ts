import "server-only";

import {
  approveChargeGenerationBatch,
  ChargeGenerationError,
  chargeGenerationErrorCodes,
  createChargeGenerationBatch,
  executeChargeGenerationBatch,
  previewChargeGeneration,
  submitChargeGenerationBatch,
  type ChargeGenerationPersistencePort,
} from "@preparatoria/supabase/charge-generation";

import { createAdministrativeRpcClient, extractErrorCode } from "./financial-runtime";

function createPort(
  client: Awaited<ReturnType<typeof createAdministrativeRpcClient>>,
): ChargeGenerationPersistencePort {
  return {
    async execute(command) {
      const result = await client.rpc(command.sqlFunction, command.input);
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          chargeGenerationErrorCodes.includes(code as (typeof chargeGenerationErrorCodes)[number])
        ) {
          throw new ChargeGenerationError(code as (typeof chargeGenerationErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as {
        entityId: string;
        status:
          | "ACTIVE"
          | "APPROVED"
          | "CANCELLED"
          | "COMPLETED"
          | "COMPLETED_WITH_ERRORS"
          | "DRAFT"
          | "PREVIEWED"
          | "PROCESSING"
          | "REJECTED"
          | "RETIRED"
          | "SUSPENDED"
          | "UNDER_REVIEW"
          | "PENDING_INSTITUTIONAL_VALIDATION";
      };
    },
    async preview(input) {
      const result = await client.rpc("public.preview_charge_generation", input);
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          chargeGenerationErrorCodes.includes(code as (typeof chargeGenerationErrorCodes)[number])
        ) {
          throw new ChargeGenerationError(code as (typeof chargeGenerationErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as Awaited<ReturnType<typeof previewChargeGeneration>>;
    },
  };
}

export async function getChargeGenerationAdapter() {
  const port = createPort(await createAdministrativeRpcClient());

  return Object.freeze({
    preview: (input: Parameters<typeof previewChargeGeneration>[1]) =>
      previewChargeGeneration(port, input),
    createBatch: (
      input: Parameters<typeof createChargeGenerationBatch>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => createChargeGenerationBatch(port, input, idempotencyKey, correlationId),
    submitBatch: (
      input: Parameters<typeof submitChargeGenerationBatch>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => submitChargeGenerationBatch(port, input, idempotencyKey, correlationId),
    approveBatch: (
      input: Parameters<typeof approveChargeGenerationBatch>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => approveChargeGenerationBatch(port, input, idempotencyKey, correlationId),
    executeBatch: (
      input: Parameters<typeof executeChargeGenerationBatch>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => executeChargeGenerationBatch(port, input, idempotencyKey, correlationId),
  });
}
