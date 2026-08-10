import assert from "node:assert/strict";
import test from "node:test";

import {
  asMoneyAmount,
  buildFinancialReportFilters,
  escapeCsvCell,
  FinancialReportError,
  financialReportErrorCodes,
  financialReportRpcNames,
  financialReportTypes,
  normalizeFinancialReportOffset,
  normalizeFinancialReportPageSize,
  parseChargeReportPage,
  parseFinancialReportSummary,
  rowLimitGuard,
} from "../dist/financial-report-utils.js";

test("contrato puro de reportes financieros mantiene catálogos cerrados y export seguro", () => {
  assert.deepEqual(financialReportTypes, [
    "SUMMARY",
    "CHARGES",
    "PAYMENTS",
    "DEBT",
    "CASH",
    "BENEFITS",
    "AGREEMENTS",
  ]);
  assert.deepEqual(financialReportRpcNames, [
    "get_financial_period_summary",
    "report_charges",
    "report_payments",
    "report_debt_summary",
    "report_cash_operations",
    "report_financial_benefits",
    "report_payment_agreements",
  ]);
  assert.ok(financialReportErrorCodes.includes("FINANCIAL_REPORT_EXPORT_LIMIT_EXCEEDED"));
  assert.equal(escapeCsvCell("=SUM(A1:A2)"), `"\'=SUM(A1:A2)"`);
  assert.equal(escapeCsvCell("+cmd"), `"'+cmd"`);
  assert.equal(escapeCsvCell("-1+2"), `"'-1+2"`);
  assert.equal(escapeCsvCell("@evil"), `"'@evil"`);
  assert.equal(escapeCsvCell('a"\r\nb'), `"a""  b"`);
});

test("helpers puros validan paginación y límites de exportación", () => {
  assert.equal(normalizeFinancialReportPageSize(undefined), 50);
  assert.equal(normalizeFinancialReportPageSize(200), 200);
  assert.equal(normalizeFinancialReportOffset(undefined), 0);
  assert.equal(normalizeFinancialReportOffset(0), 0);
  assert.throws(
    () => normalizeFinancialReportPageSize(201),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_INVALID_PAGE_SIZE",
  );
  assert.throws(
    () => normalizeFinancialReportOffset(-1),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_INVALID_CURSOR",
  );
  assert.throws(
    () => rowLimitGuard(10_001),
    (error) =>
      error instanceof FinancialReportError &&
      error.code === "FINANCIAL_REPORT_EXPORT_LIMIT_EXCEEDED",
  );
});

test("helpers puros construyen filtros cerrados", () => {
  assert.deepEqual(
    buildFinancialReportFilters({
      academicPeriodId: "00000000-0000-4000-8000-000000000001",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      offset: 0,
      pageSize: 50,
      searchText: "  AL-001  ",
    }),
    {
      requested_academic_period_id: "00000000-0000-4000-8000-000000000001",
      date_from: "2026-08-01",
      date_to: "2026-08-31",
      requested_limit: 50,
      requested_offset: 0,
      requested_search_text: "AL-001",
    },
  );

  assert.throws(
    () => buildFinancialReportFilters({ academicPeriodId: "bad-uuid" }),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_RESPONSE_INVALID",
  );
  assert.throws(
    () => buildFinancialReportFilters({ dateFrom: "2026-08-10", dateTo: "2026-08-01" }),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_INVALID_DATE_RANGE",
  );
});

test("helpers puros materializan DTOs cerrados", () => {
  const summary = parseFinancialReportSummary({
    academicPeriodId: "00000000-0000-4000-8000-000000000001",
    businessDate: "2026-08-10",
    chargeCount: 1,
    confirmedPayments: "100.00",
    creditAdjustments: "0.00",
    debtorAccountCount: 1,
    discounts: "10.00",
    grossCharges: "100.00",
    netCharges: "90.00",
    netCollections: "80.00",
    outstanding: "10.00",
    overdue: "10.00",
    paymentCount: 1,
    reversedPayments: "20.00",
    scholarshipAdjustments: "0.00",
    waivers: "0.00",
  });
  assert.equal(summary.netCollections, "80.00");

  const charges = parseChargeReportPage({
    offset: 0,
    pageSize: 50,
    rows: [
      {
        amountPaid: "80.00",
        appliedAdjustments: "10.00",
        chargeId: "00000000-0000-4000-8000-000000000010",
        chargeStatus: "PARTIALLY_PAID",
        concept: "Colegiatura",
        dueDate: "2026-08-09",
        isOverdue: true,
        originalAmount: "100.00",
        outstanding: "10.00",
        postedAt: "2026-08-01T10:00:00.000Z",
        studentDisplayName: "Alumno AL-001",
        studentIdentifier: "AL-001",
      },
    ],
    totalRows: 1,
  });
  assert.equal(charges.rows[0].studentIdentifier, "AL-001");
  assert.equal(asMoneyAmount("10.00"), "10.00");

  assert.throws(
    () => parseFinancialReportSummary({ grossCharges: "oops" }),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_RESPONSE_INVALID",
  );
});
