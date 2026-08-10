import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/financial-period-close solo puede importarse desde el servidor.",
  );
}

export type MoneyAmount = `${number}.${number}${number}`;

export const financialPeriodCloseOperations = Object.freeze([
  "LIST_CLOSES",
  "GET_CLOSE",
  "CREATE_CLOSE",
  "APPROVE_CLOSE",
  "SUPERSEDE_CLOSE",
] as const);

export type FinancialPeriodCloseOperation = (typeof financialPeriodCloseOperations)[number];

export const financialPeriodCloseSqlFunctions = Object.freeze({
  LIST_CLOSES: "public.list_financial_period_closures",
  GET_CLOSE: "public.get_financial_period_close",
  CREATE_CLOSE: "public.create_financial_period_close",
  APPROVE_CLOSE: "public.approve_financial_period_close",
  SUPERSEDE_CLOSE: "public.supersede_financial_period_close",
} as const satisfies Readonly<Record<FinancialPeriodCloseOperation, string>>);

export const financialPeriodCloseErrorCodes = Object.freeze([
  "AAL2_REQUIRED",
  "ACTOR_NOT_AUTHORIZED",
  "APPLICATION_NOT_ALLOWED",
  "CONCURRENT_MODIFICATION",
  "FINANCE_OPERATION_FAILED",
  "FINANCIAL_PERIOD_CLOSE_INVALID",
  "FINANCIAL_PERIOD_CLOSE_RESPONSE_INVALID",
  "IDEMPOTENCY_CONFLICT",
  "SESSION_VERSION_INVALID",
] as const);

export type FinancialPeriodCloseErrorCode = (typeof financialPeriodCloseErrorCodes)[number];

export interface FinancialPeriodCloseRecord {
  readonly academicPeriodCode: string | null;
  readonly academicPeriodId: string;
  readonly academicPeriodName: string | null;
  readonly approvedAt: string | null;
  readonly approvedByAccountId: string | null;
  readonly businessDate: string;
  readonly closureId: string;
  readonly confirmedPayments: MoneyAmount;
  readonly createdAt: string;
  readonly createdByAccountId: string;
  readonly creditAdjustments: MoneyAmount;
  readonly discounts: MoneyAmount;
  readonly grossCharges: MoneyAmount;
  readonly netCharges: MoneyAmount;
  readonly netCollections: MoneyAmount;
  readonly outstanding: MoneyAmount;
  readonly overdue: MoneyAmount;
  readonly reversedPayments: MoneyAmount;
  readonly scholarshipAdjustments: MoneyAmount;
  readonly status: "APPROVED" | "DRAFT" | "SUPERSEDED" | "UNDER_REVIEW";
  readonly supersededAt: string | null;
  readonly supersededByAccountId: string | null;
  readonly supersedesClosureId: string | null;
  readonly version: number;
  readonly waivers: MoneyAmount;
}

export interface FinancialPeriodCloseList {
  readonly offset: number;
  readonly pageSize: number;
  readonly rows: readonly FinancialPeriodCloseRecord[];
  readonly totalRows: number;
}

interface FinancialPeriodCloseSdk {
  rpc(
    name: (typeof financialPeriodCloseSqlFunctions)[FinancialPeriodCloseOperation],
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type FinancialPeriodCloseClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => FinancialPeriodCloseSdk;

export class FinancialPeriodCloseError extends Error {
  readonly code: FinancialPeriodCloseErrorCode;

  constructor(code: FinancialPeriodCloseErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la operación de cierre financiero.", options);
    this.name = "FinancialPeriodCloseError";
    this.code = code;
  }
}

const decimalPattern = /^\d+\.\d{2}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function expectObject(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new FinancialPeriodCloseError("FINANCIAL_PERIOD_CLOSE_RESPONSE_INVALID");
  }
  return value as Readonly<Record<string, unknown>>;
}

function expectArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new FinancialPeriodCloseError("FINANCIAL_PERIOD_CLOSE_RESPONSE_INVALID");
  }
  return value as readonly unknown[];
}

