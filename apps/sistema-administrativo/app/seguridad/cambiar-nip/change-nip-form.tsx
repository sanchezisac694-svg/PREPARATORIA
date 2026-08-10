"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, FormMessage, FormActions, Input } from "@preparatoria/ui";

import { changeNipAction, type LoginState } from "../../actions";

function Submit() {
  const { pending } = useFormStatus();

  return (
    <Button pending={pending} type="submit">
      {pending ? "Actualizando…" : "Actualizar NIP"}
    </Button>
  );
}

export function ChangeNipForm() {
  const [state, action] = useActionState<LoginState, FormData>(changeNipAction, {});

  return (
    <form action={action} className="security-form">
      <Field
        helpText="Confirma tu NIP vigente antes de registrar uno nuevo."
        label="NIP actual"
        labelFor="currentNip"
      >
        <Input
          autoComplete="current-password"
          id="currentNip"
          maxLength={64}
          minLength={6}
          name="currentNip"
          required
          type="password"
        />
      </Field>

      <Field
        helpText="Usa el nuevo NIP institucional permitido por la política vigente."
        label="Nuevo NIP"
        labelFor="newNip"
      >
        <Input
          autoComplete="new-password"
          id="newNip"
          maxLength={64}
          minLength={6}
          name="newNip"
          required
          type="password"
        />
      </Field>

      <Field
        helpText="Repítelo exactamente para confirmar el cambio."
        label="Confirmar nuevo NIP"
        labelFor="confirmation"
      >
        <Input
          autoComplete="new-password"
          id="confirmation"
          maxLength={64}
          minLength={6}
          name="confirmation"
          required
          type="password"
        />
      </Field>

      <FormActions primary={<Submit />} />
      {state.error ? (
        <FormMessage role="alert" tone="error">
          {state.error}
        </FormMessage>
      ) : null}
      {state.success ? (
        <FormMessage role="status" tone="success">
          {state.success}
        </FormMessage>
      ) : null}
    </form>
  );
}
