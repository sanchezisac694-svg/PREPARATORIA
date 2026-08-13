import "server-only";

import { hasAnyPermission, permissions, type Permission } from "@preparatoria/authz";
import { readSupabasePublicEnv } from "@preparatoria/env/server";
import {
  createGradeManagementPublicService,
  GradeManagementPublicError,
  type CaptureBulkUnitGradesInput,
  type CaptureStudentUnitGradeInput,
  type CreateGradeCaptureWindowInput,
  type GradeManagementPublicCorrectionInput,
  type GradeManagementPublicCorrectionFilters,
  type GradeManagementPublicMyOfferingFilters,
  type GradeManagementPublicOfferingFilters,
  type GradeManagementPublicWindowFilters,
} from "@preparatoria/supabase/grade-management-public";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminAccess } from "./auth";

export class GradeManagementUiError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible completar la operación de calificaciones.", options);
    this.name = "GradeManagementUiError";
    this.code = code;
  }
}

export const gradeManagementNavigationPermissions = Object.freeze([
  permissions.ACADEMIC_GRADES_READ,
  permissions.ACADEMIC_GRADES_CAPTURE,
  permissions.ACADEMIC_GRADES_REVIEW,
  permissions.ACADEMIC_GRADES_FINALIZE,
  permissions.ACADEMIC_GRADES_CORRECT,
  permissions.ACADEMIC_GRADE_WINDOWS_MANAGE,
  permissions.ACADEMIC_SUBJECT_RESULTS_READ,
] as const satisfies readonly Permission[]);

function normalizeError(error: unknown): GradeManagementUiError {
  if (error instanceof GradeManagementUiError) {
    return error;
  }

  if (error instanceof GradeManagementPublicError) {
    return new GradeManagementUiError(error.code, { cause: error });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return new GradeManagementUiError(error.code, { cause: error });
  }

  return new GradeManagementUiError("GRADE_MANAGEMENT_UI_OPERATION_FAILED", {
    cause: error as Error,
  });
}

export function toGradeManagementMessage(error: unknown) {
  const normalized = normalizeError(error);

  switch (normalized.code) {
    case "INVALID_GRADE_VALUE":
    case "GRADE_MANAGEMENT_PUBLIC_BULK_INVALID":
      return "La calificación debe capturarse con un valor válido entre 0 y 10.";
    case "GRADE_WINDOW_NOT_OPEN":
    case "GRADE_WINDOW_INVALID_STATE":
      return "La captura no está disponible en la ventana actual.";
    case "UNIT_GRADE_INVALID_STATE":
    case "SUBJECT_RESULT_INVALID_STATE":
    case "GRADE_CORRECTION_INVALID_STATE":
      return "La operación ya no está disponible para el estado actual.";
    case "TEACHER_ASSIGNMENT_NOT_ACTIVE":
    case "TEACHER_NOT_AUTHORIZED":
    case "ACTOR_NOT_AUTHORIZED":
      return "Tu cuenta no tiene autorización para operar esta calificación.";
    case "AAL2_REQUIRED":
      return "Se requiere verificación reforzada para completar esta operación.";
    case "APPLICATION_NOT_ALLOWED":
      return "Tu cuenta no tiene acceso a esta superficie de calificaciones.";
    case "IDEMPOTENCY_CONFLICT":
      return "La operación ya fue registrada anteriormente.";
    case "CONCURRENT_MODIFICATION":
      return "La información cambió mientras realizabas la operación. Intenta nuevamente.";
    case "PERIOD_NOT_AVAILABLE":
      return "El periodo académico ya no está disponible para esta operación.";
    default:
      return "No fue posible completar la operación de calificaciones.";
  }
}

export async function getGradeManagementService() {
  const store = await cookies();
  const env = readSupabasePublicEnv();

  return createGradeManagementPublicService(
    { publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, url: env.NEXT_PUBLIC_SUPABASE_URL },
    {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const value of values) {
          store.set({ name: value.name, value: value.value, ...value.options });
        }
      },
    },
  );
}

export async function requireGradeManagementAccess(requiredPermissions: readonly Permission[]) {
  const identity = await requireAdminAccess();

  if (
    requiredPermissions.length > 0 &&
    !hasAnyPermission(identity.context.roleCodes, requiredPermissions)
  ) {
    redirect("/sin-autorizacion");
  }

  return {
    identity,
    service: await getGradeManagementService(),
  };
}

