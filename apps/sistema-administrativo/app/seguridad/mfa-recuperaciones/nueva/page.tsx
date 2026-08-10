import { Alert, PageHeader, SectionCard, Button, Field, Input, Select } from "@preparatoria/ui";

import { requestMfaRecoveryAction } from "../actions";

export default function NewMfaRecoveryPage() {
  return (
    <>
      <PageHeader
        description="Registra una solicitud administrativa cuando una persona autorizada ya completó la validación humana fuera del sistema."
        title="Nueva recuperación MFA"
      />

      <SectionCard
        description="Confirma a quién se atenderá y el motivo de la intervención antes de registrar la solicitud."
        title="Registrar solicitud"
      >
        <Alert tone="warning">
          Esta acción es sensible. Úsala solo cuando la verificación institucional correspondiente
          ya se haya realizado por el canal autorizado.
        </Alert>

        <div className="security-form-shell">
          <form action={requestMfaRecoveryAction} className="security-form">
            <Field
              helpText="Escribe el identificador institucional exacto de la persona que será atendida."
              label="Identificador institucional"
              labelFor="institutionalIdentifier"
            >
              <Input
                autoComplete="off"
                id="institutionalIdentifier"
                maxLength={80}
                name="institutionalIdentifier"
                required
                type="text"
              />
            </Field>

            <Field
              helpText="Selecciona el motivo operativo que mejor describa la recuperación."
              label="Motivo"
              labelFor="reason"
            >
              <Select id="reason" name="reason">
                <option value="LOST_ALL_FACTORS">Pérdida de todos los factores</option>
                <option value="COMPROMISED_AUTHENTICATOR">Autenticador comprometido</option>
                <option value="DAMAGED_DEVICE">Dispositivo dañado</option>
              </Select>
            </Field>

            <div className="security-form__actions">
              <Button type="submit">Registrar solicitud</Button>
            </div>
          </form>
        </div>
      </SectionCard>
    </>
  );
}
