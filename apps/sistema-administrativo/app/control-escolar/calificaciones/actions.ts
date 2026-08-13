"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  applyGradeCorrection,
  approveGradeCorrection,
  beginGradeCorrectionReview,
  cancelGradeCorrection,
  cancelGradeWindow,
  cancelStudentUnitGrade,
  captureBulkUnitGrades,
  captureStudentUnitGrade,
  closeGradeWindow,
  confirmSubjectFinalResult,
  createGradeCorrection,
  createGradeWindow,
  finalizeStudentUnitGrade,
  openGradeWindow,
  rejectGradeCorrection,
  reviewStudentUnitGrade,
  submitGradeCorrection,
  toGradeManagementMessage,
} from "../../../lib/grade-management";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function requiredString(
  formData: FormData,
  key: string,
  pathname: string,
  message: string,
): string {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) {
    redirectWithStatus(pathname, "error", message);
  }
  return value as string;
}

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function revalidateGradePaths(offeringPath: string) {
  revalidatePath("/control-escolar/calificaciones");
  revalidatePath("/control-escolar/calificaciones/mis-grupos");
  revalidatePath("/control-escolar/calificaciones/correcciones");
  revalidatePath("/control-escolar/calificaciones/ventanas");
  revalidatePath(offeringPath);
}