function asMoneyAmount(value: unknown): MoneyAmount {
  const amount = String(value ?? "0.00");
  if (!decimalPattern.test(amount)) {
    throw new FinancialPeriodCloseError("FINANCIAL_PERIOD_CLOSE_RESPONSE_INVALID");
  }
  return amount as MoneyAmount;
}

function asUuid(value: unknown) {
  const text = String(value ?? "");
  if (!uuidPattern.test(text)) {
    throw new FinancialPeriodCloseError("FINANCIAL_PERIOD_CLOSE_RESPONSE_INVALID");
  }
  return text;
}

function asOptionalUuid(value: unknown) {
  if (value == null) {
    return null;
  }
  return asUuid(value);
}

function asOptionalDate(value: unknown) {
  if (value == null) {
    return null;
  }
  return String(value);
}

function parseRpcError(error: unknown): FinancialPeriodCloseErrorCode {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message).toUpperCase();
    if (financialPeriodCloseErrorCodes.includes(message as FinancialPeriodCloseErrorCode)) {
      return message as FinancialPeriodCloseErrorCode;
    }
    if (
      [
        "AAL2_REQUIRED",
        "ACTOR_NOT_AUTHORIZED",
        "APPLICATION_NOT_ALLOWED",
        "CONCURRENT_MODIFICATION",
        "IDEMPOTENCY_CONFLICT",
        "SESSION_VERSION_INVALID",
      ].includes(message)
    ) {
      return message as FinancialPeriodCloseErrorCode;
    }
  }
  return "FINANCE_OPERATION_FAILED";
}

function normalizeUuid(value: string, code: FinancialPeriodCloseErrorCode) {
  if (!uuidPattern.test(value)) {
    throw new FinancialPeriodCloseError(code);
  }
  return value;
}

function normalizeDate(value: string, code: FinancialPeriodCloseErrorCode) {
  if (!datePattern.test(value)) {
    throw new FinancialPeriodCloseError(code);
  }
  return value;
}

function asRecord(value: unknown): FinancialPeriodCloseRecord {
  const object = expectObject(value);
  return {
    academicPeriodCode:
      typeof object.academicPeriodCode === "string" ? object.academicPeriodCode : null,
    academicPeriodId: asUuid(object.academicPeriodId),
    academicPeriodName:
      typeof object.academicPeriodName === "string" ? object.academicPeriodName : null,
    approvedAt: asOptionalDate(object.approvedAt),
    approvedByAccountId: asOptionalUuid(object.approvedByAccountId),
    businessDate: String(object.businessDate ?? ""),
    closureId: asUuid(object.closureId),
    confirmedPayments: asMoneyAmount(object.confirmedPayments ?? object.netCollections ?? "0.00"),
    createdAt: String(object.createdAt ?? ""),
    createdByAccountId: asUuid(object.createdByAccountId),
    creditAdjustments: asMoneyAmount(object.creditAdjustments ?? "0.00"),
    discounts: asMoneyAmount(object.discounts ?? "0.00"),
    grossCharges: asMoneyAmount(object.grossCharges ?? "0.00"),
    netCharges: asMoneyAmount(object.netCharges ?? "0.00"),
    netCollections: asMoneyAmount(object.netCollections ?? "0.00"),
    outstanding: asMoneyAmount(object.outstanding ?? "0.00"),
    overdue: asMoneyAmount(object.overdue ?? "0.00"),
    reversedPayments: asMoneyAmount(object.reversedPayments ?? "0.00"),
    scholarshipAdjustments: asMoneyAmount(object.scholarshipAdjustments ?? "0.00"),
    status: String(object.status ?? "DRAFT") as FinancialPeriodCloseRecord["status"],
    supersededAt: asOptionalDate(object.supersededAt),
    supersededByAccountId: asOptionalUuid(object.supersededByAccountId),
    supersedesClosureId: asOptionalUuid(object.supersedesClosureId),
    version: Number(object.version ?? 1),
    waivers: asMoneyAmount(object.waivers ?? "0.00"),
  };
}

