import "server-only";

import { createServerClient } from "@supabase/ssr";

import {
  gradeCalculationStatuses,
  gradeManagementErrorCodes,
  gradeWindowStatuses,
  subjectResultCodes,
  unitGradeStatuses,
  validateGradeDecimal,
} from "./grade-management.js";
import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/grade-management-public solo puede importarse desde el servidor.",
  );
}

export const gradeManagementPublicRpcNames = Object.freeze([
  "list_grade_management_offerings",
  "list_my_grade_management_offerings",
  "get_grade_management_offering_detail",
  "get_grade_management_unit_grade_history",
  "get_grade_management_subject_result_history",
  "list_grade_management_corrections",
  "list_grade_capture_windows",
  "create_grade_capture_window",
  "open_grade_capture_window",
  "close_grade_capture_window",
  "cancel_grade_capture_window",
  "capture_student_unit_grade",
  "capture_bulk_unit_grades",
  "review_student_unit_grade",
  "finalize_student_unit_grade",
  "cancel_student_unit_grade",
  "calculate_subject_final_result",
  "confirm_subject_final_result",
  "create_grade_correction",
  "submit_grade_correction",
  "begin_grade_correction_review",
  "approve_grade_correction",
  "reject_grade_correction",
  "apply_grade_correction",
  "cancel_grade_correction",
] as const);

export type GradeManagementPublicRpcName = (typeof gradeManagementPublicRpcNames)[number];

interface GradeManagementPublicSdk {
  rpc(
    name: GradeManagementPublicRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type GradeManagementPublicClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => GradeManagementPublicSdk;

export class GradeManagementPublicError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible completar la operación pública de calificaciones.", options);
    this.name = "GradeManagementPublicError";
    this.code = code;
  }
}

export interface GradeManagementPublicPage<T> {
  readonly offset: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly totalRows: number;
}

export interface GradeManagementPublicReference {
  readonly code: string;
  readonly id: string;
  readonly name: string;
}

export interface GradeManagementPublicOfferingRow {
  readonly academicOfferingId: string;
  readonly academicPeriod: GradeManagementPublicReference & { readonly academicPeriodId: string };
  readonly captureSummary: {
    readonly calculatedResultCount: number;
    readonly capturedCount: number;
    readonly confirmedResultCount: number;
    readonly correctedCount: number;
    readonly finalizedCount: number;
    readonly pendingCorrectionCount: number;
    readonly reviewedCount: number;
  };
  readonly group: GradeManagementPublicReference & { readonly groupId: string };
  readonly offeringStatus: string;
  readonly semesterNumber: number;
  readonly studentCount: number;
  readonly subject: GradeManagementPublicReference & { readonly subjectId: string };
  readonly teacher: {
    readonly assignmentStatus: string | null;
    readonly assignmentType: string | null;
    readonly teacherDisplayName: string | null;
    readonly teacherIdentifier: string | null;
  } | null;
  readonly trainingArea:
    (GradeManagementPublicReference & { readonly trainingAreaId: string }) | null;
  readonly windowSummary: {
    readonly cancelledCount: number;
    readonly closedCount: number;
    readonly draftCount: number;
    readonly openCount: number;
  };
}

export interface GradeManagementPublicOfferingDetailStudent {
  readonly enrollmentStatus: string;
  readonly offeringEnrollmentStatus: string;
  readonly periodEnrollmentId: string;
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly studentOfferingEnrollmentId: string;
  readonly studentRecordId: string;
  readonly subjectResult: {
    readonly accreditedUnitCount: number;
    readonly calculationStatus: string;
    readonly calculatedAt: string | null;
    readonly confirmedAt: string | null;
    readonly nonAccreditedUnitCount: number;
    readonly rawFinalGrade: number | null;
    readonly resultCode: string;
    readonly roundedFinalGrade: number | null;
    readonly status: string;
    readonly subjectFinalResultId: string;
  } | null;
  readonly unitGrades: ReadonlyArray<{
    readonly capturedAt: string | null;
    readonly finalizedAt: string | null;
    readonly isAccredited: boolean;
    readonly normalizedGrade: number;
    readonly rawGrade: number;
    readonly reviewedAt: string | null;
    readonly status: string;
    readonly studentUnitGradeId: string;
    readonly subjectUnitId: string;
    readonly unitNumber: number;
  }>;
}

