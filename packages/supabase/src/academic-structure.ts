import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/academic-structure solo puede importarse desde el servidor.",
  );
}

export const academicStructureErrorCodes = Object.freeze([
  "ACADEMIC_CYCLE_NOT_FOUND",
  "ACADEMIC_CYCLE_INVALID_STATE",
  "ACADEMIC_CYCLE_DATE_CONFLICT",
  "ACADEMIC_PERIOD_NOT_FOUND",
  "ACADEMIC_PERIOD_DATE_CONFLICT",
  "ACADEMIC_PERIOD_HAS_OPEN_OFFERINGS",
  "STUDY_PLAN_NOT_FOUND",
  "STUDY_PLAN_INVALID_STATE",
  "STUDY_PLAN_IMMUTABLE",
  "INVALID_SEMESTER_NUMBER",
  "TRAINING_AREA_NOT_FOUND",
  "TRAINING_AREA_NOT_ALLOWED",
  "SUBJECT_NOT_FOUND",
  "SUBJECT_CODE_CONFLICT",
  "SUBJECT_TYPE_AREA_MISMATCH",
  "CURRICULUM_SUBJECT_CONFLICT",
  "SUBJECT_UNITS_INCOMPLETE",
  "GROUP_NOT_FOUND",
  "GROUP_CODE_CONFLICT",
  "GROUP_AREA_MISMATCH",
  "GROUP_INVALID_STATE",
  "ACADEMIC_OFFERING_CONFLICT",
  "ACADEMIC_OFFERING_PLAN_MISMATCH",
  "TEACHER_NOT_FOUND",
  "TEACHER_ROLE_REQUIRED",
  "PRIMARY_TEACHER_CONFLICT",
  "INVALID_DATE_RANGE",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "HISTORICAL_RECORD_IMMUTABLE",
  "ACADEMIC_STRUCTURE_OPERATION_FAILED",
] as const);

export type AcademicStructureErrorCode = (typeof academicStructureErrorCodes)[number];

export const academicStructureOperations = Object.freeze([
  "CREATE_SCHOOL_CYCLE",
  "PLAN_SCHOOL_CYCLE",
  "ACTIVATE_SCHOOL_CYCLE",
  "BEGIN_SCHOOL_CYCLE_CLOSING",
  "CLOSE_SCHOOL_CYCLE",
  "CANCEL_SCHOOL_CYCLE",
  "CREATE_ACADEMIC_PERIOD",
  "PLAN_ACADEMIC_PERIOD",
  "ACTIVATE_ACADEMIC_PERIOD",
  "BEGIN_ACADEMIC_PERIOD_CLOSING",
  "CLOSE_ACADEMIC_PERIOD",
  "CANCEL_ACADEMIC_PERIOD",
  "CREATE_STUDY_PLAN",
  "SUBMIT_STUDY_PLAN_FOR_REVIEW",
  "APPROVE_STUDY_PLAN",
  "ACTIVATE_STUDY_PLAN",
  "RETIRE_STUDY_PLAN",
  "CANCEL_STUDY_PLAN",
  "CREATE_SUBJECT",
  "DEACTIVATE_SUBJECT",
  "ADD_SUBJECT_TO_STUDY_PLAN",
  "CREATE_SUBJECT_UNITS",
  "CREATE_GROUP",
  "PLAN_GROUP",
  "OPEN_GROUP",
  "ACTIVATE_GROUP",
  "CLOSE_GROUP",
  "CANCEL_GROUP",
  "CREATE_ACADEMIC_OFFERING",
  "PLAN_ACADEMIC_OFFERING",
  "ACTIVATE_ACADEMIC_OFFERING",
  "CLOSE_ACADEMIC_OFFERING",
  "CANCEL_ACADEMIC_OFFERING",
  "ASSIGN_TEACHER",
  "ACTIVATE_TEACHING_ASSIGNMENT",
  "END_TEACHING_ASSIGNMENT",
  "CANCEL_TEACHING_ASSIGNMENT",
  "GET_ACADEMIC_STRUCTURE_SUMMARY",
] as const);

export type AcademicStructureOperation = (typeof academicStructureOperations)[number];

