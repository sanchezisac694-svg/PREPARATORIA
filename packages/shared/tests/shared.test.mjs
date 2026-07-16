import assert from "node:assert/strict";
import test from "node:test";

import {
  AppError,
  createCorrelationId,
  isCorrelationId,
  normalizeError,
  redactSensitive,
  technicalErrorCodes,
} from "../dist/index.js";
import { createLogger } from "../dist/logger.js";

test("normaliza errores conocidos con un mensaje seguro", () => {
  const error = new AppError("Detalle interno", {
    code: technicalErrorCodes.VALIDATION_ERROR,
    safeMessage: "La información técnica no es válida.",
  });
  const normalized = normalizeError(error);

  assert.equal(normalized.code, technicalErrorCodes.VALIDATION_ERROR);
  assert.equal(normalized.message, "La información técnica no es válida.");
  assert.doesNotMatch(normalized.message, /Detalle interno/);
});

test("normaliza errores desconocidos sin filtrar el mensaje original", () => {
  const normalized = normalizeError(new Error("token secreto expuesto"));

  assert.equal(normalized.code, technicalErrorCodes.UNKNOWN_ERROR);
  assert.equal(normalized.message, "Ocurrió un error técnico inesperado.");
  assert.doesNotMatch(normalized.message, /token secreto expuesto/);
});

test("redacta claves y patrones sensibles", () => {
  const redacted = redactSensitive({
    archivoNombre: "acta-nacimiento.pdf",
    clave: "abc123",
    cookie: "session=123",
    correo: "persona@example.com",
    curp: "GODE561231HDFRRN09",
    emailInText: "Contacto persona@example.com",
    password: "contraseña",
    token: "token-value",
  });

  for (const value of Object.values(redacted)) {
    assert.doesNotMatch(
      String(value),
      /abc123|session=123|persona@example.com|GODE561231HDFRRN09|acta-nacimiento|token-value|contraseña/,
    );
  }
});

test("genera identificadores de correlación válidos y distintos", () => {
  const first = createCorrelationId();
  const second = createCorrelationId();

  assert.equal(isCorrelationId(first), true);
  assert.equal(isCorrelationId(second), true);
  assert.notEqual(first, second);
});

test("el logger emite JSON estructurado y redactado", () => {
  const lines = [];
  const logger = createLogger({ write: (line) => lines.push(line) });
  const entry = logger.info("Prueba técnica", {
    email: "persona@example.com",
    operation: "smoke-test",
    password: "abc123",
  });
  const parsed = JSON.parse(lines[0]);

  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "Prueba técnica");
  assert.equal(parsed.context.email, "[REDACTED]");
  assert.equal(parsed.context.password, "[REDACTED]");
  assert.equal(parsed.context.operation, "smoke-test");
  assert.equal(parsed.correlationId, entry.correlationId);
});