export interface GradeManagementPublicOfferingDetail {
  readonly offering: {
    readonly academicOfferingId: string;
    readonly academicPeriod: GradeManagementPublicReference & { readonly academicPeriodId: string };
    readonly group: GradeManagementPublicReference & { readonly groupId: string };
    readonly offeringStatus: string;
    readonly semesterNumber: number;
    readonly subject: GradeManagementPublicReference & { readonly subjectId: string };
    readonly teacher: {
      readonly assignmentStatus: string | null;
      readonly assignmentType: string | null;
      readonly teacherDisplayName: string | null;
      readonly teacherIdentifier: string | null;
      readonly teachingAssignmentId: string | null;
    } | null;
    readonly trainingArea:
      (GradeManagementPublicReference & { readonly trainingAreaId: string }) | null;
  };
  readonly students: readonly GradeManagementPublicOfferingDetailStudent[];
}

export interface GradeManagementPublicUnitGradeHistory {
  readonly history: ReadonlyArray<{
    readonly actorIdentifier: string | null;
    readonly correctionId: string | null;
    readonly createdAt: string;
    readonly historyId: string;
    readonly previousRawGrade: number | null;
    readonly previousStatus: string | null;
    readonly reasonCode: string;
    readonly resultingRawGrade: number;
    readonly resultingStatus: string;
  }>;
  readonly studentIdentifier: string;
  readonly studentOfferingEnrollmentId: string;
  readonly studentRecordId: string;
  readonly studentUnitGradeId: string;
  readonly unitNumber: number;
}

export interface GradeManagementPublicSubjectResultHistory {
  readonly history: ReadonlyArray<{
    readonly actorIdentifier: string | null;
    readonly createdAt: string;
    readonly historyId: string;
    readonly previousResult: string | null;
    readonly previousStatus: string | null;
    readonly resultingResult: string;
    readonly resultingStatus: string;
  }>;
  readonly studentIdentifier: string;
  readonly studentOfferingEnrollmentId: string;
  readonly studentRecordId: string;
  readonly subjectFinalResultId: string;
}

export interface GradeManagementPublicCorrectionRow {
  readonly academicOfferingId: string;
  readonly appliedAt: string | null;
  readonly appliedByIdentifier: string | null;
  readonly approvedAt: string | null;
  readonly approvedByIdentifier: string | null;
  readonly cancelledAt: string | null;
  readonly correctionId: string;
  readonly previousRawGrade: number;
  readonly proposedRawGrade: number;
  readonly reasonCode: string;
  readonly rejectedAt: string | null;
  readonly requestedAt: string;
  readonly requestedByIdentifier: string | null;
  readonly reviewedAt: string | null;
  readonly reviewedByIdentifier: string | null;
  readonly status: string;
  readonly studentIdentifier: string;
  readonly studentRecordId: string;
  readonly studentUnitGradeId: string;
  readonly unitNumber: number;
}

export interface GradeManagementPublicWindowRow {
  readonly academicPeriod: GradeManagementPublicReference & { readonly academicPeriodId: string };
  readonly activeOfferingCount: number;
  readonly canCancel: boolean;
  readonly canClose: boolean;
  readonly canOpen: boolean;
  readonly closedAt: string | null;
  readonly closedByIdentifier: string | null;
  readonly createdAt: string;
  readonly createdByIdentifier: string | null;
  readonly gradeCaptureWindowId: string;
  readonly isActiveNow: boolean;
  readonly openedAt: string | null;
  readonly openedByIdentifier: string | null;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly status: string;
  readonly unitNumber: number | null;
  readonly windowType: string;
}

export interface GradeManagementPublicMutationResult {
  readonly entityId: string;
  readonly status: string;
}

export interface GradeManagementPublicOfferingFilters {
  readonly academicOfferingId?: string | null;
  readonly academicPeriodId?: string | null;
  readonly groupId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly offeringStatus?: string | null;
  readonly subjectId?: string | null;
  readonly teacherIdentifier?: string | null;
  readonly windowStatus?: string | null;
}

export interface GradeManagementPublicMyOfferingFilters {
  readonly academicPeriodId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly offeringStatus?: string | null;
  readonly windowStatus?: string | null;
}

export interface GradeManagementPublicCorrectionFilters {
  readonly academicOfferingId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly status?: string | null;
  readonly studentUnitGradeId?: string | null;
}

export interface GradeManagementPublicWindowFilters {
  readonly academicPeriodId?: string | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly status?: string | null;
  readonly windowType?: string | null;
}

export interface CreateGradeCaptureWindowInput {
  readonly closesAt: string;
  readonly gradeWindowType: string;
  readonly idempotencyKey: string;
  readonly opensAt: string;
  readonly academicPeriodId: string;
  readonly unitNumber?: number | null;
  readonly correlationId?: string;
}

export interface CaptureStudentUnitGradeInput {
  readonly correlationId?: string;
  readonly idempotencyKey: string;
  readonly rawGrade: string;
  readonly studentOfferingEnrollmentId: string;
  readonly subjectUnitId: string;
}