export interface FinancialPeriodClosePersistencePort {
  execute(
    operation: Extract<
      FinancialPeriodCloseOperation,
      "CREATE_CLOSE" | "APPROVE_CLOSE" | "SUPERSEDE_CLOSE"
    >,
    input: Record<string, unknown>,
  ): Promise<{ entityId: string; status: string }>;
  getClose(closureId: string): Promise<FinancialPeriodCloseRecord>;
  listCloses(limit?: number, offset?: number): Promise<FinancialPeriodCloseList>;
}

export function createFinancialPeriodCloseService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: FinancialPeriodCloseClientFactory = createServerClient as unknown as FinancialPeriodCloseClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(operation: FinancialPeriodCloseOperation, input?: Record<string, unknown>) {
    const result = await client.rpc(financialPeriodCloseSqlFunctions[operation], input);
    if (result.error) {
      throw new FinancialPeriodCloseError(parseRpcError(result.error), { cause: result.error });
    }
    return result.data;
  }

  return Object.freeze({
    async list(limit = 50, offset = 0) {
      const data = expectObject(
        await invoke("LIST_CLOSES", { requested_limit: limit, requested_offset: offset }),
      );
      return {
        offset: Number(data.offset ?? 0),
        pageSize: Number(data.pageSize ?? limit),
        rows: expectArray(data.rows ?? []).map(asRecord),
        totalRows: Number(data.totalRows ?? 0),
      } satisfies FinancialPeriodCloseList;
    },
    async get(closureId: string) {
      return asRecord(
        await invoke("GET_CLOSE", {
          closure_id: normalizeUuid(closureId, "FINANCIAL_PERIOD_CLOSE_INVALID"),
        }),
      );
    },
    async create(
      academicPeriodId: string,
      businessDate: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      const object = expectObject(
        await invoke("CREATE_CLOSE", {
          requested_academic_period_id: normalizeUuid(
            academicPeriodId,
            "FINANCIAL_PERIOD_CLOSE_INVALID",
          ),
          requested_business_date: normalizeDate(businessDate, "FINANCIAL_PERIOD_CLOSE_INVALID"),
          operation_key: idempotencyKey,
          ...(correlationId
            ? { correlation_id: normalizeUuid(correlationId, "FINANCIAL_PERIOD_CLOSE_INVALID") }
            : {}),
        }),
      );
      return {
        entityId: asUuid(object.entity_id ?? object.entityId),
        status: String(object.status ?? ""),
      };
    },
    async approve(closureId: string, idempotencyKey: string, correlationId?: string) {
      const object = expectObject(
        await invoke("APPROVE_CLOSE", {
          target_closure_id: normalizeUuid(closureId, "FINANCIAL_PERIOD_CLOSE_INVALID"),
          operation_key: idempotencyKey,
          ...(correlationId
            ? { correlation_id: normalizeUuid(correlationId, "FINANCIAL_PERIOD_CLOSE_INVALID") }
            : {}),
        }),
      );
      return {
        entityId: asUuid(object.entity_id ?? object.entityId),
        status: String(object.status ?? ""),
      };
    },
    async supersede(
      closureId: string,
      businessDate: string,
      idempotencyKey: string,
      correlationId?: string,
    ) {
      const object = expectObject(
        await invoke("SUPERSEDE_CLOSE", {
          target_closure_id: normalizeUuid(closureId, "FINANCIAL_PERIOD_CLOSE_INVALID"),
          requested_business_date: normalizeDate(businessDate, "FINANCIAL_PERIOD_CLOSE_INVALID"),
          operation_key: idempotencyKey,
          ...(correlationId
            ? { correlation_id: normalizeUuid(correlationId, "FINANCIAL_PERIOD_CLOSE_INVALID") }
            : {}),
        }),
      );
      return {
        entityId: asUuid(object.entity_id ?? object.entityId),
        status: String(object.status ?? ""),
      };
    },
  });
}
