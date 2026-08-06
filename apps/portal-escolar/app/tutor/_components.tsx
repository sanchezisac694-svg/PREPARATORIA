import { Alert, AppLink, Card, type ReactNode } from "@preparatoria/ui";

type SectionProps = Readonly<{
  children: ReactNode;
  description?: string;
  title: string;
}>;

export function GuardianPortalSection({ children, description, title }: SectionProps) {
  return (
    <Card>
      <h2>{title}</h2>
      {description ? <p className="technical-reference">{description}</p> : null}
      {children}
    </Card>
  );
}

export function GuardianPortalEmpty({ message }: Readonly<{ message: string }>) {
  return <Alert tone="info">{message}</Alert>;
}

export function GuardianPortalMetric({
  label,
  value,
}: Readonly<{ label: string; value: ReactNode }>) {
  return (
    <div className="student-portal-metric">
      <span className="student-portal-metric__label">{label}</span>
      <strong className="student-portal-metric__value">{value}</strong>
    </div>
  );
}

export function GuardianPortalNav() {
  return (
    <nav aria-label="Navegación del tutor" className="student-portal-nav">
      <AppLink href="/tutor">Resumen</AppLink>
      <AppLink href="/tutor/alumnos">Alumnos vinculados</AppLink>
    </nav>
  );
}
