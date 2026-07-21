import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/student-enrollment solo puede importarse desde el servidor.",
  );
}

export const studentEnrollmentErrorCodes = Object.freeze([
  "STUDENT_RECORD_NOT_FOUND",
  "STUDENT_RECORD_CONFLICT",
  "STUDENT_RECORD_NOT_ACTIVE",
  "STUDENT_ACCOUNT_NOT_ACTIVE",
  "STUDENT_ROLE_REQUIRED",
  "STUDENT_PERSON_ACCOUNT_MISMATCH",
  "GENERATION_NOT_FOUND",
  "GENERATION_NOT_ACTIVE",
  "STUDY_PLAN_NOT_COMPATIBLE",
  "ENROLLMENT_REQUEST_NOT_FOUND",
  "ENROLLMENT_REQUEST_INVALID_STATE",
  "ENROLLMENT_ALREADY_EXISTS",
  "ACTIVE_ENROLLMENT_EXISTS",
  "ACADEMIC_RESULT_PENDING",
  "PROGRESS_DECISION_REQUIRED",
  "PROGRESS_DECISION_CONFLICT",
  "SEMESTER_ADVANCE_NOT_ALLOWED",
  "SEMESTER_REPEAT_REQUIRED",
  "INVALID_SEMESTER_NUMBER",
  "TRAINING_AREA_REQUIRED",
  "TRAINING_AREA_NOT_ALLOWED",
  "GROUP_NOT_FOUND",
  "GROUP_NOT_AVAILABLE",
  "GROUP_NOT_COMPATIBLE",
  "GROUP_CAPACITY_REACHED",
  "GROUP_ASSIGNMENT_CONFLICT",
  "CURRICULUM_COVERAGE_INCOMPLETE",
  "ACADEMIC_OFFERING_NOT_AVAILABLE",
  "OFFERING_ENROLLMENT_CONFLICT",
  "PERIOD_NOT_AVAILABLE",
  "PERIOD_CLOSING",
  "STUDENT_ON_ACADEMIC_HOLD",
  "STUDENT_TEMPORARILY_WITHDRAWN",
  "STUDENT_PERMANENTLY_WITHDRAWN",
  "HISTORICAL_RECORD_IMMUTABLE",
  "INVALID_STATE_TRANSITION",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "STUDENT_ENROLLMENT_OPERATION_FAILED",
] as const);

export type StudentEnrollmentErrorCode = (typeof studentEnrollmentErrorCodes)[number];

export const studentEnrollmentOperations = Object.freeze([
  "CREATE_STUDENT_GENERATION",
  "ACTIVATE_STUDENT_GENERATION",
  "CLOSE_STUDENT_GENERATION",
  "CREATE_STUDENT_RECORD",
  "ACTIVATE_STUDENT_RECORD",
  "CREATE_ENROLLMENT_REQUEST",
  "SUBMIT_ENROLLMENT_REQUEST",
  "BEGIN_ENROLLMENT_REVIEW",
  "APPROVE_ENROLLMENT_REQUEST",
  "REJECT_ENROLLMENT_REQUEST",
  "CANCEL_ENROLLMENT_REQUEST",
  "EXPIRE_ENROLLMENT_REQUEST",
  "CREATE_PROGRESS_DECISION",
  "CONFIRM_PROGRESS_DECISION",
  "REVERSE_PROGRESS_DECISION",
  "CREATE_PERIOD_ENROLLMENT",
  "ACTIVATE_PERIOD_ENROLLMENT",
  "COMPLETE_PERIOD_ENROLLMENT",
  "CANCEL_PERIOD_ENROLLMENT",
  "WITHDRAW_PERIOD_ENROLLMENT",
  "ASSIGN_STUDENT_GROUP",
  "CHANGE_STUDENT_GROUP",
  "END_STUDENT_GROUP_ASSIGNMENT",
  "ENROLL_STUDENT_IN_GROUP_OFFERINGS",
  "APPLY_TEMPORARY_WITHDRAWAL",
  "REACTIVATE_STUDENT_RECORD",
  "APPLY_ACADEMIC_HOLD",
  "RELEASE_ACADEMIC_HOLD",
  "APPLY_PERMANENT_WITHDRAWAL",
  "COMPLETE_STUDENT_STUDIES",
  "VALIDATE_GROUP_CURRICULUM_COVERAGE",
] as const);

