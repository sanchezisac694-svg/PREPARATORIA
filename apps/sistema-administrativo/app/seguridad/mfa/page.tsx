import { AppLink, Button, Card, Container } from "@preparatoria/ui";

import { adminAuthentication } from "../../../lib/auth";
import { unenrollMfaFactorAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function MfaSecurityPage() {
  const result = await (await adminAuthentication()).listFactors();
  const factors = result.ok ? result.factors.filter((factor) => factor.status === "verified") : [];
  return (
    <Container>
      <Card>
        <h1>Autenticación reforzada</h1>
        <p>Administra tus factores TOTP sin compartir códigos ni claves.</p>
        <AppLink href="/seguridad/mfa/configurar">Configurar factor</AppLink>
        <p>Factores verificados: {factors.length}</p>
        {factors.map((factor, index) => (
          <form action={unenrollMfaFactorAction} key={`factor-${index + 1}`}>
            <p>{factor.friendlyName ?? `Autenticador ${index + 1}`}</p>
            <input name="factorIndex" type="hidden" value={index} />
            <label htmlFor={`currentNip-${index}`}>NIP actual</label>
            <input
              autoComplete="current-password"
              id={`currentNip-${index}`}
              name="currentNip"
              type="password"
            />
            <Button type="submit">Retirar factor</Button>
          </form>
        ))}
      </Card>
    </Container>
  );
}
