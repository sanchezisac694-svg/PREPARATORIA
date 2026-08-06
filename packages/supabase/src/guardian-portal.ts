import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error(
    "@preparatoria/supabase/guardian-portal solo puede importarse desde el servidor.",
  );
}

export const guardianPortalRpcNames = Object.freeze([
  "get_my_guardian_portal_overview",
  "get_my_linked_students",
  "get_my_guardian_student_overview",
  "get_my_guardian_student_record",
  "get_my_guardian_student_subjects",
  "get_my_guardian_student_schedule",
  "get_my_guardian_student_attendance",
  "get_my_guardian_student_permissions",
  "get_my_guardian_student_grades",
  "get_my_guardian_student_results",
  "get_my_guardian_student_progress",
  "get_my_guardian_student_history",
] as const);

export type GuardianPortalRpcName = (typeof guardianPortalRpcNames)[number];

interface GuardianPortalSdk {
  rpc(
    name: GuardianPortalRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type GuardianPortalClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => GuardianPortalSdk;

export class GuardianPortalError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible obtener la información autorizada del portal del tutor.", options);
    this.name = "GuardianPortalError";
    this.code = code;
  }
}

function parseRpcError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    if ("message" in error && typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }
    if ("code" in error && typeof error.code === "string" && error.code.length > 0) {
      return error.code;
    }
  }
  return "GUARDIAN_PORTAL_OPERATION_FAILED";
}

function expectJson(data: unknown) {
  if (typeof data !== "object" || data === null) {
    throw new GuardianPortalError("GUARDIAN_PORTAL_RESPONSE_INVALID");
  }
  return data as Readonly<Record<string, unknown>>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredLinkInput(linkId: string) {
  if (!uuidPattern.test(linkId)) {
    throw new GuardianPortalError("GUARDIAN_PORTAL_ACCESS_DENIED");
  }
  return { link_id: linkId };
}

function optionalLinkPeriodInput(linkId: string, periodId?: string | null) {
  if (!uuidPattern.test(linkId)) {
    throw new GuardianPortalError("GUARDIAN_PORTAL_ACCESS_DENIED");
  }
  if (periodId && !uuidPattern.test(periodId)) {
    throw new GuardianPortalError("PERIOD_NOT_AVAILABLE");
  }
  return periodId ? { link_id: linkId, requested_period_id: periodId } : { link_id: linkId };
}

function historyInput(linkId: string, limitCount = 20, offsetCount = 0) {
  if (!uuidPattern.test(linkId)) {
    throw new GuardianPortalError("GUARDIAN_PORTAL_ACCESS_DENIED");
  }
  return {
    link_id: linkId,
    limit_count: Math.max(0, Math.min(100, Math.trunc(limitCount))),
    offset_count: Math.max(0, Math.trunc(offsetCount)),
  };
}

export function createGuardianPortalService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: GuardianPortalClientFactory = createServerClient as unknown as GuardianPortalClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: GuardianPortalRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new GuardianPortalError(parseRpcError(result.error), { cause: result.error });
    }
    return expectJson(result.data);
  }

  return Object.freeze({
    getPortalOverview() {
      return invoke("get_my_guardian_portal_overview");
    },
    getLinkedStudents() {
      return invoke("get_my_linked_students");
    },
    getStudentOverview(linkId: string, periodId?: string | null) {
      return invoke("get_my_guardian_student_overview", optionalLinkPeriodInput(linkId, periodId));
    },
    getStudentRecord(linkId: string) {
      return invoke("get_my_guardian_student_record", requiredLinkInput(linkId));
    },
    getStudentSubjects(linkId: string, periodId?: string | null) {
      return invoke("get_my_guardian_student_subjects", optionalLinkPeriodInput(linkId, periodId));
    },
    getStudentSchedule(linkId: string, periodId?: string | null) {
      return invoke("get_my_guardian_student_schedule", optionalLinkPeriodInput(linkId, periodId));
    },
    getStudentAttendance(linkId: string, periodId?: string | null) {
      return invoke(
        "get_my_guardian_student_attendance",
        optionalLinkPeriodInput(linkId, periodId),
      );
    },
    getStudentPermissions(linkId: string, periodId?: string | null) {
      return invoke(
        "get_my_guardian_student_permissions",
        optionalLinkPeriodInput(linkId, periodId),
      );
    },
    getStudentGrades(linkId: string, periodId?: string | null) {
      return invoke("get_my_guardian_student_grades", optionalLinkPeriodInput(linkId, periodId));
    },
    getStudentResults(linkId: string, periodId?: string | null) {
      return invoke("get_my_guardian_student_results", optionalLinkPeriodInput(linkId, periodId));
    },
    getStudentProgress(linkId: string) {
      return invoke("get_my_guardian_student_progress", requiredLinkInput(linkId));
    },
    getStudentHistory(linkId: string, limitCount?: number, offsetCount?: number) {
      return invoke(
        "get_my_guardian_student_history",
        historyInput(linkId, limitCount, offsetCount),
      );
    },
  });
}
