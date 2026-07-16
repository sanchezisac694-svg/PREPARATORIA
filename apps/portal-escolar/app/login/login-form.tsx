"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "../actions";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "Ingresando…" : "Iniciar sesión"}
    </button>
  );
}
export function LoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action}>
      <label htmlFor="email">Correo de acceso</label>
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
