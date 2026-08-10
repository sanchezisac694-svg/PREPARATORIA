import type { ReactNode } from "react";
import { AppLink, Card, Container, StatusBadge } from "@preparatoria/ui";

type AuthShellProps = Readonly<{
  badge?: ReactNode;
  children: ReactNode;
  description: ReactNode;
  footer?: ReactNode;
  help?: ReactNode;
  title: ReactNode;
}>;

export function AuthShell({ badge, children, description, footer, help, title }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <div className="auth-shell__backdrop" aria-hidden="true" />
      <Container className="auth-shell__container">
        <div className="auth-shell__layout">
          <section className="auth-shell__context" aria-label="Contexto institucional">
            <div className="auth-shell__brand">
              <span className="auth-shell__brand-mark">SP</span>
              <div>
                <strong>Sistema Preparatoria</strong>
                <p>Sistema Administrativo</p>
              </div>
            </div>
            {badge ? <StatusBadge tone="info">{badge}</StatusBadge> : null}
            <div className="auth-shell__copy">
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {help ? <div className="auth-shell__help">{help}</div> : null}
          </section>

          <Card className="auth-shell__panel" padding="lg">
            {children}
            <footer className="auth-shell__footer">
              {footer ?? (
                <p>
                  Si necesitas apoyo institucional, consulta con la coordinación autorizada de tu
                  área.
                </p>
              )}
            </footer>
          </Card>
        </div>
      </Container>
    </div>
  );
}

export function AuthSupportNote() {
  return (
    <p>
      Este acceso está destinado al personal autorizado. No compartas tu NIP ni códigos de
      verificación.
    </p>
  );
}

export function AuthBackHomeLink() {
  return <AppLink href="/dashboard">Volver al inicio</AppLink>;
}
