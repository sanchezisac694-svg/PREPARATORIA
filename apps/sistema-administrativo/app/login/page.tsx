import { AuthShell, AuthSupportNote } from "../_auth/auth-shell";
import { InstitutionalLoginForm } from "./institutional-login-form";

export default function Page() {
  return (
    <AuthShell
      badge="Acceso institucional"
      description="Ingresa con tus credenciales institucionales para acceder al Sistema Administrativo."
      help={<AuthSupportNote />}
      title="Iniciar sesión"
    >
      <InstitutionalLoginForm />
    </AuthShell>
  );
}