export interface CaptureBulkUnitGradesInput {
  readonly correlationId?: string;
  readonly idempotencyKey: string;
  readonly items: ReadonlyArray<{
    readonly rawGrade: string;
    readonly studentOfferingEnrollmentId: string;
    readonly subjectUnitId: string;
  }>;
}

export interface GradeManagementPublicCorrectionInput {
  readonly correlationId?: string;
  readonly gradeCorrectionReason: string;
  readonly idempotencyKey: string;
  readonly proposedRawGrade: string;
  readonly studentUnitGradeId: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function parseRpcError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    if ("code" in error && typeof error.code === "string" && error.code.length > 0) {
      return error.code;
    }
  }
  return "GRADE_MANAGEMENT_PUBLIC_OPERATION_FAILED";
}

function expectObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_RESPONSE_INVALID");
  }
  return value as Record<string, unknown>;
}

function expectArray(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_RESPONSE_INVALID");
  }
  return value.map(expectObject);
}

function asString(value: unknown, required = true): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (!required && (value === null || value === undefined || value === "")) return null;
  throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_RESPONSE_INVALID");
}

function asNumber(value: unknown, required = true): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!required && (value === null || value === undefined)) return null;
  throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_RESPONSE_INVALID");
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_RESPONSE_INVALID");
}

function parseReference(
  value: unknown,
  keys: { code?: string; id: string; name?: string } = { code: "code", id: "id", name: "name" },
): GradeManagementPublicReference | null {
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
): GradeManagementPublicPage<T> {
  const object = expectObject(value);
  return {
    offset: asNumber(object.offset) ?? 0,
    pageSize: asNumber(object.pageSize) ?? 0,
    rows: expectArray(object.rows).map(mapper),
    totalRows: asNumber(object.totalRows) ?? 0,
  };
}

function validateUuid(value: string, code: string) {
  if (!uuidPattern.test(value)) throw new GradeManagementPublicError(code);
  return value;
}

function validateOptionalUuid(value: string | null | undefined, code: string) {
  if (value == null) return undefined;
  return validateUuid(value, code);
}

function validateStatusFilter(
  value: string | null | undefined,
  allowed: readonly string[],
  code: string,
) {
  if (value == null) return undefined;
  if (!allowed.includes(value)) throw new GradeManagementPublicError(code);
  return value;
}

function validatePageSize(value: number | null | undefined) {
  if (value == null) return 25;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_LIMIT_INVALID");
  }
  return value;
}

function validateOffset(value: number | null | undefined) {
  if (value == null) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_OFFSET_INVALID");
  }
  return value;
}

function validateWindowType(value: string | null | undefined) {
  if (value == null) return undefined;
  const allowed = ["UNIT_CAPTURE", "FINAL_REVIEW", "CORRECTION"];
  if (!allowed.includes(value)) throw new GradeManagementPublicError("GRADE_WINDOW_TYPE_INVALID");
  return value;
}

function validateIsoTimestamp(value: string, code: string) {
  if (!isoDateTimePattern.test(value)) throw new GradeManagementPublicError(code);
  return value;
}