export type StudentEnrollmentOperation = (typeof studentEnrollmentOperations)[number];

export const studentEnrollmentSqlFunctions = Object.freeze({
  CREATE_STUDENT_GENERATION: "academic.create_student_generation",
  ACTIVATE_STUDENT_GENERATION: "academic.activate_student_generation",
  CLOSE_STUDENT_GENERATION: "academic.close_student_generation",
  CREATE_STUDENT_RECORD: "academic.create_student_record",
  ACTIVATE_STUDENT_RECORD: "academic.activate_student_record",
  CREATE_ENROLLMENT_REQUEST: "academic.create_enrollment_request",
  SUBMIT_ENROLLMENT_REQUEST: "academic.submit_enrollment_request",
  BEGIN_ENROLLMENT_REVIEW: "academic.begin_enrollment_review",
  APPROVE_ENROLLMENT_REQUEST: "academic.approve_enrollment_request",
  REJECT_ENROLLMENT_REQUEST: "academic.reject_enrollment_request",
  CANCEL_ENROLLMENT_REQUEST: "academic.cancel_enrollment_request",
  EXPIRE_ENROLLMENT_REQUEST: "academic.expire_enrollment_request",
  CREATE_PROGRESS_DECISION: "academic.create_progress_decision",
  CONFIRM_PROGRESS_DECISION: "academic.confirm_progress_decision",
  REVERSE_PROGRESS_DECISION: "academic.reverse_progress_decision",
  CREATE_PERIOD_ENROLLMENT: "academic.create_period_enrollment",
  ACTIVATE_PERIOD_ENROLLMENT: "academic.activate_period_enrollment",
  COMPLETE_PERIOD_ENROLLMENT: "academic.complete_period_enrollment",
  CANCEL_PERIOD_ENROLLMENT: "academic.cancel_period_enrollment",
  WITHDRAW_PERIOD_ENROLLMENT: "academic.withdraw_period_enrollment",
  ASSIGN_STUDENT_GROUP: "academic.assign_student_group",
  CHANGE_STUDENT_GROUP: "academic.change_student_group",
  END_STUDENT_GROUP_ASSIGNMENT: "academic.end_student_group_assignment",
  ENROLL_STUDENT_IN_GROUP_OFFERINGS: "academic.enroll_student_in_group_offerings",
  APPLY_TEMPORARY_WITHDRAWAL: "academic.apply_temporary_withdrawal",
  REACTIVATE_STUDENT_RECORD: "academic.reactivate_student_record",
  APPLY_ACADEMIC_HOLD: "academic.apply_academic_hold",
  RELEASE_ACADEMIC_HOLD: "academic.release_academic_hold",
  APPLY_PERMANENT_WITHDRAWAL: "academic.apply_permanent_withdrawal",
  COMPLETE_STUDENT_STUDIES: "academic.complete_student_studies",
  VALIDATE_GROUP_CURRICULUM_COVERAGE: "academic.validate_group_curriculum_coverage",
} as const satisfies Readonly<Record<StudentEnrollmentOperation, string>>);

export interface StudentEnrollmentCommand {
  readonly operation: StudentEnrollmentOperation;
  readonly sqlFunction: (typeof studentEnrollmentSqlFunctions)[StudentEnrollmentOperation];
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly input: Readonly<Record<string, boolean | number | string | null>>;
}

export interface StudentEnrollmentResult {
  readonly entityId: string;
  readonly operation: StudentEnrollmentOperation;
  readonly status: string;
}

export interface CurriculumCoverageResult {
  readonly complete: boolean;
  readonly expectedCount: number;
  readonly offeredCount: number;
}

export interface StudentEnrollmentPersistencePort {
  execute(command: StudentEnrollmentCommand): Promise<StudentEnrollmentResult>;
  validateCoverage(groupId: string): Promise<CurriculumCoverageResult>;
}

export class StudentEnrollmentError extends Error {
  readonly code: StudentEnrollmentErrorCode;

  constructor(code: StudentEnrollmentErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de inscripción.", options);
    this.name = "StudentEnrollmentError";
    this.code = code;
  }
}

