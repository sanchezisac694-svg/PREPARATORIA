import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/payment-agreements solo puede importarse desde el servidor.",
  );
}

export type MoneyAmount = `${number}.${number}${number}`;

export const paymentAgreementOperations = Object.freeze([
  "CREATE_AGREEMENT",
  "APPROVE_AGREEMENT",
  "RECONCILE_INSTALLMENT",
  "EVALUATE_AGREEMENT",
  "CANCEL_AGREEMENT",
  "MARK_AGREEMENT_DEFAULTED",
] as const);

export type PaymentAgreementOperation = (typeof paymentAgreementOperations)[number];

export const paymentAgreementSqlFunctions = Object.freeze({
  CREATE_AGREEMENT: "public.create_payment_agreement",
  APPROVE_AGREEMENT: "public.approve_payment_agreement",
  RECONCILE_INSTALLMENT: "public.reconcile_payment_agreement_installment",
  EVALUATE_AGREEMENT: "public.evaluate_payment_agreement",
  CANCEL_AGREEMENT: "public.cancel_payment_agreement",
  MARK_AGREEMENT_DEFAULTED: "public.mark_payment_agreement_defaulted",
} as const satisfies Readonly<Record<PaymentAgreementOperation, string>>);

export const paymentAgreementErrorCodes = Object.freeze([
  "AAL2_REQUIRED",
  "ACTOR_NOT_AUTHORIZED",
  "APPLICATION_NOT_ALLOWED",
  "FINANCE_OPERATION_FAILED",
  "HISTORICAL_RECORD_IMMUTABLE",
  "IDEMPOTENCY_CONFLICT",
  "PAYMENT_AGREEMENT_INSTALLMENT_NOT_FOUND",
  "PAYMENT_AGREEMENT_INVALID",
  "PAYMENT_AGREEMENT_INVALID_STATE",
  "SESSION_VERSION_INVALID",
  "STUDENT_ACCOUNT_NOT_ACTIVE",
] as const);

export type PaymentAgreementErrorCode = (typeof paymentAgreementErrorCodes)[number];

export interface PaymentAgreementEvaluation {
  readonly evaluationStatus: "COMPLETED" | "DUE" | "ON_TRACK" | "PAST_DUE";
  readonly installmentsDue: number;
  readonly installmentsPastDue: number;
  readonly nextInstallmentDate: string | null;
  readonly remainingAgreementAmount: MoneyAmount;
  readonly totalFulfilled: MoneyAmount;
  readonly totalScheduled: MoneyAmount;
}

export interface PaymentAgreementCommand {
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly input?: Readonly<Record<string, boolean | number | string | null | readonly string[]>>;
  readonly operation: PaymentAgreementOperation;
  readonly sqlFunction: (typeof paymentAgreementSqlFunctions)[PaymentAgreementOperation];
}

export interface PaymentAgreementPersistencePort {
  execute(command: PaymentAgreementCommand): Promise<{ entityId: string; status: string }>;
  query<T>(command: PaymentAgreementCommand): Promise<T>;
}

export class PaymentAgreementError extends Error {
  readonly code: PaymentAgreementErrorCode;

  constructor(code: PaymentAgreementErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de convenio de pago.", options);
    this.name = "PaymentAgreementError";
    this.code = code;
  }
}

function mutationFactory(operation: Exclude<PaymentAgreementOperation, "EVALUATE_AGREEMENT">) {
  return async (
    port: PaymentAgreementPersistencePort,
    input?: PaymentAgreementCommand["input"],
    idempotencyKey?: string,
    correlationId?: string,
  ) => {
    try {
      return await port.execute({
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(input ? { input } : {}),
        operation,
        sqlFunction: paymentAgreementSqlFunctions[operation],
      });
    } catch (error) {
      if (error instanceof PaymentAgreementError) throw error;
      throw new PaymentAgreementError("FINANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const createPaymentAgreement = mutationFactory("CREATE_AGREEMENT");
export const approvePaymentAgreement = mutationFactory("APPROVE_AGREEMENT");
export const reconcilePaymentAgreementInstallment = mutationFactory("RECONCILE_INSTALLMENT");
export const cancelPaymentAgreement = mutationFactory("CANCEL_AGREEMENT");
export const markPaymentAgreementDefaulted = mutationFactory("MARK_AGREEMENT_DEFAULTED");

export async function evaluatePaymentAgreement(
  port: PaymentAgreementPersistencePort,
  input: PaymentAgreementCommand["input"],
) {
  try {
    return await port.query<PaymentAgreementEvaluation>({
      ...(input ? { input } : {}),
      operation: "EVALUATE_AGREEMENT",
      sqlFunction: paymentAgreementSqlFunctions.EVALUATE_AGREEMENT,
    });
  } catch (error) {
    if (error instanceof PaymentAgreementError) throw error;
    throw new PaymentAgreementError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}
