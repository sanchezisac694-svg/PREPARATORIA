import { ErrorState } from "@preparatoria/ui";

import { AuthBackHomeLink, AuthShell } from "../_auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      badge="Sin autorización"
      description="No tienes acceso a esta sección con la cuenta actual."
      title="Sin autorización"
    >
      <ErrorState
        action={<AuthBackHomeLink />}
        description="Si necesitas operar este módulo, acércate al proceso institucional correspondiente."
        title="No tienes acceso a esta sección."
      />
    </AuthShell>
  );
}
