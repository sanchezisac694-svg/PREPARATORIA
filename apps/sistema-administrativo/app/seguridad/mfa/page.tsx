import { Alert, AppLink, Button, EmptyState, PageHeader, SectionCard } from "@preparatoria/ui";

import { adminAuthentication } from "../../../lib/auth";
import { SecurityStatusBadge } from "../../_admin/security-status";
import { unenrollMfaFactorAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function MfaSecurityPage() {
  const result = await (await adminAuthentication()).listFactors();
  const factors = result.ok ? result.factors : [];
  const verifiedFactors = factors.filter((factor) => factor.status === "verified");

  return (
    <>
      <PageHeader
        actions={
          <AppLink href="/seguridad/mfa/configurar" variant="button">
            Configurar factor
          </AppLink>
        }
        description="Administra tus factores de verificación sin compartir códigos ni claves."
        title="Autenticación reforzada"
      />

      <SectionCard
        description="Consulta el estado de tus autenticadores y retira únicamente los que ya no utilices."
        title="Factores configurados"
      >
        <Alert tone="info">
          Los factores verificados protegen el acceso. Retíralos solo si cuentas con otro método
          vigente o vas a sustituirlo de inmediato.
        </Alert>

        {factors.length === 0 ? (
          <EmptyState
            action={
              <AppLink href="/seguridad/mfa/configurar" variant="button">
                Configurar autenticador
              </AppLink>
            }
            description="Aún no hay factores visibles para esta cuenta."
            title="Sin factores configurados"
          />
        ) : (
          <div className="security-factor-list">
            {factors.map((factor, index) => (
              <SectionCard
                key={`factor-${index + 1}`}
                actions={<SecurityStatusBadge status={factor.status} />}
                className="security-factor-card"
                description="Mantén actualizados solo los autenticadores bajo tu control."
                title={factor.friendlyName ?? `Autenticador ${index + 1}`}
              >
                <div className="security-factor-card__body">
                  <p>
                    {factor.status === "verified"
                      ? "Este factor ya puede utilizarse para verificar tu sesión."
                      : "Este factor todavía requiere verificación para quedar activo."}
                  </p>

                  {factor.status === "verified" ? (
                    <form action={unenrollMfaFactorAction} className="security-inline-form">
                      <input name="factorIndex" type="hidden" value={index} />
                      <div className="security-inline-form__controls">
                        <label htmlFor={`currentNip-${index}`}>NIP actual</label>
                        <input
                          autoComplete="current-password"
                          id={`currentNip-${index}`}
                          name="currentNip"
                          type="password"
                        />
                        <Button type="submit" variant="danger">
                          Retirar factor
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        description="La verificación adicional ayuda a proteger sesiones administrativas sensibles."
        title="Resumen"
      >
        <div className="security-summary-grid">
          <div>
            <strong>{verifiedFactors.length}</strong>
            <p>Factores verificados</p>
          </div>
          <div>
            <strong>{factors.length - verifiedFactors.length}</strong>
            <p>Factores pendientes de verificación</p>
          </div>
        </div>
      </SectionCard>
    </>
  );
}
