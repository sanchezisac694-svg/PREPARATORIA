import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la página provisional identifica el Portal Escolar", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /Portal Escolar/);
  assert.match(source, /Base técnica en construcción/);
  assert.match(source, /Fase 1 — Fundamentos técnicos/);
});
