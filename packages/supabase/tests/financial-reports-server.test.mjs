import assert from "node:assert/strict";
import test from "node:test";

import { createFinancialReportsService, FinancialReportError } from "../dist/financial-reports.js";
import {
  createFinancialPeriodCloseService,
  FinancialPeriodCloseError,
  financialPeriodCloseErrorCodes,
  financialPeriodCloseOperations,
  financialPeriodCloseSqlFunctions,
} from "../dist/financial-period-close.js";

const validConfig = {
  publishableKey: "sb_publishable_example123",
  url: "https://example.supabase.co",
};

const cookies = {
  getAll: () => [],
  setAll: () => {},
};

test("servicio server-only de reportes financieros usa rpc cerradas y no expone el sdk", async () => {
  const calls = [];
  const service = createFinancialReportsService(validConfig, cookies, () => ({
    rpc: async (name, input) => {
      calls.push({ input, name });
      switch (name) {
        case "get_financial_period_summary":
          return {
            data: {
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
            },
            error: null,
          };
        case "report_charges":
          return {
            data: {
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
            },
            error: null,
          };
        case "report_payments":
          return {
            data: {
              offset: 0,
              pageSize: 50,
              rows: [
                {
                  amount: "100.00",
                  appliedAmount: "80.00",
                  cashSession: null,
                  method: "CASH",
                  paidAt: "2026-08-10T10:00:00.000Z",
                  paymentId: "00000000-0000-4000-8000-000000000020",
                  receiptNumber: "REC-2026-000001",
                  status: "CONFIRMED",
                  studentDisplayName: "Alumno AL-001",
                  studentIdentifier: "AL-001",
                  unappliedAmount: "20.00",
                },
              ],
              totalRows: 1,
            },
            error: null,
          };
        case "report_debt_summary":
          return {
            data: {
              rows: [],
              summary: {
                debtorAccounts: 1,
                totalOutstanding: "10.00",
                totalOverdue: "10.00",
              },
            },
            error: null,
          };
        case "report_cash_operations":
        case "report_financial_benefits":
        case "report_payment_agreements":
          return { data: { offset: 0, pageSize: 50, rows: [], totalRows: 0 }, error: null };
        default:
          return { data: null, error: { message: "FINANCIAL_REPORT_OPERATION_FAILED" } };
      }
    },
  }));

  const summary = await service.getSummary();
  const charges = await service.getCharges();
  const payments = await service.getPayments();
  const debt = await service.getDebt();
  const csv = await service.exportSummaryCsv();

  assert.equal(summary.netCollections, "80.00");
  assert.equal(charges.rows[0].studentIdentifier, "AL-001");
  assert.equal(payments.rows[0].receiptNumber, "REC-2026-000001");
  assert.equal(debt.summary.totalOutstanding, "10.00");
  assert.match(csv, /gross_charges/);
  assert.equal(calls[0].name, "get_financial_period_summary");
  assert.equal(calls[1].name, "report_charges");
  assert.equal(calls[2].name, "report_payments");
});

test("servicio server-only de reportes financieros falla cerrado ante respuestas inválidas", async () => {
  const service = createFinancialReportsService(validConfig, cookies, () => ({
    rpc: async () => ({ data: { grossCharges: "oops" }, error: null }),
  }));

  await assert.rejects(
    service.getSummary(),
    (error) =>
      error instanceof FinancialReportError && error.code === "FINANCIAL_REPORT_RESPONSE_INVALID",
  );
});

test("contrato de cierre financiero expone operaciones cerradas e idempotentes", () => {
  assert.deepEqual(financialPeriodCloseOperations, [
    "LIST_CLOSES",
    "GET_CLOSE",
    "CREATE_CLOSE",
    "APPROVE_CLOSE",
    "SUPERSEDE_CLOSE",
  ]);
  assert.equal(
    financialPeriodCloseSqlFunctions.CREATE_CLOSE,
    "public.create_financial_period_close",
  );
  assert.ok(financialPeriodCloseErrorCodes.includes("IDEMPOTENCY_CONFLICT"));
});

