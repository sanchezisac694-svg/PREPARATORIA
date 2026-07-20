"use server";

import { redirect } from "next/navigation";

import { adminAuthentication } from "../../../lib/auth";

async function requireAdministrativeAal2(): Promise<void> {
  const authentication = await adminAuthentication();
  const [identity, assurance] = await Promise.all([
    authentication.getAuthenticatedIdentity(),
    authentication.getAuthenticatorAssuranceLevel(),
  ]);
  if (
    !identity.ok ||
    !assurance.ok ||
    assurance.currentLevel !== "aal2" ||
    !identity.identity.context.roleCodes.some((role) =>
      ["SUPERADMIN", "ADMINISTRATIVO", "CONTROL_ESCOLAR"].includes(role),
    )
  ) {
    redirect("/sin-autorizacion");
  }
}

async function failClosed(): Promise<never> {
  await requireAdministrativeAal2();
  redirect("/seguridad/mfa-recuperaciones?error=1");
}

export async function requestMfaRecoveryAction(_formData: FormData) {
  void _formData;
  return failClosed();
}

export async function verifyMfaRecoveryIdentityAction(_formData: FormData) {
  void _formData;
  return failClosed();
}

export async function approveMfaRecoveryAction(_formData: FormData) {
  void _formData;
  return failClosed();
}

export async function executeMfaRecoveryAction(_formData: FormData) {
  void _formData;
  return failClosed();
}

export async function cancelMfaRecoveryAction(_formData: FormData) {
  void _formData;
  return failClosed();
}

export async function reconcileMfaRecoveryAction(_formData: FormData) {
  void _formData;
  return failClosed();
}
