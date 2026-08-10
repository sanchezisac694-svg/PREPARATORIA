export type MoneyAmount = `${number}.${number}${number}`;

export const financialReportTypes = Object.freeze([
  "SUMMARY",
  "CHARGES",
  "PAYMENTS",
  "DEBT",
  "CASH",
  "BENEFITS",
  "AGREEMENTS",
] as const);

export type FinancialReportType = (typeof financialReportTypes)[number];

export const financialReportErrorCodes = Object.freeze([
  "AAL2_REQUIRED",
  "ACTOR_NOT_AUTHORIZED",
  "APPLICATION_NOT_ALLOWED",
  "FINANCIAL_REPORT_EXPORT_LIMIT_EXCEEDED",
  "FINANCIAL_REPORT_INVALID_CURSOR",
  "FINANCIAL_REPORT_INVALID_DATE_RANGE",
  "FINANCIAL_REPORT_INVALID_PAGE_SIZE",
  "FINANCIAL_REPORT_OPERATION_FAILED",
  "FINANCIAL_REPORT_RESPONSE_INVALID",
  "SESSION_VERSION_INVALID",
] as const);

export type FinancialReportErrorCode = (typeof financialReportErrorCodes)[number];

export interface FinancialReportSummary {
  readonly academicPeriodId: string | null;
  readonly businessDate: string;
  readonly chargeCount: number;
  readonly confirmedPayments: MoneyAmount;
  readonly creditAdjustments: MoneyAmount;
  readonly debtorAccountCount: number;
  readonly discounts: MoneyAmount;
  readonly grossCharges: MoneyAmount;
  readonly netCharges: MoneyAmount;
  readonly netCollections: MoneyAmount;
  readonly outstanding: MoneyAmount;
  readonly overdue: MoneyAmount;
  readonly paymentCount: number;
  readonly reversedPayments: MoneyAmount;
  readonly scholarshipAdjustments: MoneyAmount;
  readonly waivers: MoneyAmount;
}

export interface FinancialReportPage<T> {
  readonly offset: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly totalRows: number;
}

export interface ChargeReportRow {
  readonly amountPaid: MoneyAmount;
  readonly appliedAdjustments: MoneyAmount;
  readonly chargeId: string;
  readonly chargeStatus: string;
  readonly concept: string;
  readonly dueDate: string | null;
  readonly isOverdue: boolean;
  readonly originalAmount: MoneyAmount;
  readonly outstanding: MoneyAmount;
  readonly postedAt: string;
  readonly studentDisplayName: string;
  readonly studentIdentifier: string | null;
}

export interface PaymentReportRow {
  readonly amount: MoneyAmount;
  readonly appliedAmount: MoneyAmount;
  readonly cashSession: null | Readonly<{
    businessDate: string;
    cashRegisterCode: string | null;
    cashRegisterName: string | null;
    cashSessionId: string;
  }>;
  readonly method: string;
  readonly paidAt: string;
  readonly paymentId: string;
  readonly receiptNumber: string;
  readonly status: string;
  readonly studentDisplayName: string;
  readonly studentIdentifier: string | null;
  readonly unappliedAmount: MoneyAmount;
}

export interface DebtReportSummary {
  readonly debtorAccounts: number;
  readonly totalOutstanding: MoneyAmount;
  readonly totalOverdue: MoneyAmount;
}

export interface DebtReportRow {
  readonly agingBucket: string;
  readonly caseStatus: string | null;
  readonly groupName: string | null;
  readonly oldestOverdueDate: string | null;
  readonly semesterNumber: number | null;
  readonly studentDisplayName: string | null;
  readonly studentIdentifier: string;
  readonly totalOutstanding: MoneyAmount;
  readonly totalOverdue: MoneyAmount;
}

