import "server-only";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/charge-generation solo puede importarse desde el servidor.",
  );
}

export const chargeGenerationErrorCodes = Object.freeze([
  "CHARGE_GENERATION_RULE_NOT_FOUND",
  "CHARGE_GENERATION_RULE_NOT_ACTIVE",
  "CHARGE_GENERATION_VERSION_NOT_FOUND",
  "CHARGE_GENERATION_VERSION_NOT_APPROVED",
  "CHARGE_GENERATION_PREVIEW_REQUIRED",
  "CHARGE_GENERATION_BATCH_NOT_FOUND",
  "CHARGE_GENERATION_BATCH_INVALID_STATE",
  "CHARGE_GENERATION_BATCH_NOT_APPROVED",
  "CHARGE_GENERATION_ALREADY_EXECUTED",
  "CHARGE_GENERATION_DUPLICATE",
  "CHARGE_GENERATION_ACCOUNT_NOT_ACTIVE",
  "CHARGE_GENERATION_ENROLLMENT_NOT_ELIGIBLE",
  "CHARGE_GENERATION_NO_APPLICABLE_RATE",
  "CHARGE_GENERATION_EXCLUDED",
  "CHARGE_GENERATION_MANUAL_REVIEW_REQUIRED",
  "CHARGE_GENERATION_APPROVAL_REQUIRED",
  "CHARGE_GENERATION_SELF_APPROVAL_NOT_ALLOWED",
  "IDEMPOTENCY_CONFLICT",
  "CONCURRENT_MODIFICATION",
  "SESSION_VERSION_INVALID",
  "APPLICATION_NOT_ALLOWED",
  "ACTOR_NOT_AUTHORIZED",
  "AAL2_REQUIRED",
  "FINANCE_OPERATION_FAILED",
  "HISTORICAL_RECORD_IMMUTABLE",
] as const);

export type ChargeGenerationErrorCode = (typeof chargeGenerationErrorCodes)[number];
export type MoneyAmount = `${number}.${number}${number}`;

export type ChargeGenerationType =
  | "INITIAL_ENROLLMENT"
  | "REENROLLMENT"
  | "REPEAT_SEMESTER"
  | "REENTRY"
  | "PERIODIC_TUITION"
  | "DOCUMENT"
  | "MANUAL_BATCH"
  | "OTHER";

export type ChargeGenerationRuleStatus =
  "DRAFT" | "ACTIVE" | "SUSPENDED" | "RETIRED" | "PENDING_INSTITUTIONAL_VALIDATION";

export type ChargeGenerationRuleVersionStatus =
  "DRAFT" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "RETIRED" | "PENDING_INSTITUTIONAL_VALIDATION";

export type ChargeGenerationDueDateStrategy =
  "FIXED_DATE" | "DAYS_AFTER_GENERATION" | "MANUAL_REVIEW";

export type ChargeGenerationBatchStatus =
  | "DRAFT"
  | "PREVIEWED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "PROCESSING"
  | "COMPLETED"
  | "COMPLETED_WITH_ERRORS"
  | "REJECTED"
  | "CANCELLED";

export type ChargeGenerationEligibilityStatus =
  | "ELIGIBLE"
  | "ALREADY_CHARGED"
  | "ACCOUNT_NOT_ACTIVE"
  | "ENROLLMENT_NOT_ELIGIBLE"
  | "NO_APPLICABLE_RATE"
  | "EXPLICITLY_EXCLUDED"
  | "MANUAL_REVIEW_REQUIRED";

export type ChargeGenerationItemStatus = "PENDING" | "GENERATED" | "SKIPPED" | "FAILED";

export interface ChargeGenerationRule {
  readonly ruleId: string;
  readonly code: string;
  readonly name: string;
  readonly chargeConceptId: string;
  readonly generationType: ChargeGenerationType;
  readonly status: ChargeGenerationRuleStatus;
}

export interface ChargeGenerationRuleVersion {
  readonly ruleVersionId: string;
  readonly ruleId: string;
  readonly versionNumber: number;
  readonly status: ChargeGenerationRuleVersionStatus;
  readonly academicPeriodId: string | null;
  readonly academicPlanId: string | null;
  readonly semesterNumber: number | null;
  readonly trainingAreaId: string | null;
  readonly chargeRateId: string | null;
  readonly dueDateStrategy: ChargeGenerationDueDateStrategy;
  readonly fixedDueDate: string | null;
  readonly dueDaysAfterGeneration: number | null;
}

export interface ChargeGenerationPreviewItem {
  readonly studentIdentifier: string | null;
  readonly displayName: string | null;
  readonly groupName: string | null;
  readonly semesterNumber: number | null;
  readonly eligibilityStatus: ChargeGenerationEligibilityStatus;
  readonly reasonCode: string | null;
  readonly resolvedChargeRateId: string | null;
  readonly resolvedAmount: MoneyAmount | null;
  readonly dueDate: string | null;
}

export interface ChargeGenerationSummary {
  readonly totalCandidates: number;
  readonly totalEligible: number;
  readonly totalAlreadyCharged: number;
  readonly totalExcluded: number;
  readonly totalManualReview: number;
  readonly totalWithoutRate: number;
  readonly estimatedTotal: MoneyAmount;
}

export interface ChargeGenerationPreview extends ChargeGenerationSummary {
  readonly items: readonly ChargeGenerationPreviewItem[];
}

