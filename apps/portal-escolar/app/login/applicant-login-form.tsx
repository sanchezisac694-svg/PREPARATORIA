"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { applicantLoginAction, type LoginState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "Ingresando…" : "Iniciar sesión"}
    </button>
  );
}

export function ApplicantLoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(applicantLoginAction, {});
  return (
    <form action={action}>
      <label htmlFor="email">Correo de aspirante</label>
      <input autoComplete="username" id="email" name="email" required type="email" />
      <label htmlFor="password">Contraseña</label>
      <input
        autoComplete="current-password"
        id="password"
        minLength={8}
        name="password"
        required
        type="password"
      />
      <input name="next" type="hidden" value="/dashboard" />
      <Submit />
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
