import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePublicEnv, parseSupabasePublicEnv } from "../dist/client.js";
import {
  parseInstitutionalAuthEnv,
  parseServerEnv,
  readInstitutionalAuthEnv,
  readRuntimeEnv,
  readSupabasePublicEnv,
} from "../dist/server.js";

test("acepta variables públicas válidas", () => {
  assert.deepEqual(parsePublicEnv({ APP_ENV: "test", LOG_LEVEL: "warn" }), {
    APP_ENV: "test",
    LOG_LEVEL: "warn",
  });
});

test("acepta variables privadas válidas", () => {
  const result = parseServerEnv({
    ADMIN_BASE_URL: "http://localhost:3001",
    APP_ENV: "development",
    LOG_LEVEL: "info",
    PORTAL_BASE_URL: "http://localhost:3000",
  });
  assert.equal(result.PORTAL_BASE_URL, "http://localhost:3000");
  assert.equal(result.ADMIN_BASE_URL, "http://localhost:3001");
});

test("informa variables obligatorias faltantes", () => {
  assert.throws(
    () => parseServerEnv({ APP_ENV: "test", LOG_LEVEL: "info" }),
    /PORTAL_BASE_URL|ADMIN_BASE_URL/,
  );
});

test("permite arrancar sin configuración externa", () => {
  assert.deepEqual(readRuntimeEnv({}), { APP_ENV: "development", LOG_LEVEL: "info" });
});

test("valida la configuración pública de Supabase solo cuando se solicita", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example123",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  };
  assert.deepEqual(parseSupabasePublicEnv(valid), valid);
  assert.deepEqual(readSupabasePublicEnv(valid), valid);
  assert.throws(
    () => parseSupabasePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    /NEXT_PUBLIC_SUPABASE_URL/,
  );
  assert.throws(
    () => parseSupabasePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: valid.NEXT_PUBLIC_SUPABASE_URL }),
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  );
});

test("valida el dominio y la sal server-only del acceso institucional", () => {
  const valid = {
    AUTH_ATTEMPT_GUARD_SALT: "synthetic-test-salt-with-more-than-32-characters",
    INSTITUTIONAL_AUTH_ALIAS_DOMAIN: "identidad.sistema-preparatoria.invalid",
    NIP_RESET_TOKEN_SECRET: "synthetic-reset-secret-with-more-than-32-characters",
  };
  assert.deepEqual(parseInstitutionalAuthEnv(valid), valid);
  assert.deepEqual(readInstitutionalAuthEnv(valid), valid);
  for (const domain of [
    "https://identidad.invalid",
    "identidad.invalid/path",
    "identidad.invalid:443",
    "IDENTIDAD.INVALID",
    "localhost",
  ]) {
    assert.throws(
      () =>
        parseInstitutionalAuthEnv({
          ...valid,
          INSTITUTIONAL_AUTH_ALIAS_DOMAIN: domain,
        }),
      /INSTITUTIONAL_AUTH_ALIAS_DOMAIN/,
    );
  }
  assert.throws(
    () => parseInstitutionalAuthEnv({ ...valid, AUTH_ATTEMPT_GUARD_SALT: "short" }),
    /AUTH_ATTEMPT_GUARD_SALT/,
  );
  assert.throws(
    () => parseInstitutionalAuthEnv({ ...valid, NIP_RESET_TOKEN_SECRET: "short" }),
    /NIP_RESET_TOKEN_SECRET/,
  );
});

test("el módulo cliente no accede a process.env", async () => {
  const source = await readFile(new URL("../src/client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /process\.env/);
});

test("el módulo servidor rechaza importación en un entorno cliente", () => {
  const script = [
    "globalThis.window = {};",
    "import('./dist/server.js').catch((error) => {",
    "console.error(error.message);",
    "process.exit(1);",
    "});",
  ].join("");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /solo puede importarse desde el servidor/);
});
