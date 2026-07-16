import { createCorrelationId } from "./correlation.js";
import type { CorrelationId } from "./correlation.js";
import { redactSensitive } from "./redact.js";

export type LogLevel = "debug" | "error" | "fatal" | "info" | "warn";

export type LogContext = Readonly<Record<string, unknown>>;

export type LogEntry = Readonly<{
  context?: LogContext;
  correlationId: CorrelationId;
  level: LogLevel;
  message: string;
  timestamp: string;
}>;

type LoggerOptions = Readonly<{
  write?: (line: string) => void;
}>;

export function createLogger(options: LoggerOptions = {}) {
  const write = options.write ?? ((line: string) => globalThis.console.log(line));

  function log(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const entry: LogEntry = {
      ...(context === undefined ? {} : { context: redactSensitive(context) }),
      correlationId: createCorrelationId(),
      level,
      message,
      timestamp: new Date().toISOString(),
    };

    write(JSON.stringify(entry));
    return entry;
  }

  return {
    debug: (message: string, context?: LogContext) => log("debug", message, context),
    error: (message: string, context?: LogContext) => log("error", message, context),
    fatal: (message: string, context?: LogContext) => log("fatal", message, context),
    info: (message: string, context?: LogContext) => log("info", message, context),
    warn: (message: string, context?: LogContext) => log("warn", message, context),
  } as const;
}
