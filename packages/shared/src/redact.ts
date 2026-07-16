const redactedValue = "[REDACTED]";
const sensitiveKeyPattern =
  /password|contrase(?:n|ñ)a|token|cookie|secret|api[-_]?key|clave|email|correo|curp|document|archivo|file[-_]?name/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const curpPattern = /\b[A-Z][AEIOU][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi;

export function redactSensitive<T>(value: T): T {
  return redactValue(value, new WeakSet<object>()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return value.replace(emailPattern, redactedValue).replace(curpPattern, redactedValue);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[CIRCULAR]";
  }

  seen.add(value);

  const result: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    result[key] = sensitiveKeyPattern.test(key) ? redactedValue : redactValue(item, seen);
  }

  return result;
}