export const academicSqlFunctions = Object.freeze({
  CREATE_SCHOOL_CYCLE: "academic.create_school_cycle",
  PLAN_SCHOOL_CYCLE: "academic.plan_school_cycle",
  ACTIVATE_SCHOOL_CYCLE: "academic.activate_school_cycle",
  BEGIN_SCHOOL_CYCLE_CLOSING: "academic.begin_school_cycle_closing",
  CLOSE_SCHOOL_CYCLE: "academic.close_school_cycle",
  CANCEL_SCHOOL_CYCLE: "academic.cancel_school_cycle",
  CREATE_ACADEMIC_PERIOD: "academic.create_academic_period",
  PLAN_ACADEMIC_PERIOD: "academic.plan_academic_period",
  ACTIVATE_ACADEMIC_PERIOD: "academic.activate_academic_period",
  BEGIN_ACADEMIC_PERIOD_CLOSING: "academic.begin_academic_period_closing",
  CLOSE_ACADEMIC_PERIOD: "academic.close_academic_period",
  CANCEL_ACADEMIC_PERIOD: "academic.cancel_academic_period",
  CREATE_STUDY_PLAN: "academic.create_study_plan",
  SUBMIT_STUDY_PLAN_FOR_REVIEW: "academic.submit_study_plan_for_review",
  APPROVE_STUDY_PLAN: "academic.approve_study_plan",
  ACTIVATE_STUDY_PLAN: "academic.activate_study_plan",
  RETIRE_STUDY_PLAN: "academic.retire_study_plan",
  CANCEL_STUDY_PLAN: "academic.cancel_study_plan",
  CREATE_SUBJECT: "academic.create_subject",
  DEACTIVATE_SUBJECT: "academic.deactivate_subject",
  ADD_SUBJECT_TO_STUDY_PLAN: "academic.add_subject_to_study_plan",
  CREATE_SUBJECT_UNITS: "academic.create_subject_units",
  CREATE_GROUP: "academic.create_group",
  PLAN_GROUP: "academic.plan_group",
  OPEN_GROUP: "academic.open_group",
  ACTIVATE_GROUP: "academic.activate_group",
  CLOSE_GROUP: "academic.close_group",
  CANCEL_GROUP: "academic.cancel_group",
  CREATE_ACADEMIC_OFFERING: "academic.create_academic_offering",
  PLAN_ACADEMIC_OFFERING: "academic.plan_academic_offering",
  ACTIVATE_ACADEMIC_OFFERING: "academic.activate_academic_offering",
  CLOSE_ACADEMIC_OFFERING: "academic.close_academic_offering",
  CANCEL_ACADEMIC_OFFERING: "academic.cancel_academic_offering",
  ASSIGN_TEACHER: "academic.assign_teacher",
  ACTIVATE_TEACHING_ASSIGNMENT: "academic.activate_teaching_assignment",
  END_TEACHING_ASSIGNMENT: "academic.end_teaching_assignment",
  CANCEL_TEACHING_ASSIGNMENT: "academic.cancel_teaching_assignment",
  GET_ACADEMIC_STRUCTURE_SUMMARY: "academic.get_academic_structure_summary",
} as const satisfies Readonly<Record<AcademicStructureOperation, string>>);

export interface AcademicStructureCommand {
  readonly operation: AcademicStructureOperation;
  readonly sqlFunction: (typeof academicSqlFunctions)[AcademicStructureOperation];
  readonly idempotencyKey: string;
  readonly correlationId?: string;
  readonly input: Readonly<Record<string, boolean | number | string | null>>;
}

export interface AcademicStructureResult {
  readonly entityId: string;
  readonly operation: AcademicStructureOperation;
  readonly status: string;
}

export interface AcademicStructureSummary {
  readonly activeCycleCount: number;
  readonly activePeriodCount: number;
  readonly activePlanCount: number;
  readonly activeGroupCount: number;
}

export interface AcademicStructurePersistencePort {
  execute(command: AcademicStructureCommand): Promise<AcademicStructureResult>;
  summary(): Promise<AcademicStructureSummary>;
}

export class AcademicStructureError extends Error {
  readonly code: AcademicStructureErrorCode;

  constructor(code: AcademicStructureErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación académica.", options);
    this.name = "AcademicStructureError";
    this.code = code;
  }
}

export function normalizeAcademicCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(normalized)) {
    throw new AcademicStructureError("ACADEMIC_STRUCTURE_OPERATION_FAILED");
  }
  return normalized;
}

