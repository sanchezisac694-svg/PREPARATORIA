import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

type ClassNameOptions = ReadonlyArray<string | false | null | undefined>;

function classes(...value: ClassNameOptions) {
  return value.filter(Boolean).join(" ");
}

type ButtonProps = Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    pending?: boolean;
    size?: "md" | "sm";
    variant?: "danger" | "ghost" | "primary" | "secondary";
  }
>;

export function Button({
  className = "",
  disabled,
  pending = false,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={pending || undefined}
      className={classes(
        "ui-button",
        `ui-button--${variant}`,
        `ui-button--${size}`,
        pending && "ui-button--pending",
        className,
      )}
      disabled={disabled || pending}
      type={type}
      {...props}
    />
  );
}

type AppLinkProps = Readonly<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "button" | "muted" | "text";
  }
>;

export function AppLink({ className = "", variant = "text", ...props }: AppLinkProps) {
  return <a className={classes("ui-link", `ui-link--${variant}`, className)} {...props} />;
}

type ContainerProps = Readonly<HTMLAttributes<HTMLElement>>;

export function Container({ className = "", ...props }: ContainerProps) {
  return <main className={classes("ui-container", className)} {...props} />;
}

type PageContainerProps = Readonly<HTMLAttributes<HTMLElement>>;

export function PageContainer({ className = "", ...props }: PageContainerProps) {
  return <section className={classes("ui-page-container", className)} {...props} />;
}

type CardProps = Readonly<
  HTMLAttributes<HTMLElement> & {
    padding?: "lg" | "md" | "sm";
    variant?: "default" | "metric" | "muted";
  }
>;

export function Card({ className = "", padding = "md", variant = "default", ...props }: CardProps) {
  return (
    <section
      className={classes("ui-card", `ui-card--${variant}`, `ui-card--${padding}`, className)}
      {...props}
    />
  );
}

type AlertProps = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    tone?: "danger" | "error" | "info" | "success" | "warning";
  }
>;

export function Alert({ className = "", tone = "info", ...props }: AlertProps) {
  const normalizedTone = tone === "danger" ? "error" : tone;
  return (
    <div
      aria-live={normalizedTone === "error" ? "assertive" : "polite"}
      className={classes("ui-alert", `ui-alert--${normalizedTone}`, className)}
      role={normalizedTone === "error" ? "alert" : "status"}
      {...props}
    />
  );
}

type FieldProps = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    error?: ReactNode;
    helpText?: ReactNode;
    label?: ReactNode;
    labelFor?: string;
  }
>;

