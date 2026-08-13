"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCashRegisterAdapter } from "../../lib/cash-register";

function redirectWithStatus(pathname: string, status: string, message?: string) {
  const search = new URLSearchParams({ status });
  if (message) {
    search.set("message", message);
  }
  redirect(`${pathname}?${search.toString()}`);
}

function toCashMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    switch (error.code) {
      case "CASH_SESSION_ALREADY_OPEN":
        return "Ya existe un turno operativo abierto para esta caja.";
      case "CASH_PAYMENT_REQUIRES_OPEN_SESSION":
      case "CASH_SESSION_NOT_OPEN":
        return "Se requiere un turno abierto para completar esta operación.";
      case "CASH_COUNT_REQUIRED":
        return "Primero debes registrar el conteo de efectivo.";
      case "CASH_RECONCILIATION_REQUIRED":
        return "La sesión requiere conciliación antes de continuar.";
      case "CASH_DIFFERENCE_APPROVAL_REQUIRED":
        return "La diferencia detectada requiere aprobación autorizada.";
      case "AAL2_REQUIRED":
        return "Se requiere verificación adicional para esta operación.";
      case "ACTOR_NOT_AUTHORIZED":
      case "APPLICATION_NOT_ALLOWED":
        return "Tu cuenta no tiene autorización para operar esta acción.";
      default:
        return "No fue posible completar la operación de caja.";
    }
  }

  return "No fue posible completar la operación de caja.";
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

export async function openCashSessionAction(formData: FormData) {
  const targetRegisterId = requiredString(
    formData,
    "targetRegisterId",
    "/caja/turno",
    "Información incompleta para abrir el turno.",
  );
  const requestedBusinessDate = requiredString(
    formData,
    "requestedBusinessDate",
    "/caja/turno",
    "Información incompleta para abrir el turno.",
  );
  const openingAmount = requiredString(
    formData,
    "openingAmount",
    "/caja/turno",
    "Información incompleta para abrir el turno.",
  );

  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.openSession(
      {
        opening_amount: openingAmount,
        requested_business_date: requestedBusinessDate,
        target_register_id: targetRegisterId,
      },
      `cash:open:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja");
    revalidatePath("/caja/turno");
    redirectWithStatus("/caja/turno", "success", "El turno de caja fue abierto.");
  } catch (error) {
    redirectWithStatus("/caja/turno", "error", toCashMessage(error));
  }
}

export async function registerCashierPaymentAction(formData: FormData) {
  const accountId = requiredString(
    formData,
    "accountId",
    "/caja/cobros/nuevo",
    "Información incompleta para registrar el cobro.",
  );
  const requestedAmount = requiredString(
    formData,
    "requestedAmount",
    "/caja/cobros/nuevo",
    "Información incompleta para registrar el cobro.",
  );
  const requestedMethod = requiredString(
    formData,
    "requestedMethod",
    "/caja/cobros/nuevo",
    "Información incompleta para registrar el cobro.",
  );
  const sessionId = requiredString(
    formData,
    "sessionId",
    "/caja/cobros/nuevo",
    "Información incompleta para registrar el cobro.",
  );

  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.registerPayment(
      {
        account_id: accountId,
        confirm_operation_key: `cash:confirm:${randomUUID()}`,
        register_operation_key: `cash:register:${randomUUID()}`,
        requested_amount: requestedAmount,
        requested_method: requestedMethod,
        session_id: sessionId,
      },
      `cash:link:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja");
    revalidatePath("/caja/cobros/nuevo");
    redirectWithStatus(
      "/caja/cobros/nuevo",
      "success",
      "Cobro registrado. Comprobante interno de registro de pago. No constituye CFDI ni comprobante fiscal.",
    );
  } catch (error) {
    redirectWithStatus("/caja/cobros/nuevo", "error", toCashMessage(error));
  }
}

export async function registerCashMovementAction(formData: FormData) {
  const amount = requiredString(
    formData,
    "amount",
    "/caja/movimientos",
    "Información incompleta para registrar el movimiento.",
  );
  const movementType = requiredString(
    formData,
    "movementType",
    "/caja/movimientos",
    "Información incompleta para registrar el movimiento.",
  );
  const reasonCode = requiredString(
    formData,
    "reasonCode",
    "/caja/movimientos",
    "Información incompleta para registrar el movimiento.",
  );
  const targetSessionId = requiredString(
    formData,
    "targetSessionId",
    "/caja/movimientos",
    "Información incompleta para registrar el movimiento.",
  );

  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.registerMovement(
      {
        amount,
        movement_type: movementType,
        reason_code: reasonCode,
        target_session_id: targetSessionId,
      },
      `cash:movement:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja");
    revalidatePath("/caja/movimientos");
    redirectWithStatus("/caja/movimientos", "success", "El movimiento manual fue registrado.");
  } catch (error) {
    redirectWithStatus("/caja/movimientos", "error", toCashMessage(error));
  }
}

export async function beginCashSessionCloseAction(formData: FormData) {
  const targetSessionId = requiredString(
    formData,
    "targetSessionId",
    "/caja/arqueo",
    "No fue posible identificar el turno.",
  );
  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.beginClose(
      { target_session_id: targetSessionId },
      `cash:begin-close:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja/arqueo");
    revalidatePath("/caja/cierre");
    redirectWithStatus("/caja/arqueo", "success", "El turno pasó a proceso de cierre.");
  } catch (error) {
    redirectWithStatus("/caja/arqueo", "error", toCashMessage(error));
  }
}

export async function recordCashCountAction(formData: FormData) {
  const countedAmount = requiredString(
    formData,
    "countedAmount",
    "/caja/arqueo",
    "Falta el conteo total para continuar.",
  );
  const targetSessionId = requiredString(
    formData,
    "targetSessionId",
    "/caja/arqueo",
    "Falta el conteo total para continuar.",
  );
  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.recordCount(
      { counted_amount: countedAmount, target_session_id: targetSessionId },
      `cash:count:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja/arqueo");
    revalidatePath("/caja/cierre");
    redirectWithStatus("/caja/arqueo", "success", "El conteo fue registrado.");
  } catch (error) {
    redirectWithStatus("/caja/arqueo", "error", toCashMessage(error));
  }
}

export async function closeCashSessionAction(formData: FormData) {
  const targetSessionId = requiredString(
    formData,
    "targetSessionId",
    "/caja/cierre",
    "No fue posible identificar el turno.",
  );
  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.closeSession(
      {
        difference_note: null,
        difference_reason_code: null,
        target_session_id: targetSessionId,
      },
      `cash:close:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja");
    revalidatePath("/caja/cierre");
    redirectWithStatus("/caja/cierre", "success", "El cierre del turno fue registrado.");
  } catch (error) {
    redirectWithStatus("/caja/cierre", "error", toCashMessage(error));
  }
}

export async function approveCashDifferenceAction(formData: FormData) {
  const targetSessionId = requiredString(
    formData,
    "targetSessionId",
    "/caja/cierre",
    "No fue posible identificar el turno.",
  );
  try {
    const adapter = await getCashRegisterAdapter();
    await adapter.approveDifference(
      { target_session_id: targetSessionId },
      `cash:approve:${randomUUID()}`,
      randomUUID(),
    );
    revalidatePath("/caja");
    revalidatePath("/caja/cierre");
    redirectWithStatus("/caja/cierre", "success", "La diferencia fue aprobada.");
  } catch (error) {
    redirectWithStatus("/caja/cierre", "error", toCashMessage(error));
  }
}
