import { unstable_noStore as noStore } from "next/cache";

import { getGuardianPortalService } from "../../../../../lib/guardian-portal";
import { GuardianPortalSection } from "../../../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function GuardianStudentRecordPage({
  params,
}: Readonly<{ params: Promise<{ linkId: string }> }>) {
  noStore();
  const { linkId } = await params;
  const service = await getGuardianPortalService();
  const record = await service.getStudentRecord(linkId);

  return (
    <GuardianPortalSection title="Expediente académico mínimo">
      <pre>{JSON.stringify(record, null, 2)}</pre>
    </GuardianPortalSection>
  );
}