export function Field({
  children,
  className = "",
  error,
  helpText,
  label,
  labelFor,
  ...props
}: FieldProps) {
  return (
    <div className={classes("ui-field", className)} {...props}>
      {label ? (
        <label className="ui-field__label" htmlFor={labelFor}>
          {label}
        </label>
      ) : null}
      {children}
      {helpText ? <div className="ui-field__help">{helpText}</div> : null}
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}

type InputProps = Readonly<
  InputHTMLAttributes<HTMLInputElement> & {
    describedBy?: string;
    invalid?: boolean;
  }
>;

export function Input({ className = "", describedBy, invalid = false, ...props }: InputProps) {
  return (
    <input
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={classes("ui-input", invalid && "ui-input--invalid", className)}
      {...props}
    />
  );
}

type SelectProps = Readonly<
  SelectHTMLAttributes<HTMLSelectElement> & {
    describedBy?: string;
    invalid?: boolean;
  }
>;

export function Select({ className = "", describedBy, invalid = false, ...props }: SelectProps) {
  return (
    <select
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className={classes("ui-select", invalid && "ui-input--invalid", className)}
      {...props}
    />
  );
}

type FormMessageProps = Readonly<
  HTMLAttributes<HTMLParagraphElement> & {
    tone?: "error" | "info" | "success";
  }
>;

export function FormMessage({ className = "", tone = "info", ...props }: FormMessageProps) {
  return (
    <p className={classes("ui-form-message", `ui-form-message--${tone}`, className)} {...props} />
  );
}

type LoadingIndicatorProps = Readonly<{
  label?: string;
  size?: "md" | "sm";
}>;

export function LoadingIndicator({ label = "Cargando", size = "md" }: LoadingIndicatorProps) {
  return (
    <div aria-live="polite" className={classes("ui-loading", `ui-loading--${size}`)} role="status">
      <span aria-hidden="true" className="ui-loading__spinner" />
      <span>{label}</span>
    </div>
  );
}

type BadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

type StatusBadgeProps = Readonly<
  HTMLAttributes<HTMLSpanElement> & {
    tone?: BadgeTone;
  }
>;

export function StatusBadge({ className = "", tone = "neutral", ...props }: StatusBadgeProps) {
  return <span className={classes("ui-badge", `ui-badge--${tone}`, className)} {...props} />;
}

type MoneyProps = Readonly<{
  amount: `${number}` | `${number}.${number}` | `${number}.${number}${number}`;
  currency?: string;
}>;

export function formatMoney(
  amount: `${number}` | `${number}.${number}` | `${number}.${number}${number}`,
  currency = "MXN",
) {
  const value = Number(amount);
  if (!Number.isFinite(value) || amount.trim() === "") {
    return "—";
  }
  const formattedAmount = new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
  return `$${formattedAmount} ${currency}`;
}

export function Money({ amount, currency = "MXN" }: MoneyProps) {
  return <span>{formatMoney(amount, currency)}</span>;
}

type DateDisplayProps = Readonly<{
  value: string;
  withTime?: boolean;
}>;

export function formatDate(value: string, withTime = false) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat(
    "es-MX",
    withTime
      ? {
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          month: "2-digit",
          timeZone: "America/Mexico_City",
          year: "numeric",
        }
      : {
          day: "2-digit",
          month: "2-digit",
          timeZone: isDateOnly ? "America/Mexico_City" : undefined,
          year: "numeric",
        },
  ).format(date);
}

export function DateDisplay({ value, withTime = false }: DateDisplayProps) {
  return <time dateTime={value}>{formatDate(value, withTime)}</time>;
}

type EmptyStateProps = Readonly<{
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
}>;

export function EmptyState({ action, description, title }: EmptyStateProps) {
  return (
    <section className="ui-empty-state">
      <div className="ui-empty-state__icon" aria-hidden="true">
        ○
      </div>
      <div className="ui-empty-state__body">
        <h2>{title}</h2>
        <p>{description}</p>
        {action ? <div className="ui-empty-state__action">{action}</div> : null}
      </div>
    </section>
  );
}

type LoadingStateProps = Readonly<{
  description?: ReactNode;
  title?: ReactNode;
}>;

export function LoadingState({
  description = "Estamos preparando la información visible.",
  title = "Cargando",
}: LoadingStateProps) {
  return (
    <section className="ui-state-card">
      <LoadingIndicator />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </section>
  );
}

type ErrorStateProps = Readonly<{
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
  tone?: "danger" | "info" | "warning";
}>;

export function ErrorState({ action, description, title, tone = "danger" }: ErrorStateProps) {
  return (
    <section className="ui-state-card">
      <Alert tone={tone}>
        <strong>{title}</strong>
        <div>{description}</div>
      </Alert>
      {action ? <div className="ui-state-card__action">{action}</div> : null}
    </section>
  );
}

type BreadcrumbItem = Readonly<{
  href?: string;
  label: ReactNode;
}>;