export async function captureStudentUnitGradeAction(formData: FormData) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones",
    "No fue posible identificar el offering.",
  );

  try {
    await captureStudentUnitGrade({
      correlationId: randomUUID(),
      idempotencyKey: `grade-capture:${randomUUID()}`,
      rawGrade: requiredString(
        formData,
        "rawGrade",
        pathname,
        "Debes indicar una calificación válida.",
      ),
      studentOfferingEnrollmentId: requiredString(
        formData,
        "studentOfferingEnrollmentId",
        pathname,
        "No fue posible identificar la inscripción de la materia.",
      ),
      subjectUnitId: requiredString(
        formData,
        "subjectUnitId",
        pathname,
        "No fue posible identificar la unidad.",
      ),
    });
    revalidateGradePaths(pathname);
    redirectWithStatus(pathname, "success", "La calificación fue registrada correctamente.");
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

export async function captureBulkUnitGradesAction(formData: FormData) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones",
    "No fue posible identificar el offering.",
  );
  const raw = requiredString(
    formData,
    "bulkItems",
    pathname,
    "No hay calificaciones listas para enviar.",
  );

  try {
    const items = JSON.parse(raw) as Array<{
      rawGrade: string;
      studentOfferingEnrollmentId: string;
      subjectUnitId: string;
    }>;
    await captureBulkUnitGrades({
      correlationId: randomUUID(),
      idempotencyKey: `grade-bulk:${randomUUID()}`,
      items,
    });
    revalidateGradePaths(pathname);
    redirectWithStatus(pathname, "success", "La captura masiva fue registrada.");
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

async function runUnitAction(
  formData: FormData,
  action: (
    studentUnitGradeId: string,
    idempotencyKey: string,
    correlationId?: string,
  ) => Promise<unknown>,
  successMessage: string,
) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones",
    "No fue posible identificar el offering.",
  );

  try {
    await action(
      requiredString(
        formData,
        "studentUnitGradeId",
        pathname,
        "No fue posible identificar la unidad.",
      ),
      `grade-unit:${randomUUID()}`,
      randomUUID(),
    );
    revalidateGradePaths(pathname);
    redirectWithStatus(pathname, "success", successMessage);
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

export async function reviewStudentUnitGradeAction(formData: FormData) {
  return runUnitAction(formData, reviewStudentUnitGrade, "La unidad fue marcada como revisada.");
}

export async function finalizeStudentUnitGradeAction(formData: FormData) {
  return runUnitAction(formData, finalizeStudentUnitGrade, "La unidad fue finalizada.");
}

export async function cancelStudentUnitGradeAction(formData: FormData) {
  return runUnitAction(formData, cancelStudentUnitGrade, "La unidad fue cancelada.");
}

export async function confirmSubjectFinalResultAction(formData: FormData) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones",
    "No fue posible identificar el offering.",
  );

  try {
    await confirmSubjectFinalResult(
      requiredString(
        formData,
        "subjectFinalResultId",
        pathname,
        "No fue posible identificar el resultado.",
      ),
      `grade-result:${randomUUID()}`,
      randomUUID(),
    );
    revalidateGradePaths(pathname);
    redirectWithStatus(pathname, "success", "El resultado de materia fue confirmado.");
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

export async function createGradeWindowAction(formData: FormData) {
  const pathname = "/control-escolar/calificaciones/ventanas";

  try {
    await createGradeWindow({
      academicPeriodId: requiredString(
        formData,
        "academicPeriodId",
        pathname,
        "Debes seleccionar un periodo.",
      ),
      closesAt: requiredString(formData, "closesAt", pathname, "Debes indicar el cierre."),
      correlationId: randomUUID(),
      gradeWindowType: requiredString(
        formData,
        "gradeWindowType",
        pathname,
        "Debes indicar el tipo.",
      ),
      idempotencyKey: `grade-window:${randomUUID()}`,
      opensAt: requiredString(formData, "opensAt", pathname, "Debes indicar la apertura."),
      unitNumber: (() => {
        const value = optionalString(formData, "unitNumber");
        if (!value) return null;
        const numeric = Number.parseInt(value, 10);
        return Number.isInteger(numeric) ? numeric : null;
      })(),
    });
    revalidatePath(pathname);
    redirectWithStatus(pathname, "success", "La ventana fue creada.");
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

async function runWindowAction(
  formData: FormData,
  action: (windowId: string, idempotencyKey: string, correlationId?: string) => Promise<unknown>,
  successMessage: string,
) {
  const pathname = "/control-escolar/calificaciones/ventanas";

  try {
    await action(
      requiredString(
        formData,
        "gradeCaptureWindowId",
        pathname,
        "No fue posible identificar la ventana.",
      ),
      `grade-window:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath(pathname);
    redirectWithStatus(pathname, "success", successMessage);
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

export async function openGradeWindowAction(formData: FormData) {
  return runWindowAction(formData, openGradeWindow, "La ventana fue abierta.");
}

export async function closeGradeWindowAction(formData: FormData) {
  return runWindowAction(formData, closeGradeWindow, "La ventana fue cerrada.");
}

export async function cancelGradeWindowAction(formData: FormData) {
  return runWindowAction(formData, cancelGradeWindow, "La ventana fue cancelada.");
}

export async function createGradeCorrectionAction(formData: FormData) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones/correcciones",
    "No fue posible identificar la ruta de retorno.",
  );

  try {
    await createGradeCorrection({
      correlationId: randomUUID(),
      gradeCorrectionReason: requiredString(
        formData,
        "gradeCorrectionReason",
        pathname,
        "Debes indicar el motivo.",
      ),
      idempotencyKey: `grade-correction:${randomUUID()}`,
      proposedRawGrade: requiredString(
        formData,
        "proposedRawGrade",
        pathname,
        "Debes indicar la calificación propuesta.",
      ),
      studentUnitGradeId: requiredString(
        formData,
        "studentUnitGradeId",
        pathname,
        "No fue posible identificar la unidad.",
      ),
    });
    revalidatePath("/control-escolar/calificaciones/correcciones");
    revalidatePath(pathname);
    redirectWithStatus(pathname, "success", "La corrección fue registrada.");
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

async function runCorrectionAction(
  formData: FormData,
  action: (
    correctionId: string,
    idempotencyKey: string,
    correlationId?: string,
  ) => Promise<unknown>,
  successMessage: string,
) {
  const pathname = requiredString(
    formData,
    "returnPath",
    "/control-escolar/calificaciones/correcciones",
    "No fue posible identificar la ruta de retorno.",
  );

  try {
    await action(
      requiredString(
        formData,
        "correctionId",
        pathname,
        "No fue posible identificar la corrección.",
      ),
      `grade-correction:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/control-escolar/calificaciones/correcciones");
    revalidatePath(pathname);
    redirectWithStatus(pathname, "success", successMessage);
  } catch (error) {
    redirectWithStatus(pathname, "error", toGradeManagementMessage(error));
  }
}

export async function submitGradeCorrectionAction(formData: FormData) {
  return runCorrectionAction(formData, submitGradeCorrection, "La corrección fue enviada.");
}

export async function beginGradeCorrectionReviewAction(formData: FormData) {
  return runCorrectionAction(
    formData,
    beginGradeCorrectionReview,
    "La corrección pasó a revisión.",
  );
}

export async function approveGradeCorrectionAction(formData: FormData) {
  return runCorrectionAction(formData, approveGradeCorrection, "La corrección fue aprobada.");
}

export async function rejectGradeCorrectionAction(formData: FormData) {
  return runCorrectionAction(formData, rejectGradeCorrection, "La corrección fue rechazada.");
}

export async function applyGradeCorrectionAction(formData: FormData) {
  return runCorrectionAction(formData, applyGradeCorrection, "La corrección fue aplicada.");
}

export async function cancelGradeCorrectionAction(formData: FormData) {
  return runCorrectionAction(formData, cancelGradeCorrection, "La corrección fue cancelada.");
}
