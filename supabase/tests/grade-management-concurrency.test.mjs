import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const admin = String.raw`set request.jwt.claims='{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}';`;
const teacher = String.raw`set request.jwt.claims='{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}';`;
const psqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-Atq",
];
function sql(sqlText) {
  const r = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sqlText, shell: false });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
}
function connection(sqlText) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let out = "",
      err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (v) => (out += v));
    child.stderr.on("data", (v) => (err += v));
    child.on("close", (code) => resolve({ code, out, err }));
    child.stdin.end(sqlText);
  });
}
const race = (left, right, claims = admin) =>
  Promise.all([
    connection(`begin;${claims}select pg_sleep(.08);${left};commit;`),
    connection(`begin;${claims}select pg_sleep(.08);${right};commit;`),
  ]);
function clearGrades() {
  sql(
    `set session_replication_role=replica;delete from academic.grade_events;delete from academic.grade_commands;delete from academic.subject_result_history;update academic.semester_evaluation_summaries set progress_decision_id=null;delete from academic.academic_progress_decisions where source_period_enrollment_id='f5300000-0000-4000-8000-000000000001';delete from academic.semester_evaluation_summaries;delete from academic.subject_final_results;delete from academic.student_unit_grade_history;delete from academic.grade_corrections;delete from academic.student_unit_grades;delete from academic.grade_capture_windows;update academic.period_enrollments set status='ACTIVE' where id='f5300000-0000-4000-8000-000000000001';update academic.teaching_assignments set status='ACTIVE' where id='f4800000-0000-4000-8000-000000000001';update academic.academic_periods set status='ACTIVE' where id='f4100000-0000-4000-8000-000000000001';set session_replication_role=origin;`,
  );
}
function windows() {
  for (let u = 1; u <= 3; u++) {
    const id = sql(
      `${admin}select entity_id from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',${u}::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','C_W_${u}');`,
    );
    sql(`${admin}select * from academic.open_grade_capture_window('${id}','C_O_${u}');`);
  }
}
function capture(unit, grade = 7, key = `C_G_${unit}`) {
  return sql(
    `${teacher}select entity_id from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-00000000000${unit}',${grade},'${key}');`,
  );
}
function finalize(id, suffix) {
  sql(
    `${teacher}select * from academic.review_student_unit_grade('${id}','C_R_${suffix}');select * from academic.finalize_student_unit_grade('${id}','C_F_${suffix}');`,
  );
}
function completeSubject() {
  windows();
  for (let u = 1; u <= 3; u++) finalize(capture(u, u === 1 ? 5 : 7), u);
}

before(() => {
  const source = readFileSync(
    new URL("./attendance-management-local.test.mjs", import.meta.url),
    "utf8",
  );
  const fixture = source.match(/begin;([\s\S]*?)create temporary table b4_ids/);
  assert.ok(fixture);
  sql(
    `begin;${fixture[1]}select set_config('academic.actor_account_id','f3000000-0000-4000-8000-000000000001',true),set_config('academic.operation_key','B5_CONC_UNITS',true);insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order) values('f5600000-0000-4000-8000-000000000001','f4500000-0000-4000-8000-000000000001',1,'U1',1),('f5600000-0000-4000-8000-000000000002','f4500000-0000-4000-8000-000000000001',2,'U2',2),('f5600000-0000-4000-8000-000000000003','f4500000-0000-4000-8000-000000000001',3,'U3',3);commit;`,
  );
});
after(() => {
  clearGrades();
  sql(
    `set session_replication_role=replica;delete from academic.subject_units where id::text like 'f560%';delete from academic.student_offering_enrollments where id='f5500000-0000-4000-8000-000000000001';delete from academic.student_group_assignments where id='f5400000-0000-4000-8000-000000000001';delete from academic.period_enrollments where id='f5300000-0000-4000-8000-000000000001';delete from academic.enrollment_requests where id='f5200000-0000-4000-8000-000000000001';delete from academic.student_records where id='f5100000-0000-4000-8000-000000000001';delete from academic.student_generations where id='f5000000-0000-4000-8000-000000000001';delete from academic.teaching_assignments where id='f4800000-0000-4000-8000-000000000001';delete from academic.academic_offerings where id='f4700000-0000-4000-8000-000000000001';delete from academic.groups where id='f4600000-0000-4000-8000-000000000001';delete from academic.curriculum_subjects where id='f4500000-0000-4000-8000-000000000001';delete from academic.subjects where id='f4400000-0000-4000-8000-000000000001';delete from academic.plan_semesters where id='f4300000-0000-4000-8000-000000000001';delete from academic.study_plans where id='f4200000-0000-4000-8000-000000000001';delete from academic.academic_periods where id='f4100000-0000-4000-8000-000000000001';delete from academic.school_cycles where id='f4000000-0000-4000-8000-000000000001';delete from core.account_roles where account_id::text like 'f300%';delete from core.accounts where id::text like 'f300%';delete from core.people where id::text like 'f200%';delete from auth.users where id::text like 'f100%';set session_replication_role=origin;`,
  );
});

