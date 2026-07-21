import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/academic-scheduling solo puede importarse desde el servidor.",
  );
}

export const academicSchedulingErrorCodes = Object.freeze([
  "SHIFT_NOT_FOUND",
  "SHIFT_INVALID_STATE",
  "SHIFT_TIME_RANGE_INVALID",
  "SPACE_NOT_FOUND",
  "SPACE_NOT_AVAILABLE",
  "SPACE_CAPACITY_INVALID",
  "SPACE_TYPE_NOT_COMPATIBLE",
  "TIME_BLOCK_NOT_FOUND",
  "TIME_BLOCK_CONFLICT",
  "TIME_BLOCK_IS_BREAK",
  "FIRST_PERIOD_CONFLICT",
  "TEMPLATE_NOT_FOUND",
  "TEMPLATE_INVALID_STATE",
  "TEMPLATE_BLOCK_NOT_ALLOWED",
  "TEACHER_AVAILABILITY_CONFLICT",
  "TEACHER_UNAVAILABLE",
  "GROUP_SCHEDULE_NOT_FOUND",
  "GROUP_SCHEDULE_CONFLICT",
  "GROUP_SCHEDULE_INVALID_STATE",
  "CLASS_SESSION_NOT_FOUND",
  "CLASS_SESSION_INVALID_STATE",
  "GROUP_TIME_CONFLICT",
  "TEACHER_TIME_CONFLICT",
  "SPACE_TIME_CONFLICT",
  "OFFERING_NOT_COMPATIBLE",
  "ASSIGNMENT_NOT_COMPATIBLE",
  "ASSIGNMENT_NOT_ACTIVE",
  "PERIOD_NOT_AVAILABLE",
  "PERIOD_CLOSING",
  "GROUP_NOT_AVAILABLE",
  "SCHEDULE_COVERAGE_INCOMPLETE",
  "SCHEDULE_CHANGE_NOT_FOUND",
  "SCHEDULE_CHANGE_INVALID_STATE",
  "PUBLISHED_SCHEDULE_IMMUTABLE",
  "HISTORICAL_RECORD_IMMUTABLE",
  "INVALID_STATE_TRANSITION",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "ACADEMIC_SCHEDULING_OPERATION_FAILED",
] as const);

export type AcademicSchedulingErrorCode = (typeof academicSchedulingErrorCodes)[number];

export const academicSchedulingOperations = Object.freeze([
  "CREATE_ACADEMIC_SHIFT",
  "ACTIVATE_ACADEMIC_SHIFT",
  "DEACTIVATE_ACADEMIC_SHIFT",
  "RETIRE_ACADEMIC_SHIFT",
  "CREATE_ACADEMIC_SPACE",
  "ACTIVATE_ACADEMIC_SPACE",
  "MARK_ACADEMIC_SPACE_MAINTENANCE",
  "DEACTIVATE_ACADEMIC_SPACE",
  "REACTIVATE_ACADEMIC_SPACE",
  "RETIRE_ACADEMIC_SPACE",
  "CREATE_SCHEDULE_TIME_BLOCK",
  "ACTIVATE_SCHEDULE_TIME_BLOCK",
  "DEACTIVATE_SCHEDULE_TIME_BLOCK",
  "CREATE_SCHEDULE_TEMPLATE",
  "ADD_SCHEDULE_TEMPLATE_BLOCK",
  "SUBMIT_SCHEDULE_TEMPLATE",
  "APPROVE_SCHEDULE_TEMPLATE",
  "ACTIVATE_SCHEDULE_TEMPLATE",
  "RETIRE_SCHEDULE_TEMPLATE",
  "DECLARE_TEACHER_AVAILABILITY",
  "CANCEL_TEACHER_AVAILABILITY",
  "CREATE_GROUP_SCHEDULE",
  "SUBMIT_GROUP_SCHEDULE",
  "APPROVE_GROUP_SCHEDULE",
  "PUBLISH_GROUP_SCHEDULE",
  "CLOSE_GROUP_SCHEDULE",
  "CANCEL_GROUP_SCHEDULE",
  "CREATE_CLASS_SESSION",
  "ACTIVATE_CLASS_SESSION",
  "MOVE_CLASS_SESSION",
  "CHANGE_CLASS_SESSION_SPACE",
  "CHANGE_CLASS_SESSION_ASSIGNMENT",
  "CANCEL_CLASS_SESSION",
  "END_CLASS_SESSION",
  "CREATE_SCHEDULE_CHANGE_REQUEST",
  "SUBMIT_SCHEDULE_CHANGE_REQUEST",
  "BEGIN_SCHEDULE_CHANGE_REVIEW",
  "APPROVE_SCHEDULE_CHANGE_REQUEST",
  "REJECT_SCHEDULE_CHANGE_REQUEST",
  "APPLY_SCHEDULE_CHANGE_REQUEST",
  "CANCEL_SCHEDULE_CHANGE_REQUEST",
] as const);

