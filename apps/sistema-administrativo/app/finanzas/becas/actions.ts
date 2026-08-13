"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getFinancialBenefitsAdapter } from "../../../lib/financial-benefits";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function toBenefitsMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "ADJUSTMENT_EXCEEDS_BALANCE":
        return "El beneficio no puede exceder el saldo vigente del cargo.";
      case "STUDENT_SCHOLARSHIP_INVALID_STATE":
      case "SCHOLARSHIP_PROGRAM_INVALID_STATE":
      case "ADJUSTMENT_INVALID_STATE":
        return "El beneficio indicado ya no admite esta operación.";
      case "SCHOLARSHIP_ALREADY_APPLIED":
        return "La beca ya fue aplicada al cargo indicado.";
      case "AAL2_REQUIRED":
        return "Se requiere verificación adicional para esta operación.";
      default:
        return "No fue posible completar la operación de beneficios financieros.";
    }
  }

  return "No fue posible completar la operación de beneficios financieros.";
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

export async function createScholarshipProgramAction(formData: FormData) {
  const requestedCode = requiredString(
    formData,
    "requestedCode",
    "/finanzas/becas/nuevo",
    "Falta el código del programa.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.createProgram(
      { requested_code: requestedCode },
      `benefits:program:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/becas");
    redirectWithStatus("/finanzas/becas/nuevo", "success", "El programa de beca fue registrado.");
  } catch (error) {
    redirectWithStatus("/finanzas/becas/nuevo", "error", toBenefitsMessage(error));
  }
}

export async function applyScholarshipAction(formData: FormData) {
  const targetChargeId = requiredString(
    formData,
    "targetChargeId",
    "/finanzas/becas",
    "Falta información para aplicar la beca.",
  );
  const targetStudentScholarshipId = requiredString(
    formData,
    "targetStudentScholarshipId",
    "/finanzas/becas",
    "Falta información para aplicar la beca.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.applyScholarship(
      {
        target_charge_id: targetChargeId,
        target_student_scholarship_id: targetStudentScholarshipId,
      },
      `benefits:scholarship-apply:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/becas");
    redirectWithStatus("/finanzas/becas", "success", "La beca fue aplicada al cargo.");
  } catch (error) {
    redirectWithStatus("/finanzas/becas", "error", toBenefitsMessage(error));
  }
}

export async function applyDiscountAction(formData: FormData) {
  const targetChargeId = requiredString(
    formData,
    "targetChargeId",
    "/finanzas/descuentos",
    "Falta información para registrar el descuento.",
  );
  const requestedAmount = requiredString(
    formData,
    "requestedAmount",
    "/finanzas/descuentos",
    "Falta información para registrar el descuento.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.applyDiscount(
      { requested_amount: Number(requestedAmount), target_charge_id: targetChargeId },
      `benefits:discount:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/descuentos");
    redirectWithStatus(
      "/finanzas/descuentos",
      "success",
      "El descuento autorizado fue registrado.",
    );
  } catch (error) {
    redirectWithStatus("/finanzas/descuentos", "error", toBenefitsMessage(error));
  }
}

export async function createWaiverAction(formData: FormData) {
  const targetChargeId = requiredString(
    formData,
    "targetChargeId",
    "/finanzas/descuentos",
    "Falta información para registrar la condonación.",
  );
  const requestedAmount = requiredString(
    formData,
    "requestedAmount",
    "/finanzas/descuentos",
    "Falta información para registrar la condonación.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.createWaiver(
      { requested_amount: Number(requestedAmount), target_charge_id: targetChargeId },
      `benefits:waiver-create:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/descuentos");
    redirectWithStatus(
      "/finanzas/descuentos",
      "success",
      "La condonación quedó registrada y pendiente de aprobación.",
    );
  } catch (error) {
    redirectWithStatus("/finanzas/descuentos", "error", toBenefitsMessage(error));
  }
}

export async function approveWaiverAction(formData: FormData) {
  const targetAdjustmentId = requiredString(
    formData,
    "targetAdjustmentId",
    "/finanzas/descuentos",
    "No fue posible identificar la condonación.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.approveWaiver(
      { target_adjustment_id: targetAdjustmentId },
      `benefits:waiver-approve:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/descuentos");
    redirectWithStatus("/finanzas/descuentos", "success", "La condonación fue aprobada.");
  } catch (error) {
    redirectWithStatus("/finanzas/descuentos", "error", toBenefitsMessage(error));
  }
}

export async function applyWaiverAction(formData: FormData) {
  const targetAdjustmentId = requiredString(
    formData,
    "targetAdjustmentId",
    "/finanzas/descuentos",
    "No fue posible identificar la condonación.",
  );

  try {
    const adapter = await getFinancialBenefitsAdapter();
    await adapter.applyWaiver(
      { target_adjustment_id: targetAdjustmentId },
      `benefits:waiver-apply:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/descuentos");
    redirectWithStatus("/finanzas/descuentos", "success", "La condonación fue aplicada.");
  } catch (error) {
    redirectWithStatus("/finanzas/descuentos", "error", toBenefitsMessage(error));
  }
}
