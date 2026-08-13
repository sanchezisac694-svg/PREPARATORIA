import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  actions: new URL("../app/control-escolar/calificaciones/actions.ts", import.meta.url),
  adapter: new URL("../lib/grade-management.ts", import.meta.url),
  corrections: new URL(
    "../app/control-escolar/calificaciones/correcciones/page.tsx",
    import.meta.url,
  ),
  detail: new URL(
    "../app/control-escolar/calificaciones/[academicOfferingId]/page.tsx",
    import.meta.url,
  ),
  historyResult: new URL(
    "../app/control-escolar/calificaciones/[academicOfferingId]/resultados/[subjectFinalResultId]/page.tsx",
    import.meta.url,
  ),
  historyUnit: new URL(
    "../app/control-escolar/calificaciones/[academicOfferingId]/unidades/[studentUnitGradeId]/page.tsx",
    import.meta.url,
  ),
  labels: new URL("../app/_admin/grade-labels.tsx", import.meta.url),
  listing: new URL("../app/control-escolar/calificaciones/page.tsx", import.meta.url),
  myGroups: new URL("../app/control-escolar/calificaciones/mis-grupos/page.tsx", import.meta.url),
  navigation: new URL("../app/_admin/navigation.ts", import.meta.url),
  windows: new URL("../app/control-escolar/calificaciones/ventanas/page.tsx", import.meta.url),
};

test("la navegación incorpora Calificaciones por permisos y sin autorización por rol directo", async () => {
  const navigation = await readFile(files.navigation, "utf8");

  assert.match(navigation, /Calificaciones/);
  assert.match(navigation, /\/control-escolar\/calificaciones/);
  assert.match(navigation, /ACADEMIC_GRADES_READ/);
  assert.match(navigation, /ACADEMIC_GRADES_CAPTURE/);
  assert.match(navigation, /ACADEMIC_GRADES_REVIEW/);
  assert.match(navigation, /ACADEMIC_GRADES_FINALIZE/);
  assert.match(navigation, /ACADEMIC_GRADES_CORRECT/);
  assert.match(navigation, /ACADEMIC_GRADE_WINDOWS_MANAGE/);
  assert.match(navigation, /ACADEMIC_SUBJECT_RESULTS_READ/);
  assert.doesNotMatch(navigation, /SUPERADMIN\s*\|\||DOCENTE\s*\|\|/);
});

test("el adapter de calificaciones es server-only y consume solo el contrato público", async () => {
  const adapter = await readFile(files.adapter, "utf8");

  assert.match(adapter, /import "server-only"/);
  assert.match(adapter, /@preparatoria\/supabase\/grade-management-public/);
  assert.match(adapter, /createGradeManagementPublicService/);
  assert.match(adapter, /cookies\(\)/);
  assert.doesNotMatch(
    adapter,
    /service_role|SUPABASE_SECRET_KEY|createClient|packages\/supabase\/src/i,
  );
});

test("las pantallas consumen el adapter app-side y evitan SQL, RPC o imports privados", async () => {
  const [listing, detail, myGroups, windows, corrections] = await Promise.all([
    readFile(files.listing, "utf8"),
    readFile(files.detail, "utf8"),
    readFile(files.myGroups, "utf8"),
    readFile(files.windows, "utf8"),
    readFile(files.corrections, "utf8"),
  ]);
  const combined = [listing, detail, myGroups, windows, corrections].join("\n");

  assert.match(listing, /listGradeManagementOfferings/);
  assert.match(myGroups, /listMyGradeManagementOfferings/);
  assert.match(detail, /getGradeManagementOfferingDetail/);
  assert.match(windows, /listGradeManagementWindows/);
  assert.match(corrections, /listGradeManagementCorrections/);
  assert.doesNotMatch(combined, /client\.rpc|academic\.[a-z_]+|service_role|SUPABASE_SECRET_KEY/i);
  assert.doesNotMatch(combined, /packages\/supabase\/src/);
});