export type AcademicSchedulingOperation = (typeof academicSchedulingOperations)[number];

const snakeCase = (value: string) => value.toLowerCase();

export const academicSchedulingSqlFunctions = Object.freeze(
  Object.fromEntries(
    academicSchedulingOperations.map((name) => [name, `academic.${snakeCase(name)}`]),
  ) as Readonly<Record<AcademicSchedulingOperation, string>>,
);

export interface AcademicSchedulingCommand {
  readonly operation: AcademicSchedulingOperation;
  readonly sqlFunction: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly input: Readonly<Record<string, boolean | number | string | null>>;
}

export interface AcademicSchedulingResult {
  readonly entityId: string;
  readonly operation: AcademicSchedulingOperation;
  readonly status: string;
}

export interface ScheduleCoverageResult {
  readonly valid: boolean;
  readonly missingOfferingCount: number;
  readonly conflictCount: number;
  readonly invalidSessionCount: number;
}

export interface TeacherWorkloadResult {
  readonly offeringCount: number;
  readonly groupCount: number;
  readonly weeklySessionCount: number;
  readonly weeklyMinutes: number;
  readonly distributionByDay: Readonly<Record<string, number>>;
  readonly conflictCount: number;
  readonly activeSessionCount: number;
  readonly plannedSessionCount: number;
}

export interface AcademicSchedulingPersistencePort {
  execute(command: AcademicSchedulingCommand): Promise<AcademicSchedulingResult>;
  validateCoverage(groupScheduleId: string): Promise<ScheduleCoverageResult>;
  getTeacherWorkload(
    teacherAccountId: string,
    academicPeriodId: string,
  ): Promise<TeacherWorkloadResult>;
}

export class AcademicSchedulingError extends Error {
  readonly code: AcademicSchedulingErrorCode;

  constructor(code: AcademicSchedulingErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de horario.", options);
    this.name = "AcademicSchedulingError";
    this.code = code;
  }
}

export function normalizeScheduleCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalized)) {
    throw new AcademicSchedulingError("ACADEMIC_SCHEDULING_OPERATION_FAILED");
  }
  return normalized;
}

export function validateIsoWeekday(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new AcademicSchedulingError("TEMPLATE_BLOCK_NOT_ALLOWED");
  }
  return value;
}

export function validateTimeValue(value: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) {
    throw new AcademicSchedulingError("SHIFT_TIME_RANGE_INVALID");
  }
  return value;
}

type CommandInput = Omit<AcademicSchedulingCommand, "operation" | "sqlFunction">;

function operation(name: AcademicSchedulingOperation) {
  return async (
    input: CommandInput,
    port: AcademicSchedulingPersistencePort,
  ): Promise<AcademicSchedulingResult> => {
    try {
      return await port.execute({
        ...input,
        operation: name,
        sqlFunction: academicSchedulingSqlFunctions[name],
      });
    } catch (error) {
      if (error instanceof AcademicSchedulingError) throw error;
      throw new AcademicSchedulingError("ACADEMIC_SCHEDULING_OPERATION_FAILED", { cause: error });
    }
  };
}

export const academicSchedulingCommands = Object.freeze(
  Object.fromEntries(
    academicSchedulingOperations.map((name) => [name, operation(name)]),
  ) as Readonly<Record<AcademicSchedulingOperation, ReturnType<typeof operation>>>,
);

export async function validateGroupScheduleCoverage(
  groupScheduleId: string,
  port: AcademicSchedulingPersistencePort,
): Promise<ScheduleCoverageResult> {
  try {
    return await port.validateCoverage(groupScheduleId);
  } catch (error) {
    throw new AcademicSchedulingError("ACADEMIC_SCHEDULING_OPERATION_FAILED", { cause: error });
  }
}

export async function getTeacherWorkloadSummary(
  teacherAccountId: string,
  academicPeriodId: string,
  port: AcademicSchedulingPersistencePort,
): Promise<TeacherWorkloadResult> {
  try {
    return await port.getTeacherWorkload(teacherAccountId, academicPeriodId);
  } catch (error) {
    throw new AcademicSchedulingError("ACADEMIC_SCHEDULING_OPERATION_FAILED", { cause: error });
  }
}
