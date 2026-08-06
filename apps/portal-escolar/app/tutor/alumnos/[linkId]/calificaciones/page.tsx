import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentGradesPage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const grades = await service.getStudentGrades(linkId);

  return (
    <GuardianPortalSection title="Calificaciones publicadas">
      <pre>{JSON.stringify(grades, null, 2)}</pre>
    </GuardianPortalSection>
  );
}
