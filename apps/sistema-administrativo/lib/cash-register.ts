import "server-only";

import {
  approveCashDifference,
  beginCashSessionClose,
  CashRegisterError,
  cashRegisterErrorCodes,
  closeCashSession,
  getActiveCashSession,
  getCashRegisters,
  openCashSession,
  recordCashCount,
  registerCashierPayment,
  registerCashMovement,
  type CashRegisterPersistencePort,
} from "@preparatoria/supabase/cash-register";

import { createAdministrativeRpcClient, extractErrorCode } from "./financial-runtime";

function createPort(
  client: Awaited<ReturnType<typeof createAdministrativeRpcClient>>,
): CashRegisterPersistencePort {
  return {
    async execute(command) {
      const result = await client.rpc(command.sqlFunction, command.input);
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          cashRegisterErrorCodes.includes(code as (typeof cashRegisterErrorCodes)[number])
        ) {
          throw new CashRegisterError(code as (typeof cashRegisterErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data as {
        entityId: string;
        status: "APPROVED" | "CLOSED" | "LINKED" | "RECORDED" | "RECONCILIATION_REQUIRED";
      };
    },
    async getRegisters() {
      const result = await client.rpc("public.get_cash_registers");
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          cashRegisterErrorCodes.includes(code as (typeof cashRegisterErrorCodes)[number])
        ) {
          throw new CashRegisterError(code as (typeof cashRegisterErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return Array.isArray(result.data)
        ? (result.data as Awaited<ReturnType<typeof getCashRegisters>>)
        : [];
    },
    async getActiveSession() {
      const result = await client.rpc("public.get_active_cash_session");
      if (result.error) {
        const code = extractErrorCode(result.error);
        if (
          code &&
          cashRegisterErrorCodes.includes(code as (typeof cashRegisterErrorCodes)[number])
        ) {
          throw new CashRegisterError(code as (typeof cashRegisterErrorCodes)[number], {
            cause: result.error,
          });
        }
        throw result.error;
      }
      return result.data ? (result.data as Awaited<ReturnType<typeof getActiveCashSession>>) : null;
    },
  };
}

export async function getCashRegisterAdapter() {
  const client = await createAdministrativeRpcClient();
  const port = createPort(client);

  return Object.freeze({
    async getOverview() {
      const [registers, activeSession] = await Promise.all([
        getCashRegisters(port),
        getActiveCashSession(port),
      ]);

      return { activeSession, registers };
    },
    openSession: (
      input: Parameters<typeof openCashSession>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => openCashSession(port, input, idempotencyKey, correlationId),
    registerPayment: (
      input: Parameters<typeof registerCashierPayment>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => registerCashierPayment(port, input, idempotencyKey, correlationId),
    registerMovement: (
      input: Parameters<typeof registerCashMovement>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => registerCashMovement(port, input, idempotencyKey, correlationId),
    beginClose: (
      input: Parameters<typeof beginCashSessionClose>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => beginCashSessionClose(port, input, idempotencyKey, correlationId),
    recordCount: (
      input: Parameters<typeof recordCashCount>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => recordCashCount(port, input, idempotencyKey, correlationId),
    closeSession: (
      input: Parameters<typeof closeCashSession>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => closeCashSession(port, input, idempotencyKey, correlationId),
    approveDifference: (
      input: Parameters<typeof approveCashDifference>[1],
      idempotencyKey: string,
      correlationId?: string,
    ) => approveCashDifference(port, input, idempotencyKey, correlationId),
  });
}
