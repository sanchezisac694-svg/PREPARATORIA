import { Alert, AppLink, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function CajaPage() {
  const identity = await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Caja escolar</h1>
        <p>Operación presencial en construcción sobre la base financiera existente.</p>
        <p className="technical-reference">
          Roles activos: {identity.context.roleCodes.join(", ")}
        </p>
        <Alert tone="warning">
          Esta superficie no habilita reversos libres, pagos en línea ni CFDI.
        </Alert>
      </Card>

      <Card>
        <h2>Flujo operativo</h2>
        <ul>
          <li>Sin turno: apertura controlada con caja activa, cuenta activa, AAL2 y MFA.</li>
          <li>Turno abierto: cobro presencial y movimientos manuales autorizados.</li>
          <li>Cierre en curso: arqueo, conciliación y aprobación segregada de diferencias.</li>
          <li>Turno cerrado: solo lectura histórica.</li>
        </ul>
      </Card>

      <Card>
        <h2>Acciones disponibles</h2>
        <nav aria-label="Operación de caja">
          <ul>
            <li>
              <AppLink href="/caja/turno">Turno actual</AppLink>
            </li>
            <li>
              <AppLink href="/caja/cobros/nuevo">Nuevo cobro presencial</AppLink>
            </li>
            <li>
              <AppLink href="/caja/movimientos">Movimientos manuales</AppLink>
            </li>
            <li>
              <AppLink href="/caja/arqueo">Arqueo</AppLink>
            </li>
            <li>
              <AppLink href="/caja/cierre">Cierre</AppLink>
            </li>
          </ul>
        </nav>
      </Card>
    </Container>
  );
}
