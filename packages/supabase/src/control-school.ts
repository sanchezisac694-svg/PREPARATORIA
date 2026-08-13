import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/control-school solo puede importarse desde el servidor.");
}

export const controlSchoolRpcNames = Object.freeze([
  "list_control_school_students",
  "get_control_school_student_detail",
  "list_control_school_groups",
  "get_control_school_group_detail",
  "get_control_school_group_schedule",
  "get_control_school_structure",
  "list_control_school_enrollments",
  "get_control_school_student_trajectory",
] as const);

export type ControlSchoolRpcName = (typeof controlSchoolRpcNames)[number];

export class ControlSchoolError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible obtener la información administrativa de control escolar.", options);
    this.name = "ControlSchoolError";
    this.code = code;
  }
}

export interface ControlSchoolPage<T> {
  readonly offset: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly totalRows: number;
}

export interface ControlSchoolReference {
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

export interface ControlSchoolStudentRow {
  readonly academicPeriod: ControlSchoolReference | null;
  readonly enrollmentStatus: string | null;
  readonly group: ControlSchoolReference | null;
  readonly semesterNumber: number | null;
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly studentRecordId: string;
  readonly studentStatus: string;
  readonly trainingArea: ControlSchoolReference | null;
}

export interface ControlSchoolStudentIdentity {
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly studentRecordId: string;
  readonly studentStatus: string;
}

export interface ControlSchoolStudentDetail {
  readonly currentEnrollment: {
    readonly cancelledAt: string | null;
    readonly completedAt: string | null;
    readonly enrolledAt: string | null;
    readonly enrollmentNumber: string | null;
    readonly periodEnrollmentId: string;
    readonly status: string;
  } | null;
  readonly currentSituation: {
    readonly academicPeriod: ControlSchoolReference | null;
    readonly generation: ControlSchoolReference & { readonly generationId: string };
    readonly group: ControlSchoolReference | null;
    readonly semesterNumber: number | null;
    readonly studyPlan: ControlSchoolReference & {
      readonly studyPlanId: string;
      readonly version: string | null;
    };
    readonly trainingArea: ControlSchoolReference | null;
  };
  readonly identity: ControlSchoolStudentIdentity;
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly studentRecordId: string;
  readonly studentStatus: string;
  readonly timeline: {
    readonly activatedAt: string | null;
    readonly graduatedAt: string | null;
    readonly withdrawnAt: string | null;
  };
}

export interface ControlSchoolGroupRow {
  readonly academicPeriod: ControlSchoolReference;
  readonly code: string;
  readonly groupId: string;
  readonly name: string;
  readonly semesterNumber: number;
  readonly status: string;
  readonly studentCount: number;
  readonly trainingArea: ControlSchoolReference | null;
}

export interface ControlSchoolGroupDetail {
  readonly group: ControlSchoolGroupRow;
  readonly students: ReadonlyArray<{
    readonly enrollmentStatus: string;
    readonly semesterNumber: number | null;
    readonly studentDisplayName: string | null;
    readonly studentIdentifier: string;
    readonly studentRecordId: string;
  }>;
  readonly subjects: ReadonlyArray<{
    readonly academicOfferingId: string;
    readonly subjectCode: string;
    readonly subjectId: string;
    readonly subjectName: string;
    readonly weeklyHours: string | null;
  }>;
  readonly teachers: ReadonlyArray<{
    readonly assignmentStatus: string;
    readonly assignmentType: string;
    readonly teacherDisplayName: string | null;
    readonly teacherIdentifier: string | null;
    readonly teachingAssignmentId: string;
  }>;
}

export interface ControlSchoolGroupScheduleRow {
  readonly classSessionId: string;
  readonly endsAt: string;
  readonly group: ControlSchoolReference & { readonly groupId: string };
  readonly scheduleStatus: string;
  readonly spaceCode: string | null;
  readonly spaceName: string | null;
  readonly startsAt: string;
  readonly subjectCode: string;
  readonly subjectName: string;
  readonly teacherDisplayName: string | null;
  readonly teacherIdentifier: string | null;
  readonly timeBlockName: string;
  readonly weekday: number;
}

export interface ControlSchoolGroupSchedule {
  readonly academicPeriodId: string;
  readonly groupId: string;
  readonly rows: readonly ControlSchoolGroupScheduleRow[];
}

export interface ControlSchoolStructureOverview {
  readonly cycles: ReadonlyArray<{
    readonly code: string;
    readonly endsOn: string;
    readonly name: string;
    readonly schoolCycleId: string;
    readonly startsOn: string;
    readonly status: string;
  }>;
  readonly groups: ReadonlyArray<{
    readonly academicPeriodId: string;
    readonly code: string;
    readonly groupId: string;
    readonly name: string;
    readonly semesterNumber: number;
    readonly status: string;
    readonly studyPlanId: string;
    readonly trainingAreaId: string | null;
  }>;
  readonly periods: ReadonlyArray<{
    readonly academicPeriodId: string;
    readonly code: string;
    readonly endsOn: string;
    readonly name: string;
    readonly schoolCycleId: string;
    readonly sequenceNumber: number;
    readonly startsOn: string;
    readonly status: string;
  }>;
  readonly planSemesters: ReadonlyArray<{
    readonly name: string;
    readonly planSemesterId: string;
    readonly semesterNumber: number;
    readonly specializationRequired: boolean;
    readonly studyPlanId: string;
  }>;
  readonly studyPlans: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly status: string;
    readonly studyPlanId: string;
    readonly totalSemesters: number;
    readonly validFrom: string;
    readonly validTo: string | null;
    readonly version: string | null;
  }>;
  readonly subjects: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly shortName: string | null;
    readonly status: string;
    readonly subjectId: string;
    readonly subjectType: string;
  }>;
  readonly trainingAreas: ReadonlyArray<{
    readonly code: string;
    readonly name: string;
    readonly startsAtSemester: number;
    readonly status: string;
    readonly trainingAreaId: string;
  }>;
}

