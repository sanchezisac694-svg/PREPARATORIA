import "server-only";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/cash-register solo puede importarse desde el servidor.");
}

export const cashRegisterErrorCodes = Object.freeze([
  "CASH_REGISTER_NOT_FOUND",
  "CASH_REGISTER_NOT_ACTIVE",
  "CASHIER_NOT_ASSIGNED",
  "CASH_SESSION_NOT_FOUND",
  "CASH_SESSION_NOT_OPEN",
  "CASH_SESSION_ALREADY_OPEN",
  "CASH_SESSION_INVALID_STATE",
  "CASH_SESSION_CLOSING",
  "CASH_MOVEMENT_INVALID",
  "CASH_PAYMENT_REQUIRES_OPEN_SESSION",
  "CASH_COUNT_REQUIRED",
  "CASH_RECONCILIATION_REQUIRED",
  "CASH_DIFFERENCE_REQUIRES_REVIEW",
  "CASH_DIFFERENCE_APPROVAL_REQUIRED",
  "CASH_OPERATION_NOT_ALLOWED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "SESSION_VERSION_INVALID",
  "APPLICATION_NOT_ALLOWED",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "FINANCE_OPERATION_FAILED",
  "HISTORICAL_RECORD_IMMUTABLE",
] as const);

export type CashRegisterErrorCode = (typeof cashRegisterErrorCodes)[number];

export type MoneyAmount = `${number}.${number}${number}`;

export type CashRegisterStatus =
  "ACTIVE" | "SUSPENDED" | "RETIRED" | "PENDING_INSTITUTIONAL_VALIDATION";

export type CashierAssignmentStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";

export type CashSessionStatus =
  "OPEN" | "CLOSING" | "RECONCILIATION_REQUIRED" | "CLOSED" | "CANCELLED";

export type CashMovementType =
  "CASH_IN" | "CASH_OUT" | "CASH_WITHDRAWAL" | "CASH_TRANSFER" | "REVERSAL";

export type CashMovementReasonCode =
  "CHANGE_FUND_ADDITION" | "SAFE_DROP" | "CASH_TRANSFER" | "CORRECTION" | "OTHER_MANUAL_REVIEW";

export type CashReconciliationStatus =
  "BALANCED" | "OVERAGE" | "SHORTAGE" | "REVIEW_REQUIRED" | "APPROVED";

export interface CashRegisterSummary {
  readonly cashRegisterId: string;
  readonly code: string;
  readonly name: string;
  readonly status: CashRegisterStatus;
  readonly locationLabel: string | null;
  readonly currencyCode: "MXN";
  readonly assigned: boolean;
}

export interface CashierAssignment {
  readonly cashRegisterId: string;
  readonly accountId: string;
  readonly status: CashierAssignmentStatus;
  readonly validFrom: string;
  readonly validUntil: string | null;
}

export interface CashSessionSummary {
  readonly cashSessionId: string;
  readonly cashRegisterId: string;
  readonly businessDate: string;
  readonly status: CashSessionStatus;
  readonly openingAmount: MoneyAmount;
  readonly expectedCashAmount: MoneyAmount | null;
  readonly countedCashAmount: MoneyAmount | null;
  readonly differenceAmount: MoneyAmount | null;
}

export interface CashSessionDetail extends CashSessionSummary {
  readonly cashierAccountId: string;
  readonly openedAt: string;
  readonly closedAt: string | null;
  readonly closedByAccountId: string | null;
  readonly differenceReasonCode: string | null;
  readonly differenceNote: string | null;
  readonly approvedByAccountId: string | null;
  readonly approvedAt: string | null;
}

export interface CashPaymentLink {
  readonly cashSessionPaymentId: string;
  readonly cashSessionId: string;
  readonly paymentId: string;
  readonly linkedAt: string;
}

export interface CashMovement {
  readonly cashMovementId: string;
  readonly cashSessionId: string;
  readonly movementType: CashMovementType;
  readonly amount: MoneyAmount;
  readonly reasonCode: CashMovementReasonCode;
  readonly note: string | null;
  readonly status: "ACTIVE" | "REVERSED";
  readonly effectiveAt: string;
}

export interface CashCount {
  readonly cashCountId: string;
  readonly cashSessionId: string;
  readonly countedAmount: MoneyAmount;
  readonly countedAt: string;
}

export interface CashReconciliation {
  readonly cashReconciliationId: string;
  readonly cashSessionId: string;
  readonly expectedAmount: MoneyAmount;
  readonly countedAmount: MoneyAmount;
  readonly differenceAmount: MoneyAmount;
  readonly status: CashReconciliationStatus;
}

