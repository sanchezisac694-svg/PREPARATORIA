import { Alert, AppLink, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function ChargeGenerationPage() {
  const identity = await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Generación institucional de cargos</h1>
        <p>
          Esta superficie coordina preview, revisión, aprobación y ejecución controlada de cargos
          masivos sin crear un ledger paralelo.
        </p>
        <p className="technical-reference">
          Roles activos: {identity.context.roleCodes.join(", ")}
        </p>
        <Alert tone="warning">
          No existe botón de ejecución directa sin preview, aprobación ni revalidación crítica.
        </Alert>
      </Card>

      <Card>
        <h2>Flujo mínimo</h2>
        <ol>
          <li>Seleccionar regla y periodo.</li>
          <li>Generar preview server-side con elegibilidad cerrada.</li>
          <li>Revisar elegibles, excluidos, duplicados y revisión manual.</li>
          <li>Crear batch, someterlo a revisión y aprobarlo.</li>
          <li>Ejecutar de forma idempotente y revisar el resultado final.</li>
        </ol>
      </Card>

      <Card>
        <h2>Rutas disponibles</h2>
        <nav aria-label="Generación de cargos">
          <ul>
            <li>
              <AppLink href="/finanzas/generacion-cargos/reglas">Reglas</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/generacion-cargos/nuevo">Nuevo batch</AppLink>
            </li>
            <li>
              <AppLink href="/finanzas/generacion-cargos/lote-ejemplo">Detalle de batch</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
