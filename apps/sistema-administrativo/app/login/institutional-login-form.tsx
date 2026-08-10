"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, FormMessage, Input, Select } from "@preparatoria/ui";

import { institutionalLoginAction, type LoginState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button pending={pending} type="submit">
      {pending ? "Ingresando…" : "Iniciar sesión"}
    </Button>
  );
}

export function InstitutionalLoginForm() {
  const [state, action] = useActionState<LoginState, FormData>(institutionalLoginAction, {});

  return (
    <form action={action} className="auth-form">
      <Field
        helpText="Selecciona el formato con el que te identificas dentro de la institución."
        label="Tipo de identificador"
        labelFor="identifierType"
      >
        <Select defaultValue="ADMINISTRATIVE_ID" id="identifierType" name="identifierType">
          <option value="NUMERO_CONTROL">Número de control</option>
          <option value="MATRICULA">Matrícula</option>
          <option value="EMPLOYEE_ID">Identificador de personal</option>
          <option value="ADMINISTRATIVE_ID">Identificador administrativo</option>
        </Select>
      </Field>

      <Field
        helpText="Utiliza tu identificador institucional tal como fue asignado."
        label="Identificador institucional"
        labelFor="identifier"
      >
        <Input
          autoCapitalize="characters"
          autoComplete="username"
          id="identifier"
          maxLength={32}
          minLength={4}
          name="identifier"
          required
          type="text"
        />
      </Field>

      <Field
        helpText="Escribe tu NIP de acceso sin compartirlo con terceros."
        label="NIP"
        labelFor="nip"
      >
        <Input
          autoComplete="current-password"
          id="nip"
          maxLength={64}
          minLength={6}
          name="nip"
          required
          type="password"
        />
      </Field>

      <input name="next" type="hidden" value="/dashboard" />

      <div className="auth-form__actions">
        <Submit />
      </div>

      {state.error ? (
        <FormMessage role="alert" tone="error">
          {state.error}
        </FormMessage>
      ) : null}
      {!state.error ? (
        <FormMessage tone="info">
          Si tu cuenta requiere una verificación adicional, la verás en el siguiente paso.
        </FormMessage>
      ) : null}
    </form>
  );
}