export function normalizeInstitutionalStudentCode(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(normalized)) {
    throw new StudentEnrollmentError("STUDENT_ENROLLMENT_OPERATION_FAILED");
  }
  return normalized;
}

export function validateStudentSemester(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new StudentEnrollmentError("INVALID_SEMESTER_NUMBER");
  }
  return value;
}

type CommandInput = Omit<StudentEnrollmentCommand, "operation" | "sqlFunction">;

function operation(name: StudentEnrollmentOperation) {
  return async (input: CommandInput, port: StudentEnrollmentPersistencePort) => {
    try {
      return await port.execute({
        ...input,
        operation: name,
        sqlFunction: studentEnrollmentSqlFunctions[name],
      });
    } catch (error) {
      if (error instanceof StudentEnrollmentError) throw error;
      throw new StudentEnrollmentError("STUDENT_ENROLLMENT_OPERATION_FAILED", { cause: error });
    }
  };
}

export const createStudentGeneration = operation("CREATE_STUDENT_GENERATION");
export const activateStudentGeneration = operation("ACTIVATE_STUDENT_GENERATION");
export const closeStudentGeneration = operation("CLOSE_STUDENT_GENERATION");
export const createStudentRecord = operation("CREATE_STUDENT_RECORD");
export const activateStudentRecord = operation("ACTIVATE_STUDENT_RECORD");
export const createEnrollmentRequest = operation("CREATE_ENROLLMENT_REQUEST");
export const submitEnrollmentRequest = operation("SUBMIT_ENROLLMENT_REQUEST");
export const beginEnrollmentReview = operation("BEGIN_ENROLLMENT_REVIEW");
export const approveEnrollmentRequest = operation("APPROVE_ENROLLMENT_REQUEST");
export const rejectEnrollmentRequest = operation("REJECT_ENROLLMENT_REQUEST");
export const cancelEnrollmentRequest = operation("CANCEL_ENROLLMENT_REQUEST");
export const expireEnrollmentRequest = operation("EXPIRE_ENROLLMENT_REQUEST");
export const createProgressDecision = operation("CREATE_PROGRESS_DECISION");
export const confirmProgressDecision = operation("CONFIRM_PROGRESS_DECISION");
export const reverseProgressDecision = operation("REVERSE_PROGRESS_DECISION");
export const createPeriodEnrollment = operation("CREATE_PERIOD_ENROLLMENT");
export const activatePeriodEnrollment = operation("ACTIVATE_PERIOD_ENROLLMENT");
export const completePeriodEnrollment = operation("COMPLETE_PERIOD_ENROLLMENT");
export const cancelPeriodEnrollment = operation("CANCEL_PERIOD_ENROLLMENT");
export const withdrawPeriodEnrollment = operation("WITHDRAW_PERIOD_ENROLLMENT");
export const assignStudentGroup = operation("ASSIGN_STUDENT_GROUP");
export const changeStudentGroup = operation("CHANGE_STUDENT_GROUP");
export const endStudentGroupAssignment = operation("END_STUDENT_GROUP_ASSIGNMENT");
export const enrollStudentInGroupOfferings = operation("ENROLL_STUDENT_IN_GROUP_OFFERINGS");
export const applyTemporaryWithdrawal = operation("APPLY_TEMPORARY_WITHDRAWAL");
export const reactivateStudentRecord = operation("REACTIVATE_STUDENT_RECORD");
export const applyAcademicHold = operation("APPLY_ACADEMIC_HOLD");
export const releaseAcademicHold = operation("RELEASE_ACADEMIC_HOLD");
export const applyPermanentWithdrawal = operation("APPLY_PERMANENT_WITHDRAWAL");
export const completeStudentStudies = operation("COMPLETE_STUDENT_STUDIES");

export async function validateGroupCurriculumCoverage(
  groupId: string,
  port: StudentEnrollmentPersistencePort,
): Promise<CurriculumCoverageResult> {
  try {
    return await port.validateCoverage(groupId);
  } catch (error) {
    throw new StudentEnrollmentError("STUDENT_ENROLLMENT_OPERATION_FAILED", { cause: error });
  }
}
