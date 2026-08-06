import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentSubjectsPage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const subjects = await service.getStudentSubjects(linkId);

  return (
    <GuardianPortalSection title="Materias visibles">
      <pre>{JSON.stringify(subjects, null, 2)}</pre>
    </GuardianPortalSection>
  );
}