export interface ControlSchoolEnrollmentRow {
  readonly academicPeriod: ControlSchoolReference;
  readonly cancelledAt: string | null;
  readonly completedAt: string | null;
  readonly enrolledAt: string | null;
  readonly enrollmentNumber: string | null;
  readonly group: ControlSchoolReference | null;
  readonly periodEnrollmentId: string;
  readonly semesterNumber: number;
  readonly status: string;
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly studentRecordId: string;
}

export interface ControlSchoolStudentTrajectory {
  readonly periods: ReadonlyArray<{
    readonly academicPeriodCode: string;
    readonly academicPeriodId: string;
    readonly academicPeriodName: string;
    readonly enrollmentStatus: string;
    readonly endsOn: string;
    readonly group: ControlSchoolReference | null;
    readonly periodEnrollmentId: string;
    readonly semesterNumber: number;
    readonly startsOn: string;
    readonly trainingArea: ControlSchoolReference | null;
  }>;
  readonly progressDecisions: ReadonlyArray<{
    readonly decisionId: string;
    readonly decisionStatus: string;
    readonly decisionType: string;
    readonly decidedAt: string | null;
    readonly resultingSemesterNumber: number;
    readonly resultingTrainingArea: ControlSchoolReference | null;
    readonly reversedAt: string | null;
    readonly sourceAcademicPeriodCode: string;
    readonly sourceAcademicPeriodId: string;
    readonly sourceAcademicPeriodName: string;
  }>;
  readonly studentRecordId: string;
}

export interface ControlSchoolStudentFilters {
  readonly academicPeriodId?: string | null;
  readonly groupId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly searchText?: string | null;
  readonly semesterNumber?: number | null;
  readonly studentStatus?: string | null;
}

export interface ControlSchoolGroupFilters {
  readonly academicPeriodId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly semesterNumber?: number | null;
  readonly status?: string | null;
  readonly trainingAreaId?: string | null;
}

export interface ControlSchoolEnrollmentFilters {
  readonly academicPeriodId?: string | null;
  readonly groupId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly searchText?: string | null;
  readonly semesterNumber?: number | null;
  readonly status?: string | null;
}

export interface ControlSchoolStructureFilters {
  readonly academicPeriodId?: string | null;
  readonly studyPlanId?: string | null;
}

interface ControlSchoolSdk {
  rpc(
    name: ControlSchoolRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type ControlSchoolClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => ControlSchoolSdk;

function parseRpcError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    if ("code" in error && typeof error.code === "string" && error.code.length > 0) {
      return error.code;
    }
  }
  return "CONTROL_SCHOOL_OPERATION_FAILED";
}

function expectObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ControlSchoolError("CONTROL_SCHOOL_RESPONSE_INVALID");
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new ControlSchoolError("CONTROL_SCHOOL_RESPONSE_INVALID");
  }
  return value.map(expectObject);
}

