import { ErrorState } from "@preparatoria/ui";

import { AuthBackHomeLink, AuthShell } from "../_auth/auth-shell";

export default function Page() {
  return (
    <AuthShell
      badge="Acceso no disponible"
      description="El acceso no está disponible para esta cuenta o aplicación en este momento."
      title="Acceso no disponible"
    >
      <ErrorState
        action={<AuthBackHomeLink />}
        description="Si consideras que esto es inesperado, solicita apoyo al área autorizada."
        title="No fue posible continuar con este acceso."
        tone="warning"
      />
    </AuthShell>
  );
}
