import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentTrajectoryPage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const progress = await service.getStudentProgress(linkId);
  const history = await service.getStudentHistory(linkId);

  return (
    <>
      <GuardianPortalSection title="Progreso confirmado">
        <pre>{JSON.stringify(progress, null, 2)}</pre>
      </GuardianPortalSection>
      <GuardianPortalSection title="Trayectoria informativa">
        <pre>{JSON.stringify(history, null, 2)}</pre>
      </GuardianPortalSection>
    </>
  );
}