function offeringRow(row: Record<string, unknown>): GradeManagementPublicOfferingRow {
  const academicPeriod = expectObject(row.academicPeriod);
  const group = expectObject(row.group);
  const subject = expectObject(row.subject);
  const captureSummary = expectObject(row.captureSummary);
  const windowSummary = expectObject(row.windowSummary);
  const teacher = row.teacher === null ? null : expectObject(row.teacher);
  return {
    academicOfferingId: asString(row.academicOfferingId) ?? "",
    academicPeriod: {
      ...(parseReference(academicPeriod, {
        code: "code",
        id: "academicPeriodId",
        name: "name",
      }) as GradeManagementPublicReference),
      academicPeriodId: asString(academicPeriod.academicPeriodId) ?? "",
    },
    captureSummary: {
      calculatedResultCount: asNumber(captureSummary.calculatedResultCount) ?? 0,
      capturedCount: asNumber(captureSummary.capturedCount) ?? 0,
      confirmedResultCount: asNumber(captureSummary.confirmedResultCount) ?? 0,
      correctedCount: asNumber(captureSummary.correctedCount) ?? 0,
      finalizedCount: asNumber(captureSummary.finalizedCount) ?? 0,
      pendingCorrectionCount: asNumber(captureSummary.pendingCorrectionCount) ?? 0,
      reviewedCount: asNumber(captureSummary.reviewedCount) ?? 0,
    },
    group: {
      ...(parseReference(group, {
        code: "code",
        id: "groupId",
        name: "name",
      }) as GradeManagementPublicReference),
      groupId: asString(group.groupId) ?? "",
    },
    offeringStatus: asString(row.offeringStatus) ?? "",
    semesterNumber: asNumber(row.semesterNumber) ?? 0,
    studentCount: asNumber(row.studentCount) ?? 0,
    subject: {
      ...(parseReference(subject, {
        code: "code",
        id: "subjectId",
        name: "name",
      }) as GradeManagementPublicReference),
      subjectId: asString(subject.subjectId) ?? "",
    },
    teacher: teacher
      ? {
          assignmentStatus: asString(teacher.assignmentStatus, false),
          assignmentType: asString(teacher.assignmentType, false),
          teacherDisplayName: asString(teacher.teacherDisplayName, false),
          teacherIdentifier: asString(teacher.teacherIdentifier, false),
        }
      : null,
    trainingArea: row.trainingArea
      ? {
          ...(parseReference(row.trainingArea, {
            code: "code",
            id: "trainingAreaId",
            name: "name",
          }) as GradeManagementPublicReference),
          trainingAreaId: asString(expectObject(row.trainingArea).trainingAreaId) ?? "",
        }
      : null,
    windowSummary: {
      cancelledCount: asNumber(windowSummary.cancelledCount) ?? 0,
      closedCount: asNumber(windowSummary.closedCount) ?? 0,
      draftCount: asNumber(windowSummary.draftCount) ?? 0,
      openCount: asNumber(windowSummary.openCount) ?? 0,
    },
  };
}

function parseOfferingDetail(value: unknown): GradeManagementPublicOfferingDetail {
  const object = expectObject(value);
  const offering = expectObject(object.offering);
  const academicPeriod = expectObject(offering.academicPeriod);
  const group = expectObject(offering.group);
  const subject = expectObject(offering.subject);
  return {
    offering: {
      academicOfferingId: asString(offering.academicOfferingId) ?? "",
      academicPeriod: {
        ...(parseReference(academicPeriod, {
          code: "code",
          id: "academicPeriodId",
          name: "name",
        }) as GradeManagementPublicReference),
        academicPeriodId: asString(academicPeriod.academicPeriodId) ?? "",
      },
      group: {
        ...(parseReference(group, {
          code: "code",
          id: "groupId",
          name: "name",
        }) as GradeManagementPublicReference),
        groupId: asString(group.groupId) ?? "",
      },
      offeringStatus: asString(offering.offeringStatus) ?? "",
      semesterNumber: asNumber(offering.semesterNumber) ?? 0,
      subject: {
        ...(parseReference(subject, {
          code: "code",
          id: "subjectId",
          name: "name",
        }) as GradeManagementPublicReference),
        subjectId: asString(subject.subjectId) ?? "",
      },
      teacher: offering.teacher
        ? {
            assignmentStatus: asString(expectObject(offering.teacher).assignmentStatus, false),
            assignmentType: asString(expectObject(offering.teacher).assignmentType, false),
            teacherDisplayName: asString(expectObject(offering.teacher).teacherDisplayName, false),
            teacherIdentifier: asString(expectObject(offering.teacher).teacherIdentifier, false),
            teachingAssignmentId: asString(
              expectObject(offering.teacher).teachingAssignmentId,
              false,
            ),
          }
        : null,
      trainingArea: offering.trainingArea
        ? {
            ...(parseReference(offering.trainingArea, {
              code: "code",
              id: "trainingAreaId",
              name: "name",
            }) as GradeManagementPublicReference),
            trainingAreaId: asString(expectObject(offering.trainingArea).trainingAreaId) ?? "",
          }
        : null,
    },
    students: expectArray(object.students).map((row) => ({
      enrollmentStatus: asString(row.enrollmentStatus) ?? "",
      offeringEnrollmentStatus: asString(row.offeringEnrollmentStatus) ?? "",
      periodEnrollmentId: asString(row.periodEnrollmentId) ?? "",
      studentDisplayName: asString(row.studentDisplayName, false),
      studentIdentifier: asString(row.studentIdentifier) ?? "",
      studentOfferingEnrollmentId: asString(row.studentOfferingEnrollmentId) ?? "",
      studentRecordId: asString(row.studentRecordId) ?? "",
      subjectResult: row.subjectResult
        ? {
            accreditedUnitCount: asNumber(expectObject(row.subjectResult).accreditedUnitCount) ?? 0,
            calculationStatus: asString(expectObject(row.subjectResult).calculationStatus) ?? "",
            calculatedAt: asString(expectObject(row.subjectResult).calculatedAt, false),
            confirmedAt: asString(expectObject(row.subjectResult).confirmedAt, false),
            nonAccreditedUnitCount:
              asNumber(expectObject(row.subjectResult).nonAccreditedUnitCount) ?? 0,
            rawFinalGrade: asNumber(expectObject(row.subjectResult).rawFinalGrade, false),
            resultCode: asString(expectObject(row.subjectResult).resultCode) ?? "",
            roundedFinalGrade: asNumber(expectObject(row.subjectResult).roundedFinalGrade, false),
            status: asString(expectObject(row.subjectResult).status) ?? "",
            subjectFinalResultId:
              asString(expectObject(row.subjectResult).subjectFinalResultId) ?? "",
          }
        : null,
      unitGrades: expectArray(row.unitGrades).map((grade) => ({
        capturedAt: asString(grade.capturedAt, false),
        finalizedAt: asString(grade.finalizedAt, false),
        isAccredited: asBoolean(grade.isAccredited),
        normalizedGrade: asNumber(grade.normalizedGrade) ?? 0,
        rawGrade: asNumber(grade.rawGrade) ?? 0,
        reviewedAt: asString(grade.reviewedAt, false),
        status: asString(grade.status) ?? "",
        studentUnitGradeId: asString(grade.studentUnitGradeId) ?? "",
        subjectUnitId: asString(grade.subjectUnitId) ?? "",
        unitNumber: asNumber(grade.unitNumber) ?? 0,
      })),
    })),
  };
}