type BreadcrumbsProps = Readonly<{
  items: readonly BreadcrumbItem[];
}>;

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="ui-breadcrumbs">
      <ol>
        {items.map((item, index) => (
          <li key={`${item.href ?? "current"}-${index}`}>
            {item.href ? (
              <AppLink href={item.href}>{item.label}</AppLink>
            ) : (
              <span>{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

type PageHeaderProps = Readonly<{
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}>;

export function PageHeader({ actions, breadcrumbs, description, title }: PageHeaderProps) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-header__copy">
        {breadcrumbs ? <div className="ui-page-header__breadcrumbs">{breadcrumbs}</div> : null}
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="ui-page-header__actions">{actions}</div> : null}
    </header>
  );
}

type SectionCardProps = Readonly<
  HTMLAttributes<HTMLElement> & {
    actions?: ReactNode;
    description?: ReactNode;
    title?: ReactNode;
  }
>;

export function SectionCard({
  actions,
  children,
  className = "",
  description,
  title,
  ...props
}: SectionCardProps) {
  return (
    <Card className={classes("ui-section-card", className)} {...props}>
      {(title || description || actions) && (
        <div className="ui-section-card__header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      )}
      {children}
    </Card>
  );
}

type MetricCardProps = Readonly<{
  description?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
}>;

export function MetricCard({ description, icon, label, value }: MetricCardProps) {
  return (
    <Card className="ui-metric-card" variant="metric">
      <div className="ui-metric-card__header">
        <span>{label}</span>
        {icon ? <span className="ui-metric-card__icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
      {description ? <p>{description}</p> : null}
    </Card>
  );
}

type DataTableProps = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    caption?: ReactNode;
    emptyState?: ReactNode;
    tableClassName?: string;
  }
>;

export function DataTable({
  caption,
  children,
  className = "",
  emptyState,
  tableClassName = "",
  ...props
}: DataTableProps) {
  return (
    <div className={classes("ui-table-wrapper", className)} {...props}>
      <table className={classes("ui-table", tableClassName)}>
        {caption ? <caption>{caption}</caption> : null}
        {children}
      </table>
      {emptyState ? <div className="ui-table-empty">{emptyState}</div> : null}
    </div>
  );
}

type TableSectionProps = Readonly<HTMLAttributes<HTMLTableSectionElement>>;

export function TableHeadSection({ className = "", ...props }: TableSectionProps) {
  return <thead className={classes("ui-table__head", className)} {...props} />;
}

export function TableBodySection({ className = "", ...props }: TableSectionProps) {
  return <tbody className={classes("ui-table__body", className)} {...props} />;
}

type TableRowProps = Readonly<HTMLAttributes<HTMLTableRowElement>>;

export function TableRow({ className = "", ...props }: TableRowProps) {
  return <tr className={classes("ui-table__row", className)} {...props} />;
}

type TableCellProps = Readonly<
  HTMLAttributes<HTMLTableCellElement> & {
    align?: "center" | "left" | "right";
  }
>;

export function TableCell({ align = "left", className = "", ...props }: TableCellProps) {
  return (
    <td className={classes("ui-table__cell", `ui-table__cell--${align}`, className)} {...props} />
  );
}

type TableHeadCellProps = Readonly<
  HTMLAttributes<HTMLTableCellElement> & {
    align?: "center" | "left" | "right";
    scope?: "col" | "row";
  }
>;

export function TableHeadCell({
  align = "left",
  className = "",
  scope = "col",
  ...props
}: TableHeadCellProps) {
  return (
    <th
      className={classes("ui-table__head-cell", `ui-table__cell--${align}`, className)}
      scope={scope}
      {...props}
    />
  );
}

type DescriptionListProps = Readonly<HTMLAttributes<HTMLDListElement>>;

export function DescriptionList({ className = "", ...props }: DescriptionListProps) {
  return <dl className={classes("ui-description-list", className)} {...props} />;
}

type DescriptionItemProps = Readonly<{
  label: ReactNode;
  value: ReactNode;
}>;

export function DescriptionItem({ label, value }: DescriptionItemProps) {
  return (
    <div className="ui-description-list__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type FormActionsProps = Readonly<{
  primary: ReactNode;
  secondary?: ReactNode;
}>;

export function FormActions({ primary, secondary }: FormActionsProps) {
  return (
    <div className="ui-form-actions">
      {secondary ? <div className="ui-form-actions__secondary">{secondary}</div> : null}
      <div className="ui-form-actions__primary">{primary}</div>
    </div>
  );
}

export type { ReactNode };
