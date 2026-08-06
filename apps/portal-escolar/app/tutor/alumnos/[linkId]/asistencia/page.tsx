import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentAttendancePage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const attendance = await service.getStudentAttendance(linkId);

  return (
    <GuardianPortalSection title="Asistencia visible">
      <pre>{JSON.stringify(attendance, null, 2)}</pre>
    </GuardianPortalSection>
  );
}
