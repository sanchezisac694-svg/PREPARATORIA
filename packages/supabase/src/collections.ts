import "server-only";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/collections solo puede importarse desde el servidor.");
}

export type MoneyAmount = `${number}.${number}${number}`;

export interface DebtChargeBreakdown {
  readonly agingBucket:
    | "CURRENT"
    | "1_30_DAYS"
    | "31_60_DAYS"
    | "61_90_DAYS"
    | "91_PLUS_DAYS"
    | "NO_DUE_DATE"
    | "SETTLED";
  readonly chargeDescription: string;
  readonly chargeId: string;
  readonly chargeStatus: string;
  readonly debtStatus: "DUE_TODAY" | "NOT_DUE" | "NO_DUE_DATE" | "OVERDUE" | "SETTLED";
  readonly dueDate: string | null;
  readonly originalAmount: MoneyAmount;
  readonly outstandingAmount: MoneyAmount;
}

export interface StudentDebtPosition {
  readonly chargeCount: number;
  readonly daysPastDue: number;
  readonly oldestOverdueDate: string | null;
  readonly overdueChargeCount: number;
  readonly charges: readonly DebtChargeBreakdown[];
  readonly totalNotDue: MoneyAmount;
  readonly totalOutstanding: MoneyAmount;
  readonly totalOverdue: MoneyAmount;
}

export interface OverdueAccountSummary {
  readonly agingBucket: DebtChargeBreakdown["agingBucket"];
  readonly caseStatus:
    "CLOSED" | "IN_FOLLOW_UP" | "OPEN" | "PROMISE_PENDING" | "RESOLVED" | "REVIEW_REQUIRED" | null;
  readonly displayName: string | null;
  readonly groupName: string | null;
  readonly institutionalStudentCode: string;
  readonly oldestOverdueDate: string | null;
  readonly semesterNumber: number | null;
  readonly totalOutstanding: MoneyAmount;
  readonly totalOverdue: MoneyAmount;
}

export interface CollectionCase {
  readonly caseId: string;
  readonly closedAt: string | null;
  readonly closeReasonCode: string | null;
  readonly lastActionAt: string | null;
  readonly nextActionAt: string | null;
  readonly openedAt: string;
  readonly openedReasonCode: string;
  readonly priority: "HIGH" | "LOW" | "NORMAL" | "URGENT";
  readonly status:
    "CLOSED" | "IN_FOLLOW_UP" | "OPEN" | "PROMISE_PENDING" | "RESOLVED" | "REVIEW_REQUIRED";
}

export interface CollectionAction {
  readonly actionStatus: "CANCELLED" | "COMPLETED" | "RECORDED";
  readonly actionType:
    | "ACCOUNT_REVIEW"
    | "CASE_REVIEWED"
    | "EMAIL_CONTACT"
    | "IN_PERSON_CONTACT"
    | "NOTICE_DELIVERED"
    | "OTHER_MANUAL_REVIEW"
    | "PAYMENT_COMMITMENT_BROKEN"
    | "PAYMENT_COMMITMENT_CREATED"
    | "PAYMENT_COMMITMENT_UPDATED"
    | "PAYMENT_RECEIVED"
    | "PHONE_CONTACT";
  readonly contactChannel: "EMAIL" | "IN_PERSON" | "NONE" | "OTHER" | "PHONE";
  readonly nextActionAt: string | null;
  readonly occurredAt: string;
  readonly summary: string;
}

export interface PaymentCommitment {
  readonly commitmentId: string;
  readonly notes: string | null;
  readonly promisedAmount: MoneyAmount;
  readonly promisedDate: string;
  readonly status: "BROKEN" | "CANCELLED" | "FULFILLED" | "PENDING";
}

export interface PaymentCommitmentEvaluation {
  readonly appearsBroken: boolean;
  readonly canBeMarkedFulfilled: boolean;
  readonly isPastDue: boolean;
  readonly outstandingCurrent: MoneyAmount;
  readonly promisedAmount: MoneyAmount;
  readonly promisedDate: string;
  readonly qualifyingPaymentsAfterCreated: MoneyAmount;
}

export interface CollectionCaseDetail {
  readonly activeCommitment: PaymentCommitment | null;
  readonly actions: readonly CollectionAction[];
  readonly debtPosition: StudentDebtPosition;
  readonly overdueAccount: OverdueAccountSummary;
  readonly record: CollectionCase;
}

export interface CollectionSummary {
  readonly casesOpen: number;
  readonly overdueAccounts: number;
  readonly totalOverdue: MoneyAmount;
}

export const collectionOperations = Object.freeze([
  "GET_DEBT_POSITION",
  "LIST_OVERDUE",
  "OPEN_CASE",
  "ADD_ACTION",
  "CREATE_COMMITMENT",
  "EVALUATE_COMMITMENT",
  "FULFILL_COMMITMENT",
  "BREAK_COMMITMENT",
  "CANCEL_COMMITMENT",
  "RESOLVE_CASE",
  "CLOSE_CASE",
] as const);