export function validateSemesterNumber(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new AcademicStructureError("INVALID_SEMESTER_NUMBER");
  }
  return value;
}

async function execute(
  port: AcademicStructurePersistencePort,
  command: AcademicStructureCommand,
): Promise<AcademicStructureResult> {
  try {
    return await port.execute(command);
  } catch (error) {
    if (error instanceof AcademicStructureError) throw error;
    throw new AcademicStructureError("ACADEMIC_STRUCTURE_OPERATION_FAILED", { cause: error });
  }
}

type CommandInput = Omit<AcademicStructureCommand, "operation" | "sqlFunction">;

function operation(name: AcademicStructureOperation) {
  return (input: CommandInput, port: AcademicStructurePersistencePort) =>
    execute(port, { ...input, operation: name, sqlFunction: academicSqlFunctions[name] });
}

export const createSchoolCycle = operation("CREATE_SCHOOL_CYCLE");
export const planSchoolCycle = operation("PLAN_SCHOOL_CYCLE");
export const activateSchoolCycle = operation("ACTIVATE_SCHOOL_CYCLE");
export const beginSchoolCycleClosing = operation("BEGIN_SCHOOL_CYCLE_CLOSING");
export const closeSchoolCycle = operation("CLOSE_SCHOOL_CYCLE");
export const cancelSchoolCycle = operation("CANCEL_SCHOOL_CYCLE");
export const createAcademicPeriod = operation("CREATE_ACADEMIC_PERIOD");
export const planAcademicPeriod = operation("PLAN_ACADEMIC_PERIOD");
export const activateAcademicPeriod = operation("ACTIVATE_ACADEMIC_PERIOD");
export const beginAcademicPeriodClosing = operation("BEGIN_ACADEMIC_PERIOD_CLOSING");
export const closeAcademicPeriod = operation("CLOSE_ACADEMIC_PERIOD");
export const cancelAcademicPeriod = operation("CANCEL_ACADEMIC_PERIOD");
export const createStudyPlan = operation("CREATE_STUDY_PLAN");
export const submitStudyPlanForReview = operation("SUBMIT_STUDY_PLAN_FOR_REVIEW");
export const approveStudyPlan = operation("APPROVE_STUDY_PLAN");
export const activateStudyPlan = operation("ACTIVATE_STUDY_PLAN");
export const retireStudyPlan = operation("RETIRE_STUDY_PLAN");
export const cancelStudyPlan = operation("CANCEL_STUDY_PLAN");
export const createSubject = operation("CREATE_SUBJECT");
export const deactivateSubject = operation("DEACTIVATE_SUBJECT");
export const addSubjectToStudyPlan = operation("ADD_SUBJECT_TO_STUDY_PLAN");
export const createSubjectUnits = operation("CREATE_SUBJECT_UNITS");
export const createGroup = operation("CREATE_GROUP");
export const planGroup = operation("PLAN_GROUP");
export const openGroup = operation("OPEN_GROUP");
export const activateGroup = operation("ACTIVATE_GROUP");
export const closeGroup = operation("CLOSE_GROUP");
export const cancelGroup = operation("CANCEL_GROUP");
export const createAcademicOffering = operation("CREATE_ACADEMIC_OFFERING");
export const planAcademicOffering = operation("PLAN_ACADEMIC_OFFERING");
export const activateAcademicOffering = operation("ACTIVATE_ACADEMIC_OFFERING");
export const closeAcademicOffering = operation("CLOSE_ACADEMIC_OFFERING");
export const cancelAcademicOffering = operation("CANCEL_ACADEMIC_OFFERING");
export const assignTeacher = operation("ASSIGN_TEACHER");
export const activateTeachingAssignment = operation("ACTIVATE_TEACHING_ASSIGNMENT");
export const endTeachingAssignment = operation("END_TEACHING_ASSIGNMENT");
export const cancelTeachingAssignment = operation("CANCEL_TEACHING_ASSIGNMENT");

export async function getAcademicStructureSummary(
  port: AcademicStructurePersistencePort,
): Promise<AcademicStructureSummary> {
  try {
    return await port.summary();
  } catch (error) {
    throw new AcademicStructureError("ACADEMIC_STRUCTURE_OPERATION_FAILED", { cause: error });
  }
}
