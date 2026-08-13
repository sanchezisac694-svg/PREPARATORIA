"use client";

import { useActionState } from "react";
import { Alert, Button, Field, FormMessage, Input, SectionCard } from "@preparatoria/ui";

import {
  beginMfaEnrollmentAction,
  type MfaActionState,
  verifyMfaEnrollmentAction,
} from "../../../actions";

function resolveQrImageSrc(qrCode: string): string {
  const trimmed = qrCode.trimStart();
  if (trimmed.startsWith("data:")) return qrCode;
  if (trimmed.startsWith("<svg")) return `data:image/svg+xml;utf-8,${encodeURIComponent(qrCode)}`;
  return qrCode;
}

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
    <div className="security-stack">
      <form action={beginAction} className="security-form">
        <Field
          helpText="Se solicitará nuevamente para confirmar que eres tú."
          label="NIP actual"
          labelFor="currentNip"
        >
          <Input
            autoComplete="current-password"
            id="currentNip"
            name="currentNip"
            type="password"
          />
        </Field>

        <Field
          helpText="Te ayudará a reconocer este autenticador dentro de tu cuenta."
          label="Nombre del autenticador (opcional)"
          labelFor="friendlyName"
        >
          <Input id="friendlyName" maxLength={60} name="friendlyName" type="text" />
        </Field>

        <div className="security-form__actions">
          <Button pending={beginning} type="submit">
            {beginning ? "Preparando…" : "Configurar autenticador"}
          </Button>
        </div>
      </form>

      {beginState.qrCode ? (
        <SectionCard
          description="Escanea el código o captura la clave temporal solo para completar la configuración."
          title="Configurar autenticador"
        >
          <Alert tone="warning">
            Este material es sensible. Úsalo únicamente para registrar tu autenticador y no lo
            compartas.
          </Alert>

          <div className="mfa-enrollment">
            <div className="mfa-enrollment__qr">
              <img
                alt="Código QR temporal para configurar el autenticador"
                src={resolveQrImageSrc(beginState.qrCode)}
              />
            </div>

            <div className="mfa-enrollment__details">
              <Field
                helpText="Si no puedes escanear el QR, ingresa esta clave manualmente en tu aplicación."
                label="Clave temporal"
                labelFor="temporarySecret"
              >
                <Input
                  id="temporarySecret"
                  readOnly
                  type="password"
                  value={beginState.secret ?? ""}
                />
              </Field>

              <form action={verifyAction} className="security-form">
                <input name="factorId" type="hidden" value={beginState.factorId ?? ""} />
                <Field
                  helpText="Escribe el código generado por tu autenticador para verificarlo."
                  label="Código de verificación"
                  labelFor="enrollmentCode"
                >
                  <Input
                    autoComplete="one-time-code"
                    id="enrollmentCode"
                    inputMode="numeric"
                    name="code"
                    pattern="[0-9]{6}"
                    placeholder="000000"
                  />
                </Field>

                <div className="security-form__actions">
                  <Button pending={verifying} type="submit">
                    {verifying ? "Verificando…" : "Verificar factor"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {beginState.error || verifyState.error ? (
        <FormMessage role="alert" tone="error">
          {beginState.error ?? verifyState.error}
        </FormMessage>
      ) : null}
      {verifyState.success ? (
        <FormMessage role="status" tone="success">
          {verifyState.success}
        </FormMessage>
      ) : null}
    </div>
  );
}
