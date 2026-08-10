import {
  Alert,
  Button,
  PageHeader,
  SectionCard,
  StatusBadge,
  type ReactNode,
} from "@preparatoria/ui";

import {
  approveMfaRecoveryAction,
  cancelMfaRecoveryAction,
  executeMfaRecoveryAction,
  reconcileMfaRecoveryAction,
  verifyMfaRecoveryIdentityAction,
} from "../actions";

function OperationForm({
  action,
  description,
  id,
  label,
  variant = "secondary",
}: {
  action: (formData: FormData) => Promise<void>;
  description: ReactNode;
  id: string;
  label: string;
  variant?: "danger" | "secondary";
}) {
  return (
    <form action={action} className="security-operation">
      <input name="recoveryReference" type="hidden" value={id} />
      <p>{description}</p>
      <Button type="submit" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

export default async function MfaRecoveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        actions={<StatusBadge tone="warning">Operación sensible</StatusBadge>}
        description="Continúa una recuperación MFA mediante su referencia operativa, sin exponer detalles internos de la cuenta."
        title="Solicitud de recuperación MFA"
      />

      <SectionCard
        description="Utiliza la referencia solo para registrar acciones autorizadas dentro del flujo administrativo."
        title="Referencia operativa"
      >
        <div className="technical-reference">
          <strong>Referencia:</strong> {id}
        </div>
        <Alert tone="warning">
          Este flujo debe ser operado únicamente por personal autorizado y con verificación
          administrativa completa.
        </Alert>
      </SectionCard>

      <div className="security-operation-grid">
        <SectionCard
          description="Registra que la validación institucional fuera del sistema ya fue completada."
          title="Verificación de identidad"
        >
          <OperationForm
            action={verifyMfaRecoveryIdentityAction}
            description="Deja constancia operativa de la verificación humana correspondiente."
            id={id}
            label="Registrar verificación"
          />
        </SectionCard>

        <SectionCard
          description="Avanza solo cuando la solicitud esté lista para el siguiente paso."
          title="Decisiones"
        >
          <OperationForm
            action={approveMfaRecoveryAction}
            description="Aprueba la recuperación para su ejecución controlada."
            id={id}
            label="Aprobar"
          />
          <OperationForm
            action={cancelMfaRecoveryAction}
            description="Cancela la recuperación cuando ya no deba continuar."
            id={id}
            label="Cancelar"
            variant="danger"
          />
        </SectionCard>

        <SectionCard
          description="Estas acciones deben ejecutarse con especial cuidado y seguimiento institucional."
          title="Operación y cierre"
        >
          <OperationForm
            action={executeMfaRecoveryAction}
            description="Ejecuta la recuperación cuando la aprobación ya fue registrada."
            id={id}
            label="Ejecutar"
          />
          <OperationForm
            action={reconcileMfaRecoveryAction}
            description="Usa esta acción para continuar la conciliación cuando el flujo lo requiera."
            id={id}
            label="Reconciliar"
          />
        </SectionCard>
      </div>
    </>
  );
}
