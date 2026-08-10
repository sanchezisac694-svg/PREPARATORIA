import { ErrorState } from "@preparatoria/ui";

import { AuthBackHomeLink, AuthShell } from "../_auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      badge="Estado de acceso"
      description="La cuenta no tiene acceso operativo disponible en este momento."
      title="Estado de acceso de la cuenta"
    >
      <ErrorState
        action={<AuthBackHomeLink />}
        description="Consulta con la instancia institucional autorizada para revisar el estado actual de tu acceso."
        title="No fue posible habilitar el acceso."
        tone="warning"
      />
    </AuthShell>
  );
}