function asString(value: unknown, required = true): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (!required && (value === null || value === undefined || value === "")) return null;
  if (!required && typeof value !== "string") return null;
  throw new ControlSchoolError("CONTROL_SCHOOL_RESPONSE_INVALID");
}

function asNumber(value: unknown, required = true): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!required && (value === null || value === undefined)) return null;
  throw new ControlSchoolError("CONTROL_SCHOOL_RESPONSE_INVALID");
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new ControlSchoolError("CONTROL_SCHOOL_RESPONSE_INVALID");
}

function parseReference(
  value: unknown,
  keys: { code?: string; id: string; name?: string } = { code: "code", id: "id", name: "name" },
): ControlSchoolReference | null {
  if (value === null || value === undefined) return null;
  const object = expectObject(value);
  return {
    code: asString(object[keys.code ?? "code"]) ?? "",
    id: asString(object[keys.id]) ?? "",
    name: asString(object[keys.name ?? "name"]) ?? "",
  };
}

function parsePage<T>(
  value: unknown,
  mapper: (row: Record<string, unknown>) => T,
): ControlSchoolPage<T> {
  const object = expectObject(value);
  return {
    offset: asNumber(object.offset) ?? 0,
    pageSize: asNumber(object.pageSize) ?? 0,
    rows: expectArray(object.rows).map(mapper),
    totalRows: asNumber(object.totalRows) ?? 0,
  };
}

function studentRow(row: Record<string, unknown>): ControlSchoolStudentRow {
  return {
    academicPeriod: parseReference(row.academicPeriod, {
      code: "code",
      id: "academicPeriodId",
      name: "name",
    }),
    enrollmentStatus: asString(row.enrollmentStatus, false),
    group: parseReference(row.group, { code: "code", id: "groupId", name: "name" }),
    semesterNumber: asNumber(row.semesterNumber, false),
    studentDisplayName: asString(row.studentDisplayName, false),
    studentIdentifier: asString(row.studentIdentifier) ?? "",
    studentRecordId: asString(row.studentRecordId) ?? "",
    studentStatus: asString(row.studentStatus) ?? "",
    trainingArea: parseReference(row.trainingArea, {
      code: "code",
      id: "trainingAreaId",
      name: "name",
    }),
  };
}

function groupRow(row: Record<string, unknown>): ControlSchoolGroupRow {
  return {
    academicPeriod: parseReference(row.academicPeriod, {
      code: "code",
      id: "academicPeriodId",
      name: "name",
    })!,
    code: asString(row.code) ?? "",
    groupId: asString(row.groupId) ?? "",
    name: asString(row.name) ?? "",
    semesterNumber: asNumber(row.semesterNumber) ?? 0,
    status: asString(row.status) ?? "",
    studentCount: asNumber(row.studentCount) ?? 0,
    trainingArea: parseReference(row.trainingArea, {
      code: "code",
      id: "trainingAreaId",
      name: "name",
    }),
  };
}

function parseStudentDetail(value: unknown): ControlSchoolStudentDetail {
  const object = expectObject(value);
  const identity = expectObject(object.identity);
  const currentSituation = expectObject(object.currentSituation);
  const timeline = expectObject(object.timeline);
  const currentEnrollment =
    object.currentEnrollment === null ? null : expectObject(object.currentEnrollment);

  return {
    currentEnrollment: currentEnrollment
      ? {
          cancelledAt: asString(currentEnrollment.cancelledAt, false),
          completedAt: asString(currentEnrollment.completedAt, false),
          enrolledAt: asString(currentEnrollment.enrolledAt, false),
          enrollmentNumber: asString(currentEnrollment.enrollmentNumber, false),
          periodEnrollmentId: asString(currentEnrollment.periodEnrollmentId) ?? "",
          status: asString(currentEnrollment.status) ?? "",
        }
      : null,
    currentSituation: {
      academicPeriod: parseReference(currentSituation.academicPeriod, {
        code: "code",
        id: "academicPeriodId",
        name: "name",
      }),
      generation: {
        ...(parseReference(currentSituation.generation, {
          code: "code",
          id: "generationId",
          name: "name",
        }) as ControlSchoolReference),
        generationId: asString(expectObject(currentSituation.generation).generationId) ?? "",
      },
      group: parseReference(currentSituation.group, { code: "code", id: "groupId", name: "name" }),
      semesterNumber: asNumber(currentSituation.semesterNumber, false),
      studyPlan: {
        ...(parseReference(currentSituation.studyPlan, {
          code: "code",
          id: "studyPlanId",
          name: "name",
        }) as ControlSchoolReference),
        studyPlanId: asString(expectObject(currentSituation.studyPlan).studyPlanId) ?? "",
        version: asString(expectObject(currentSituation.studyPlan).version, false),
      },
      trainingArea: parseReference(currentSituation.trainingArea, {
        code: "code",
        id: "trainingAreaId",
        name: "name",
      }),
    },
    identity: {
      studentDisplayName: asString(identity.studentDisplayName, false),
      studentIdentifier: asString(identity.studentIdentifier) ?? "",
      studentRecordId: asString(identity.studentRecordId) ?? "",
      studentStatus: asString(identity.studentStatus) ?? "",
    },
    studentDisplayName: asString(object.studentDisplayName, false),
    studentIdentifier: asString(object.studentIdentifier) ?? "",
    studentRecordId: asString(object.studentRecordId) ?? "",
    studentStatus: asString(object.studentStatus) ?? "",
    timeline: {
      activatedAt: asString(timeline.activatedAt, false),
      graduatedAt: asString(timeline.graduatedAt, false),
      withdrawnAt: asString(timeline.withdrawnAt, false),
    },
  };
}

