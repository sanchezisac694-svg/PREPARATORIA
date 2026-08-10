import { AuthShell, AuthSupportNote } from "../../_auth/auth-shell";
import { MfaChallengeForm } from "./mfa-challenge-form";

export default function VerifyMfaPage() {
  return (
    <AuthShell
      badge="Autenticación reforzada"
      description="Ingresa el código generado por tu aplicación autenticadora para continuar."
      help={<AuthSupportNote />}
      title="Verificar segundo factor"
    >
      <MfaChallengeForm />
    </AuthShell>
  );
}
