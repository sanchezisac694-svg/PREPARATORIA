import { AppLink } from "@preparatoria/ui";

import { AuthShell, AuthSupportNote } from "../../_auth/auth-shell";

export default function MfaRequiredPage() {
  return (
    <AuthShell
      badge="Verificación adicional"
      description="Por seguridad, necesitas verificar un segundo factor para continuar."
      help={<AuthSupportNote />}
      title="Verificación adicional requerida"
    >
      <div className="auth-stack">
        <p>
          Si todavía no has configurado tu autenticador, puedes prepararlo ahora desde esta misma
          cuenta.
        </p>
        <AppLink href="/seguridad/mfa/configurar" variant="button">
          Continuar con la configuración
        </AppLink>
      </div>
    </AuthShell>
  );
}
