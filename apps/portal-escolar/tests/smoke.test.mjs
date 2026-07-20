import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createSupabaseBrowserClient } from "@preparatoria/supabase/browser";

test("login institucional, aspirante, dashboard y proxy protegen el Portal Escolar", async () => {
  const [login, institutional, applicant, actions, dashboard, proxy, changeNip, recovery] =
    await Promise.all([
      readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/institutional-login-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/applicant-login-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/seguridad/cambiar-nip/change-nip-form.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/recuperar-acceso/page.tsx", import.meta.url), "utf8"),
    ]);
  assert.match(login, /Portal Escolar/);
  assert.match(login, /login\/institucional/);
  assert.match(login, /login\/aspirante/);
  assert.match(institutional, /name="identifier"/);
  assert.match(institutional, /name="nip"/);
  assert.match(institutional, /type="password"/);
  assert.match(applicant, /name="email"/);
  assert.match(actions, /signInWithInstitutionalCredentials/);
  assert.match(actions, /signInAsApplicant/);
  assert.doesNotMatch(institutional, /alias|@.*invalid/i);
  assert.match(dashboard, /requirePortalAccess/);
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
  assert.match(recovery, /verificaciÃ³n presencial|verificación presencial/);
});

test("puede importar la fábrica pública sin crear un cliente", () => {
  assert.equal(typeof createSupabaseBrowserClient, "function");
});
