import { z } from "zod";

export const appEnvironments = ["development", "test", "staging", "production"] as const;
export const logLevels = ["debug", "info", "warn", "error", "fatal"] as const;

export const publicEnvSchema = z
  .object({
    APP_ENV: z.enum(appEnvironments),
    LOG_LEVEL: z.enum(logLevels),
  })
  .strict();

const supabasePublishableKeySchema = z
  .string()
  .min(1, "La clave publicable es obligatoria.")
  .regex(/^sb_publishable_[A-Za-z0-9_-]+$/, "Debe ser una clave publicable de Supabase.");

export const supabasePublicEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKeySchema,
    NEXT_PUBLIC_SUPABASE_URL: z
      .url()
      .refine(
        (value) => value.startsWith("https://") || value.startsWith("http://localhost"),
        "Debe usar HTTPS o localhost.",
      ),
  })
  .strict();

const institutionalAliasDomainSchema = z
  .string()
  .min(4)
  .max(253)
  .regex(
    /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    "Debe ser un dominio DNS en minúsculas, sin protocolo, ruta ni puerto.",
  );

export const institutionalAuthEnvSchema = z
  .object({
    AUTH_ATTEMPT_GUARD_SALT: z
      .string()
      .min(32, "La sal privada debe contener al menos 32 caracteres.")
      .max(256),
    INSTITUTIONAL_AUTH_ALIAS_DOMAIN: institutionalAliasDomainSchema,
    NIP_RESET_TOKEN_SECRET: z
      .string()
      .min(32, "El secreto de autorizaciones debe contener al menos 32 caracteres.")
      .max(256),
  })
  .strict();

export const serverEnvSchema = publicEnvSchema
  .extend({
    ADMIN_BASE_URL: z.url(),
    PORTAL_BASE_URL: z.url(),
  })
  .strict();

export const runtimeEnvSchema = z
  .object({
    ADMIN_BASE_URL: z.url().optional(),
    APP_ENV: z.enum(appEnvironments).default("development"),
    LOG_LEVEL: z.enum(logLevels).default("info"),
    PORTAL_BASE_URL: z.url().optional(),
  })
  .strict();

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type InstitutionalAuthEnv = z.infer<typeof institutionalAuthEnvSchema>;
export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;
export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvError(error: z.ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "entorno";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Configuración de entorno inválida: ${details}`;
}
