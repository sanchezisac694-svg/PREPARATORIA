"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { institutionalLoginAction, type LoginState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit">
      {pending ? "Ingresando…" : "Iniciar sesión"}
    </button>
  );
}

export function InstitutionalLoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(institutionalLoginAction, {});
  return (
    <form action={action}>
      <label htmlFor="identifierType">Tipo de identificador</label>
      <select defaultValue="NUMERO_CONTROL" id="identifierType" name="identifierType">
        <option value="NUMERO_CONTROL">Número de control</option>
        <option value="MATRICULA">Matrícula</option>
        <option value="EMPLOYEE_ID">Identificador de personal</option>
        <option value="ADMINISTRATIVE_ID">Identificador administrativo</option>
      </select>
      <label htmlFor="identifier">Identificador institucional</label>
      <input
        autoCapitalize="characters"
        autoComplete="username"
        id="identifier"
        maxLength={32}
        minLength={4}
        name="identifier"
        required
        type="text"
      />
      <label htmlFor="nip">NIP</label>
      <input
        autoComplete="current-password"
        id="nip"
        maxLength={64}
        minLength={6}
        name="nip"
        required
        type="password"
      />
      <input name="next" type="hidden" value="/dashboard" />
      <Submit />
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
