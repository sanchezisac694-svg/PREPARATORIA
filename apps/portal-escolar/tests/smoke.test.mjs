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
  assert.match(recovery, /verificaci/);
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

test("portal del alumno mantiene resolución server-side y no acepta selectores de expediente", async () => {
  const [
    layout,
    service,
    overview,
    record,
    subjects,
    schedule,
    attendance,
    permissions,
    grades,
    trajectory,
    documents,
    documentDetail,
  ] = await Promise.all([
    readFile(new URL("../app/alumno/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/student-portal.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/expediente/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/materias/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/horario/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/asistencia/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/permisos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/calificaciones/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/trayectoria/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/documentos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/alumno/documentos/[documentId]/page.tsx", import.meta.url), "utf8"),
  ]);

  const combined = [
    layout,
    service,
    overview,
    record,
    subjects,
    schedule,
    attendance,
    permissions,
    grades,
    trajectory,
    documents,
    documentDetail,
  ].join("\n");

  assert.match(layout, /requireStudentPortalAccess/);
  assert.match(layout, /noStore/);
  assert.match(service, /createStudentPortalService/);
  assert.match(service, /roleCodes\.includes\("ALUMNO"\)/);
  assert.match(service, /readSupabasePublicEnv/);
  assert.match(overview, /force-dynamic/);
  assert.match(overview, /revalidate = 0/);
  assert.match(overview, /noStore/);
  assert.match(schedule, /Docente pendiente de asignación|Docente pendiente de asignaci/);
  assert.match(documents, /Documento informativo generado por el sistema/);
  assert.doesNotMatch(documents + documentDetail, /oficial|SEP|certificado/i);
  assert.doesNotMatch(
    combined,
    /student_record_id|account_id|person_id|auth_user_id|searchParams|params\.|useSearchParams|localStorage|sessionStorage|createServerActionClient|from\(/i,
  );
  assert.doesNotMatch(combined, /DRAFT|UNDER_REVIEW|CAPTURED|REVIEWED|CALCULATED/);
});

test("portal del tutor resuelve vínculos server-side y no acepta selectores directos del alumno", async () => {
  const [
    layout,
    service,
    overview,
    students,
    studentPage,
    record,
    schedule,
    attendance,
    grades,
    documents,
    documentDetail,
  ] = await Promise.all([
    readFile(new URL("../app/tutor/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/guardian-portal.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/alumnos/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/alumnos/[linkId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/alumnos/[linkId]/expediente/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/alumnos/[linkId]/horario/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/tutor/alumnos/[linkId]/asistencia/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/tutor/alumnos/[linkId]/calificaciones/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/tutor/alumnos/[linkId]/documentos/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/tutor/alumnos/[linkId]/documentos/[documentId]/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  const combined = [
    layout,
    service,
    overview,
    students,
    studentPage,
    record,
    schedule,
    attendance,
    grades,
    documents,
    documentDetail,
  ].join("\n");

  assert.match(layout, /requireGuardianPortalAccess/);
  assert.match(layout, /noStore/);
  assert.match(service, /createGuardianPortalService/);
  assert.match(service, /roleCodes\.includes\("TUTOR"\)/);
  assert.match(service, /readSupabasePublicEnv/);
  assert.match(overview, /STANDARD_ACADEMIC_READ/);
  assert.match(documents + documentDetail, /DOCUMENT_SCOPE_DENIED|deshabilitad/i);
  assert.match(studentPage, /params: Promise<\{ linkId: string \}>/);
  assert.match(studentPage, /const \{ linkId \} = await params;/);
  assert.doesNotMatch(
    combined,
    /student_record_id|guardian_account_id|account_id|person_id|auth_user_id|searchParams|useSearchParams|localStorage|sessionStorage|from\(/i,
  );
});

test("la verificación pública del documento no expone PII ni descarga directa", async () => {
  const verification = await readFile(
    new URL("../app/verificar-documento/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(verification, /VIGENTE|REVOCADO|SUSTITUIDO|EXPIRADO|NO_VERIFICADO/);
  assert.doesNotMatch(verification, /nombre|matrícula|materias|calificaciones|uuid|pdf/i);
});