export interface CashReportRow {
  readonly businessDate: string;
  readonly cashIn: MoneyAmount;
  readonly cashOut: MoneyAmount;
  readonly cashReceipts: MoneyAmount;
  readonly cashRegisterCode: string | null;
  readonly cashRegisterName: string | null;
  readonly cashSessionId: string;
  readonly counted: MoneyAmount | null;
  readonly difference: MoneyAmount | null;
  readonly expected: MoneyAmount | null;
  readonly opening: MoneyAmount;
  readonly reconciliationStatus: string | null;
  readonly reversals: MoneyAmount;
  readonly sessionStatus: string;
}

export interface FinancialBenefitReportRow {
  readonly adjustmentId: string;
  readonly appliedAt: string;
  readonly benefitAmount: MoneyAmount;
  readonly benefitType: string;
  readonly chargeId: string;
  readonly concept: string;
  readonly program: string | null;
  readonly status: string;
  readonly studentDisplayName: string;
  readonly studentIdentifier: string | null;
}

export interface PaymentAgreementReportRow {
  readonly agreementStatus: string;
  readonly evaluationStatus: string;
  readonly fulfilledAmount: MoneyAmount;
  readonly initialSnapshot: MoneyAmount;
  readonly nextInstallment: string | null;
  readonly pastDueInstallments: number;
  readonly paymentAgreementId: string;
  readonly remaining: MoneyAmount;
  readonly dueInstallments: number;
  readonly scheduledTotal: MoneyAmount;
  readonly studentDisplayName: string;
  readonly studentIdentifier: string | null;
}

export const financialReportRpcNames = Object.freeze([
  "get_financial_period_summary",
  "report_charges",
  "report_payments",
  "report_debt_summary",
  "report_cash_operations",
  "report_financial_benefits",
  "report_payment_agreements",
] as const);

export type FinancialReportRpcName = (typeof financialReportRpcNames)[number];

export class FinancialReportError extends Error {
  readonly code: FinancialReportErrorCode;

  constructor(code: FinancialReportErrorCode, options?: ErrorOptions) {
    super("No fue posible obtener el reporte financiero administrativo.", options);
    this.name = "FinancialReportError";
    this.code = code;
  }
}

const decimalPattern = /^\d+\.\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function expectObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return value as Readonly<Record<string, unknown>>;
}

function expectArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return value as readonly unknown[];
}

export function asMoneyAmount(value: unknown): MoneyAmount {
  const amount = String(value ?? "0.00");
  if (!decimalPattern.test(amount)) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return amount as MoneyAmount;
}

function asOptionalDate(value: unknown) {
  if (value == null) {
    return null;
  }
  const text = String(value);
  if (!datePattern.test(text) && Number.isNaN(Date.parse(text))) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return text;
}

function asUuid(value: unknown) {
  const text = String(value ?? "");
  if (!uuidPattern.test(text)) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return text;
}

export function parseFinancialReportRpcError(error: unknown): FinancialReportErrorCode {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    const message = error.message.toUpperCase();
    if (financialReportErrorCodes.includes(message as FinancialReportErrorCode)) {
      return message as FinancialReportErrorCode;
    }
    if (
      [
        "AAL2_REQUIRED",
        "ACTOR_NOT_AUTHORIZED",
        "APPLICATION_NOT_ALLOWED",
        "SESSION_VERSION_INVALID",
      ].includes(message)
    ) {
      return message as FinancialReportErrorCode;
    }
  }
  return "FINANCIAL_REPORT_OPERATION_FAILED";
}

export function normalizeFinancialReportPageSize(value?: number | null) {
  if (value == null) {
    return 50;
  }
  if (!Number.isInteger(value) || value < 1 || value > 200) {
    throw new FinancialReportError("FINANCIAL_REPORT_INVALID_PAGE_SIZE");
  }
  return value;
}

export function normalizeFinancialReportOffset(value?: number | null) {
  if (value == null) {
    return 0;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new FinancialReportError("FINANCIAL_REPORT_INVALID_CURSOR");
  }
  return value;
}

function normalizeDate(value?: string | null) {
  if (!value) {
    return undefined;
  }
  if (!datePattern.test(value)) {
    throw new FinancialReportError("FINANCIAL_REPORT_INVALID_DATE_RANGE");
  }
  return value;
}