export interface ChargeGenerationBatchItem {
  readonly batchItemId: string;
  readonly studentIdentifier: string | null;
  readonly displayName: string | null;
  readonly groupName: string | null;
  readonly semesterNumber: number | null;
  readonly eligibilityStatus: ChargeGenerationEligibilityStatus;
  readonly processingStatus: ChargeGenerationItemStatus;
  readonly resolvedAmount: MoneyAmount | null;
  readonly dueDate: string | null;
  readonly generatedChargeId: string | null;
}

export interface ChargeGenerationBatch extends ChargeGenerationSummary {
  readonly batchId: string;
  readonly ruleVersionId: string;
  readonly academicPeriodId: string;
  readonly status: ChargeGenerationBatchStatus;
  readonly totalGenerated: number;
  readonly totalSkipped: number;
  readonly totalFailed: number;
  readonly generatedTotal: MoneyAmount;
}

export interface ChargeGenerationExecutionResult {
  readonly entityId: string;
  readonly status:
    ChargeGenerationBatchStatus | ChargeGenerationRuleStatus | ChargeGenerationRuleVersionStatus;
}

export const chargeGenerationOperations = Object.freeze([
  "CREATE_RULE",
  "CREATE_RULE_VERSION",
  "APPROVE_RULE_VERSION",
  "ACTIVATE_RULE_VERSION",
  "PREVIEW",
  "CREATE_BATCH",
  "SUBMIT_BATCH",
  "APPROVE_BATCH",
  "EXECUTE_BATCH",
  "CREATE_EXCLUSION",
] as const);

export type ChargeGenerationOperation = (typeof chargeGenerationOperations)[number];

export const chargeGenerationSqlFunctions = Object.freeze({
  CREATE_RULE: "finance.create_charge_generation_rule",
  CREATE_RULE_VERSION: "finance.create_charge_generation_rule_version",
  APPROVE_RULE_VERSION: "finance.approve_charge_generation_rule_version",
  ACTIVATE_RULE_VERSION: "finance.activate_charge_generation_rule_version",
  PREVIEW: "public.preview_charge_generation",
  CREATE_BATCH: "public.create_charge_generation_batch",
  SUBMIT_BATCH: "public.submit_charge_generation_batch",
  APPROVE_BATCH: "public.approve_charge_generation_batch",
  EXECUTE_BATCH: "public.execute_charge_generation_batch",
  CREATE_EXCLUSION: "finance.create_charge_generation_exclusion",
} as const satisfies Readonly<Record<ChargeGenerationOperation, string>>);

export interface ChargeGenerationCommand {
  readonly operation: ChargeGenerationOperation;
  readonly sqlFunction: (typeof chargeGenerationSqlFunctions)[ChargeGenerationOperation];
  readonly idempotencyKey?: string;
  readonly correlationId?: string;
  readonly input?: Readonly<Record<string, boolean | number | string | null>>;
}

export interface ChargeGenerationPersistencePort {
  execute(command: ChargeGenerationCommand): Promise<ChargeGenerationExecutionResult>;
  preview(
    input: Readonly<Record<string, boolean | number | string | null>>,
  ): Promise<ChargeGenerationPreview>;
}

export class ChargeGenerationError extends Error {
  readonly code: ChargeGenerationErrorCode;

  constructor(code: ChargeGenerationErrorCode, options?: ErrorOptions) {
    super("No fue posible completar la generación institucional de cargos.", options);
    this.name = "ChargeGenerationError";
    this.code = code;
  }
}

function operation(name: ChargeGenerationOperation) {
  return async (
    port: ChargeGenerationPersistencePort,
    input?: Readonly<Record<string, boolean | number | string | null>>,
    idempotencyKey?: string,
    correlationId?: string,
  ) => {
    try {
      return await port.execute({
        ...(correlationId ? { correlationId } : {}),
        ...(idempotencyKey ? { idempotencyKey } : {}),
        ...(input ? { input } : {}),
        operation: name,
        sqlFunction: chargeGenerationSqlFunctions[name],
      });
    } catch (error) {
      if (error instanceof ChargeGenerationError) throw error;
      throw new ChargeGenerationError("FINANCE_OPERATION_FAILED", { cause: error });
    }
  };
}

export const createChargeGenerationRule = operation("CREATE_RULE");
export const createChargeGenerationRuleVersion = operation("CREATE_RULE_VERSION");
export const approveChargeGenerationRuleVersion = operation("APPROVE_RULE_VERSION");
export const activateChargeGenerationRuleVersion = operation("ACTIVATE_RULE_VERSION");
export const createChargeGenerationBatch = operation("CREATE_BATCH");
export const submitChargeGenerationBatch = operation("SUBMIT_BATCH");
export const approveChargeGenerationBatch = operation("APPROVE_BATCH");
export const executeChargeGenerationBatch = operation("EXECUTE_BATCH");
export const createChargeGenerationExclusion = operation("CREATE_EXCLUSION");

export async function previewChargeGeneration(
  port: ChargeGenerationPersistencePort,
  input: Readonly<Record<string, boolean | number | string | null>>,
): Promise<ChargeGenerationPreview> {
  try {
    return await port.preview(input);
  } catch (error) {
    if (error instanceof ChargeGenerationError) throw error;
    throw new ChargeGenerationError("FINANCE_OPERATION_FAILED", { cause: error });
  }
}
