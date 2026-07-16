import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createSupabaseBrowserClient } from "../dist/browser.js";
import { createSupabaseSsrClient } from "../dist/ssr.js";

const validConfig = {
  publishableKey: "sb_publishable_example123",
  url: "https://example.supabase.co",
};

test("crea el cliente de navegador con una dependencia simulada y sin red", () => {
  const expected = { kind: "browser-double" };
  const calls = [];
  const result = createSupabaseBrowserClient(validConfig, (url, key) => {
    calls.push({ key, url });
    return expected;
  });
  assert.equal(result, expected);
  assert.deepEqual(calls, [{ key: validConfig.publishableKey, url: validConfig.url }]);
});

test("rechaza URL inválida, clave faltante y claves no publicables", () => {
  assert.throws(
    () => createSupabaseBrowserClient({ ...validConfig, url: "invalid" }, () => ({})),
    /URL/,
  );
  assert.throws(
    () => createSupabaseBrowserClient({ ...validConfig, publishableKey: "" }, () => ({})),
    /clave publicable|PUBLISHABLE/i,
  );
  assert.throws(
    () =>
      createSupabaseBrowserClient({ ...validConfig, publishableKey: "secret_value" }, () => ({})),
    /clave publicable|PUBLISHABLE/i,
  );
});

test("crea el cliente SSR con cookies simuladas y sin red", () => {
  const expected = { kind: "ssr-double" };
  const cookies = { getAll: () => [], setAll: () => undefined };
  const result = createSupabaseSsrClient(validConfig, cookies, (url, key, options) => {
    assert.equal(url, validConfig.url);
    assert.equal(key, validConfig.publishableKey);
    assert.equal(options.cookies, cookies);
    return expected;
  });
  assert.equal(result, expected);
});

test("los módulos server-only rechazan un entorno de navegador", () => {
  for (const moduleName of ["ssr", "admin-contract"]) {
    const script = `globalThis.window={};import('./dist/${moduleName}.js').catch((error)=>{console.error(error.message);process.exit(1)})`;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /solo puede importarse desde el servidor/);
  }
});

test("las entradas no contienen consultas, credenciales privilegiadas ni acceso al entorno", async () => {
  const files = ["admin-contract.ts", "browser.ts", "config.ts", "ssr.ts", "types.ts"];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")),
  );
  const source = sources.join("\n");
  assert.doesNotMatch(source, /\.from\s*\(/);
  assert.doesNotMatch(source, /service_role/i);
  assert.doesNotMatch(source, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(source, /process\.env/);
});
