import { PageHeader, SectionCard } from "@preparatoria/ui";

import { MfaEnrollmentForm } from "./mfa-enrollment-form";

export default function ConfigureMfaPage() {
  return (
    <>
      <PageHeader
        description="Usa una aplicación autenticadora TOTP para proteger tu cuenta institucional."
        title="Configurar verificación adicional"
      />

      <SectionCard
        description="Prepara tu autenticador y verifica el código para dejarlo activo."
        title="Nuevo factor"
      >
        <div className="security-form-shell">
          <MfaEnrollmentForm />
        </div>
      </SectionCard>
    </>
  );
}
