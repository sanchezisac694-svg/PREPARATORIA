"use client";

import { useActionState } from "react";
import { Button, Field, FormMessage, Input } from "@preparatoria/ui";

import { verifyMfaChallengeAction } from "../../actions";

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(verifyMfaChallengeAction, {});

  return (
    <form action={action} className="auth-form">
      <Field
        helpText="Escribe el código temporal tal como aparece en tu autenticador."
        label="Código de verificación"
        labelFor="mfaCode"
      >
        <Input
          autoComplete="one-time-code"
          id="mfaCode"
          inputMode="numeric"
          name="code"
          pattern="[0-9]{6}"
          placeholder="000000"
        />
      </Field>

      <div className="auth-form__actions">
        <Button pending={pending} type="submit">
          {pending ? "Verificando…" : "Continuar"}
        </Button>
      </div>

      {state.error ? (
        <FormMessage role="alert" tone="error">
          {state.error}
        </FormMessage>
      ) : null}
    </form>
  );
}
