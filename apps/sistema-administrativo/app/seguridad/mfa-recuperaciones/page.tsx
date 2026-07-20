import { AppLink, Card, Container } from "@preparatoria/ui";

export const dynamic = "force-dynamic";

export default async function MfaRecoveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Container>
      <Card>
        <h1>Recuperaciones administrativas MFA</h1>
        {error ? <p role="alert">No fue posible completar la operación.</p> : null}
        <p>
          Superficie técnica restringida. El adaptador privilegiado de este bloque funciona
          únicamente contra Supabase local.
        </p>
        <AppLink href="/seguridad/mfa-recuperaciones/nueva">Registrar solicitud</AppLink>
      </Card>
    </Container>
  );
}
