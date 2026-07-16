import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type ButtonProps = Readonly<ButtonHTMLAttributes<HTMLButtonElement>>;

export function Button({ className = "", type = "button", ...props }: ButtonProps) {
  return <button className={`ui-button ${className}`.trim()} type={type} {...props} />;
}

type AppLinkProps = Readonly<AnchorHTMLAttributes<HTMLAnchorElement>>;

export function AppLink({ className = "", ...props }: AppLinkProps) {
  return <a className={`ui-link ${className}`.trim()} {...props} />;
}

type ContainerProps = Readonly<HTMLAttributes<HTMLElement>>;

export function Container({ className = "", ...props }: ContainerProps) {
  return <main className={`ui-container ${className}`.trim()} {...props} />;
}

type CardProps = Readonly<HTMLAttributes<HTMLElement>>;

export function Card({ className = "", ...props }: CardProps) {
  return <section className={`ui-card ${className}`.trim()} {...props} />;
}

type AlertProps = Readonly<
  HTMLAttributes<HTMLDivElement> & {
    tone?: "error" | "info" | "success" | "warning";
  }
>;

export function Alert({ className = "", tone = "info", ...props }: AlertProps) {
  return (
    <div
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`ui-alert ui-alert--${tone} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    />
  );
}

type LoadingIndicatorProps = Readonly<{
  label?: string;
}>;

export function LoadingIndicator({ label = "Cargando" }: LoadingIndicatorProps) {
  return (
    <div aria-live="polite" className="ui-loading" role="status">
      <span aria-hidden="true" className="ui-loading__spinner" />
      <span>{label}</span>
    </div>
  );
}

export type { ReactNode };
