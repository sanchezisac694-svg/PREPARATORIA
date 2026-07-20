import { Button, Card, Container } from "@preparatoria/ui";

import {
  approveMfaRecoveryAction,
  cancelMfaRecoveryAction,
  executeMfaRecoveryAction,
  reconcileMfaRecoveryAction,
  verifyMfaRecoveryIdentityAction,
} from "../actions";

function OperationForm({
  action,
  id,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input name="recoveryReference" type="hidden" value={id} />
      <Button type="submit">{label}</Button>
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
    <Container>
      <Card>
        <h1>Solicitud de recuperación MFA</h1>
        <p>Estado técnico disponible únicamente para operadores autorizados con AAL2.</p>
        <OperationForm
          action={verifyMfaRecoveryIdentityAction}
          id={id}
          label="Registrar verificación"
        />
        <OperationForm action={approveMfaRecoveryAction} id={id} label="Aprobar" />
        <OperationForm action={executeMfaRecoveryAction} id={id} label="Ejecutar" />
        <OperationForm action={reconcileMfaRecoveryAction} id={id} label="Reconciliar" />
        <OperationForm action={cancelMfaRecoveryAction} id={id} label="Cancelar" />
      </Card>
    </Container>
  );
}
