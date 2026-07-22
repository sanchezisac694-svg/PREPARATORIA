import { Alert, AppLink, Card, type ReactNode } from "@preparatoria/ui";

type SectionProps = Readonly<{
  children: ReactNode;
  description?: string;
  title: string;
}>;

export function StudentPortalSection({ children, description, title }: SectionProps) {
  return (
    <Card>
      <h2>{title}</h2>
      {description ? <p className="technical-reference">{description}</p> : null}
      {children}
    </Card>
  );
}

type MetricProps = Readonly<{
  label: string;
  value: ReactNode;
}>;

export function StudentPortalMetric({ label, value }: MetricProps) {
  return (
    <div className="student-portal-metric">
      <span className="student-portal-metric__label">{label}</span>
      <strong className="student-portal-metric__value">{value}</strong>
    </div>
  );
}

type EmptyProps = Readonly<{
  message: string;
}>;

export function StudentPortalEmpty({ message }: EmptyProps) {
  return <Alert tone="info">{message}</Alert>;
}

export function StudentPortalNav() {
  return (
    <nav aria-label="Navegación del alumno" className="student-portal-nav">
      <AppLink href="/alumno">Resumen</AppLink>
      <AppLink href="/alumno/expediente">Expediente</AppLink>
      <AppLink href="/alumno/materias">Materias</AppLink>
      <AppLink href="/alumno/horario">Horario</AppLink>
      <AppLink href="/alumno/asistencia">Asistencia</AppLink>
      <AppLink href="/alumno/permisos">Permisos</AppLink>
      <AppLink href="/alumno/calificaciones">Calificaciones</AppLink>
      <AppLink href="/alumno/trayectoria">Trayectoria</AppLink>
    </nav>
  );
}
