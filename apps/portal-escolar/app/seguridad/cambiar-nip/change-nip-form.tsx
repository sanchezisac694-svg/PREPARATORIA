"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { changeNipAction, type LoginState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "Actualizando…" : "Actualizar NIP"}
    </button>
  );
}

export function ChangeNipForm() {
  const [state, action] = useActionState<LoginState, FormData>(changeNipAction, {});
  return (
    <form action={action}>
      <label htmlFor="currentNip">NIP actual</label>
      <input
        autoComplete="current-password"
        id="currentNip"
        maxLength={64}
        minLength={6}
        name="currentNip"
        required
        type="password"
      />
      <label htmlFor="newNip">NIP nuevo</label>
      <input
        autoComplete="new-password"
        id="newNip"
        maxLength={64}
        minLength={6}
        name="newNip"
        required
        type="password"
      />
      <label htmlFor="confirmation">Confirmar NIP nuevo</label>
      <input
        autoComplete="new-password"
        id="confirmation"
        maxLength={64}
        minLength={6}
        name="confirmation"
        required
        type="password"
      />
      <Submit />
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{state.success}</p> : null}
    </form>
  );
}
