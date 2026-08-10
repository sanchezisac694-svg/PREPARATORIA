import { Alert, PageHeader, SectionCard } from "@preparatoria/ui";

import { requireAdminAccess } from "../../../lib/auth";
import { ChangeNipForm } from "./change-nip-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireAdminAccess();

  return (
    <>
      <PageHeader
        description="Actualiza tu NIP institucional desde una vista protegida y con instrucciones claras."
        title="Cambiar NIP"
      />

      <SectionCard
        description="Confirma tu NIP actual antes de establecer uno nuevo."
        title="Actualización de acceso"
      >
        <Alert tone="info">
          Mantén tu NIP en privado y evita compartirlo por mensajes o capturas de pantalla.
        </Alert>
        <div className="security-form-shell">
          <ChangeNipForm />
        </div>
      </SectionCard>
    </>
  );
}
