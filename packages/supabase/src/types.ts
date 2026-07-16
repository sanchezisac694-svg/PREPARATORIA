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

export interface TechnicalSupabaseAdapter {
  isInitialized(): boolean;
  readonly runtime: "administrative" | "browser" | "server";
}

export interface BrowserSupabaseAdapter extends TechnicalSupabaseAdapter {
  readonly runtime: "browser";
}

export interface SsrSupabaseAdapter extends TechnicalSupabaseAdapter {
  readonly runtime: "server";
}

export interface AdministrativeSupabaseAdapter extends TechnicalSupabaseAdapter {
  readonly runtime: "administrative";
}

export type SupabaseInitializationResult<TAdapter extends TechnicalSupabaseAdapter> =
  { adapter: TAdapter; ok: true } | { error: SupabaseInitializationError; ok: false };

export interface SupabaseInitializationError {
  code: "SUPABASE_CONFIGURATION_INVALID" | "SUPABASE_INITIALIZATION_FAILED";
  message: string;
}
