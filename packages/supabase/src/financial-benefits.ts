import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/financial-benefits solo puede importarse desde el servidor.",
  );
}

export type MoneyAmount = `${number}.${number}${number}`;

export const financialBenefitOperations = Object.freeze([
  "CREATE_SCHOLARSHIP_PROGRAM",
  "SUBMIT_SCHOLARSHIP_PROGRAM",
  "APPROVE_SCHOLARSHIP_PROGRAM",
  "ACTIVATE_SCHOLARSHIP_PROGRAM",
  "ASSIGN_STUDENT_SCHOLARSHIP",
  "SUBMIT_STUDENT_SCHOLARSHIP",
  "APPROVE_STUDENT_SCHOLARSHIP",
  "ACTIVATE_STUDENT_SCHOLARSHIP",
  "REVOKE_STUDENT_SCHOLARSHIP",
  "APPLY_STUDENT_SCHOLARSHIP",
  "APPLY_AUTHORIZED_DISCOUNT",
  "CREATE_AUTHORIZED_WAIVER",
  "APPROVE_AUTHORIZED_WAIVER",
  "APPLY_AUTHORIZED_WAIVER",
  "REVERSE_FINANCIAL_BENEFIT",
] as const);

export type FinancialBenefitOperation = (typeof financialBenefitOperations)[number];

export const financialBenefitSqlFunctions = Object.freeze({
  CREATE_SCHOLARSHIP_PROGRAM: "finance.create_scholarship_program",
  SUBMIT_SCHOLARSHIP_PROGRAM: "finance.submit_scholarship_program",
  APPROVE_SCHOLARSHIP_PROGRAM: "finance.approve_scholarship_program",
  ACTIVATE_SCHOLARSHIP_PROGRAM: "finance.activate_scholarship_program",
  ASSIGN_STUDENT_SCHOLARSHIP: "finance.assign_student_scholarship",
  SUBMIT_STUDENT_SCHOLARSHIP: "finance.submit_student_scholarship",
  APPROVE_STUDENT_SCHOLARSHIP: "finance.approve_student_scholarship",
  ACTIVATE_STUDENT_SCHOLARSHIP: "finance.activate_student_scholarship",
  REVOKE_STUDENT_SCHOLARSHIP: "finance.revoke_student_scholarship",
  APPLY_STUDENT_SCHOLARSHIP: "finance.apply_student_scholarship",
  APPLY_AUTHORIZED_DISCOUNT: "finance.apply_authorized_discount",
  CREATE_AUTHORIZED_WAIVER: "finance.create_authorized_waiver",
  APPROVE_AUTHORIZED_WAIVER: "finance.approve_authorized_waiver",
  APPLY_AUTHORIZED_WAIVER: "finance.apply_authorized_waiver",
  REVERSE_FINANCIAL_BENEFIT: "finance.reverse_financial_benefit",
} as const satisfies Readonly<Record<FinancialBenefitOperation, string>>);

export const financialBenefitErrorCodes = Object.freeze([
  "AAL2_REQUIRED",
  "ACTOR_NOT_AUTHORIZED",
  "APPLICATION_NOT_ALLOWED",
  "ADJUSTMENT_EXCEEDS_BALANCE",
  "ADJUSTMENT_INVALID_STATE",
  "CONCURRENT_MODIFICATION",
  "FINANCE_OPERATION_FAILED",
  "HISTORICAL_RECORD_IMMUTABLE",
  "IDEMPOTENCY_CONFLICT",
  "SCHOLARSHIP_ALREADY_APPLIED",
  "SCHOLARSHIP_PERIOD_NOT_ALLOWED",
  "SCHOLARSHIP_PROGRAM_INVALID_STATE",
  "SESSION_VERSION_INVALID",
  "STUDENT_ACCOUNT_NOT_ACTIVE",
  "STUDENT_SCHOLARSHIP_INVALID_STATE",
] as const);

export type FinancialBenefitErrorCode = (typeof financialBenefitErrorCodes)[number];

export interface FinancialBenefitCommand {
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
  readonly input?: Readonly<Record<string, boolean | number | string | null | readonly string[]>>;
  readonly operation: FinancialBenefitOperation;
  readonly sqlFunction: (typeof financialBenefitSqlFunctions)[FinancialBenefitOperation];
}

export interface FinancialBenefitPersistencePort {
  execute(command: FinancialBenefitCommand): Promise<{ entityId: string; status: string }>;
}

export class FinancialBenefitError extends Error {
  readonly code: FinancialBenefitErrorCode;

  constructor(code: FinancialBenefitErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de beneficio financiero.", options);
    this.name = "FinancialBenefitError";
    this.code = code;
  }
}

function commandFactory(operation: FinancialBenefitOperation) {
  return async (
    port: FinancialBenefitPersistencePort,
    input?: FinancialBenefitCommand["input"],
    idempotencyKey?: string,
    correlationId?: string,
  ) => {
    try {
      return await port.execute({
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(input ? { input } : {}),
        operation,
        sqlFunction: financialBenefitSqlFunctions[operation],
      });
    } catch (error) {
      if (error instanceof FinancialBenefitError) throw error;
      throw new FinancialBenefitError("FINANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const createScholarshipProgram = commandFactory("CREATE_SCHOLARSHIP_PROGRAM");
export const submitScholarshipProgram = commandFactory("SUBMIT_SCHOLARSHIP_PROGRAM");
export const approveScholarshipProgram = commandFactory("APPROVE_SCHOLARSHIP_PROGRAM");
export const activateScholarshipProgram = commandFactory("ACTIVATE_SCHOLARSHIP_PROGRAM");
export const assignStudentScholarship = commandFactory("ASSIGN_STUDENT_SCHOLARSHIP");
export const submitStudentScholarship = commandFactory("SUBMIT_STUDENT_SCHOLARSHIP");
export const approveStudentScholarship = commandFactory("APPROVE_STUDENT_SCHOLARSHIP");
export const activateStudentScholarship = commandFactory("ACTIVATE_STUDENT_SCHOLARSHIP");
export const revokeStudentScholarship = commandFactory("REVOKE_STUDENT_SCHOLARSHIP");
export const applyStudentScholarship = commandFactory("APPLY_STUDENT_SCHOLARSHIP");
export const applyAuthorizedDiscount = commandFactory("APPLY_AUTHORIZED_DISCOUNT");
export const createAuthorizedWaiver = commandFactory("CREATE_AUTHORIZED_WAIVER");
export const approveAuthorizedWaiver = commandFactory("APPROVE_AUTHORIZED_WAIVER");
export const applyAuthorizedWaiver = commandFactory("APPLY_AUTHORIZED_WAIVER");
export const reverseFinancialBenefit = commandFactory("REVERSE_FINANCIAL_BENEFIT");
