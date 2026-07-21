import "server-only";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/grade-management solo puede importarse desde servidor.");
}

export const gradeWindowStatuses = Object.freeze(["DRAFT", "OPEN", "CLOSED", "CANCELLED"] as const);
export const unitGradeStatuses = Object.freeze([
  "DRAFT",
  "CAPTURED",
  "REVIEWED",
  "FINALIZED",
  "CORRECTED",
  "CANCELLED",
] as const);
export const subjectResultCodes = Object.freeze(["AC", "NA", "PENDING"] as const);
export const gradeCalculationStatuses = Object.freeze([
  "COMPLETE",
  "INCOMPLETE",
  "MANUAL_REVIEW_REQUIRED",
] as const);
export type SubjectResultCode = (typeof subjectResultCodes)[number];

export const gradeManagementOperations = Object.freeze([
  "CREATE_GRADE_CAPTURE_WINDOW",
  "OPEN_GRADE_CAPTURE_WINDOW",
  "CLOSE_GRADE_CAPTURE_WINDOW",
  "CANCEL_GRADE_CAPTURE_WINDOW",
  "CAPTURE_STUDENT_UNIT_GRADE",
  "CAPTURE_BULK_UNIT_GRADES",
  "REVIEW_STUDENT_UNIT_GRADE",
  "FINALIZE_STUDENT_UNIT_GRADE",
  "CANCEL_STUDENT_UNIT_GRADE",
  "CALCULATE_SUBJECT_FINAL_RESULT",
  "CONFIRM_SUBJECT_FINAL_RESULT",
  "CALCULATE_SEMESTER_EVALUATION_SUMMARY",
  "CONFIRM_SEMESTER_PROGRESS_DECISION",
  "CREATE_GRADE_CORRECTION",
  "SUBMIT_GRADE_CORRECTION",
  "BEGIN_GRADE_CORRECTION_REVIEW",
  "APPROVE_GRADE_CORRECTION",
  "REJECT_GRADE_CORRECTION",
  "APPLY_GRADE_CORRECTION",
  "CANCEL_GRADE_CORRECTION",
] as const);
export type GradeManagementOperation = (typeof gradeManagementOperations)[number];

export const gradeManagementErrorCodes = Object.freeze([
  "GRADE_WINDOW_NOT_FOUND",
  "GRADE_WINDOW_NOT_OPEN",
  "GRADE_WINDOW_INVALID_STATE",
  "UNIT_GRADE_NOT_FOUND",
  "UNIT_GRADE_ALREADY_EXISTS",
  "UNIT_GRADE_INVALID_STATE",
  "INVALID_GRADE_VALUE",
  "SUBJECT_UNIT_NOT_COMPATIBLE",
  "STUDENT_NOT_ENROLLED",
  "OFFERING_NOT_COMPATIBLE",
  "TEACHER_ASSIGNMENT_NOT_ACTIVE",
  "TEACHER_NOT_AUTHORIZED",
  "THREE_UNITS_REQUIRED",
  "UNIT_GRADES_INCOMPLETE",
  "SUBJECT_RESULT_NOT_FOUND",
  "SUBJECT_RESULT_INCOMPLETE",
  "SUBJECT_RESULT_INVALID_STATE",
  "SEMESTER_EVALUATION_INCOMPLETE",
  "PROGRESS_RULE_PENDING",
  "PROGRESS_DECISION_REQUIRES_REVIEW",
  "GRADE_CORRECTION_NOT_FOUND",
  "GRADE_CORRECTION_INVALID_STATE",
  "HISTORICAL_GRADE_IMMUTABLE",
  "PERIOD_NOT_AVAILABLE",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "GRADE_MANAGEMENT_OPERATION_FAILED",
] as const);
export type GradeManagementErrorCode = (typeof gradeManagementErrorCodes)[number];

export type GradeManagementScalar = string | number | boolean | null;
export interface GradeManagementInput {
  readonly [key: string]: GradeManagementScalar | readonly GradeManagementInput[];
}

export interface GradeManagementCommand {
  readonly operation: GradeManagementOperation;
  readonly sqlFunction: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly input: GradeManagementInput;
}
export interface GradeManagementResult {
  readonly entityId: string;
  readonly status: string;
}
export interface GradeManagementPort {
  execute(command: GradeManagementCommand): Promise<GradeManagementResult>;
}

export class GradeManagementError extends Error {
  readonly code: GradeManagementErrorCode;
  constructor(code: GradeManagementErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de calificaciones.", options);
    this.name = "GradeManagementError";
    this.code = code;
  }
}

export function validateGradeDecimal(value: string): string {
  if (!/^(?:10(?:\.0{1,3})?|\d(?:\.\d{1,3})?)$/.test(value))
    throw new GradeManagementError("INVALID_GRADE_VALUE");
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 10)
    throw new GradeManagementError("INVALID_GRADE_VALUE");
  return value;
}

const sqlFunctions = Object.freeze(
  Object.fromEntries(
    gradeManagementOperations.map((operation) => [
      operation,
      `academic.${operation.toLowerCase()}`,
    ]),
  ) as Readonly<Record<GradeManagementOperation, string>>,
);
export const gradeManagementCommands = Object.freeze(
  Object.fromEntries(
    gradeManagementOperations.map((operation) => [
      operation,
      async (
        input: Omit<GradeManagementCommand, "operation" | "sqlFunction">,
        port: GradeManagementPort,
      ) => {
        try {
          return await port.execute({ ...input, operation, sqlFunction: sqlFunctions[operation] });
        } catch (error) {
          if (error instanceof GradeManagementError) throw error;
          throw new GradeManagementError("GRADE_MANAGEMENT_OPERATION_FAILED", { cause: error });
        }
      },
    ]),
  ) as Readonly<
    Record<
      GradeManagementOperation,
      (
        input: Omit<GradeManagementCommand, "operation" | "sqlFunction">,
        port: GradeManagementPort,
      ) => Promise<GradeManagementResult>
    >
  >,
);
