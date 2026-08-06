import { Container } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";
import type { ReactNode } from "react";

import { requireGuardianPortalAccess } from "../../lib/guardian-portal";
import { GuardianPortalNav } from "./_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  noStore();
  const identity = await requireGuardianPortalAccess();

  return (
    <Container className="student-portal">
      <header className="student-portal-header">
        <div>
          <h1>Portal del tutor</h1>
          <p className="technical-reference">
            Consulta informativa solo para alumnos con vínculo institucional vigente. Rol activo:{" "}
            {identity.context.roleCodes.join(", ")}
          </p>
        </div>
      </header>
      <GuardianPortalNav />
      {children}
    </Container>
  );
}
