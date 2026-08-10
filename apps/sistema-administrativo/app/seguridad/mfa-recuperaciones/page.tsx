import { Alert, AppLink, EmptyState, PageHeader, SectionCard, StatusBadge } from "@preparatoria/ui";

export const dynamic = "force-dynamic";

export default async function MfaRecoveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <PageHeader
        actions={
          <AppLink href="/seguridad/mfa-recuperaciones/nueva" variant="button">
            Registrar solicitud
          </AppLink>
        }
        description="Herramienta administrativa sensible para registrar y dar seguimiento a recuperaciones MFA."
        title="Recuperaciones MFA"
      />

      {error ? (
        <Alert tone="error">
          No fue posible completar la operación con la información recibida.
        </Alert>
      ) : null}

      <SectionCard
        description="Esta superficie conserva las acciones reales del flujo administrativo sin exponer datos sensibles en pantalla."
        title="Operación actual"
      >
        <div className="security-recovery-intro">
          <StatusBadge tone="warning">Superficie sensible</StatusBadge>
          <p>
            El detalle operativo disponible en esta fase es mínimo y se concentra en registrar la
            solicitud o continuar con una referencia existente.
          </p>
        </div>
      </SectionCard>

      <EmptyState
        action={
          <AppLink href="/seguridad/mfa-recuperaciones/nueva" variant="button">
            Nueva solicitud
          </AppLink>
        }
        description="Cuando una solicitud requiera intervención, podrás abrir su referencia operativa desde esta sección."
        title="Sin solicitudes visibles en esta vista"
      />
    </>
  );
}
