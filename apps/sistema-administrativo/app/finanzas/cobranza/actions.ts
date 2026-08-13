"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCollectionsAdapter } from "../../../lib/collections";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function toCollectionsMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "COLLECTION_CASE_REQUIRES_OVERDUE_BALANCE":
        return "La cuenta debe tener adeudo vencido para abrir un caso de cobranza.";
      case "COLLECTION_CASE_REQUIRES_SETTLED_OVERDUE":
        return "El caso solo puede cerrarse cuando el adeudo vencido ya quedó atendido.";
      case "COLLECTION_ACTION_SUMMARY_INVALID":
        return "La evidencia del seguimiento debe quedar resumida de forma clara.";
      case "COLLECTION_COMMITMENT_INVALID_STATE":
      case "COLLECTION_CASE_INVALID_STATE":
        return "El caso o compromiso ya no admite esta operación.";
      case "STUDENT_ACCOUNT_NOT_ACTIVE":
        return "La cuenta del alumno no está activa para esta operación.";
      case "AAL2_REQUIRED":
        return "Se requiere verificación adicional para completar la operación.";
      case "APPLICATION_NOT_ALLOWED":
        return "Tu cuenta no tiene acceso a esta operación de cobranza.";
      default:
        return "No fue posible completar la operación de cobranza.";
    }
  }

  return "No fue posible completar la operación de cobranza.";
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

export async function openCollectionCaseAction(formData: FormData) {
  const requestedStudentAccountId = requiredString(
    formData,
    "requestedStudentAccountId",
    "/finanzas/cobranza/nuevo",
    "Falta información para abrir el caso.",
  );
  const requestedOpenedReasonCode = requiredString(
    formData,
    "requestedOpenedReasonCode",
    "/finanzas/cobranza/nuevo",
    "Falta información para abrir el caso.",
  );
  const requestedPriority = requiredString(
    formData,
    "requestedPriority",
    "/finanzas/cobranza/nuevo",
    "Falta información para abrir el caso.",
  );

  try {
    const adapter = await getCollectionsAdapter();
    await adapter.openCase(
      {
        requested_opened_reason_code: requestedOpenedReasonCode,
        requested_priority: requestedPriority,
        requested_student_account_id: requestedStudentAccountId,
      },
      `collections:open:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/cobranza");
    revalidatePath("/finanzas/cobranza/adeudos");
    redirectWithStatus(
      "/finanzas/cobranza/nuevo",
      "success",
      "El caso de cobranza fue registrado.",
    );
  } catch (error) {
    redirectWithStatus("/finanzas/cobranza/nuevo", "error", toCollectionsMessage(error));
  }
}

export async function addCollectionActionAction(formData: FormData) {
  const requestedCollectionCaseId = requiredString(
    formData,
    "requestedCollectionCaseId",
    "/finanzas/cobranza",
    "Falta información para registrar el seguimiento.",
  );
  const requestedActionType = requiredString(
    formData,
    "requestedActionType",
    "/finanzas/cobranza",
    "Falta información para registrar el seguimiento.",
  );
  const requestedContactChannel = requiredString(
    formData,
    "requestedContactChannel",
    "/finanzas/cobranza",
    "Falta información para registrar el seguimiento.",
  );
  const requestedSummary = requiredString(
    formData,
    "requestedSummary",
    "/finanzas/cobranza",
    "Falta información para registrar el seguimiento.",
  );

  try {
    const adapter = await getCollectionsAdapter();
    await adapter.addAction(
      {
        requested_action_status: "RECORDED",
        requested_action_type: requestedActionType,
        requested_collection_case_id: requestedCollectionCaseId,
        requested_contact_channel: requestedContactChannel,
        requested_occurred_at: new Date().toISOString(),
        requested_summary: requestedSummary,
      },
      `collections:action:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/cobranza");
    revalidatePath(`/finanzas/cobranza/${requestedCollectionCaseId}`);
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "success",
      "El seguimiento quedó registrado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "error",
      toCollectionsMessage(error),
    );
  }
}

export async function createPaymentCommitmentAction(formData: FormData) {
  const requestedCollectionCaseId = requiredString(
    formData,
    "requestedCollectionCaseId",
    "/finanzas/cobranza",
    "Falta información para registrar el compromiso.",
  );
  const requestedStudentAccountId = requiredString(
    formData,
    "requestedStudentAccountId",
    "/finanzas/cobranza",
    "Falta información para registrar el compromiso.",
  );
  const requestedPromisedAmount = requiredString(
    formData,
    "requestedPromisedAmount",
    "/finanzas/cobranza",
    "Falta información para registrar el compromiso.",
  );
  const requestedPromisedDate = requiredString(
    formData,
    "requestedPromisedDate",
    "/finanzas/cobranza",
    "Falta información para registrar el compromiso.",
  );
  const requestedNotes = formData.get("requestedNotes");

  try {
    const adapter = await getCollectionsAdapter();
    await adapter.createCommitment(
      {
        requested_collection_case_id: requestedCollectionCaseId,
        requested_notes:
          typeof requestedNotes === "string" && requestedNotes.length > 0 ? requestedNotes : null,
        requested_promised_amount: requestedPromisedAmount,
        requested_promised_date: requestedPromisedDate,
        requested_student_account_id: requestedStudentAccountId,
      },
      `collections:commitment:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath(`/finanzas/cobranza/${requestedCollectionCaseId}`);
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "success",
      "El compromiso de pago fue registrado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "error",
      toCollectionsMessage(error),
    );
  }
}

export async function closeCollectionCaseAction(formData: FormData) {
  const requestedCollectionCaseId = requiredString(
    formData,
    "requestedCollectionCaseId",
    "/finanzas/cobranza",
    "No fue posible identificar el caso.",
  );
  const requestedCloseReasonCode = requiredString(
    formData,
    "requestedCloseReasonCode",
    "/finanzas/cobranza",
    "No fue posible identificar el caso.",
  );

  try {
    const adapter = await getCollectionsAdapter();
    await adapter.closeCase(
      {
        requested_close_reason_code: requestedCloseReasonCode,
        requested_collection_case_id: requestedCollectionCaseId,
      },
      `collections:close:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/cobranza");
    revalidatePath(`/finanzas/cobranza/${requestedCollectionCaseId}`);
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "success",
      "El caso de cobranza fue cerrado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/cobranza/${requestedCollectionCaseId}`,
      "error",
      toCollectionsMessage(error),
    );
  }
}
