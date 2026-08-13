"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getChargeGenerationAdapter } from "../../../lib/charge-generation";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function toGenerationMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "CHARGE_GENERATION_PREVIEW_REQUIRED":
        return "Debes revisar la vista previa antes de crear el lote.";
      case "CHARGE_GENERATION_BATCH_INVALID_STATE":
      case "CHARGE_GENERATION_BATCH_NOT_APPROVED":
        return "El lote no está en un estado válido para esta acción.";
      case "CHARGE_GENERATION_SELF_APPROVAL_NOT_ALLOWED":
        return "La aprobación debe realizarla una cuenta diferente de quien creó el lote.";
      case "CHARGE_GENERATION_RULE_NOT_ACTIVE":
      case "CHARGE_GENERATION_VERSION_NOT_APPROVED":
        return "La versión de regla indicada no está disponible para operar.";
      case "AAL2_REQUIRED":
        return "Se requiere verificación adicional para esta operación.";
      default:
        return "No fue posible completar la operación de generación de cargos.";
    }
  }

  return "No fue posible completar la operación de generación de cargos.";
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

export async function createChargeGenerationBatchAction(formData: FormData) {
  const targetAcademicPeriodId = requiredString(
    formData,
    "targetAcademicPeriodId",
    "/finanzas/generacion-cargos/nuevo",
    "Falta información para crear el lote.",
  );
  const targetRuleVersionId = requiredString(
    formData,
    "targetRuleVersionId",
    "/finanzas/generacion-cargos/nuevo",
    "Falta información para crear el lote.",
  );

  try {
    const adapter = await getChargeGenerationAdapter();
    await adapter.createBatch(
      {
        target_academic_period_id: targetAcademicPeriodId,
        target_rule_version_id: targetRuleVersionId,
      },
      `charge-generation:create:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/generacion-cargos");
    redirectWithStatus(
      "/finanzas/generacion-cargos/nuevo",
      "success",
      "El lote fue creado y quedó listo para revisión.",
    );
  } catch (error) {
    redirectWithStatus("/finanzas/generacion-cargos/nuevo", "error", toGenerationMessage(error));
  }
}

export async function submitChargeGenerationBatchAction(formData: FormData) {
  const targetBatchId = requiredString(
    formData,
    "targetBatchId",
    "/finanzas/generacion-cargos",
    "No fue posible identificar el lote.",
  );

  try {
    const adapter = await getChargeGenerationAdapter();
    await adapter.submitBatch(
      { target_batch_id: targetBatchId },
      `charge-generation:submit:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/generacion-cargos");
    revalidatePath(`/finanzas/generacion-cargos/${targetBatchId}`);
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "success",
      "El lote fue enviado a revisión.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "error",
      toGenerationMessage(error),
    );
  }
}

export async function approveChargeGenerationBatchAction(formData: FormData) {
  const targetBatchId = requiredString(
    formData,
    "targetBatchId",
    "/finanzas/generacion-cargos",
    "No fue posible identificar el lote.",
  );

  try {
    const adapter = await getChargeGenerationAdapter();
    await adapter.approveBatch(
      { target_batch_id: targetBatchId },
      `charge-generation:approve:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/generacion-cargos");
    revalidatePath(`/finanzas/generacion-cargos/${targetBatchId}`);
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "success",
      "El lote fue aprobado.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "error",
      toGenerationMessage(error),
    );
  }
}

export async function executeChargeGenerationBatchAction(formData: FormData) {
  const targetBatchId = requiredString(
    formData,
    "targetBatchId",
    "/finanzas/generacion-cargos",
    "No fue posible identificar el lote.",
  );

  try {
    const adapter = await getChargeGenerationAdapter();
    await adapter.executeBatch(
      { target_batch_id: targetBatchId },
      `charge-generation:execute:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/finanzas/generacion-cargos");
    revalidatePath(`/finanzas/generacion-cargos/${targetBatchId}`);
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "success",
      "La ejecución del lote fue registrada.",
    );
  } catch (error) {
    redirectWithStatus(
      `/finanzas/generacion-cargos/${targetBatchId}`,
      "error",
      toGenerationMessage(error),
    );
  }
}
