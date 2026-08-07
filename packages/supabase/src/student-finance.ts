import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/student-finance solo puede importarse desde el servidor.",
  );
}

export type MoneyAmount = `${number}.${number}${number}`;

export interface StudentFinancialSummary {
  readonly currencyCode: "MXN";
  readonly lastUpdatedAt: string | null;
  readonly openChargeCount: number;
  readonly paymentCount: number;
  readonly totalBalance: MoneyAmount;
}

export interface FinancialMovement {
  readonly amount: MoneyAmount;
  readonly balance: MoneyAmount;
  readonly conceptName: string;
  readonly createdAt: string;
  readonly effectiveAt: string;
  readonly movementType: "ADJUSTMENT" | "ALLOCATION" | "CHARGE" | "PAYMENT";
  readonly referenceMasked: string | null;
  readonly status: string;
}

export interface StudentAccountStatement {
  readonly currencyCode: "MXN";
  readonly movements: readonly FinancialMovement[];
  readonly periodId: string | null;
  readonly totalBalance: MoneyAmount;
}

export interface StudentChargeSummary {
  readonly amount: MoneyAmount;
  readonly balance: MoneyAmount;
  readonly conceptName: string;
  readonly effectiveAt: string;
  readonly paymentStatus: string;
  readonly source: string;
}

export interface StudentPaymentSummary {
  readonly amount: MoneyAmount;
  readonly effectiveAt: string;
  readonly paymentId: string;
  readonly paymentMethod: string;
  readonly paymentReferenceMasked: string | null;
  readonly receiptNumber: string | null;
  readonly status: string;
}

export interface StudentPaymentDetail extends StudentPaymentSummary {
  readonly allocations: readonly Readonly<{
    amount: MoneyAmount;
    conceptName: string;
    effectiveAt: string;
    status: string;
  }>[];
}

export interface InternalPaymentReceipt {
  readonly amount: MoneyAmount;
  readonly issuedAt: string;
  readonly legend: string;
  readonly paymentMethod: string;
  readonly paymentReferenceMasked: string | null;
  readonly receiptNumber: string;
  readonly status: string;
}

export interface GuardianFinancialAccessResult {
  readonly error: "FINANCE_SCOPE_DENIED";
}

export const studentFinanceRpcNames = Object.freeze([
  "get_my_student_financial_summary",
  "get_my_student_account_statement",
  "get_my_student_charges",
  "get_my_student_payments",
  "get_my_student_payment",
  "get_my_student_receipt",
  "get_my_guardian_student_financial_summary",
  "get_my_guardian_student_account_statement",
] as const);

type StudentFinanceRpcName = (typeof studentFinanceRpcNames)[number];

interface StudentFinanceSdk {
  rpc(
    name: StudentFinanceRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type StudentFinanceClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => StudentFinanceSdk;

export class StudentFinanceError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible obtener la información financiera autorizada.", options);
    this.name = "StudentFinanceError";
    this.code = code;
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decimalPattern = /^\d+\.\d{2}$/;

function parseRpcError(error: unknown) {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    if ("code" in error && typeof error.code === "string" && error.code.length > 0) {
      return error.code;
    }
  }
  return "FINANCE_OPERATION_FAILED";
}

function expectObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StudentFinanceError("FINANCE_RESPONSE_INVALID");
  }
  return value as Readonly<Record<string, unknown>>;
}

function expectArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new StudentFinanceError("FINANCE_RESPONSE_INVALID");
  }
  return value as readonly unknown[];
}

function asMoneyAmount(value: unknown): MoneyAmount {
  const amount = String(value);
  if (!decimalPattern.test(amount)) {
    throw new StudentFinanceError("FINANCE_AMOUNT_INVALID");
  }
  return amount as MoneyAmount;
}

function asOptionalUuid(value: unknown, code: string) {
  if (value == null) {
    return null;
  }
  const text = String(value);
  if (!uuidPattern.test(text)) {
    throw new StudentFinanceError(code);
  }
  return text;
}

function optionalPeriodInput(periodId?: string | null) {
  if (!periodId) {
    return undefined;
  }
  if (!uuidPattern.test(periodId)) {
    throw new StudentFinanceError("FINANCE_PERIOD_INVALID");
  }
  return { requested_period_id: periodId };
}

function requiredPaymentInput(paymentId: string) {
  if (!uuidPattern.test(paymentId)) {
    throw new StudentFinanceError("FINANCE_ACCESS_DENIED");
  }
  return { payment_id: paymentId };
}

function guardianLinkInput(linkId: string, periodId?: string | null) {
  if (!uuidPattern.test(linkId)) {
    throw new StudentFinanceError("FINANCE_SCOPE_DENIED");
  }
  if (periodId && !uuidPattern.test(periodId)) {
    throw new StudentFinanceError("FINANCE_SCOPE_DENIED");
  }
  return periodId ? { link_id: linkId, requested_period_id: periodId } : { link_id: linkId };
}

function asGuardianAccessResult(value: unknown): GuardianFinancialAccessResult | null {
  const object = expectObject(value);
  return object.error === "FINANCE_SCOPE_DENIED" ? { error: "FINANCE_SCOPE_DENIED" } : null;
}

function asSummary(value: unknown): StudentFinancialSummary {
  const object = expectObject(value);
  return {
    currencyCode: "MXN",
    lastUpdatedAt: typeof object.lastUpdatedAt === "string" ? object.lastUpdatedAt : null,
    openChargeCount: Number(object.openChargeCount ?? 0),
    paymentCount: Number(object.paymentCount ?? 0),
    totalBalance: asMoneyAmount(object.totalBalance ?? "0.00"),
  };
}