export type CollectionOperation = (typeof collectionOperations)[number];

export const collectionSqlFunctions = Object.freeze({
  GET_DEBT_POSITION: "public.get_student_debt_position",
  LIST_OVERDUE: "public.list_overdue_student_accounts",
  OPEN_CASE: "public.open_collection_case",
  ADD_ACTION: "public.add_collection_action",
  CREATE_COMMITMENT: "public.create_payment_commitment",
  EVALUATE_COMMITMENT: "public.evaluate_payment_commitment",
  FULFILL_COMMITMENT: "public.mark_payment_commitment_fulfilled",
  BREAK_COMMITMENT: "public.mark_payment_commitment_broken",
  CANCEL_COMMITMENT: "public.cancel_payment_commitment",
  RESOLVE_CASE: "public.resolve_collection_case",
  CLOSE_CASE: "public.close_collection_case",
} as const satisfies Readonly<Record<CollectionOperation, string>>);

export const collectionErrorCodes = Object.freeze([
  "AAL2_REQUIRED",
  "APPLICATION_NOT_ALLOWED",
  "COLLECTION_ACTION_SUMMARY_INVALID",
  "COLLECTION_CASE_CLOSE_DENIED",
  "COLLECTION_CASE_INVALID_STATE",
  "COLLECTION_CASE_REQUIRES_OVERDUE_BALANCE",
  "COLLECTION_CASE_REQUIRES_SETTLED_OVERDUE",
  "COLLECTION_COMMITMENT_EVIDENCE_REQUIRED",
  "COLLECTION_COMMITMENT_INVALID_STATE",
  "CONCURRENT_MODIFICATION",
  "FINANCE_OPERATION_FAILED",
  "IDEMPOTENCY_CONFLICT",
  "SESSION_VERSION_INVALID",
  "STUDENT_ACCOUNT_NOT_ACTIVE",
] as const);

export type CollectionErrorCode = (typeof collectionErrorCodes)[number];

export interface CollectionCommand {
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly input?: Readonly<Record<string, boolean | number | string | null>>;
  readonly operation: CollectionOperation;
  readonly sqlFunction: (typeof collectionSqlFunctions)[CollectionOperation];
}

export interface CollectionPersistencePort {
  execute(command: CollectionCommand): Promise<{ entityId: string; status: string }>;
  query<T>(command: CollectionCommand): Promise<T>;
}

export class CollectionError extends Error {
  readonly code: CollectionErrorCode;

  constructor(code: CollectionErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación administrativa de cobranza.", options);
    this.name = "CollectionError";
    this.code = code;
  }
}

function commandFactory(
  operation: Exclude<
    CollectionOperation,
    "GET_DEBT_POSITION" | "LIST_OVERDUE" | "EVALUATE_COMMITMENT"
  >,
) {
  return async (
    port: CollectionPersistencePort,
    input?: Readonly<Record<string, boolean | number | string | null>>,
    idempotencyKey?: string,
    correlationId?: string,
  ) => {
    try {
      return await port.execute({
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(input ? { input } : {}),
        operation,
        sqlFunction: collectionSqlFunctions[operation],
      });
    } catch (error) {
      if (error instanceof CollectionError) throw error;
      throw new CollectionError("FINANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const openCollectionCase = commandFactory("OPEN_CASE");
export const addCollectionAction = commandFactory("ADD_ACTION");
export const createPaymentCommitment = commandFactory("CREATE_COMMITMENT");
export const markPaymentCommitmentFulfilled = commandFactory("FULFILL_COMMITMENT");
export const markPaymentCommitmentBroken = commandFactory("BREAK_COMMITMENT");
export const cancelPaymentCommitment = commandFactory("CANCEL_COMMITMENT");
export const resolveCollectionCase = commandFactory("RESOLVE_CASE");
export const closeCollectionCase = commandFactory("CLOSE_CASE");

export async function getStudentDebtPosition(
  port: CollectionPersistencePort,
  input: Readonly<Record<string, boolean | number | string | null>>,
) {
  try {
    return await port.query<StudentDebtPosition>({
      input,
      operation: "GET_DEBT_POSITION",
      sqlFunction: collectionSqlFunctions.GET_DEBT_POSITION,
    });
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}

export async function listOverdueStudentAccounts(
  port: CollectionPersistencePort,
  input: Readonly<Record<string, boolean | number | string | null>>,
) {
  try {
    return await port.query<readonly OverdueAccountSummary[]>({
      input,
      operation: "LIST_OVERDUE",
      sqlFunction: collectionSqlFunctions.LIST_OVERDUE,
    });
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}

export async function evaluatePaymentCommitment(
  port: CollectionPersistencePort,
  input: Readonly<Record<string, boolean | number | string | null>>,
) {
  try {
    return await port.query<PaymentCommitmentEvaluation>({
      input,
      operation: "EVALUATE_COMMITMENT",
      sqlFunction: collectionSqlFunctions.EVALUATE_COMMITMENT,
    });
  } catch (error) {
    if (error instanceof CollectionError) throw error;
    throw new CollectionError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}