function parseGroupDetail(value: unknown): ControlSchoolGroupDetail {
  const object = expectObject(value);
  return {
    group: groupRow(expectObject(object.group)),
    students: expectArray(object.students).map((row) => ({
      enrollmentStatus: asString(row.enrollmentStatus) ?? "",
      semesterNumber: asNumber(row.semesterNumber, false),
      studentDisplayName: asString(row.studentDisplayName, false),
      studentIdentifier: asString(row.studentIdentifier) ?? "",
      studentRecordId: asString(row.studentRecordId) ?? "",
    })),
    subjects: expectArray(object.subjects).map((row) => ({
      academicOfferingId: asString(row.academicOfferingId) ?? "",
      subjectCode: asString(row.subjectCode) ?? "",
      subjectId: asString(row.subjectId) ?? "",
      subjectName: asString(row.subjectName) ?? "",
      weeklyHours: asString(row.weeklyHours, false),
    })),
    teachers: expectArray(object.teachers).map((row) => ({
      assignmentStatus: asString(row.assignmentStatus) ?? "",
      assignmentType: asString(row.assignmentType) ?? "",
      teacherDisplayName: asString(row.teacherDisplayName, false),
      teacherIdentifier: asString(row.teacherIdentifier, false),
      teachingAssignmentId: asString(row.teachingAssignmentId) ?? "",
    })),
  };
}

function parseGroupSchedule(value: unknown): ControlSchoolGroupSchedule {
  const object = expectObject(value);
  return {
    academicPeriodId: asString(object.academicPeriodId) ?? "",
    groupId: asString(object.groupId) ?? "",
    rows: expectArray(object.rows).map((row) => ({
      classSessionId: asString(row.classSessionId) ?? "",
      endsAt: asString(row.endsAt) ?? "",
      group: {
        ...(parseReference(row.group, {
          code: "code",
          id: "groupId",
          name: "name",
        }) as ControlSchoolReference),
        groupId: asString(expectObject(row.group).groupId) ?? "",
      },
      scheduleStatus: asString(row.scheduleStatus) ?? "",
      spaceCode: asString(row.spaceCode, false),
      spaceName: asString(row.spaceName, false),
      startsAt: asString(row.startsAt) ?? "",
      subjectCode: asString(row.subjectCode) ?? "",
      subjectName: asString(row.subjectName) ?? "",
      teacherDisplayName: asString(row.teacherDisplayName, false),
      teacherIdentifier: asString(row.teacherIdentifier, false),
      timeBlockName: asString(row.timeBlockName) ?? "",
      weekday: asNumber(row.weekday) ?? 0,
    })),
  };
}