function normalizeUuid(value?: string | null) {
  if (!value) {
    return undefined;
  }
  if (!uuidPattern.test(value)) {
    throw new FinancialReportError("FINANCIAL_REPORT_RESPONSE_INVALID");
  }
  return value;
}

export interface FinancialReportsFilters {
  readonly academicPeriodId?: string | null;
  readonly businessDate?: string | null;
  readonly cashRegisterId?: string | null;
  readonly cashierAccountId?: string | null;
  readonly chargeConceptId?: string | null;
  readonly chargeStatus?: string | null;
  readonly dateFrom?: string | null;
  readonly dateTo?: string | null;
  readonly groupId?: string | null;
  readonly offset?: number | null;
  readonly pageSize?: number | null;
  readonly paymentMethod?: string | null;
  readonly paymentStatus?: string | null;
  readonly searchText?: string | null;
  readonly semesterNumber?: number | null;
  readonly sessionStatus?: string | null;
  readonly trainingAreaId?: string | null;
}

export function buildFinancialReportFilters(input: FinancialReportsFilters) {
  const dateFrom = normalizeDate(input.dateFrom);
  const dateTo = normalizeDate(input.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new FinancialReportError("FINANCIAL_REPORT_INVALID_DATE_RANGE");
  }

  return {
    ...(normalizeUuid(input.academicPeriodId)
      ? { requested_academic_period_id: input.academicPeriodId }
      : {}),
    ...(normalizeDate(input.businessDate) ? { requested_business_date: input.businessDate } : {}),
    ...(normalizeUuid(input.cashRegisterId)
      ? { requested_cash_register_id: input.cashRegisterId }
      : {}),
    ...(normalizeUuid(input.cashierAccountId)
      ? { requested_cashier_account_id: input.cashierAccountId }
      : {}),
    ...(normalizeUuid(input.chargeConceptId)
      ? { requested_charge_concept_id: input.chargeConceptId }
      : {}),
    ...(input.chargeStatus ? { requested_charge_status: input.chargeStatus } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    ...(normalizeUuid(input.groupId) ? { requested_group_id: input.groupId } : {}),
    ...(input.paymentMethod ? { requested_payment_method: input.paymentMethod } : {}),
    ...(input.paymentStatus ? { requested_payment_status: input.paymentStatus } : {}),
    ...(typeof input.searchText === "string" && input.searchText.trim().length > 0
      ? { requested_search_text: input.searchText.trim() }
      : {}),
    ...(typeof input.semesterNumber === "number"
      ? { requested_semester_number: input.semesterNumber }
      : {}),
    ...(input.sessionStatus ? { requested_session_status: input.sessionStatus } : {}),
    ...(normalizeUuid(input.trainingAreaId)
      ? { requested_training_area_id: input.trainingAreaId }
      : {}),
    requested_limit: normalizeFinancialReportPageSize(input.pageSize),
    requested_offset: normalizeFinancialReportOffset(input.offset),
  };
}

function asPage<T>(value: unknown, mapper: (row: unknown) => T): FinancialReportPage<T> {
  const object = expectObject(value);
  return {
    offset: Number(object.offset ?? 0),
    pageSize: Number(object.pageSize ?? 50),
    rows: expectArray(object.rows ?? []).map(mapper),
    totalRows: Number(object.totalRows ?? 0),
  };
}

export function parseFinancialReportSummary(value: unknown): FinancialReportSummary {
  const object = expectObject(value);
  return {
    academicPeriodId:
      typeof object.academicPeriodId === "string" && uuidPattern.test(object.academicPeriodId)
        ? object.academicPeriodId
        : null,
    businessDate: String(object.businessDate ?? ""),
    chargeCount: Number(object.chargeCount ?? 0),
    confirmedPayments: asMoneyAmount(object.confirmedPayments),
    creditAdjustments: asMoneyAmount(object.creditAdjustments),
    debtorAccountCount: Number(object.debtorAccountCount ?? 0),
    discounts: asMoneyAmount(object.discounts),
    grossCharges: asMoneyAmount(object.grossCharges),
    netCharges: asMoneyAmount(object.netCharges),
    netCollections: asMoneyAmount(object.netCollections),
    outstanding: asMoneyAmount(object.outstanding),
    overdue: asMoneyAmount(object.overdue),
    paymentCount: Number(object.paymentCount ?? 0),
    reversedPayments: asMoneyAmount(object.reversedPayments),
    scholarshipAdjustments: asMoneyAmount(object.scholarshipAdjustments),
    waivers: asMoneyAmount(object.waivers),
  };
}

function asChargeRow(value: unknown): ChargeReportRow {
  const object = expectObject(value);
  return {
    amountPaid: asMoneyAmount(object.amountPaid),
    appliedAdjustments: asMoneyAmount(object.appliedAdjustments),
    chargeId: asUuid(object.chargeId),
    chargeStatus: String(object.chargeStatus ?? ""),
    concept: String(object.concept ?? ""),
    dueDate: asOptionalDate(object.dueDate),
    isOverdue: Boolean(object.isOverdue),
    originalAmount: asMoneyAmount(object.originalAmount),
    outstanding: asMoneyAmount(object.outstanding),
    postedAt: String(object.postedAt ?? ""),
    studentDisplayName: String(object.studentDisplayName ?? ""),
    studentIdentifier:
      typeof object.studentIdentifier === "string" ? object.studentIdentifier : null,
  };
}

function asPaymentRow(value: unknown): PaymentReportRow {
  const object = expectObject(value);
  const cashSessionObject =
    typeof object.cashSession === "object" && object.cashSession !== null
      ? expectObject(object.cashSession)
      : null;
  return {
    amount: asMoneyAmount(object.amount),
    appliedAmount: asMoneyAmount(object.appliedAmount),
    cashSession: cashSessionObject
      ? {
          businessDate: String(cashSessionObject.businessDate ?? ""),
          cashRegisterCode:
            typeof cashSessionObject.cashRegisterCode === "string"
              ? cashSessionObject.cashRegisterCode
              : null,
          cashRegisterName:
            typeof cashSessionObject.cashRegisterName === "string"
              ? cashSessionObject.cashRegisterName
              : null,
          cashSessionId: asUuid(cashSessionObject.cashSessionId),
        }
      : null,
    method: String(object.method ?? ""),
    paidAt: String(object.paidAt ?? ""),
    paymentId: asUuid(object.paymentId),
    receiptNumber: String(object.receiptNumber ?? ""),
    status: String(object.status ?? ""),
    studentDisplayName: String(object.studentDisplayName ?? ""),
    studentIdentifier:
      typeof object.studentIdentifier === "string" ? object.studentIdentifier : null,
    unappliedAmount: asMoneyAmount(object.unappliedAmount),
  };
}

function asDebtRow(value: unknown): DebtReportRow {
  const object = expectObject(value);
  return {
    agingBucket: String(object.agingBucket ?? ""),
    caseStatus: typeof object.caseStatus === "string" ? object.caseStatus : null,
    groupName: typeof object.groupName === "string" ? object.groupName : null,
    oldestOverdueDate: asOptionalDate(object.oldestOverdueDate),
    semesterNumber:
      typeof object.semesterNumber === "number"
        ? object.semesterNumber
        : Number(object.semesterNumber ?? NaN) || null,
    studentDisplayName:
      typeof object.studentDisplayName === "string" ? object.studentDisplayName : null,
    studentIdentifier: String(object.studentIdentifier ?? ""),
    totalOutstanding: asMoneyAmount(object.totalOutstanding),
    totalOverdue: asMoneyAmount(object.totalOverdue),
  };
}

export function parseDebtReport(value: unknown) {
  const object = expectObject(value);
  const summary = expectObject(object.summary ?? {});
  return {
    rows: expectArray(object.rows ?? []).map(asDebtRow),
    summary: {
      debtorAccounts: Number(summary.debtorAccounts ?? 0),
      totalOutstanding: asMoneyAmount(summary.totalOutstanding),
      totalOverdue: asMoneyAmount(summary.totalOverdue),
    } satisfies DebtReportSummary,
  };
}

function asCashRow(value: unknown): CashReportRow {
  const object = expectObject(value);
  return {
    businessDate: String(object.businessDate ?? ""),
    cashIn: asMoneyAmount(object.cashIn),
    cashOut: asMoneyAmount(object.cashOut),
    cashReceipts: asMoneyAmount(object.cashReceipts),
    cashRegisterCode: typeof object.cashRegisterCode === "string" ? object.cashRegisterCode : null,
    cashRegisterName: typeof object.cashRegisterName === "string" ? object.cashRegisterName : null,
    cashSessionId: asUuid(object.cashSessionId),
    counted: object.counted == null ? null : asMoneyAmount(object.counted),
    difference: object.difference == null ? null : asMoneyAmount(object.difference),
    expected: object.expected == null ? null : asMoneyAmount(object.expected),
    opening: asMoneyAmount(object.opening),
    reconciliationStatus:
      typeof object.reconciliationStatus === "string" ? object.reconciliationStatus : null,
    reversals: asMoneyAmount(object.reversals),
    sessionStatus: String(object.sessionStatus ?? ""),
  };
}

function asBenefitRow(value: unknown): FinancialBenefitReportRow {
  const object = expectObject(value);
  return {
    adjustmentId: asUuid(object.adjustmentId),
    appliedAt: String(object.appliedAt ?? ""),
    benefitAmount: asMoneyAmount(object.benefitAmount),
    benefitType: String(object.benefitType ?? ""),
    chargeId: asUuid(object.chargeId),
    concept: String(object.concept ?? ""),
    program: typeof object.program === "string" ? object.program : null,
    status: String(object.status ?? ""),
    studentDisplayName: String(object.studentDisplayName ?? ""),
    studentIdentifier:
      typeof object.studentIdentifier === "string" ? object.studentIdentifier : null,
  };
}

function asAgreementRow(value: unknown): PaymentAgreementReportRow {
  const object = expectObject(value);
  return {
    agreementStatus: String(object.agreementStatus ?? ""),
    evaluationStatus: String(object.evaluationStatus ?? ""),
    fulfilledAmount: asMoneyAmount(object.fulfilledAmount),
    initialSnapshot: asMoneyAmount(object.initialSnapshot),
    nextInstallment: asOptionalDate(object.nextInstallment),
    pastDueInstallments: Number(object.pastDueInstallments ?? 0),
    paymentAgreementId: asUuid(object.paymentAgreementId),
    remaining: asMoneyAmount(object.remaining),
    dueInstallments: Number(object.dueInstallments ?? 0),
    scheduledTotal: asMoneyAmount(object.scheduledTotal),
    studentDisplayName: String(object.studentDisplayName ?? ""),
    studentIdentifier:
      typeof object.studentIdentifier === "string" ? object.studentIdentifier : null,
  };
}

export function parseChargeReportPage(value: unknown) {
  return asPage(value, asChargeRow);
}

export function parsePaymentReportPage(value: unknown) {
  return asPage(value, asPaymentRow);
}

export function parseCashReportPage(value: unknown) {
  return asPage(value, asCashRow);
}

export function parseFinancialBenefitsReportPage(value: unknown) {
  return asPage(value, asBenefitRow);
}

export function parsePaymentAgreementsReportPage(value: unknown) {
  return asPage(value, asAgreementRow);
}

export function escapeCsvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replaceAll('"', '""').replaceAll("\r", " ").replaceAll("\n", " ")}"`;
}

export function rowLimitGuard(rowCount: number, limit = 10_000) {
  if (rowCount > limit) {
    throw new FinancialReportError("FINANCIAL_REPORT_EXPORT_LIMIT_EXCEEDED");
  }
}