export interface CashExpectedAmount {
  readonly cashSessionId: string;
  readonly expectedAmount: MoneyAmount;
}

export interface CashSessionCloseResult {
  readonly entityId: string;
  readonly status: CashSessionStatus | CashReconciliationStatus | "LINKED" | "RECORDED";
}

export const cashRegisterOperations = Object.freeze([
  "GET_CASH_REGISTERS",
  "GET_ACTIVE_CASH_SESSION",
  "CREATE_CASH_REGISTER",
  "ASSIGN_CASHIER_TO_REGISTER",
  "OPEN_CASH_SESSION",
  "REGISTER_CASHIER_PAYMENT",
  "REGISTER_CASH_MOVEMENT",
  "BEGIN_CASH_SESSION_CLOSE",
  "RECORD_CASH_COUNT",
  "CLOSE_CASH_SESSION",
  "APPROVE_CASH_DIFFERENCE",
] as const);

export type CashRegisterOperation = (typeof cashRegisterOperations)[number];

export const cashRegisterSqlFunctions = Object.freeze({
  GET_CASH_REGISTERS: "public.get_cash_registers",
  GET_ACTIVE_CASH_SESSION: "public.get_active_cash_session",
  CREATE_CASH_REGISTER: "finance.create_cash_register",
  ASSIGN_CASHIER_TO_REGISTER: "finance.assign_cashier_to_register",
  OPEN_CASH_SESSION: "public.open_cash_session",
  REGISTER_CASHIER_PAYMENT: "public.register_cashier_payment",
  REGISTER_CASH_MOVEMENT: "public.register_cash_movement",
  BEGIN_CASH_SESSION_CLOSE: "public.begin_cash_session_close",
  RECORD_CASH_COUNT: "public.record_cash_count",
  CLOSE_CASH_SESSION: "public.close_cash_session",
  APPROVE_CASH_DIFFERENCE: "public.approve_cash_difference",
} as const satisfies Readonly<Record<CashRegisterOperation, string>>);

export interface CashRegisterCommand {
  readonly operation: CashRegisterOperation;
  readonly sqlFunction: (typeof cashRegisterSqlFunctions)[CashRegisterOperation];
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly input?: Readonly<Record<string, boolean | number | string | null>>;
}

export interface CashRegisterPersistencePort {
  execute(command: CashRegisterCommand): Promise<CashSessionCloseResult>;
  getRegisters(): Promise<readonly CashRegisterSummary[]>;
  getActiveSession(): Promise<CashSessionSummary | null>;
}

export class CashRegisterError extends Error {
  readonly code: CashRegisterErrorCode;

  constructor(code: CashRegisterErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de caja.", options);
    this.name = "CashRegisterError";
    this.code = code;
  }
}

function operation(name: CashRegisterOperation) {
  return async (
    port: CashRegisterPersistencePort,
    input?: Readonly<Record<string, boolean | number | string | null>>,
    idempotencyKey?: string,
    correlationId?: string,
  ) => {
    try {
      return await port.execute({
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(input ? { input } : {}),
        operation: name,
        sqlFunction: cashRegisterSqlFunctions[name],
      });
    } catch (error) {
      if (error instanceof CashRegisterError) throw error;
      throw new CashRegisterError("FINANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const createCashRegister = operation("CREATE_CASH_REGISTER");
export const assignCashierToRegister = operation("ASSIGN_CASHIER_TO_REGISTER");
export const openCashSession = operation("OPEN_CASH_SESSION");
export const registerCashierPayment = operation("REGISTER_CASHIER_PAYMENT");
export const registerCashMovement = operation("REGISTER_CASH_MOVEMENT");
export const beginCashSessionClose = operation("BEGIN_CASH_SESSION_CLOSE");
export const recordCashCount = operation("RECORD_CASH_COUNT");
export const closeCashSession = operation("CLOSE_CASH_SESSION");
export const approveCashDifference = operation("APPROVE_CASH_DIFFERENCE");

export async function getCashRegisters(
  port: CashRegisterPersistencePort,
): Promise<readonly CashRegisterSummary[]> {
  try {
    return await port.getRegisters();
  } catch (error) {
    throw new CashRegisterError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}

export async function getActiveCashSession(
  port: CashRegisterPersistencePort,
): Promise<CashSessionSummary | null> {
  try {
    return await port.getActiveSession();
  } catch (error) {
    throw new CashRegisterError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}