function parseStructure(value: unknown): ControlSchoolStructureOverview {
  const object = expectObject(value);
  return {
    cycles: expectArray(object.cycles).map((row) => ({
      code: asString(row.code) ?? "",
      endsOn: asString(row.endsOn) ?? "",
      name: asString(row.name) ?? "",
      schoolCycleId: asString(row.schoolCycleId) ?? "",
      startsOn: asString(row.startsOn) ?? "",
      status: asString(row.status) ?? "",
    })),
    groups: expectArray(object.groups).map((row) => ({
      academicPeriodId: asString(row.academicPeriodId) ?? "",
      code: asString(row.code) ?? "",
      groupId: asString(row.groupId) ?? "",
      name: asString(row.name) ?? "",
      semesterNumber: asNumber(row.semesterNumber) ?? 0,
      status: asString(row.status) ?? "",
      studyPlanId: asString(row.studyPlanId) ?? "",
      trainingAreaId: asString(row.trainingAreaId, false),
    })),
    periods: expectArray(object.periods).map((row) => ({
      academicPeriodId: asString(row.academicPeriodId) ?? "",
      code: asString(row.code) ?? "",
      endsOn: asString(row.endsOn) ?? "",
      name: asString(row.name) ?? "",
      schoolCycleId: asString(row.schoolCycleId) ?? "",
      sequenceNumber: asNumber(row.sequenceNumber) ?? 0,
      startsOn: asString(row.startsOn) ?? "",
      status: asString(row.status) ?? "",
    })),
    planSemesters: expectArray(object.planSemesters).map((row) => ({
      name: asString(row.name) ?? "",
      planSemesterId: asString(row.planSemesterId) ?? "",
      semesterNumber: asNumber(row.semesterNumber) ?? 0,
      specializationRequired: asBoolean(row.specializationRequired),
      studyPlanId: asString(row.studyPlanId) ?? "",
    })),
    studyPlans: expectArray(object.studyPlans).map((row) => ({
      code: asString(row.code) ?? "",
      name: asString(row.name) ?? "",
      status: asString(row.status) ?? "",
      studyPlanId: asString(row.studyPlanId) ?? "",
      totalSemesters: asNumber(row.totalSemesters) ?? 0,
      validFrom: asString(row.validFrom) ?? "",
      validTo: asString(row.validTo, false),
      version: asString(row.version, false),
    })),
    subjects: expectArray(object.subjects).map((row) => ({
      code: asString(row.code) ?? "",
      name: asString(row.name) ?? "",
      shortName: asString(row.shortName, false),
      status: asString(row.status) ?? "",
      subjectId: asString(row.subjectId) ?? "",
      subjectType: asString(row.subjectType) ?? "",
    })),
    trainingAreas: expectArray(object.trainingAreas).map((row) => ({
      code: asString(row.code) ?? "",
      name: asString(row.name) ?? "",
      startsAtSemester: asNumber(row.startsAtSemester) ?? 0,
      status: asString(row.status) ?? "",
      trainingAreaId: asString(row.trainingAreaId) ?? "",
    })),
  };
}

function parseTrajectory(value: unknown): ControlSchoolStudentTrajectory {
  const object = expectObject(value);
  return {
    periods: expectArray(object.periods).map((row) => ({
      academicPeriodCode: asString(row.academicPeriodCode) ?? "",
      academicPeriodId: asString(row.academicPeriodId) ?? "",
      academicPeriodName: asString(row.academicPeriodName) ?? "",
      enrollmentStatus: asString(row.enrollmentStatus) ?? "",
      endsOn: asString(row.endsOn) ?? "",
      group: parseReference(row.group, { code: "code", id: "groupId", name: "name" }),
      periodEnrollmentId: asString(row.periodEnrollmentId) ?? "",
      semesterNumber: asNumber(row.semesterNumber) ?? 0,
      startsOn: asString(row.startsOn) ?? "",
      trainingArea: parseReference(row.trainingArea, {
        code: "code",
        id: "trainingAreaId",
        name: "name",
      }),
    })),
    progressDecisions: expectArray(object.progressDecisions).map((row) => ({
      decisionId: asString(row.decisionId) ?? "",
      decisionStatus: asString(row.decisionStatus) ?? "",
      decisionType: asString(row.decisionType) ?? "",
      decidedAt: asString(row.decidedAt, false),
      resultingSemesterNumber: asNumber(row.resultingSemesterNumber) ?? 0,
      resultingTrainingArea: parseReference(row.resultingTrainingArea, {
        code: "code",
        id: "trainingAreaId",
        name: "name",
      }),
      reversedAt: asString(row.reversedAt, false),
      sourceAcademicPeriodCode: asString(row.sourceAcademicPeriodCode) ?? "",
      sourceAcademicPeriodId: asString(row.sourceAcademicPeriodId) ?? "",
      sourceAcademicPeriodName: asString(row.sourceAcademicPeriodName) ?? "",
    })),
    studentRecordId: asString(object.studentRecordId) ?? "",
  };
}

