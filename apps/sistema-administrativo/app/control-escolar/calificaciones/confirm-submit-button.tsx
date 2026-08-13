"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "danger" | "primary" | "secondary";

const toneClasses: Record<Tone, string> = {
  danger: "ui-button ui-button--danger ui-button--sm",
  primary: "ui-button ui-button--primary ui-button--sm",
  secondary: "ui-button ui-button--secondary ui-button--sm",
};

export function ConfirmSubmitButton({
  children,
  confirmationMessage,
  tone = "secondary",
  ...props
}: Readonly<
  {
    children: ReactNode;
    confirmationMessage: string;
    tone?: Tone;
  } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">
>) {
  return (
    <button
      {...props}
      className={props.className ?? toneClasses[tone]}
      onClick={(event) => {
        if (!window.confirm(confirmationMessage)) {
          event.preventDefault();
        }

        props.onClick?.(event);
      }}
      type="submit"
    >
      {children}
    </button>
  );
}