function asMovement(value: unknown): FinancialMovement {
  const object = expectObject(value);
  return {
    amount: asMoneyAmount(object.amount ?? object.chargeAmount ?? object.creditAmount ?? "0.00"),
    balance: asMoneyAmount(object.balance ?? "0.00"),
    conceptName: String(object.conceptName ?? object.description ?? "Movimiento"),
    createdAt: String(object.createdAt ?? object.effectiveAt ?? new Date(0).toISOString()),
    effectiveAt: String(object.effectiveAt ?? object.createdAt ?? new Date(0).toISOString()),
    movementType: String(object.movementType ?? "CHARGE") as FinancialMovement["movementType"],
    referenceMasked: typeof object.referenceMasked === "string" ? object.referenceMasked : null,
    status: String(object.status ?? "VISIBLE"),
  };
}

function asStatement(value: unknown): StudentAccountStatement {
  const object = expectObject(value);
  return {
    currencyCode: "MXN",
    movements: expectArray(object.movements ?? []).map(asMovement),
    periodId: asOptionalUuid(object.periodId ?? object.requestedPeriodId, "FINANCE_PERIOD_INVALID"),
    totalBalance: asMoneyAmount(object.totalBalance ?? "0.00"),
  };
}

function asChargeSummary(value: unknown): StudentChargeSummary {
  const object = expectObject(value);
  return {
    amount: asMoneyAmount(object.originalAmount ?? object.amount ?? "0.00"),
    balance: asMoneyAmount(object.balance ?? "0.00"),
    conceptName: String(object.conceptName ?? "Cargo"),
    effectiveAt: String(object.effectiveAt ?? new Date(0).toISOString()),
    paymentStatus: String(object.status ?? "VISIBLE"),
    source: String(object.source ?? "MANUAL"),
  };
}

function asPaymentSummary(value: unknown): StudentPaymentSummary {
  const object = expectObject(value);
  const paymentId = String(object.paymentId ?? "");
  if (!uuidPattern.test(paymentId)) {
    throw new StudentFinanceError("FINANCE_RESPONSE_INVALID");
  }
  return {
    amount: asMoneyAmount(object.amount ?? "0.00"),
    effectiveAt: String(object.effectiveAt ?? new Date(0).toISOString()),
    paymentId,
    paymentMethod: String(object.paymentMethod ?? "OTHER"),
    paymentReferenceMasked:
      typeof object.paymentReferenceMasked === "string" ? object.paymentReferenceMasked : null,
    receiptNumber: typeof object.receiptNumber === "string" ? object.receiptNumber : null,
    status: String(object.status ?? "VISIBLE"),
  };
}

function asPaymentDetail(value: unknown): StudentPaymentDetail {
  const object = expectObject(value);
  return {
    ...asPaymentSummary(object),
    allocations: expectArray(object.allocations ?? []).map((entry) => {
      const allocation = expectObject(entry);
      return {
        amount: asMoneyAmount(allocation.amount ?? "0.00"),
        conceptName: String(allocation.conceptName ?? "Aplicación"),
        effectiveAt: String(allocation.effectiveAt ?? new Date(0).toISOString()),
        status: String(allocation.status ?? "VISIBLE"),
      };
    }),
  };
}

function asReceipt(value: unknown): InternalPaymentReceipt {
  const object = expectObject(value);
  return {
    amount: asMoneyAmount(object.amount ?? "0.00"),
    issuedAt: String(object.issuedAt ?? new Date(0).toISOString()),
    legend: String(
      object.legend ??
        "Comprobante interno de registro de pago. No constituye CFDI ni comprobante fiscal.",
    ),
    paymentMethod: String(object.paymentMethod ?? "OTHER"),
    paymentReferenceMasked:
      typeof object.paymentReferenceMasked === "string" ? object.paymentReferenceMasked : null,
    receiptNumber: String(object.receiptNumber ?? ""),
    status: String(object.status ?? "VISIBLE"),
  };
}

export function createStudentFinanceService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: StudentFinanceClientFactory = createServerClient as unknown as StudentFinanceClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: StudentFinanceRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new StudentFinanceError(parseRpcError(result.error), { cause: result.error });
    }
    return result.data;
  }

  return Object.freeze({
    async getSummary() {
      return asSummary(await invoke("get_my_student_financial_summary"));
    },
    async getAccountStatement(periodId?: string | null) {
      return asStatement(
        await invoke("get_my_student_account_statement", optionalPeriodInput(periodId)),
      );
    },
    async getCharges(periodId?: string | null) {
      return expectArray(await invoke("get_my_student_charges", optionalPeriodInput(periodId))).map(
        asChargeSummary,
      );
    },
    async getPayments(periodId?: string | null) {
      return expectArray(
        await invoke("get_my_student_payments", optionalPeriodInput(periodId)),
      ).map(asPaymentSummary);
    },
    async getPayment(paymentId: string) {
      return asPaymentDetail(
        await invoke("get_my_student_payment", requiredPaymentInput(paymentId)),
      );
    },
    async getReceipt(paymentId: string) {
      return asReceipt(await invoke("get_my_student_receipt", requiredPaymentInput(paymentId)));
    },
    async getGuardianSummary(linkId: string) {
      const result = await invoke(
        "get_my_guardian_student_financial_summary",
        guardianLinkInput(linkId),
      );
      return asGuardianAccessResult(result) ?? asSummary(result);
    },
    async getGuardianAccountStatement(linkId: string, periodId?: string | null) {
      const result = await invoke(
        "get_my_guardian_student_account_statement",
        guardianLinkInput(linkId, periodId),
      );
      return asGuardianAccessResult(result) ?? asStatement(result);
    },
  });
}
