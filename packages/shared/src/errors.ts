import { createCorrelationId } from "./correlation.js";
import type { CorrelationId } from "./correlation.js";
import { technicalErrorCodes } from "./error-codes.js";
import type { TechnicalErrorCode } from "./error-codes.js";

type AppErrorOptions = Readonly<{
  cause?: unknown;
  code: TechnicalErrorCode;
  correlationId?: CorrelationId;
  safeMessage: string;
}>;

export class AppError extends Error {
  readonly code: TechnicalErrorCode;
  readonly correlationId: CorrelationId;
  readonly safeMessage: string;

  constructor(message: string, options: AppErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = options.code;
    this.correlationId = options.correlationId ?? createCorrelationId();
    this.safeMessage = options.safeMessage;
  }
}

export type NormalizedError = Readonly<{
  code: TechnicalErrorCode;
  correlationId: CorrelationId;
  message: string;
}>;

export function normalizeError(
  error: unknown,
  correlationId: CorrelationId = createCorrelationId(),
): NormalizedError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      correlationId: error.correlationId,
      message: error.safeMessage,
    };
  }

  return {
    code: technicalErrorCodes.UNKNOWN_ERROR,
    correlationId,
    message: "Ocurrió un error técnico inesperado.",
  };
}