function parseUnitGradeHistory(value: unknown): GradeManagementPublicUnitGradeHistory {
  const object = expectObject(value);
  return {
    history: expectArray(object.history).map((row) => ({
      actorIdentifier: asString(row.actorIdentifier, false),
      correctionId: asString(row.correctionId, false),
      createdAt: asString(row.createdAt) ?? "",
      historyId: asString(row.historyId) ?? "",
      previousRawGrade: asNumber(row.previousRawGrade, false),
      previousStatus: asString(row.previousStatus, false),
      reasonCode: asString(row.reasonCode) ?? "",
      resultingRawGrade: asNumber(row.resultingRawGrade) ?? 0,
      resultingStatus: asString(row.resultingStatus) ?? "",
    })),
    studentIdentifier: asString(object.studentIdentifier) ?? "",
    studentOfferingEnrollmentId: asString(object.studentOfferingEnrollmentId) ?? "",
    studentRecordId: asString(object.studentRecordId) ?? "",
    studentUnitGradeId: asString(object.studentUnitGradeId) ?? "",
    unitNumber: asNumber(object.unitNumber) ?? 0,
  };
}

function parseSubjectResultHistory(value: unknown): GradeManagementPublicSubjectResultHistory {
  const object = expectObject(value);
  return {
    history: expectArray(object.history).map((row) => ({
      actorIdentifier: asString(row.actorIdentifier, false),
      createdAt: asString(row.createdAt) ?? "",
      historyId: asString(row.historyId) ?? "",
      previousResult: asString(row.previousResult, false),
      previousStatus: asString(row.previousStatus, false),
      resultingResult: asString(row.resultingResult) ?? "",
      resultingStatus: asString(row.resultingStatus) ?? "",
    })),
    studentIdentifier: asString(object.studentIdentifier) ?? "",
    studentOfferingEnrollmentId: asString(object.studentOfferingEnrollmentId) ?? "",
    studentRecordId: asString(object.studentRecordId) ?? "",
    subjectFinalResultId: asString(object.subjectFinalResultId) ?? "",
  };
}

function correctionRow(row: Record<string, unknown>): GradeManagementPublicCorrectionRow {
  return {
    academicOfferingId: asString(row.academicOfferingId) ?? "",
    appliedAt: asString(row.appliedAt, false),
    appliedByIdentifier: asString(row.appliedByIdentifier, false),
    approvedAt: asString(row.approvedAt, false),
    approvedByIdentifier: asString(row.approvedByIdentifier, false),
    cancelledAt: asString(row.cancelledAt, false),
    correctionId: asString(row.correctionId) ?? "",
    previousRawGrade: asNumber(row.previousRawGrade) ?? 0,
    proposedRawGrade: asNumber(row.proposedRawGrade) ?? 0,
    reasonCode: asString(row.reasonCode) ?? "",
    rejectedAt: asString(row.rejectedAt, false),
    requestedAt: asString(row.requestedAt) ?? "",
    requestedByIdentifier: asString(row.requestedByIdentifier, false),
    reviewedAt: asString(row.reviewedAt, false),
    reviewedByIdentifier: asString(row.reviewedByIdentifier, false),
    status: asString(row.status) ?? "",
    studentIdentifier: asString(row.studentIdentifier) ?? "",
    studentRecordId: asString(row.studentRecordId) ?? "",
    studentUnitGradeId: asString(row.studentUnitGradeId) ?? "",
    unitNumber: asNumber(row.unitNumber) ?? 0,
  };
}

