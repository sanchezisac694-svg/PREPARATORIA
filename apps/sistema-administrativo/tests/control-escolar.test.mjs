import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  adapter: new URL("../lib/control-school.ts", import.meta.url),
  labels: new URL("../app/_admin/academic-labels.tsx", import.meta.url),
  navigation: new URL("../app/_admin/navigation.ts", import.meta.url),
  shell: new URL("../app/_admin/admin-shell.tsx", import.meta.url),
  studentList: new URL("../app/control-escolar/alumnos/page.tsx", import.meta.url),
  studentDetail: new URL(
    "../app/control-escolar/alumnos/[studentRecordId]/page.tsx",
    import.meta.url,
  ),
  groups: new URL("../app/control-escolar/grupos/page.tsx", import.meta.url),
  groupDetail: new URL("../app/control-escolar/grupos/[groupId]/page.tsx", import.meta.url),
  enrollments: new URL("../app/control-escolar/inscripciones/page.tsx", import.meta.url),
  structure: new URL("../app/control-escolar/estructura/page.tsx", import.meta.url),
  shared: new URL("../app/control-escolar/_shared.tsx", import.meta.url),
};

test("control escolar agrega navegación real con permisos y sin mutaciones ficticias", async () => {
  const [navigation, shell] = await Promise.all([
    readFile(files.navigation, "utf8"),
    readFile(files.shell, "utf8"),
  ]);

  assert.match(navigation, /Control escolar/);
  assert.match(navigation, /\/control-escolar\/alumnos/);
  assert.match(navigation, /\/control-escolar\/grupos/);
  assert.match(navigation, /\/control-escolar\/inscripciones/);
  assert.match(navigation, /\/control-escolar\/estructura/);
  assert.match(navigation, /ACADEMIC_STUDENTS_READ/);
  assert.match(navigation, /ACADEMIC_GROUPS_READ/);
  assert.match(navigation, /ACADEMIC_ENROLLMENTS_READ/);
  assert.match(navigation, /ACADEMIC_PERIODS_READ/);
  assert.match(navigation, /ACADEMIC_PLANS_READ/);
  assert.match(navigation, /ACADEMIC_SUBJECTS_READ/);
  assert.match(shell, /hasAnyPermission/);
  assert.doesNotMatch(
    navigation + "\n" + shell,
    /Nuevo alumno|Editar alumno|Dar de baja|Reinscribir|Cambiar grupo|Crear grupo|Eliminar grupo/,
  );
});

test("el adapter de control escolar permanece server-only y consume solo el contrato público", async () => {
  const adapter = await readFile(files.adapter, "utf8");

  assert.match(adapter, /import "server-only"/);
  assert.match(adapter, /@preparatoria\/supabase\/control-school/);
  assert.match(adapter, /requireAdminAccess/);
  assert.doesNotMatch(adapter, /service_role|SUPABASE_SECRET_KEY|packages\/supabase\/src/i);
});

test("las pantallas consumen RM-01 a RM-08 desde el adapter y no invocan SQL o RPC directo", async () => {
  const [studentList, studentDetail, groups, groupDetail, enrollments, structure] =
    await Promise.all([
      readFile(files.studentList, "utf8"),
      readFile(files.studentDetail, "utf8"),
      readFile(files.groups, "utf8"),
      readFile(files.groupDetail, "utf8"),
      readFile(files.enrollments, "utf8"),
      readFile(files.structure, "utf8"),
    ]);

  assert.match(studentList, /service\.listStudents/);
  assert.match(studentDetail, /service\.getStudentDetail/);
  assert.match(studentDetail, /service\.getStudentTrajectory/);
  assert.match(groups, /service\.listGroups/);
  assert.match(groupDetail, /service\.getGroupDetail/);
  assert.match(groupDetail, /service\.getGroupSchedule/);
  assert.match(enrollments, /service\.listEnrollments/);
  assert.match(structure, /service\.getStructure/);

  const combined = [studentList, studentDetail, groups, groupDetail, enrollments, structure].join(
    "\n",
  );
  assert.doesNotMatch(combined, /createServerClient|client\.rpc|service_role|SUPABASE_SECRET_KEY/i);
  assert.doesNotMatch(combined, /packages\/supabase\/src/);
});

test("la UI aplica labels en español, fallback seguro de nombres y paginación legible", async () => {
  const [labels, studentList, studentDetail, groupDetail, shared] = await Promise.all([
    readFile(files.labels, "utf8"),
    readFile(files.studentList, "utf8"),
    readFile(files.studentDetail, "utf8"),
    readFile(files.groupDetail, "utf8"),
    readFile(files.shared, "utf8"),
  ]);

  assert.match(labels, /Activo|Inscrito|Cancelado|Baja/);
  assert.match(labels, /Lunes|Martes|MiÃ©rcoles/);
  assert.match(labels, /Nombre no disponible/);
  assert.match(labels, /Nombre institucional no disponible/);
  assert.match(labels, /renderNameOrFallback/);
  assert.match(shared, /currentPage/);
  assert.match(shared, /pageCount/);
  assert.match(shared, /Paginación|PaginaciÃ³n/);
  assert.doesNotMatch(studentList + "\n" + studentDetail + "\n" + groupDetail, /Alumno <UUID>/);
  assert.doesNotMatch(
    studentList + "\n" + studentDetail + "\n" + groupDetail,
    /auth_user_id|account_id|person_id/,
  );
});

test("la documentación del bloque 6B refleja rutas, permisos, privacidad y limitaciones DB-UX", async () => {
  const doc = await readFile(
    new URL("../../../docs/fase-6/bloque-6b-ui-control-escolar.md", import.meta.url),
    "utf8",
  );

  assert.match(doc, /Control Escolar/i);
  assert.match(doc, /\/control-escolar\/alumnos/);
  assert.match(doc, /RM-01/);
  assert.match(doc, /RM-08/);
  assert.match(doc, /DB-UX-05/);
  assert.match(doc, /DB-UX-08/);
  assert.match(doc, /sin mutaciones|solo lectura/i);
  assert.match(doc, /No mostrar IDs internos/i);
});
