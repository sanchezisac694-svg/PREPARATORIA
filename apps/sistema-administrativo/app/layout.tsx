import { readRuntimeEnv } from "@preparatoria/env/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@preparatoria/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Administrativo",
  description: "Base técnica del Sistema Administrativo",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const environment = readRuntimeEnv();

  return (
    <html data-app-env={environment.APP_ENV} data-log-level={environment.LOG_LEVEL} lang="es">
      <body>{children}</body>
    </html>
  );
}
