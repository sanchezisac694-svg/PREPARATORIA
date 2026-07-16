import type { SupabaseClient } from "@supabase/supabase-js";

export interface SupabasePublicConfig {
  publishableKey: string;
  url: string;
}

export interface CookieOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | "lax" | "none" | "strict";
  secure?: boolean;
}

export interface CookieValue {
  name: string;
  options?: CookieOptions;
  value: string;
}

export interface SsrCookieAdapter {
  getAll(): CookieValue[] | Promise<CookieValue[]>;
  setAll(cookies: CookieValue[]): void | Promise<void>;
}

export type TechnicalSupabaseClient = SupabaseClient;

export type SupabaseInitializationResult =
  { client: TechnicalSupabaseClient; ok: true } | { error: SupabaseInitializationError; ok: false };

export interface SupabaseInitializationError {
  code: "SUPABASE_CONFIGURATION_INVALID" | "SUPABASE_INITIALIZATION_FAILED";
  message: string;
}
