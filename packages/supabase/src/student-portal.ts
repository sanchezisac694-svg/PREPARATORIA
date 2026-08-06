import "server-only";

import { createServerClient } from "@supabase/ssr";

import { validateSupabasePublicConfig } from "./config.js";
import type { SsrCookieAdapter, SupabasePublicConfig } from "./types.js";

if (typeof window !== "undefined") {
  throw new Error("@preparatoria/supabase/student-portal solo puede importarse desde el servidor.");
}

export const studentPortalRpcNames = Object.freeze([
  "get_my_student_portal_attendance",
  "get_my_student_portal_grades",
  "get_my_student_portal_overview",
  "get_my_student_portal_permissions",
  "get_my_student_portal_record",
  "get_my_student_portal_schedule",
  "get_my_student_portal_subjects",
  "get_my_student_portal_trajectory",
] as const);

export type StudentPortalRpcName = (typeof studentPortalRpcNames)[number];

interface StudentPortalSdk {
  rpc(
    name: StudentPortalRpcName,
    input?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
}

export type StudentPortalClientFactory = (
  url: string,
  publishableKey: string,
  options: { cookieOptions: { secure: boolean }; cookies: SsrCookieAdapter },
) => StudentPortalSdk;

export class StudentPortalError extends Error {
  readonly code: string;

  constructor(code: string, options?: ErrorOptions) {
    super("No fue posible obtener la información académica del alumno.", options);
    this.name = "StudentPortalError";
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
  return "STUDENT_PORTAL_READ_FAILED";
}

function expectJsonObject(data: unknown) {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new StudentPortalError("STUDENT_PORTAL_RESPONSE_INVALID");
  }
  return data as Readonly<Record<string, unknown>>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalPeriodInput(periodId?: string | null) {
  if (periodId && !uuidPattern.test(periodId)) {
    throw new StudentPortalError("STUDENT_PORTAL_PERIOD_INVALID");
  }
  return periodId ? { requested_period_id: periodId } : undefined;
}

export function createStudentPortalService(
  config: SupabasePublicConfig,
  cookies: SsrCookieAdapter,
  factory: StudentPortalClientFactory = createServerClient as unknown as StudentPortalClientFactory,
) {
  const validated = validateSupabasePublicConfig(config);
  const client = factory(validated.url, validated.publishableKey, {
    cookieOptions: { secure: validated.url.startsWith("https://") },
    cookies,
  });

  async function invoke(name: StudentPortalRpcName, input?: Record<string, unknown>) {
    const result = await client.rpc(name, input);
    if (result.error) {
      throw new StudentPortalError(parseRpcError(result.error), { cause: result.error });
    }
    return expectJsonObject(result.data);
  }

  return Object.freeze({
    getAttendance(periodId?: string | null) {
      return invoke("get_my_student_portal_attendance", optionalPeriodInput(periodId));
    },
    getGrades(periodId?: string | null) {
      return invoke("get_my_student_portal_grades", optionalPeriodInput(periodId));
    },
    getOverview(periodId?: string | null) {
      return invoke("get_my_student_portal_overview", optionalPeriodInput(periodId));
    },
    getPermissions(periodId?: string | null) {
      return invoke("get_my_student_portal_permissions", optionalPeriodInput(periodId));
    },
    getRecord() {
      return invoke("get_my_student_portal_record");
    },
    getSchedule(periodId?: string | null) {
      return invoke("get_my_student_portal_schedule", optionalPeriodInput(periodId));
    },
    getSubjects(periodId?: string | null) {
      return invoke("get_my_student_portal_subjects", optionalPeriodInput(periodId));
    },
    getTrajectory() {
      return invoke("get_my_student_portal_trajectory");
    },
  });
}
