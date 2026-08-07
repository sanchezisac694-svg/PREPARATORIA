import { Alert, Card, Container } from "@preparatoria/ui";
import { requireAdminAccess } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function NuevoCobroCajaPage() {
  await requireAdminAccess();

  return (
    <Container>
      <Card>
        <h1>Nuevo cobro presencial</h1>
        <p>El alumno debe resolverse en servidor; el navegador no decide qué cuenta cobrar.</p>
        <Alert tone="warning">
          Esta pantalla no recibe student_record_id libre, no registra pagos en línea y no duplica
          la lógica financiera del Bloque 1.
        </Alert>
      </Card>

      <Card>
        <h2>Secuencia esperada</h2>
        <ol>
          <li>Validar turno OPEN.</li>
          <li>Buscar alumno con permisos exactos.</li>
          <li>Mostrar identidad mínima y cargos elegibles.</li>
          <li>Confirmar importe, método y referencia mínima.</li>
          <li>Registrar, confirmar y aplicar pago.</li>
          <li>Si el método es CASH, vincular el pago a la sesión de caja.</li>
        </ol>
      </Card>
    </Container>
  );
}
