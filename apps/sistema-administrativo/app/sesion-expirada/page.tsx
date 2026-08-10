import { AppLink, ErrorState } from "@preparatoria/ui";

import { AuthShell } from "../_auth/auth-shell";

export default function ExpiredSessionPage() {
  return (
    <AuthShell
      badge="Sesión expirada"
      description="Tu sesión ha expirado. Por seguridad, inicia sesión nuevamente para continuar."
      title="Sesión expirada"
    >
      <ErrorState
        action={
          <AppLink href="/login" variant="button">
            Iniciar sesión
          </AppLink>
        }
        description="Vuelve a ingresar con tus credenciales institucionales."
        title="Tu sesión ya no está activa."
        tone="warning"
      />
    </AuthShell>
  );
}
