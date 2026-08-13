import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("las rutas públicas de autenticación usan AuthShell y conservan sus acciones reales", async () => {
  const [loginPage, loginForm, mfaRequired, mfaVerify, challengeForm, actions, authShell] =
    await Promise.all([
      readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/login/institutional-login-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/mfa/requerido/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/mfa/verificar/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/mfa/verificar/mfa-challenge-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/_auth/auth-shell.tsx", import.meta.url), "utf8"),
    ]);

  assert.match(authShell, /Sistema Preparatoria/);
  assert.match(authShell, /Sistema Administrativo/);
  assert.match(loginPage, /AuthShell/);
  assert.match(mfaRequired, /AuthShell/);
  assert.match(mfaVerify, /AuthShell/);
  assert.match(loginForm, /institutionalLoginAction/);
  assert.match(challengeForm, /verifyMfaChallengeAction/);
  assert.match(loginForm, /autoComplete="username"/);
  assert.match(loginForm, /autoComplete="current-password"/);
  assert.match(challengeForm, /one-time-code/);
  assert.doesNotMatch(loginPage + mfaRequired + mfaVerify, /AdminShell/);
  assert.match(actions, /"\s*\/mfa\/verificar"/);
  assert.match(actions, /"\s*\/mfa\/requerido"/);
});

test("las superficies de seguridad autenticada usan copy en español y componentes reutilizables", async () => {
  const [
    mfaPage,
    configurePage,
    enrollmentForm,
    nipPage,
    nipForm,
    recoveryList,
    recoveryNew,
    recoveryDetail,
  ] = await Promise.all([
    readFile(new URL("../app/seguridad/mfa/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/seguridad/mfa/configurar/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/seguridad/mfa/configurar/mfa-enrollment-form.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/seguridad/cambiar-nip/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/seguridad/cambiar-nip/change-nip-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/seguridad/mfa-recuperaciones/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/seguridad/mfa-recuperaciones/nueva/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/seguridad/mfa-recuperaciones/[id]/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(mfaPage, /PageHeader/);
  assert.match(mfaPage, /SecurityStatusBadge/);
  assert.match(mfaPage, /Configurar factor/);
  assert.match(configurePage, /Nuevo factor/);
  assert.match(enrollmentForm, /Código de verificación/);
  assert.match(enrollmentForm, /Código QR temporal para configurar el autenticador/);
  assert.match(nipPage, /Cambiar NIP/);
  assert.match(nipForm, /changeNipAction/);
  assert.match(nipForm, /current-password/);
  assert.equal((nipForm.match(/new-password/g) ?? []).length, 2);
  assert.match(recoveryList, /Recuperaciones MFA/);
  assert.match(recoveryNew, /Registrar solicitud/);
  assert.match(recoveryDetail, /Solicitud de recuperación MFA/);
  assert.doesNotMatch(
    mfaPage + configurePage + enrollmentForm + recoveryList + recoveryNew + recoveryDetail,
    /challenge|aal|session_version|claim|recovery request/gi,
  );
});

test("los estados de acceso usan copy claro y CTAs seguros", async () => {
  const [unavailable, unauthorized, expired, accountState] = await Promise.all([
    readFile(new URL("../app/acceso-no-disponible/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sin-autorizacion/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sesion-expirada/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/estado-cuenta/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(unavailable, /Acceso no disponible/);
  assert.match(unauthorized, /No tienes acceso a esta sección/);
  assert.match(expired, /Iniciar sesión/);
  assert.match(accountState, /Estado de acceso de la cuenta/);
  assert.doesNotMatch(unavailable + unauthorized + expired + accountState, /403|JWT|AAL|token/i);
});

test("la verificación de enrolamiento MFA conserva el factor temporal exacto", async () => {
  const [actions, enrollmentForm] = await Promise.all([
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/seguridad/mfa/configurar/mfa-enrollment-form.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(actions, /formData\.get\("factorId"\)/);
  assert.match(actions, /candidate\.id === factorId && candidate\.status === "unverified"/);
  assert.match(enrollmentForm, /name="factorId"/);
});