test("servicio de cierre financiero usa wrappers públicos y conserva montos string", async () => {
  const service = createFinancialPeriodCloseService(validConfig, cookies, () => ({
    rpc: async (name) => {
      if (name === "public.list_financial_period_closures") {
        return {
          data: {
            offset: 0,
            pageSize: 50,
            rows: [
              {
                academicPeriodCode: "2026-A",
                academicPeriodId: "00000000-0000-4000-8000-000000000101",
                academicPeriodName: "Periodo 2026-A",
                approvedAt: null,
                approvedByAccountId: null,
                businessDate: "2026-08-10",
                closureId: "00000000-0000-4000-8000-000000000102",
                createdAt: "2026-08-10T10:00:00.000Z",
                createdByAccountId: "00000000-0000-4000-8000-000000000103",
                grossCharges: "100.00",
                netCollections: "90.00",
                outstanding: "10.00",
                overdue: "10.00",
                status: "UNDER_REVIEW",
                version: 1,
              },
            ],
            totalRows: 1,
          },
          error: null,
        };
      }
      if (name === "public.get_financial_period_close") {
        return {
          data: {
            academicPeriodCode: "2026-A",
            academicPeriodId: "00000000-0000-4000-8000-000000000101",
            academicPeriodName: "Periodo 2026-A",
            approvedAt: null,
            approvedByAccountId: null,
            businessDate: "2026-08-10",
            closureId: "00000000-0000-4000-8000-000000000102",
            confirmedPayments: "90.00",
            createdAt: "2026-08-10T10:00:00.000Z",
            createdByAccountId: "00000000-0000-4000-8000-000000000103",
            creditAdjustments: "0.00",
            discounts: "10.00",
            grossCharges: "100.00",
            netCharges: "90.00",
            netCollections: "90.00",
            outstanding: "10.00",
            overdue: "10.00",
            reversedPayments: "0.00",
            scholarshipAdjustments: "0.00",
            status: "UNDER_REVIEW",
            supersededAt: null,
            supersededByAccountId: null,
            supersedesClosureId: null,
            version: 1,
            waivers: "0.00",
          },
          error: null,
        };
      }
      if (name === "public.create_financial_period_close") {
        return {
          data: { entity_id: "00000000-0000-4000-8000-000000000104", status: "UNDER_REVIEW" },
          error: null,
        };
      }
      if (name === "public.approve_financial_period_close") {
        return {
          data: { entity_id: "00000000-0000-4000-8000-000000000102", status: "APPROVED" },
          error: null,
        };
      }
      if (name === "public.supersede_financial_period_close") {
        return {
          data: { entity_id: "00000000-0000-4000-8000-000000000105", status: "SUPERSEDED" },
          error: null,
        };
      }
      return { data: null, error: { message: "FINANCIAL_PERIOD_CLOSE_OPERATION_FAILED" } };
    },
  }));

  const list = await service.list();
  const detail = await service.get("00000000-0000-4000-8000-000000000102");
  const created = await service.create(
    "00000000-0000-4000-8000-000000000101",
    "2026-08-10",
    "CREATE_CLOSE",
  );
  const approved = await service.approve("00000000-0000-4000-8000-000000000102", "APPROVE_CLOSE");
  const superseded = await service.supersede(
    "00000000-0000-4000-8000-000000000102",
    "2026-08-11",
    "SUPERSEDE_CLOSE",
  );

  assert.equal(list.rows[0].grossCharges, "100.00");
  assert.equal(detail.netCollections, "90.00");
  assert.equal(created.status, "UNDER_REVIEW");
  assert.equal(approved.status, "APPROVED");
  assert.equal(superseded.status, "SUPERSEDED");
});

test("servicio de cierre financiero rechaza parámetros inválidos", async () => {
  const service = createFinancialPeriodCloseService(validConfig, cookies, () => ({
    rpc: async () => ({ data: null, error: { message: "IDEMPOTENCY_CONFLICT" } }),
  }));

  await assert.rejects(
    service.get("not-a-uuid"),
    (error) =>
      error instanceof FinancialPeriodCloseError && error.code === "FINANCIAL_PERIOD_CLOSE_INVALID",
  );
  await assert.rejects(
    service.create("00000000-0000-4000-8000-000000000101", "bad-date", "CREATE_CLOSE"),
    (error) =>
      error instanceof FinancialPeriodCloseError && error.code === "FINANCIAL_PERIOD_CLOSE_INVALID",
  );
});
