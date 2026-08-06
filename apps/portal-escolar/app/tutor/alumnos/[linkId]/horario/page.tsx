import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentSchedulePage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const schedule = await service.getStudentSchedule(linkId);

  return (
    <GuardianPortalSection title="Horario publicado">
      <pre>{JSON.stringify(schedule, null, 2)}</pre>
    </GuardianPortalSection>
  );
}