function windowRow(row: Record<string, unknown>): GradeManagementPublicWindowRow {
  const period = expectObject(row.academicPeriod);
  return {
    academicPeriod: {
      ...(parseReference(period, {
        code: "code",
        id: "academicPeriodId",
        name: "name",
      }) as GradeManagementPublicReference),
      academicPeriodId: asString(period.academicPeriodId) ?? "",
    },
    activeOfferingCount: asNumber(row.activeOfferingCount) ?? 0,
    canCancel: asBoolean(row.canCancel),
    canClose: asBoolean(row.canClose),
    canOpen: asBoolean(row.canOpen),
    closedAt: asString(row.closedAt, false),
    closedByIdentifier: asString(row.closedByIdentifier, false),
    createdAt: asString(row.createdAt) ?? "",
    createdByIdentifier: asString(row.createdByIdentifier, false),
    gradeCaptureWindowId: asString(row.gradeCaptureWindowId) ?? "",
    isActiveNow: asBoolean(row.isActiveNow),
    openedAt: asString(row.openedAt, false),
    openedByIdentifier: asString(row.openedByIdentifier, false),
    opensAt: asString(row.opensAt) ?? "",
    closesAt: asString(row.closesAt) ?? "",
    status: asString(row.status) ?? "",
    unitNumber: asNumber(row.unitNumber, false),
    windowType: asString(row.windowType) ?? "",
  };
}

function mutationResult(value: unknown): GradeManagementPublicMutationResult {
  const object = Array.isArray(value) ? expectObject(value[0]) : expectObject(value);
  return {
    entityId: asString(object.entity_id ?? object.entityId) ?? "",
    status: asString(object.status) ?? "",
  };
}

function offeringInput(filters: GradeManagementPublicOfferingFilters = {}) {
  return {
    requested_academic_offering_id: validateOptionalUuid(
      filters.academicOfferingId,
      "GRADE_MANAGEMENT_PUBLIC_OFFERING_INVALID",
    ),
    requested_academic_period_id: validateOptionalUuid(
      filters.academicPeriodId,
      "GRADE_MANAGEMENT_PUBLIC_PERIOD_INVALID",
    ),
    requested_group_id: validateOptionalUuid(
      filters.groupId,
      "GRADE_MANAGEMENT_PUBLIC_GROUP_INVALID",
    ),
    requested_limit: validatePageSize(filters.limit),
    requested_offset: validateOffset(filters.offset),
    requested_offering_status: validateStatusFilter(
      filters.offeringStatus,
      ["DRAFT", "PLANNED", "ACTIVE", "CLOSED", "CANCELLED"],
      "GRADE_MANAGEMENT_PUBLIC_OFFERING_STATUS_INVALID",
    ),
    requested_subject_id: validateOptionalUuid(
      filters.subjectId,
      "GRADE_MANAGEMENT_PUBLIC_SUBJECT_INVALID",
    ),
    requested_teacher_identifier:
      typeof filters.teacherIdentifier === "string" && filters.teacherIdentifier.length > 0
        ? filters.teacherIdentifier
        : undefined,
    requested_window_status: validateStatusFilter(
      filters.windowStatus,
      gradeWindowStatuses,
      "GRADE_MANAGEMENT_PUBLIC_WINDOW_STATUS_INVALID",
    ),
  };
}

function myOfferingInput(filters: GradeManagementPublicMyOfferingFilters = {}) {
  return {
    requested_academic_period_id: validateOptionalUuid(
      filters.academicPeriodId,
      "GRADE_MANAGEMENT_PUBLIC_PERIOD_INVALID",
    ),
    requested_limit: validatePageSize(filters.limit),
    requested_offset: validateOffset(filters.offset),
    requested_offering_status: validateStatusFilter(
      filters.offeringStatus,
      ["DRAFT", "PLANNED", "ACTIVE", "CLOSED", "CANCELLED"],
      "GRADE_MANAGEMENT_PUBLIC_OFFERING_STATUS_INVALID",
    ),
    requested_window_status: validateStatusFilter(
      filters.windowStatus,
      gradeWindowStatuses,
      "GRADE_MANAGEMENT_PUBLIC_WINDOW_STATUS_INVALID",
    ),
  };
}

