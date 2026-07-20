import { Button, Card, Container } from "@preparatoria/ui";

import { requestMfaRecoveryAction } from "../actions";

export default function NewMfaRecoveryPage() {
  return (
    <Container>
      <Card>
        <h1>Nueva recuperación MFA</h1>
        <form action={requestMfaRecoveryAction}>
          <label htmlFor="institutionalIdentifier">Identificador institucional</label>
          <input
            autoComplete="off"
            id="institutionalIdentifier"
            maxLength={80}
            name="institutionalIdentifier"
            required
          />
          <label htmlFor="reason">Motivo</label>
          <select id="reason" name="reason">
            <option value="LOST_ALL_FACTORS">Pérdida de todos los factores</option>
            <option value="COMPROMISED_AUTHENTICATOR">Autenticador comprometido</option>
            <option value="DAMAGED_DEVICE">Dispositivo dañado</option>
          </select>
          <Button type="submit">Registrar solicitud</Button>
        </form>
      </Card>
    </Container>
  );
}