test("el detalle muestra exactamente tres unidades, solo lee resultados AC/NA y ofrece historiales separados", async () => {
  const [detail, historyUnit, historyResult] = await Promise.all([
    readFile(files.detail, "utf8"),
    readFile(files.historyUnit, "utf8"),
    readFile(files.historyResult, "utf8"),
  ]);

  assert.match(detail, /Unidad 1/);
  assert.match(detail, /Unidad 2/);
  assert.match(detail, /Unidad 3/);
  assert.doesNotMatch(detail, /Unidad 4/);
  assert.match(detail, /Historial U/);
  assert.match(detail, /Historial resultado/);
  assert.match(detail, /Resultado:/);
  assert.match(historyUnit, /getGradeManagementUnitGradeHistory/);
  assert.match(historyResult, /getGradeManagementSubjectResultHistory/);
});

test("las mutaciones usan wrappers públicos server-side y el frontend no decide ownership docente", async () => {
  const [actions, detail, myGroups] = await Promise.all([
    readFile(files.actions, "utf8"),
    readFile(files.detail, "utf8"),
    readFile(files.myGroups, "utf8"),
  ]);

  assert.match(actions, /captureStudentUnitGrade/);
  assert.match(actions, /captureBulkUnitGrades/);
  assert.match(actions, /reviewStudentUnitGrade/);
  assert.match(actions, /finalizeStudentUnitGrade/);
  assert.match(actions, /cancelStudentUnitGrade/);
  assert.match(actions, /createGradeWindow/);
  assert.match(actions, /createGradeCorrection/);
  assert.doesNotMatch(actions, /fetch\(|client\.rpc|service_role|subjectFinalGrade/);
  assert.doesNotMatch(detail + "\n" + myGroups, /selectedTeacher|teacher_id/);
  assert.doesNotMatch(
    detail + "\n" + myGroups,
    /name="teacherId"|labelFor="teacher-id"|placeholder="Selecciona docente"/,
  );
});

test("la UI no duplica reglas académicas del backend ni inventa final numérico oficial", async () => {
  const [detail, labels, actions] = await Promise.all([
    readFile(files.detail, "utf8"),
    readFile(files.labels, "utf8"),
    readFile(files.actions, "utf8"),
  ]);
  const combined = [detail, labels, actions].join("\n");

  assert.doesNotMatch(combined, /Math\.round/);
  assert.doesNotMatch(combined, />=\s*6/);
  assert.doesNotMatch(combined, /approvedUnits|2\s*de\s*3|5\.95|6\.25/);
  assert.doesNotMatch(combined, /promedio final oficial|calificación final numérica oficial/i);
  assert.match(labels, /AC · Acreditado|AC .*Acreditado/);
  assert.match(labels, /NA · No acreditado|NA .*No acreditado/);
  assert.match(labels, /MANUAL_REVIEW_REQUIRED/);
});

test("las superficies preservan privacidad y etiquetas seguras en español", async () => {
  const [detail, corrections, labels] = await Promise.all([
    readFile(files.detail, "utf8"),
    readFile(files.corrections, "utf8"),
    readFile(files.labels, "utf8"),
  ]);
  const combined = [detail, corrections, labels].join("\n");

  assert.match(labels, /Nombre no disponible/);
  assert.match(labels, /Docente no disponible/);
  assert.match(labels, /No definida/);
  assert.match(labels, /Revisión institucional requerida/);
  assert.doesNotMatch(combined, /auth_user_id|account_id|person_id/);
  assert.doesNotMatch(
    combined,
    /<TableHeadCell>\s*studentRecordId\s*<\/TableHeadCell>|<TableHeadCell>\s*teachingAssignmentId\s*<\/TableHeadCell>|<TableHeadCell>\s*subjectFinalResultId\s*<\/TableHeadCell>|<TableHeadCell>\s*gradeCorrectionId\s*<\/TableHeadCell>/,
  );
  assert.doesNotMatch(combined, />\s*studentRecordId\s*</);
});
