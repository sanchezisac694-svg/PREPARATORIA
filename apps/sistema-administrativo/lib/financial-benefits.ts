import "server-only";

import {
  applyAuthorizedDiscount,
  applyAuthorizedWaiver,
  applyStudentScholarship,
  approveAuthorizedWaiver,
  createAuthorizedWaiver,
  createScholarshipProgram,
  FinancialBenefitError,
  financialBenefitErrorCodes,
  type FinancialBenefitPersistencePort,
} from "@preparatoria/supabase/financial-benefits";

import { createAdministrativeRpcClient, extractErrorCode } from "./financial-runtime";

function createPort(
  client: Awaited<ReturnType<typeof createAdministrativeRpcClient>>,
): FinancialBenefitPersistencePort {
  return {
    async execute(command) {
      const result = await client.rpc(
        command.sqlFunction,
        command.input as Record<string, unknown>,
      );
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          financialBenefitErrorCodes.includes(code as (typeof financialBenefitErrorCodes)[number])
        ) {
          throw new FinancialBenefitError(code as (typeof financialBenefitErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as { entityId: string; status: string };
    },
  };
}

export async function getFinancialBenefitsAdapter() {
  const port = createPort(await createAdministrativeRpcClient());

  return Object.freeze({
    createProgram: (
      input: Parameters<typeof createScholarshipProgram>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => createScholarshipProgram(port, input, idempotencyKey, correlationId),
    applyScholarship: (
      input: Parameters<typeof applyStudentScholarship>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => applyStudentScholarship(port, input, idempotencyKey, correlationId),
    applyDiscount: (
      input: Parameters<typeof applyAuthorizedDiscount>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => applyAuthorizedDiscount(port, input, idempotencyKey, correlationId),
    createWaiver: (
      input: Parameters<typeof createAuthorizedWaiver>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => createAuthorizedWaiver(port, input, idempotencyKey, correlationId),
    approveWaiver: (
      input: Parameters<typeof approveAuthorizedWaiver>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => approveAuthorizedWaiver(port, input, idempotencyKey, correlationId),
    applyWaiver: (
      input: Parameters<typeof applyAuthorizedWaiver>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => applyAuthorizedWaiver(port, input, idempotencyKey, correlationId),
  });
}
