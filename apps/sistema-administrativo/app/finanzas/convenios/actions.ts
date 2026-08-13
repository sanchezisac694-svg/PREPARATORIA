"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPaymentAgreementsAdapter } from "../../../lib/payment-agreements";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function toAgreementMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "PAYMENT_AGREEMENT_INVALID":
      case "PAYMENT_AGREEMENT_INVALID_STATE":
        return "El convenio ya no admite la operación solicitada.";
      case "PAYMENT_AGREEMENT_INSTALLMENT_NOT_FOUND":
        return "No fue posible localizar la parcialidad indicada.";
      case "STUDENT_ACCOUNT_NOT_ACTIVE":
        return "La cuenta del alumno no está activa para operar convenios.";
      case "AAL2_REQUIRED":
        return "Se requiere verificación adicional para esta operación.";
      default:
        return "No fue posible completar la operación del convenio.";
    }
  }

  return "No fue posible completar la operación del convenio.";
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

export async function createPaymentAgreementAction(formData: FormData) {
  const targetStudentAccountId = requiredString(
    formData,
    "targetStudentAccountId",
    "/finanzas/convenios/nuevo",
    "Falta información para crear el convenio.",
  );
  const requestedAgreedAmount = requiredString(
    formData,
    "requestedAgreedAmount",
    "/finanzas/convenios/nuevo",
    "Falta información para crear el convenio.",
  );

  try {
    const adapter = await getPaymentAgreementsAdapter();
    await adapter.createAgreement(
      {
        requested_agreed_amount: Number(requestedAgreedAmount),
        target_student_account_id: targetStudentAccountId,
      },
      `agreements:create:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/convenios");
    redirectWithStatus("/finanzas/convenios/nuevo", "success", "El convenio fue registrado.");
  } catch (error) {
    redirectWithStatus("/finanzas/convenios/nuevo", "error", toAgreementMessage(error));
  }
}

export async function approvePaymentAgreementAction(formData: FormData) {
  const targetPaymentAgreementId = requiredString(
    formData,
    "targetPaymentAgreementId",
    "/finanzas/convenios",
    "No fue posible identificar el convenio.",
  );

  try {
    const adapter = await getPaymentAgreementsAdapter();
    await adapter.approveAgreement(
      { target_payment_agreement_id: targetPaymentAgreementId },
      `agreements:approve:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/convenios");
    revalidatePath(`/finanzas/convenios/${targetPaymentAgreementId}`);
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "success",
      "El convenio fue aprobado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "error",
      toAgreementMessage(error),
    );
  }
}

export async function reconcilePaymentAgreementInstallmentAction(formData: FormData) {
  const targetInstallmentId = requiredString(
    formData,
    "targetInstallmentId",
    "/finanzas/convenios",
    "Falta información para conciliar la parcialidad.",
  );
  const targetPaymentAgreementId = requiredString(
    formData,
    "targetPaymentAgreementId",
    "/finanzas/convenios",
    "Falta información para conciliar la parcialidad.",
  );

  try {
    const adapter = await getPaymentAgreementsAdapter();
    await adapter.reconcileInstallment(
      { target_installment_id: targetInstallmentId },
      `agreements:reconcile:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/convenios");
    revalidatePath(`/finanzas/convenios/${targetPaymentAgreementId}`);
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "success",
      "La parcialidad fue conciliada.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "error",
      toAgreementMessage(error),
    );
  }
}

export async function cancelPaymentAgreementAction(formData: FormData) {
  const targetPaymentAgreementId = requiredString(
    formData,
    "targetPaymentAgreementId",
    "/finanzas/convenios",
    "Falta información para cancelar el convenio.",
  );
  const requestedReason = requiredString(
    formData,
    "requestedReason",
    "/finanzas/convenios",
    "Falta información para cancelar el convenio.",
  );

  try {
    const adapter = await getPaymentAgreementsAdapter();
    await adapter.cancelAgreement(
      {
        requested_reason: requestedReason,
        target_payment_agreement_id: targetPaymentAgreementId,
      },
      `agreements:cancel:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/convenios");
    revalidatePath(`/finanzas/convenios/${targetPaymentAgreementId}`);
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "success",
      "El convenio fue cancelado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "error",
      toAgreementMessage(error),
    );
  }
}

export async function markPaymentAgreementDefaultedAction(formData: FormData) {
  const targetPaymentAgreementId = requiredString(
    formData,
    "targetPaymentAgreementId",
    "/finanzas/convenios",
    "Falta información para registrar el incumplimiento.",
  );
  const requestedReason = requiredString(
    formData,
    "requestedReason",
    "/finanzas/convenios",
    "Falta información para registrar el incumplimiento.",
  );

  try {
    const adapter = await getPaymentAgreementsAdapter();
    await adapter.markDefaulted(
      {
        requested_reason: requestedReason,
        target_payment_agreement_id: targetPaymentAgreementId,
      },
      `agreements:default:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/convenios");
    revalidatePath(`/finanzas/convenios/${targetPaymentAgreementId}`);
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "success",
      "El convenio fue marcado como incumplido.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/convenios/${targetPaymentAgreementId}`,
      "error",
      toAgreementMessage(error),
    );
  }
}
