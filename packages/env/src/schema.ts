import { z } from "zod";

export const appEnvironments = ["development", "test", "staging", "production"] as const;
export const logLevels = ["debug", "info", "warn", "error", "fatal"] as const;

export const publicEnvSchema = z
  .object({
    APP_ENV: z.enum(appEnvironments),
    LOG_LEVEL: z.enum(logLevels),
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