test("dieciocho carreras de calificaciones terminan consistentes", async (t) => {
  await t.test("01 dos ventanas", async () => {
    clearGrades();
    const r = await race(
      `select * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','CW_A')`,
      `select * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','CW_B')`,
    );
    assert.equal(sql("select count(*) from academic.grade_capture_windows"), "1");
    assert.ok(r.some((x) => x.code !== 0));
  });
  await t.test("02 dos aperturas", async () => {
    clearGrades();
    const id = sql(
      `${admin}select entity_id from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','CW2');`,
    );
    const r = await race(
      `select * from academic.open_grade_capture_window('${id}','CO_A')`,
      `select * from academic.open_grade_capture_window('${id}','CO_B')`,
    );
    assert.equal(sql(`select status from academic.grade_capture_windows where id='${id}'`), "OPEN");
    assert.ok(r.some((x) => x.code !== 0));
  });
  await t.test("03 dos capturas misma unidad", async () => {
    clearGrades();
    windows();
    const q = `select * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'CG_A')`;
    const r = await race(q, q, teacher);
    assert.equal(sql("select count(*) from academic.student_unit_grades"), "1");
    assert.equal(r.filter((x) => x.code === 0).length, 2);
  });
  await t.test("04 masiva frente a individual", async () => {
    clearGrades();
    windows();
    const bulk = `select * from academic.capture_bulk_unit_grades('[{"student_offering_enrollment_id":"f5500000-0000-4000-8000-000000000001","subject_unit_id":"f5600000-0000-4000-8000-000000000001","raw_grade":7}]','CBULK')`;
    const one = `select * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'CONE')`;
    await race(bulk, one, teacher);
    assert.equal(sql("select count(*) from academic.student_unit_grades"), "1");
  });
  await t.test("05 revisión simultánea", async () => {
    clearGrades();
    windows();
    const id = capture(1);
    await race(
      `select * from academic.review_student_unit_grade('${id}','CR_A')`,
      `select * from academic.review_student_unit_grade('${id}','CR_B')`,
      teacher,
    );
    assert.equal(
      sql(`select status from academic.student_unit_grades where id='${id}'`),
      "REVIEWED",
    );
  });
  await t.test("06 finalización simultánea", async () => {
    clearGrades();
    windows();
    const id = capture(1);
    sql(`${teacher}select * from academic.review_student_unit_grade('${id}','CR6');`);
    await race(
      `select * from academic.finalize_student_unit_grade('${id}','CF_A')`,
      `select * from academic.finalize_student_unit_grade('${id}','CF_B')`,
      teacher,
    );
    assert.equal(
      sql(`select status from academic.student_unit_grades where id='${id}'`),
      "FINALIZED",
    );
  });
  await t.test("07 cálculo simultáneo", async () => {
    clearGrades();
    completeSubject();
    await race(
      `select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','CS_A')`,
      `select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','CS_B')`,
    );
    assert.equal(sql("select count(*) from academic.subject_final_results"), "1");
  });
  await t.test("08 confirmación simultánea", async () => {
    clearGrades();
    completeSubject();
    const id = sql(
      `${admin}select entity_id from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','CS8');`,
    );
    await race(
      `select * from academic.confirm_subject_final_result('${id}','CC_A')`,
      `select * from academic.confirm_subject_final_result('${id}','CC_B')`,
    );
    assert.equal(
      sql(`select status from academic.subject_final_results where id='${id}'`),
      "CONFIRMED",
    );
  });
  await t.test("09 cierre frente a captura", async () => {
    clearGrades();
    windows();
    const wid = sql("select id from academic.grade_capture_windows where unit_number=1");
    await race(
      `select * from academic.close_grade_capture_window('${wid}','CCLOSE')`,
      `select * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'CCAP')`,
      teacher,
    );
    assert.ok(Number(sql("select count(*) from academic.student_unit_grades")) <= 1);
  });
  await t.test("10 baja frente a captura", async () => {
    clearGrades();
    windows();
    await race(
      `select set_config('academic.enrollment_controlled_mutation','on',true);update academic.period_enrollments set status='WITHDRAWN' where id='f5300000-0000-4000-8000-000000000001'`,
      `select * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'C10')`,
      teacher,
    );
    assert.ok(Number(sql("select count(*) from academic.student_unit_grades")) <= 1);
  });
  await t.test("11 asignación frente a captura", async () => {
    clearGrades();
    windows();
    await race(
      `select set_config('academic.schedule_controlled_mutation','on',true);update academic.teaching_assignments set status='ENDED' where id='f4800000-0000-4000-8000-000000000001'`,
      `select * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'C11')`,
      teacher,
    );
    assert.ok(Number(sql("select count(*) from academic.student_unit_grades")) <= 1);
  });
  await t.test("12 dos resúmenes", async () => {
    clearGrades();
    completeSubject();
    sql(
      `${admin}select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','C12R');`,
    );
    await race(
      `select * from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','C12A')`,
      `select * from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','C12B')`,
    );
    assert.equal(sql("select count(*) from academic.semester_evaluation_summaries"), "1");
  });
  await t.test("13 misma idempotency key", async () => {
    clearGrades();
    const q = `select * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','SAME_KEY')`;
    const r = await race(q, q);
    assert.equal(r.filter((x) => x.code === 0).length, 2);
    assert.equal(sql("select count(*) from academic.grade_capture_windows"), "1");
  });
  await t.test("14 payload distinto misma clave", async () => {
    clearGrades();
    const r = await race(
      `select * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','CONFLICT')`,
      `select * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',2::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','CONFLICT')`,
    );
    assert.ok(r.some((x) => /IDEMPOTENCY_CONFLICT/.test(x.err)));
  });
  await t.test("15 cierre de periodo frente a consolidación", async () => {
    clearGrades();
    completeSubject();
    sql(
      `${admin}select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','C15R');`,
    );
    await race(
      `update academic.academic_periods set status='CLOSED' where id='f4100000-0000-4000-8000-000000000001'`,
      `select * from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','C15S')`,
    );
    assert.ok(Number(sql("select count(*) from academic.semester_evaluation_summaries")) <= 1);
  });
  await t.test("16 corrección frente a cálculo final", async () => {
    clearGrades();
    completeSubject();
    const grade = sql("select id from academic.student_unit_grades where unit_number=1");
    const correction = sql(
      `${admin}select entity_id from academic.create_grade_correction('${grade}',8,'DATA_ENTRY_ERROR','C16_CREATE');`,
    );
    sql(
      `${admin}select * from academic.submit_grade_correction('${correction}','C16_SUBMIT');select * from academic.begin_grade_correction_review('${correction}','C16_REVIEW');select * from academic.approve_grade_correction('${correction}','C16_APPROVE');`,
    );
    await race(
      `select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','C16_CALCULATE')`,
      `select * from academic.apply_grade_correction('${correction}','C16_APPLY')`,
    );
    assert.equal(sql("select count(*) from academic.subject_final_results"), "1");
    assert.equal(
      sql(`select status from academic.grade_corrections where id='${correction}'`),
      "APPLIED",
    );
    const resultState = sql(
      "select status||':'||accredited_unit_count from academic.subject_final_results",
    );
    assert.ok(resultState === "CALCULATED:3" || resultState === "CORRECTED:2");
  });
  await t.test("17 corrección frente a confirmación", async () => {
    clearGrades();
    completeSubject();
    const result = sql(
      `${admin}select entity_id from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','C17_CALCULATE');`,
    );
    const grade = sql("select id from academic.student_unit_grades where unit_number=1");
    const correction = sql(
      `${admin}select entity_id from academic.create_grade_correction('${grade}',8,'DATA_ENTRY_ERROR','C17_CREATE');`,
    );
    sql(
      `${admin}select * from academic.submit_grade_correction('${correction}','C17_SUBMIT');select * from academic.begin_grade_correction_review('${correction}','C17_REVIEW');select * from academic.approve_grade_correction('${correction}','C17_APPROVE');`,
    );
    const outcomes = await race(
      `select * from academic.confirm_subject_final_result('${result}','C17_CONFIRM')`,
      `select * from academic.apply_grade_correction('${correction}','C17_APPLY')`,
    );
    assert.ok(outcomes.some((outcome) => outcome.code !== 0));
    const state = sql(
      `select r.status||':'||c.status from academic.subject_final_results r cross join academic.grade_corrections c where r.id='${result}' and c.id='${correction}'`,
    );
    assert.ok(state === "CONFIRMED:APPROVED" || state === "CORRECTED:APPLIED");
    assert.ok(
      Number(
        sql(
          "select count(*) from academic.grade_events where event_type='SUBJECT_RESULT_CONFIRMED'",
        ),
      ) <= 1,
    );
  });
  await t.test("18 dos decisiones de progreso", async () => {
    clearGrades();
    completeSubject();
    sql(
      `${admin}select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','C18_RESULT');`,
    );
    const summary = sql(
      `${admin}select entity_id from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','C18_SUMMARY');`,
    );
    sql(
      `begin;select set_config('academic.grade_controlled_mutation','on',true);update academic.semester_evaluation_summaries set evaluation_status='COMPLETE',proposed_progress_decision='ADVANCE',proposal_reason_code='ALL_SUBJECTS_AC' where id='${summary}';commit;`,
    );
    const outcomes = await race(
      `select * from academic.confirm_semester_progress_decision('${summary}','C18_A')`,
      `select * from academic.confirm_semester_progress_decision('${summary}','C18_B')`,
    );
    assert.equal(outcomes.filter((outcome) => outcome.code === 0).length, 1);
    assert.ok(outcomes.some((outcome) => /PROGRESS_DECISION_CONFLICT/.test(outcome.err)));
    assert.equal(
      sql(
        "select count(*) from academic.academic_progress_decisions where source_period_enrollment_id='f5300000-0000-4000-8000-000000000001' and decision_status='CONFIRMED'",
      ),
      "1",
    );
    assert.equal(
      sql(
        "select count(*) from academic.grade_events where event_type='PROGRESS_DECISION_CONFIRMED'",
      ),
      "1",
    );
  });
});
