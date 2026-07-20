"use client";

import { useActionState } from "react";
import { Button } from "@preparatoria/ui";
import { verifyMfaChallengeAction } from "../../actions";

export function MfaChallengeForm() {
  const [state, action, pending] = useActionState(verifyMfaChallengeAction, {});
  return (
    <form action={action}>
      <label htmlFor="mfaCode">Código de seis dígitos</label>
      <input
        autoComplete="one-time-code"
        id="mfaCode"
        inputMode="numeric"
        name="code"
        pattern="[0-9]{6}"
      />
      <Button disabled={pending} type="submit">
        {pending ? "Verificando…" : "Continuar"}
      </Button>
      <p aria-live="polite">{state.error}</p>
    </form>
  );
}
