import { readRuntimeEnv } from "@preparatoria/env/server";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@preparatoria/ui/styles.css";
import "./globals.css";
import { AdminShell } from "./_admin/admin-shell";
import { logoutAction } from "./actions";
import { adminAuthentication } from "../lib/auth";

export const metadata: Metadata = {
  title: "Sistema Administrativo",
  description: "Base técnica del Sistema Administrativo",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function RootLayout({ children }: RootLayoutProps) {
  const environment = readRuntimeEnv();
  const userSummary = await adminAuthentication()
    .then((authentication) => authentication.getAuthenticatedIdentity())
    .then((result) =>
      result.ok
        ? {
            primaryRole: result.identity.context.roleCodes[0] ?? null,
            roleCount: result.identity.context.roleCodes.length,
          }
        : null,
    )
    .catch(() => null);

  return (
    <html data-app-env={environment.APP_ENV} data-log-level={environment.LOG_LEVEL} lang="es">
      <body>
        <AdminShell logoutAction={logoutAction} userSummary={userSummary}>
          {children}
        </AdminShell>
      </body>
    </html>
  );
}
