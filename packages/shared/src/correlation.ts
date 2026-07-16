const correlationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CorrelationId = string & { readonly __brand: "CorrelationId" };

export function createCorrelationId(): CorrelationId {
  return globalThis.crypto.randomUUID() as CorrelationId;
}

export function isCorrelationId(value: string): value is CorrelationId {
  return correlationIdPattern.test(value);
}
