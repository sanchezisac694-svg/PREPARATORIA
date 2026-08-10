import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import {
  buildFinancialReportFilters,
  FinancialReportError,
  parseCashReportPage,
  parseChargeReportPage,
  parseDebtReport,
  parseFinancialBenefitsReportPage,
  parseFinancialReportRpcError,
  parseFinancialReportSummary,
  parsePaymentAgreementsReportPage,
  parsePaymentReportPage,
  rowLimitGuard,
  escapeCsvCell,
} from "./financial-report-utils.js";
import {
  type FinancialReportRpcName,
  type FinancialReportsFilters,
} from "./financial-report-utils.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

export * from "./financial-report-utils.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/financial-reports solo puede importarse desde el servidor.",
  );
}

interface FinancialReportSdk {
  rpc(
    name: FinancialReportRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type FinancialReportsClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => FinancialReportSdk;

export function createFinancialReportsService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: FinancialReportsClientFactory = createServerClient as unknown as FinancialReportsClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: FinancialReportRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new FinancialReportError(parseFinancialReportRpcError(result.error), {
        cause: result.error,
      });
    }
    return result.data;
  }

  return Object.freeze({
    async getSummary(filters: FinancialReportsFilters = {}) {
      return parseFinancialReportSummary(
        await invoke("get_financial_period_summary", buildFinancialReportFilters(filters)),
      );
    },
    async getCharges(filters: FinancialReportsFilters = {}) {
      return parseChargeReportPage(
        await invoke("report_charges", buildFinancialReportFilters(filters)),
      );
    },
    async getPayments(filters: FinancialReportsFilters = {}) {
      return parsePaymentReportPage(
        await invoke("report_payments", buildFinancialReportFilters(filters)),
      );
    },
    async getDebt(filters: FinancialReportsFilters = {}) {
      return parseDebtReport(
        await invoke("report_debt_summary", buildFinancialReportFilters(filters)),
      );
    },
    async getCash(filters: FinancialReportsFilters = {}) {
      return parseCashReportPage(
        await invoke("report_cash_operations", buildFinancialReportFilters(filters)),
      );
    },
    async getBenefits(filters: FinancialReportsFilters = {}) {
      return parseFinancialBenefitsReportPage(
        await invoke("report_financial_benefits", buildFinancialReportFilters(filters)),
      );
    },
    async getAgreements(filters: FinancialReportsFilters = {}) {
      return parsePaymentAgreementsReportPage(
        await invoke("report_payment_agreements", buildFinancialReportFilters(filters)),
      );
    },
    async exportSummaryCsv(filters: FinancialReportsFilters = {}) {
      const summary = await this.getSummary(filters);
      const rows = [
        ["metric", "amount"],
        ["gross_charges", summary.grossCharges],
        ["credit_adjustments", summary.creditAdjustments],
        ["discounts", summary.discounts],
        ["waivers", summary.waivers],
        ["scholarship_adjustments", summary.scholarshipAdjustments],
        ["net_charges", summary.netCharges],
        ["confirmed_payments", summary.confirmedPayments],
        ["reversed_payments", summary.reversedPayments],
        ["net_collections", summary.netCollections],
        ["outstanding", summary.outstanding],
        ["overdue", summary.overdue],
      ];
      rowLimitGuard(rows.length);
      return rows.map((line) => line.map(escapeCsvCell).join(",")).join("\n");
    },
  });
}