function correctionInput(filters: GradeManagementPublicCorrectionFilters = {}) {
  return {
    requested_limit: validatePageSize(filters.limit),
    requested_offset: validateOffset(filters.offset),
    requested_status: validateStatusFilter(
      filters.status,
      ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "APPLIED", "CANCELLED"],
      "GRADE_MANAGEMENT_PUBLIC_CORRECTION_STATUS_INVALID",
    ),
    target_academic_offering_id: validateOptionalUuid(
      filters.academicOfferingId,
      "GRADE_MANAGEMENT_PUBLIC_OFFERING_INVALID",
    ),
    target_student_unit_grade_id: validateOptionalUuid(
      filters.studentUnitGradeId,
      "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID",
    ),
  };
}

function windowInput(filters: GradeManagementPublicWindowFilters = {}) {
  return {
    requested_academic_period_id: validateOptionalUuid(
      filters.academicPeriodId,
      "GRADE_MANAGEMENT_PUBLIC_PERIOD_INVALID",
    ),
    requested_limit: validatePageSize(filters.limit),
    requested_offset: validateOffset(filters.offset),
    requested_status: validateStatusFilter(
      filters.status,
      gradeWindowStatuses,
      "GRADE_MANAGEMENT_PUBLIC_WINDOW_STATUS_INVALID",
    ),
    requested_window_type: validateWindowType(filters.windowType),
  };
}

