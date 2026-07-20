import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSupabaseBrowserClient } from "@preparatoria/supabase/browser";

test("login institucional, dashboard y proxy protegen el Sistema Administrativo", async () => {
  const [login, form, actions, dashboard, proxy] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/institutional-login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(login, /Sistema Administrativo/);
  assert.match(form, /name="identifier"/);
  assert.match(form, /name="nip"/);
  assert.doesNotMatch(form, /email|aspirante|alias|@.*invalid/i);
  assert.match(actions, /signInWithInstitutionalCredentials/);
  assert.doesNotMatch(actions, /signInAsApplicant/);
  assert.match(dashboard, /requireAdminAccess/);
  assert.match(dashboard, /logoutAction/);
  assert.match(proxy, /refreshSession/);
  assert.match(proxy, /getClaims|refreshSession/);
  assert.doesNotMatch(proxy, /getSession/);
  assert.match(proxy, /request\.cookies\.set/);
  assert.match(proxy, /response\.cookies\.set/);
  assert.match(proxy, /Object\.entries\(headers\)/);
  assert.match(proxy, /private, no-store/);
  assert.match(dashboard, /force-dynamic/);
});

test("puede importar la fábrica pública sin crear un cliente", () => {
  assert.equal(typeof createSupabaseBrowserClient, "function");
});
