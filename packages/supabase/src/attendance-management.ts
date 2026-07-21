import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/attendance-management solo puede importarse desde el servidor.",
  );
}

export const attendanceStatuses = Object.freeze([
  "NOT_RECORDED",
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
] as const);
export type AttendanceStatus = (typeof attendanceStatuses)[number];

export const attendanceSessionStatuses = Object.freeze([
  "DRAFT",
  "OPEN",
  "CLOSED",
  "CANCELLED",
  "LOCKED",
] as const);
export type AttendanceSessionStatus = (typeof attendanceSessionStatuses)[number];

export const attendanceManagementErrorCodes = Object.freeze([
  "ATTENDANCE_SESSION_NOT_FOUND",
  "ATTENDANCE_SESSION_ALREADY_EXISTS",
  "ATTENDANCE_SESSION_INVALID_STATE",
  "ATTENDANCE_SESSION_CLOSED",
  "ATTENDANCE_SESSION_LOCKED",
  "ATTENDANCE_ROSTER_ALREADY_POPULATED",
  "STUDENT_NOT_EXPECTED",
  "STUDENT_NOT_ENROLLED",
  "ATTENDANCE_RECORD_NOT_FOUND",
  "ATTENDANCE_ALREADY_RECORDED",
  "INVALID_ATTENDANCE_STATUS",
  "LATENESS_MINUTES_REQUIRED",
  "LATENESS_MINUTES_NOT_ALLOWED",
  "FIRST_PERIOD_MISMATCH",
  "LATENESS_ALREADY_VALIDATED",
  "LATENESS_ALREADY_COUNTED",
  "LATENESS_ALERT_ALREADY_EXISTS",
  "PERMISSION_NOT_FOUND",
  "PERMISSION_INVALID_STATE",
  "PERMISSION_NOT_APPLICABLE",
  "PREFECTURE_ROLE_REQUIRED",
  "CORRECTION_NOT_FOUND",
  "CORRECTION_INVALID_STATE",
  "ATTENDANCE_HISTORY_IMMUTABLE",
  "STUDENT_RECORD_NOT_ACTIVE",
  "PERIOD_NOT_AVAILABLE",
  "CLASS_SESSION_NOT_AVAILABLE",
  "TEACHING_ASSIGNMENT_NOT_ACTIVE",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "ATTENDANCE_OPERATION_FAILED",
] as const);
export type AttendanceManagementErrorCode = (typeof attendanceManagementErrorCodes)[number];

export const attendanceManagementOperations = Object.freeze([
  "CREATE_ATTENDANCE_SESSION",
  "OPEN_ATTENDANCE_SESSION",
  "POPULATE_ATTENDANCE_SESSION_ROSTER",
  "RECORD_STUDENT_ATTENDANCE",
  "RECORD_BULK_ATTENDANCE",
  "CLOSE_ATTENDANCE_SESSION",
  "LOCK_ATTENDANCE_SESSION",
  "CANCEL_ATTENDANCE_SESSION",
  "VALIDATE_STUDENT_LATENESS",
  "MARK_ATTENDANCE_EXCUSED",
  "CREATE_STUDENT_PERMISSION",
  "SUBMIT_STUDENT_PERMISSION",
  "BEGIN_PERMISSION_REVIEW",
  "APPROVE_STUDENT_PERMISSION",
  "REJECT_STUDENT_PERMISSION",
  "APPLY_STUDENT_PERMISSION",
  "CANCEL_STUDENT_PERMISSION",
  "REVOKE_PERMISSION_VALIDATION",
  "CREATE_ATTENDANCE_CORRECTION",
  "SUBMIT_ATTENDANCE_CORRECTION",
  "BEGIN_ATTENDANCE_CORRECTION_REVIEW",
  "APPROVE_ATTENDANCE_CORRECTION",
  "REJECT_ATTENDANCE_CORRECTION",
  "APPLY_ATTENDANCE_CORRECTION",
  "CANCEL_ATTENDANCE_CORRECTION",
  "RECORD_LATENESS_NOTIFICATION",
  "ACKNOWLEDGE_LATENESS_ALERT",
  "CANCEL_LATENESS_ALERT_AFTER_CORRECTION",
] as const);
export type AttendanceManagementOperation = (typeof attendanceManagementOperations)[number];

const sqlName = (operation: string) => `academic.${operation.toLowerCase()}`;
export const attendanceManagementSqlFunctions = Object.freeze(
  Object.fromEntries(
    attendanceManagementOperations.map((operation) => [operation, sqlName(operation)]),
  ) as Readonly<Record<AttendanceManagementOperation, string>>,
);

export interface AttendanceManagementCommand {
  readonly operation: AttendanceManagementOperation;
  readonly sqlFunction: string;
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly input: Readonly<Record<string, boolean | number | string | null>>;
}

export interface AttendanceManagementResult {
  readonly entityId: string;
  readonly operation: AttendanceManagementOperation;
  readonly status: string;
}

export interface AttendanceSessionSummary {
  readonly expectedCount: number;
  readonly recordedCount: number;
  readonly presentCount: number;
  readonly absentCount: number;
  readonly lateCount: number;
  readonly excusedCount: number;
  readonly notRecordedCount: number;
}

export interface StudentLatenessSummary {
  readonly currentCount: number;
  readonly lifetimeCount: number;
  readonly alertSequence: number;
  readonly pendingAlertCount: number;
}

export interface AttendanceManagementPersistencePort {
  execute(command: AttendanceManagementCommand): Promise<AttendanceManagementResult>;
  getSessionSummary(attendanceSessionId: string): Promise<AttendanceSessionSummary>;
  getStudentLatenessSummary(
    studentRecordId: string,
    academicPeriodId: string,
  ): Promise<StudentLatenessSummary>;
}

export class AttendanceManagementError extends Error {
  readonly code: AttendanceManagementErrorCode;

  constructor(code: AttendanceManagementErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de asistencia.", options);
    this.name = "AttendanceManagementError";
    this.code = code;
  }
}

export function validateAttendanceDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new AttendanceManagementError("ATTENDANCE_OPERATION_FAILED");
  }
  return value;
}

export function validateLatenessMinutes(
  status: AttendanceStatus,
  minutes: number | null,
): number | null {
  if (status === "LATE") {
    if (!Number.isSafeInteger(minutes) || minutes === null || minutes <= 0) {
      throw new AttendanceManagementError("LATENESS_MINUTES_REQUIRED");
    }
    return minutes;
  }
  if (minutes !== null) {
    throw new AttendanceManagementError("LATENESS_MINUTES_NOT_ALLOWED");
  }
  return null;
}

type CommandInput = Omit<AttendanceManagementCommand, "operation" | "sqlFunction">;

function command(operation: AttendanceManagementOperation) {
  return async (
    input: CommandInput,
    port: AttendanceManagementPersistencePort,
  ): Promise<AttendanceManagementResult> => {
    try {
      return await port.execute({
        ...input,
        operation,
        sqlFunction: attendanceManagementSqlFunctions[operation],
      });
    } catch (error) {
      if (error instanceof AttendanceManagementError) throw error;
      throw new AttendanceManagementError("ATTENDANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const attendanceManagementCommands = Object.freeze(
  Object.fromEntries(
    attendanceManagementOperations.map((operation) => [operation, command(operation)]),
  ) as Readonly<Record<AttendanceManagementOperation, ReturnType<typeof command>>>,
);
