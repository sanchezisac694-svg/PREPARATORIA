import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../src/grade-management-public.ts", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("expone un subpath público server-only para el contrato de calificaciones", () => {
  assert.equal(
    packageJson.exports["./grade-management-public"].types,
    "./src/grade-management-public.ts",
  );
  assert.equal(
    packageJson.exports["./grade-management-public"].default,
    "./dist/grade-management-public.js",
  );
  assert.match(source, /import "server-only";/);
  assert.match(
    source,
    /@preparatoria\/supabase\/grade-management-public solo puede importarse desde el servidor/,
  );
});

test("declara wrappers públicos, paginación y errores seguros", () => {
  for (const rpcName of [
    "list_grade_management_offerings",
    "list_my_grade_management_offerings",
    "get_grade_management_offering_detail",
    "get_grade_management_unit_grade_history",
    "get_grade_management_subject_result_history",
    "list_grade_management_corrections",
    "list_grade_capture_windows",
    "capture_student_unit_grade",
    "calculate_subject_final_result",
    "create_grade_correction",
  ]) {
    assert.match(source, new RegExp(`"${rpcName}"`));
  }

  assert.match(source, /class GradeManagementPublicError extends Error/);
  assert.match(source, /No fue posible completar la operación pública de calificaciones/);
  assert.match(source, /validatePageSize/);
  assert.match(source, /value < 1 \|\| value > 100/);
  assert.match(source, /validateOffset/);
});

test("preserva reglas académicas existentes sin recalcularlas en el frontend", () => {
  assert.match(source, /validateGradeDecimal/);
  assert.match(source, /gradeWindowStatuses/);
  assert.match(source, /unitGradeStatuses/);
  assert.match(source, /subjectResultCodes/);
  assert.match(source, /gradeCalculationStatuses/);
  assert.doesNotMatch(source, /Math\.round|approvedUnits\s*>=\s*2|rawFinalGrade\s*\?\?/);
  assert.doesNotMatch(source, /SELECT .*academic\./i);
});

test("la captura masiva y las mutaciones usan payloads cerrados y sin secretos", () => {
  assert.match(source, /captureBulkUnitGrades/);
  assert.match(source, /input\.items\.length === 0 \|\| input\.items\.length > 100/);
  assert.match(source, /GRADE_MANAGEMENT_PUBLIC_BULK_INVALID/);
  assert.doesNotMatch(
    source,
    /service_role|sb_secret_|authorization:\s*bearer|totp secret|nip actual/i,
  );
  assert.doesNotMatch(source, /accountId|personId|authUserId|session_version/i);
});