export function createGradeManagementPublicService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: GradeManagementPublicClientFactory = createServerClient as unknown as GradeManagementPublicClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: GradeManagementPublicRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new GradeManagementPublicError(parseRpcError(result.error), { cause: result.error });
    }
    return result.data;
  }

  return Object.freeze({
    listOfferings(filters?: GradeManagementPublicOfferingFilters) {
      return invoke("list_grade_management_offerings", offeringInput(filters)).then((value) =>
        parsePage(value, offeringRow),
      );
    },
    listMyOfferings(filters?: GradeManagementPublicMyOfferingFilters) {
      return invoke("list_my_grade_management_offerings", myOfferingInput(filters)).then((value) =>
        parsePage(value, offeringRow),
      );
    },
    getOfferingDetail(academicOfferingId: string) {
      return invoke("get_grade_management_offering_detail", {
        target_academic_offering_id: validateUuid(
          academicOfferingId,
          "GRADE_MANAGEMENT_PUBLIC_OFFERING_INVALID",
        ),
      }).then(parseOfferingDetail);
    },
    getUnitGradeHistory(studentUnitGradeId: string) {
      return invoke("get_grade_management_unit_grade_history", {
        target_student_unit_grade_id: validateUuid(
          studentUnitGradeId,
          "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID",
        ),
      }).then(parseUnitGradeHistory);
    },
    getSubjectResultHistory(subjectFinalResultId: string) {
      return invoke("get_grade_management_subject_result_history", {
        target_subject_final_result_id: validateUuid(
          subjectFinalResultId,
          "GRADE_MANAGEMENT_PUBLIC_SUBJECT_RESULT_INVALID",
        ),
      }).then(parseSubjectResultHistory);
    },
    listCorrections(filters?: GradeManagementPublicCorrectionFilters) {
      return invoke("list_grade_management_corrections", correctionInput(filters)).then((value) =>
        parsePage(value, correctionRow),
      );
    },
    listWindows(filters?: GradeManagementPublicWindowFilters) {
      return invoke("list_grade_capture_windows", windowInput(filters)).then((value) =>
        parsePage(value, windowRow),
      );
    },
    createWindow(input: CreateGradeCaptureWindowInput) {
      return invoke("create_grade_capture_window", {
        closes: validateIsoTimestamp(input.closesAt, "GRADE_MANAGEMENT_PUBLIC_TIMESTAMP_INVALID"),
        correlation: input.correlationId
          ? validateUuid(input.correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        kind: validateWindowType(input.gradeWindowType),
        opens: validateIsoTimestamp(input.opensAt, "GRADE_MANAGEMENT_PUBLIC_TIMESTAMP_INVALID"),
        operation_key: input.idempotencyKey,
        period_id: validateUuid(input.academicPeriodId, "GRADE_MANAGEMENT_PUBLIC_PERIOD_INVALID"),
        unit:
          input.unitNumber == null
            ? null
            : Number.isInteger(input.unitNumber) && input.unitNumber >= 1 && input.unitNumber <= 3
              ? input.unitNumber
              : (() => {
                  throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_UNIT_INVALID");
                })(),
      }).then(mutationResult);
    },
    openWindow(windowId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("open_grade_capture_window", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(windowId, "GRADE_MANAGEMENT_PUBLIC_WINDOW_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    closeWindow(windowId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("close_grade_capture_window", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(windowId, "GRADE_MANAGEMENT_PUBLIC_WINDOW_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    cancelWindow(windowId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("cancel_grade_capture_window", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(windowId, "GRADE_MANAGEMENT_PUBLIC_WINDOW_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    captureStudentUnitGrade(input: CaptureStudentUnitGradeInput) {
      return invoke("capture_student_unit_grade", {
        correlation: input.correlationId
          ? validateUuid(input.correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        offering_enrollment_id: validateUuid(
          input.studentOfferingEnrollmentId,
          "GRADE_MANAGEMENT_PUBLIC_ENROLLMENT_INVALID",
        ),
        operation_key: input.idempotencyKey,
        raw_grade: Number(validateGradeDecimal(input.rawGrade)),
        subject_unit_id: validateUuid(
          input.subjectUnitId,
          "GRADE_MANAGEMENT_PUBLIC_SUBJECT_UNIT_INVALID",
        ),
      }).then(mutationResult);
    },
    captureBulkUnitGrades(input: CaptureBulkUnitGradesInput) {
      if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 100) {
        throw new GradeManagementPublicError("GRADE_MANAGEMENT_PUBLIC_BULK_INVALID");
      }
      return invoke("capture_bulk_unit_grades", {
        correlation: input.correlationId
          ? validateUuid(input.correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        items: input.items.map((item) => ({
          raw_grade: Number(validateGradeDecimal(item.rawGrade)),
          student_offering_enrollment_id: validateUuid(
            item.studentOfferingEnrollmentId,
            "GRADE_MANAGEMENT_PUBLIC_ENROLLMENT_INVALID",
          ),
          subject_unit_id: validateUuid(
            item.subjectUnitId,
            "GRADE_MANAGEMENT_PUBLIC_SUBJECT_UNIT_INVALID",
          ),
        })),
        operation_key: input.idempotencyKey,
      }).then(mutationResult);
    },
    reviewStudentUnitGrade(
      studentUnitGradeId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("review_student_unit_grade", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(studentUnitGradeId, "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    finalizeStudentUnitGrade(
      studentUnitGradeId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("finalize_student_unit_grade", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(studentUnitGradeId, "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    cancelStudentUnitGrade(
      studentUnitGradeId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("cancel_student_unit_grade", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(studentUnitGradeId, "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    calculateSubjectFinalResult(
      studentOfferingEnrollmentId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("calculate_subject_final_result", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        offering_enrollment_id: validateUuid(
          studentOfferingEnrollmentId,
          "GRADE_MANAGEMENT_PUBLIC_ENROLLMENT_INVALID",
        ),
        operation_key: idempotencyKey,
      }).then(mutationResult);
    },
    confirmSubjectFinalResult(
      subjectFinalResultId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("confirm_subject_final_result", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        operation_key: idempotencyKey,
        result_id: validateUuid(
          subjectFinalResultId,
          "GRADE_MANAGEMENT_PUBLIC_SUBJECT_RESULT_INVALID",
        ),
      }).then(mutationResult);
    },
    createGradeCorrection(input: GradeManagementPublicCorrectionInput) {
      return invoke("create_grade_correction", {
        correlation: input.correlationId
          ? validateUuid(input.correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        grade_id: validateUuid(
          input.studentUnitGradeId,
          "GRADE_MANAGEMENT_PUBLIC_UNIT_GRADE_INVALID",
        ),
        operation_key: input.idempotencyKey,
        proposed: Number(validateGradeDecimal(input.proposedRawGrade)),
        reason: input.gradeCorrectionReason,
      }).then(mutationResult);
    },
    submitGradeCorrection(correctionId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("submit_grade_correction", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    beginGradeCorrectionReview(
      correctionId: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      return invoke("begin_grade_correction_review", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    approveGradeCorrection(correctionId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("approve_grade_correction", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    rejectGradeCorrection(correctionId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("reject_grade_correction", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    applyGradeCorrection(correctionId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("apply_grade_correction", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
    cancelGradeCorrection(correctionId: string, idempotencyKey: string, correlationId?: string) {
      return invoke("cancel_grade_correction", {
        correlation: correlationId
          ? validateUuid(correlationId, "GRADE_MANAGEMENT_PUBLIC_CORRELATION_INVALID")
          : undefined,
        id: validateUuid(correctionId, "GRADE_MANAGEMENT_PUBLIC_CORRECTION_INVALID"),
        key: idempotencyKey,
      }).then(mutationResult);
    },
  });
}

export {
  gradeCalculationStatuses,
  gradeManagementErrorCodes,
  gradeWindowStatuses,
  subjectResultCodes,
  unitGradeStatuses,
  validateGradeDecimal,
};
