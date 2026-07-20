import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSupabaseBrowserClient } from "@preparatoria/supabase/browser";

test("login institucional, dashboard y proxy protegen el Sistema Administrativo", async () => {
  const [login, form, actions, dashboard, proxy, changeNip] = await Promise.all([
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/institutional-login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/seguridad/cambiar-nip/change-nip-form.tsx", import.meta.url), "utf8"),
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
  assert.match(actions, /changeAuthenticatedNip/);
  assert.match(changeNip, /current-password/);
  assert.equal((changeNip.match(/new-password/g) ?? []).length, 2);
  assert.doesNotMatch(changeNip, /query|searchParams|localStorage|alias/i);
});

test("puede importar la fábrica pública sin crear un cliente", () => {
  assert.equal(typeof createSupabaseBrowserClient, "function");
});

test("rutas MFA usan Server Actions y no persisten material TOTP", async () => {
  const [actions, enrollment, challenge, proxy] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/seguridad/mfa/configurar/mfa-enrollment-form.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/mfa/verificar/mfa-challenge-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
  ]);
  assert.match(actions, /beginTotpEnrollment/);
  assert.match(actions, /verifyTotpEnrollment/);
  assert.match(actions, /requireMfaStepUp/);
  assert.match(enrollment, /one-time-code/);
  assert.match(challenge, /one-time-code/);
  assert.match(proxy, /mfaRequired/);
  assert.doesNotMatch(enrollment + challenge, /localStorage|indexedDB|caches\.|searchParams/);
});
