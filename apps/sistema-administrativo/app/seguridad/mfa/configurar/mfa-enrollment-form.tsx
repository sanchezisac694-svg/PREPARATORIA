"use client";

import { useActionState } from "react";
import { Button } from "@preparatoria/ui";
import {
  beginMfaEnrollmentAction,
  type MfaActionState,
  verifyMfaEnrollmentAction,
} from "../../../actions";

export function MfaEnrollmentForm() {
  const initialMfaState: MfaActionState = {};
  const [beginState, beginAction, beginning] = useActionState(
    beginMfaEnrollmentAction,
    initialMfaState,
  );
  const [verifyState, verifyAction, verifying] = useActionState(
    verifyMfaEnrollmentAction,
    initialMfaState,
  );
  return (
    <>
      <form action={beginAction}>
        <label htmlFor="currentNip">NIP actual</label>
        <input id="currentNip" name="currentNip" type="password" autoComplete="current-password" />
        <label htmlFor="friendlyName">Nombre del autenticador (opcional)</label>
        <input id="friendlyName" name="friendlyName" maxLength={60} />
        <Button disabled={beginning} type="submit">
          {beginning ? "Preparando…" : "Configurar autenticador"}
        </Button>
      </form>
      {beginState.qrCode ? (
        <section aria-label="Configuración temporal del autenticador">
          <p>Escanea este código. No lo guardes ni lo compartas.</p>
          <img
            alt="Código QR temporal para configurar el autenticador"
            src={`data:image/svg+xml;utf-8,${encodeURIComponent(beginState.qrCode)}`}
          />
          <label htmlFor="temporarySecret">Clave temporal</label>
          <input id="temporarySecret" readOnly type="password" value={beginState.secret ?? ""} />
          <form action={verifyAction}>
            <label htmlFor="enrollmentCode">Código de seis dígitos</label>
            <input
              autoComplete="one-time-code"
              id="enrollmentCode"
              inputMode="numeric"
              name="code"
              pattern="[0-9]{6}"
            />
            <Button disabled={verifying} type="submit">
              {verifying ? "Verificando…" : "Verificar factor"}
            </Button>
          </form>
        </section>
      ) : null}
      <p aria-live="polite">{beginState.error ?? verifyState.error ?? verifyState.success}</p>
    </>
  );
}