export async function withGradeManagementService<T>(
  callback: (
    service: Awaited<ReturnType<typeof getGradeManagementService>>,
    identity: Awaited<ReturnType<typeof requireAdminAccess>>,
  ) => Promise<T>,
) {
  const identity = await requireAdminAccess();
  const service = await getGradeManagementService();

  try {
    return await callback(service, identity);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function listGradeManagementOfferings(filters?: GradeManagementPublicOfferingFilters) {
  return withGradeManagementService((service) => service.listOfferings(filters));
}

export async function listMyGradeManagementOfferings(
  filters?: GradeManagementPublicMyOfferingFilters,
) {
  return withGradeManagementService((service) => service.listMyOfferings(filters));
}

export async function getGradeManagementOfferingDetail(academicOfferingId: string) {
  return withGradeManagementService((service) => service.getOfferingDetail(academicOfferingId));
}

export async function getGradeManagementUnitGradeHistory(studentUnitGradeId: string) {
  return withGradeManagementService((service) => service.getUnitGradeHistory(studentUnitGradeId));
}

export async function getGradeManagementSubjectResultHistory(subjectFinalResultId: string) {
  return withGradeManagementService((service) =>
    service.getSubjectResultHistory(subjectFinalResultId),
  );
}

export async function listGradeManagementCorrections(
  filters?: GradeManagementPublicCorrectionFilters,
) {
  return withGradeManagementService((service) => service.listCorrections(filters));
}

export async function listGradeManagementWindows(filters?: GradeManagementPublicWindowFilters) {
  return withGradeManagementService((service) => service.listWindows(filters));
}

export async function createGradeWindow(input: CreateGradeCaptureWindowInput) {
  return withGradeManagementService((service) => service.createWindow(input));
}

export async function openGradeWindow(
  windowId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.openWindow(windowId, idempotencyKey, correlationId),
  );
}

export async function closeGradeWindow(
  windowId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.closeWindow(windowId, idempotencyKey, correlationId),
  );
}

export async function cancelGradeWindow(
  windowId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.cancelWindow(windowId, idempotencyKey, correlationId),
  );
}

export async function captureStudentUnitGrade(input: CaptureStudentUnitGradeInput) {
  return withGradeManagementService((service) => service.captureStudentUnitGrade(input));
}

export async function captureBulkUnitGrades(input: CaptureBulkUnitGradesInput) {
  return withGradeManagementService((service) => service.captureBulkUnitGrades(input));
}

export async function reviewStudentUnitGrade(
  studentUnitGradeId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.reviewStudentUnitGrade(studentUnitGradeId, idempotencyKey, correlationId),
  );
}

export async function finalizeStudentUnitGrade(
  studentUnitGradeId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.finalizeStudentUnitGrade(studentUnitGradeId, idempotencyKey, correlationId),
  );
}

export async function cancelStudentUnitGrade(
  studentUnitGradeId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.cancelStudentUnitGrade(studentUnitGradeId, idempotencyKey, correlationId),
  );
}

export async function calculateSubjectFinalResult(
  studentOfferingEnrollmentId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.calculateSubjectFinalResult(studentOfferingEnrollmentId, idempotencyKey, correlationId),
  );
}

export async function confirmSubjectFinalResult(
  subjectFinalResultId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.confirmSubjectFinalResult(subjectFinalResultId, idempotencyKey, correlationId),
  );
}

export async function createGradeCorrection(input: GradeManagementPublicCorrectionInput) {
  return withGradeManagementService((service) => service.createGradeCorrection(input));
}

export async function submitGradeCorrection(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.submitGradeCorrection(correctionId, idempotencyKey, correlationId),
  );
}

export async function beginGradeCorrectionReview(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.beginGradeCorrectionReview(correctionId, idempotencyKey, correlationId),
  );
}

export async function approveGradeCorrection(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.approveGradeCorrection(correctionId, idempotencyKey, correlationId),
  );
}

export async function rejectGradeCorrection(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.rejectGradeCorrection(correctionId, idempotencyKey, correlationId),
  );
}

export async function applyGradeCorrection(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.applyGradeCorrection(correctionId, idempotencyKey, correlationId),
  );
}

export async function cancelGradeCorrection(
  correctionId: string,
  idempotencyKey: string,
  correlationId?: string,
) {
  return withGradeManagementService((service) =>
    service.cancelGradeCorrection(correctionId, idempotencyKey, correlationId),
  );
}
