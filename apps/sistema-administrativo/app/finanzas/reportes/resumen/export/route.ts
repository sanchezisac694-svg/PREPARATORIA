import { getFinancialReportsService } from "../../../../../lib/financial-reports";
import { requireAdminAccess } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminAccess();
  const reports = await getFinancialReportsService();
  const csv = await reports.exportSummaryCsv();

  return new Response(csv, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": 'attachment; filename="financial-summary.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
