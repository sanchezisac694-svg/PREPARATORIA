import { Alert } from "@preparatoria/ui";

export function FinancialActionFeedback({
  message,
  status,
}: Readonly<{
  message?: string | undefined;
  status?: string | undefined;
}>) {
  if (!status || !message) {
    return null;
  }

  return (
    <Alert tone={status === "success" ? "success" : "error"}>
      <strong>{status === "success" ? "Operación completada" : "Operación no completada"}</strong>
      <div>{message}</div>
    </Alert>
  );
}

export function isUuid(value: string | null | undefined) {
  return typeof value === "string"
    ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    : false;
}

export function readFeedback(
  params: Record<string, string | string[] | undefined> | undefined,
): Readonly<{ message?: string; status?: string }> {
  if (!params) {
    return {};
  }

  const status = typeof params.status === "string" ? params.status : undefined;
  const message = typeof params.message === "string" ? params.message : undefined;

  return {
    ...(message ? { message } : {}),
    ...(status ? { status } : {}),
  };
}
