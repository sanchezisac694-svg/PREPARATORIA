import "server-only";

import {
  approvePaymentAgreement,
  cancelPaymentAgreement,
  createPaymentAgreement,
  evaluatePaymentAgreement,
  markPaymentAgreementDefaulted,
  PaymentAgreementError,
  paymentAgreementErrorCodes,
  reconcilePaymentAgreementInstallment,
  type PaymentAgreementPersistencePort,
} from "@preparatoria/supabase/payment-agreements";

import { createAdministrativeRpcClient, extractErrorCode } from "./financial-runtime";

function createPort(
  client: Awaited<ReturnType<typeof createAdministrativeRpcClient>>,
): PaymentAgreementPersistencePort {
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
          paymentAgreementErrorCodes.includes(code as (typeof paymentAgreementErrorCodes)[number])
        ) {
          throw new PaymentAgreementError(code as (typeof paymentAgreementErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as { entityId: string; status: string };
    },
    async query(command) {
      const result = await client.rpc(
        command.sqlFunction,
        command.input as Record<string, unknown>,
      );
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          paymentAgreementErrorCodes.includes(code as (typeof paymentAgreementErrorCodes)[number])
        ) {
          throw new PaymentAgreementError(code as (typeof paymentAgreementErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as never;
    },
  };
}

export async function getPaymentAgreementsAdapter() {
  const port = createPort(await createAdministrativeRpcClient());

  return Object.freeze({
    evaluate: (input: Parameters<typeof evaluatePaymentAgreement>[1]) =>
      evaluatePaymentAgreement(port, input),
    createAgreement: (
      input: Parameters<typeof createPaymentAgreement>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => createPaymentAgreement(port, input, idempotencyKey, correlationId),
    approveAgreement: (
      input: Parameters<typeof approvePaymentAgreement>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => approvePaymentAgreement(port, input, idempotencyKey, correlationId),
    reconcileInstallment: (
      input: Parameters<typeof reconcilePaymentAgreementInstallment>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => reconcilePaymentAgreementInstallment(port, input, idempotencyKey, correlationId),
    cancelAgreement: (
      input: Parameters<typeof cancelPaymentAgreement>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => cancelPaymentAgreement(port, input, idempotencyKey, correlationId),
    markDefaulted: (
      input: Parameters<typeof markPaymentAgreementDefaulted>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => markPaymentAgreementDefaulted(port, input, idempotencyKey, correlationId),
  });
}
