import "server-only";

import {
  addCollectionAction,
  closeCollectionCase,
  CollectionError,
  collectionErrorCodes,
  createPaymentCommitment,
  evaluatePaymentCommitment,
  getStudentDebtPosition,
  listOverdueStudentAccounts,
  openCollectionCase,
  type CollectionPersistencePort,
} from "@preparatoria/supabase/collections";

import { createAdministrativeRpcClient, extractErrorCode } from "./financial-runtime";

function createPort(
  client: Awaited<ReturnType<typeof createAdministrativeRpcClient>>,
): CollectionPersistencePort {
  return {
    async execute(command) {
      const result = await client.rpc(command.sqlFunction, command.input);
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (code && collectionErrorCodes.includes(code as (typeof collectionErrorCodes)[number])) {
          throw new CollectionError(code as (typeof collectionErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as { entityId: string; status: string };
    },
    async query(command) {
      const result = await client.rpc(command.sqlFunction, command.input);
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (code && collectionErrorCodes.includes(code as (typeof collectionErrorCodes)[number])) {
          throw new CollectionError(code as (typeof collectionErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as never;
    },
  };
}

export async function getCollectionsAdapter() {
  const port = createPort(await createAdministrativeRpcClient());

  return Object.freeze({
    listOverdue: (input: Parameters<typeof listOverdueStudentAccounts>[1]) =>
      listOverdueStudentAccounts(port, input),
    getDebtPosition: (input: Parameters<typeof getStudentDebtPosition>[1]) =>
      getStudentDebtPosition(port, input),
    evaluateCommitment: (input: Parameters<typeof evaluatePaymentCommitment>[1]) =>
      evaluatePaymentCommitment(port, input),
    openCase: (
      input: Parameters<typeof openCollectionCase>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => openCollectionCase(port, input, idempotencyKey, correlationId),
    addAction: (
      input: Parameters<typeof addCollectionAction>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => addCollectionAction(port, input, idempotencyKey, correlationId),
    createCommitment: (
      input: Parameters<typeof createPaymentCommitment>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => createPaymentCommitment(port, input, idempotencyKey, correlationId),
    closeCase: (
      input: Parameters<typeof closeCollectionCase>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => closeCollectionCase(port, input, idempotencyKey, correlationId),
  });
}
