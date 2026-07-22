import { Container } from "@preparatoria/ui";
import { unstable_noStore as noStore } from "next/cache";
import type { ReactNode } from "react";

import { requireStudentPortalAccess } from "../../lib/student-portal";
import { StudentPortalNav } from "./_components";

type StudentLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function StudentLayout({ children }: StudentLayoutProps) {
  noStore();
  const identity = await requireStudentPortalAccess();

  return (
    <Container className="student-portal">
      <header className="student-portal-header">
        <div>
          <h1>Portal del alumno</h1>
          <p className="technical-reference">
            Consulta académica propia. Rol activo: {identity.context.roleCodes.join(", ")}
          </p>
        </div>
      </header>
      <StudentPortalNav />
      {children}
    </Container>
  );
}