function studentInput(filters: ControlSchoolStudentFilters = {}) {
  return {
    requested_academic_period_id: filters.academicPeriodId ?? null,
    requested_group_id: filters.groupId ?? null,
    requested_limit: filters.limit ?? 25,
    requested_offset: filters.offset ?? 0,
    requested_search_text: filters.searchText ?? null,
    requested_semester_number: filters.semesterNumber ?? null,
    requested_student_status: filters.studentStatus ?? null,
  };
}

function groupInput(filters: ControlSchoolGroupFilters = {}) {
  return {
    requested_academic_period_id: filters.academicPeriodId ?? null,
    requested_group_status: filters.status ?? null,
    requested_limit: filters.limit ?? 25,
    requested_offset: filters.offset ?? 0,
    requested_semester_number: filters.semesterNumber ?? null,
    requested_training_area_id: filters.trainingAreaId ?? null,
  };
}

function enrollmentInput(filters: ControlSchoolEnrollmentFilters = {}) {
  return {
    requested_academic_period_id: filters.academicPeriodId ?? null,
    requested_group_id: filters.groupId ?? null,
    requested_limit: filters.limit ?? 25,
    requested_offset: filters.offset ?? 0,
    requested_search_text: filters.searchText ?? null,
    requested_semester_number: filters.semesterNumber ?? null,
    requested_status: filters.status ?? null,
  };
}

export function createControlSchoolService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: ControlSchoolClientFactory = createServerClient as unknown as ControlSchoolClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: ControlSchoolRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new ControlSchoolError(parseRpcError(result.error), { cause: result.error });
    }
    return result.data;
  }

  return Object.freeze({
    async getGroupDetail(groupId: string) {
      return parseGroupDetail(
        await invoke("get_control_school_group_detail", { target_group_id: groupId }),
      );
    },
    async getGroupSchedule(groupId: string, academicPeriodId?: string | null) {
      return parseGroupSchedule(
        await invoke("get_control_school_group_schedule", {
          requested_academic_period_id: academicPeriodId ?? null,
          target_group_id: groupId,
        }),
      );
    },
    async getStructure(filters: ControlSchoolStructureFilters = {}) {
      return parseStructure(
        await invoke("get_control_school_structure", {
          requested_academic_period_id: filters.academicPeriodId ?? null,
          requested_study_plan_id: filters.studyPlanId ?? null,
        }),
      );
    },
    async getStudentDetail(studentRecordId: string) {
      return parseStudentDetail(
        await invoke("get_control_school_student_detail", {
          target_student_record_id: studentRecordId,
        }),
      );
    },
    async getStudentTrajectory(studentRecordId: string) {
      return parseTrajectory(
        await invoke("get_control_school_student_trajectory", {
          target_student_record_id: studentRecordId,
        }),
      );
    },
    async listEnrollments(filters: ControlSchoolEnrollmentFilters = {}) {
      return parsePage<ControlSchoolEnrollmentRow>(
        await invoke("list_control_school_enrollments", enrollmentInput(filters)),
        (row) => ({
          academicPeriod: parseReference(row.academicPeriod, {
            code: "code",
            id: "academicPeriodId",
            name: "name",
          })!,
          cancelledAt: asString(row.cancelledAt, false),
          completedAt: asString(row.completedAt, false),
          enrolledAt: asString(row.enrolledAt, false),
          enrollmentNumber: asString(row.enrollmentNumber, false),
          group: parseReference(row.group, { code: "code", id: "groupId", name: "name" }),
          periodEnrollmentId: asString(row.periodEnrollmentId) ?? "",
          semesterNumber: asNumber(row.semesterNumber) ?? 0,
          status: asString(row.status) ?? "",
          studentDisplayName: asString(row.studentDisplayName, false),
          studentIdentifier: asString(row.studentIdentifier) ?? "",
          studentRecordId: asString(row.studentRecordId) ?? "",
        }),
      );
    },
    async listGroups(filters: ControlSchoolGroupFilters = {}) {
      return parsePage<ControlSchoolGroupRow>(
        await invoke("list_control_school_groups", groupInput(filters)),
        groupRow,
      );
    },
    async listStudents(filters: ControlSchoolStudentFilters = {}) {
      return parsePage<ControlSchoolStudentRow>(
        await invoke("list_control_school_students", studentInput(filters)),
        studentRow,
      );
    },
  });
}
