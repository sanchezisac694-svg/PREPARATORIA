import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const adminClaims = String.raw`set request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}';`;
const prefectClaims = String.raw`set request.jwt.claims = '{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}';`;

function sqlSync(sql) {
  const result = spawnSync(
    "docker",
    [
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
    ],
    { encoding: "utf8", input: sql, shell: false },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      [
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
      ],
      { shell: false },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (value) => (stdout += value));
    child.stderr.setEncoding("utf8").on("data", (value) => (stderr += value));
    child.on("close", (code) => resolve({ code, stderr, stdout }));
    child.stdin.end(sql);
  });
}

const race = (left, right, claims = adminClaims) =>
  Promise.all([
    sqlConnection(`begin; ${claims} select pg_sleep(0.10); ${left} commit;`),
    sqlConnection(`begin; ${claims} select pg_sleep(0.10); ${right} commit;`),
  ]);

function clearAttendance() {
  sqlSync(String.raw`set session_replication_role=replica;
delete from academic.attendance_events; delete from academic.attendance_commands; delete from academic.attendance_record_history;
delete from academic.attendance_corrections; delete from academic.permission_validations; delete from academic.lateness_alerts;
update academic.student_lateness_counters set last_alert_id=null; delete from academic.student_lateness_counters;
delete from academic.attendance_records; delete from academic.student_permissions; delete from academic.attendance_sessions;
update academic.period_enrollments set status='ACTIVE' where id='f5300000-0000-4000-8000-000000000001';
update academic.student_group_assignments set status='ACTIVE' where id='f5400000-0000-4000-8000-000000000001';
set session_replication_role=origin;`);
}

function createOperational(date, suffix, open = true) {
  const state = sqlSync(`${adminClaims}
with s as(select entity_id from academic.create_attendance_session('f4e00000-0000-4000-8000-000000000001','${date}','B4C_SESSION_${suffix}'))
select entity_id from s;`);
  sqlSync(
    `${adminClaims} select * from academic.populate_attendance_session_roster('${state}','B4C_ROSTER_${suffix}');`,
  );
  if (open)
    sqlSync(
      `${adminClaims} select * from academic.open_attendance_session('${state}','B4C_OPEN_${suffix}');`,
    );
  const record = sqlSync(
    `select id from academic.attendance_records where attendance_session_id='${state}';`,
  );
  return { record, session: state };
}

before(() => {
  const source = readFileSync(
    new URL("./attendance-management-local.test.mjs", import.meta.url),
    "utf8",
  );
  const fixture = source.match(/begin;([\s\S]*?)create temporary table b4_ids/);
  assert.ok(fixture, "No se encontró el fixture sintético compartido");
  sqlSync(`begin;${fixture[1]}commit;`);
});

after(() => {
  clearAttendance();
  sqlSync(String.raw`set session_replication_role=replica;
delete from academic.student_offering_enrollments where id='f5500000-0000-4000-8000-000000000001';
delete from academic.student_group_assignments where id='f5400000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where id='f5300000-0000-4000-8000-000000000001'; delete from academic.enrollment_requests where id='f5200000-0000-4000-8000-000000000001'; delete from academic.student_records where id='f5100000-0000-4000-8000-000000000001'; delete from academic.student_generations where id='f5000000-0000-4000-8000-000000000001';
delete from academic.class_sessions where id='f4e00000-0000-4000-8000-000000000001'; delete from academic.group_schedules where id='f4d00000-0000-4000-8000-000000000001'; delete from academic.academic_spaces where id='f4c00000-0000-4000-8000-000000000001'; delete from academic.schedule_template_blocks where schedule_template_id='f4b00000-0000-4000-8000-000000000001'; delete from academic.schedule_templates where id='f4b00000-0000-4000-8000-000000000001'; delete from academic.schedule_time_blocks where id='f4a00000-0000-4000-8000-000000000001'; delete from academic.academic_shifts where id='f4900000-0000-4000-8000-000000000001'; delete from academic.teaching_assignments where id='f4800000-0000-4000-8000-000000000001'; delete from academic.academic_offerings where id='f4700000-0000-4000-8000-000000000001'; delete from academic.groups where id='f4600000-0000-4000-8000-000000000001'; delete from academic.curriculum_subjects where id='f4500000-0000-4000-8000-000000000001'; delete from academic.subjects where id='f4400000-0000-4000-8000-000000000001'; delete from academic.plan_semesters where id='f4300000-0000-4000-8000-000000000001'; delete from academic.study_plans where id='f4200000-0000-4000-8000-000000000001'; delete from academic.academic_periods where id='f4100000-0000-4000-8000-000000000001'; delete from academic.school_cycles where id='f4000000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id::text like 'f300%'; delete from core.accounts where id::text like 'f300%'; delete from core.people where id::text like 'f200%'; delete from auth.users where id::text like 'f100%'; set session_replication_role=origin;`);
});

test("quince carreras de asistencia terminan en estado consistente", async (t) => {
  await t.test("01 dos aperturas", async () => {
    clearAttendance();
    const { session } = createOperational("2096-01-02", "OPEN", false);
    const result = await race(
      `select * from academic.open_attendance_session('${session}','B4C_OPEN_LEFT');`,
      `select * from academic.open_attendance_session('${session}','B4C_OPEN_RIGHT');`,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 1);
    assert.equal(
      sqlSync(`select status from academic.attendance_sessions where id='${session}'`),
      "OPEN",
    );
  });
  await t.test("02 dos cargas de roster", async () => {
    clearAttendance();
    const session = sqlSync(
      `${adminClaims} select entity_id from academic.create_attendance_session('f4e00000-0000-4000-8000-000000000001','2096-01-09','B4C_SESSION_ROSTER');`,
    );
    const result = await race(
      `select * from academic.populate_attendance_session_roster('${session}','B4C_ROSTER_LEFT');`,
      `select * from academic.populate_attendance_session_roster('${session}','B4C_ROSTER_RIGHT');`,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 2);
    assert.equal(
      sqlSync(
        `select count(*) from academic.attendance_records where attendance_session_id='${session}'`,
      ),
      "1",
    );
  });
  await t.test("03 registro único", async () => {
    clearAttendance();
    const { record } = createOperational("2096-01-16", "RECORD");
    const result = await race(
      `select * from academic.record_student_attendance('${record}','PRESENT',null,null,'B4C_RECORD_LEFT');`,
      `select * from academic.record_student_attendance('${record}','ABSENT',null,null,'B4C_RECORD_RIGHT');`,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 1);
  });
  await t.test("04 captura masiva", async () => {
    clearAttendance();
    const { record, session } = createOperational("2096-01-23", "BULK");
    const payload = `[{"record_id":"${record}","status":"PRESENT"}]`;
    const result = await race(
      `select * from academic.record_bulk_attendance('${session}','${payload}'::jsonb,'B4C_BULK_LEFT');`,
      `select * from academic.record_bulk_attendance('${session}','${payload}'::jsonb,'B4C_BULK_RIGHT');`,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 1);
  });
  await t.test("05 cuarto retardo", async () => {
    clearAttendance();
    const { record } = createOperational("2096-01-30", "FOURTH");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','LATE',4,null,'B4C_LATE_FOURTH'); set session_replication_role=replica; insert into academic.student_lateness_counters(student_record_id,academic_period_id,counter_type,current_count,lifetime_count) values('f5100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','FIRST_PERIOD_VALIDATED',3,3); set session_replication_role=origin;`,
    );
    const result = await race(
      `select * from academic.validate_student_lateness('${record}','B4C_VALIDATE_LEFT');`,
      `select * from academic.validate_student_lateness('${record}','B4C_VALIDATE_RIGHT');`,
      prefectClaims,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 1);
    assert.equal(sqlSync("select count(*) from academic.lateness_alerts"), "1");
  });
  await t.test("06 validación duplicada", async () => {
    clearAttendance();
    const { record } = createOperational("2096-02-06", "VALIDATE");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','LATE',3,null,'B4C_LATE_VALIDATE');`,
    );
    const result = await race(
      `select * from academic.validate_student_lateness('${record}','B4C_VAL_LEFT');`,
      `select * from academic.validate_student_lateness('${record}','B4C_VAL_RIGHT');`,
      prefectClaims,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 1);
    assert.equal(sqlSync("select lifetime_count from academic.student_lateness_counters"), "1");
  });
  await t.test("07 alerta única por secuencia", async () => {
    clearAttendance();
    const { record } = createOperational("2096-02-13", "ALERT");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','LATE',3,null,'B4C_LATE_ALERT'); set session_replication_role=replica; update academic.attendance_records set validated_at=now(),validated_by_prefect_account_id='f3000000-0000-4000-8000-000000000002' where id='${record}'; insert into academic.student_lateness_counters(student_record_id,academic_period_id,counter_type,current_count,lifetime_count) values('f5100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','FIRST_PERIOD_VALIDATED',3,3); set session_replication_role=origin;`,
    );
    const result = await race(
      `select academic.process_first_period_lateness('${record}','f3000000-0000-4000-8000-000000000002','B4C_PROCESS_LEFT');`,
      `select academic.process_first_period_lateness('${record}','f3000000-0000-4000-8000-000000000002','B4C_PROCESS_RIGHT');`,
      prefectClaims,
    );
    assert.equal(result.filter((item) => item.code === 0).length, 2);
    assert.equal(sqlSync("select count(*) from academic.lateness_alerts"), "1");
  });
  await t.test("08 corrección frente a contador", async () => {
    clearAttendance();
    const { record } = createOperational("2096-02-20", "CORRECT");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','LATE',3,null,'B4C_LATE_CORRECT');`,
    );
    const correction = sqlSync(
      `${adminClaims} select entity_id from academic.create_attendance_correction('${record}','PRESENT',null,'DATA_ENTRY_ERROR','B4C_CORRECTION_CREATE'); select * from academic.submit_attendance_correction((select id from academic.attendance_corrections limit 1),'B4C_CORRECTION_SUBMIT'); select * from academic.begin_attendance_correction_review((select id from academic.attendance_corrections limit 1),'B4C_CORRECTION_REVIEW'); select * from academic.approve_attendance_correction((select id from academic.attendance_corrections limit 1),'B4C_CORRECTION_APPROVE'); select id from academic.attendance_corrections limit 1;`,
    )
      .split(/\r?\n/)
      .at(-1);
    const result = await race(
      `select * from academic.apply_attendance_correction('${correction}','B4C_CORRECTION_APPLY');`,
      `select * from academic.validate_student_lateness('${record}','B4C_CORRECTION_COUNT');`,
    );
    assert.ok(result.some((item) => item.code === 0));
    assert.ok(
      Number(
        sqlSync("select coalesce(min(current_count),0) from academic.student_lateness_counters"),
      ) >= 0,
    );
  });
  await t.test("09 permiso frente a validación", async () => {
    clearAttendance();
    const { record } = createOperational("2096-02-27", "PERMIT");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','LATE',2,null,'B4C_LATE_PERMIT');`,
    );
    const permission = sqlSync(
      `${adminClaims} select entity_id from academic.create_student_permission('f5100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','LATE_ARRIVAL','2096-02-27',null,null,'TRANSPORTATION','B4C_PERMISSION_CREATE'); select * from academic.submit_student_permission((select id from academic.student_permissions limit 1),'B4C_PERMISSION_SUBMIT'); select * from academic.begin_permission_review((select id from academic.student_permissions limit 1),'B4C_PERMISSION_REVIEW'); select id from academic.student_permissions limit 1;`,
    )
      .split(/\r?\n/)
      .at(-1);
    const result = await Promise.all([
      sqlConnection(
        `begin;${prefectClaims} select * from academic.approve_student_permission('${permission}','B4C_PERMISSION_APPROVE');commit;`,
      ),
      sqlConnection(
        `begin;${prefectClaims} select * from academic.validate_student_lateness('${record}','B4C_PERMISSION_VALIDATE');commit;`,
      ),
    ]);
    assert.equal(result.filter((item) => item.code === 0).length, 2);
  });
  await t.test("10 cierre frente a captura", async () => {
    clearAttendance();
    const { record, session } = createOperational("2096-03-05", "CLOSE");
    const result = await race(
      `select * from academic.close_attendance_session('${session}','B4C_CLOSE_SESSION');`,
      `select * from academic.record_student_attendance('${record}','PRESENT',null,null,'B4C_CLOSE_RECORD');`,
    );
    assert.ok(result.some((item) => item.code === 0));
    assert.equal(
      sqlSync(`select status from academic.attendance_sessions where id='${session}'`),
      "CLOSED",
    );
  });
  await t.test("11 bloqueo frente a corrección", async () => {
    clearAttendance();
    const { record, session } = createOperational("2096-03-12", "LOCK");
    sqlSync(
      `${adminClaims} select * from academic.record_student_attendance('${record}','ABSENT',null,null,'B4C_LOCK_RECORD'); select * from academic.close_attendance_session('${session}','B4C_LOCK_CLOSE'); select * from academic.create_attendance_correction('${record}','PRESENT',null,'DATA_ENTRY_ERROR','B4C_LOCK_CORRECTION'); select * from academic.submit_attendance_correction((select id from academic.attendance_corrections limit 1),'B4C_LOCK_SUBMIT'); select * from academic.begin_attendance_correction_review((select id from academic.attendance_corrections limit 1),'B4C_LOCK_REVIEW'); select * from academic.approve_attendance_correction((select id from academic.attendance_corrections limit 1),'B4C_LOCK_APPROVE');`,
    );
    const correction = sqlSync("select id from academic.attendance_corrections limit 1");
    const result = await race(
      `select * from academic.lock_attendance_session('${session}','B4C_LOCK_SESSION');`,
      `select * from academic.apply_attendance_correction('${correction}','B4C_LOCK_APPLY');`,
    );
    assert.ok(result.some((item) => item.code === 0));
    assert.equal(
      sqlSync(`select status from academic.attendance_sessions where id='${session}'`),
      "LOCKED",
    );
  });
  await t.test("12 baja frente a roster", async () => {
    clearAttendance();
    const session = sqlSync(
      `${adminClaims} select entity_id from academic.create_attendance_session('f4e00000-0000-4000-8000-000000000001','2096-03-19','B4C_SESSION_WITHDRAW');`,
    );
    const result = await race(
      `select * from academic.populate_attendance_session_roster('${session}','B4C_WITHDRAW_ROSTER');`,
      `select set_config('academic.student_controlled_mutation','on',true); update academic.period_enrollments set status='WITHDRAWN' where id='f5300000-0000-4000-8000-000000000001';`,
    );
    assert.ok(result.some((item) => item.code === 0));
    assert.equal(
      sqlSync(
        "select count(*) from academic.attendance_records ar join academic.period_enrollments pe on pe.id=ar.period_enrollment_id where pe.status<>'ACTIVE'",
      ),
      "0",
    );
  });
  await t.test("13 cambio de grupo frente a apertura", async () => {
    clearAttendance();
    const { session } = createOperational("2096-03-26", "GROUP", false);
    const result = await race(
      `select * from academic.open_attendance_session('${session}','B4C_GROUP_OPEN');`,
      `select set_config('academic.student_controlled_mutation','on',true); update academic.student_group_assignments set status='ENDED' where id='f5400000-0000-4000-8000-000000000001';`,
    );
    assert.equal(
      sqlSync(`select status from academic.attendance_sessions where id='${session}'`),
      "OPEN",
    );
    assert.ok(result.some((item) => item.code !== 0));
  });
  await t.test("14 cancelación frente a registro", async () => {
    clearAttendance();
    const { record, session } = createOperational("2096-04-02", "CANCEL");
    const result = await race(
      `select * from academic.cancel_attendance_session('${session}','B4C_CANCEL_SESSION');`,
      `select * from academic.record_student_attendance('${record}','PRESENT',null,null,'B4C_CANCEL_RECORD');`,
    );
    assert.ok(result.some((item) => item.code === 0));
    assert.equal(
      sqlSync(`select status from academic.attendance_sessions where id='${session}'`),
      "CANCELLED",
    );
  });
  await t.test("15 misma idempotency key", async () => {
    clearAttendance();
    const sql =
      "select entity_id from academic.create_attendance_session('f4e00000-0000-4000-8000-000000000001','2096-04-09','B4C_SAME_KEY');";
    const result = await race(sql, sql);
    assert.equal(result.filter((item) => item.code === 0).length, 2);
    assert.equal(sqlSync("select count(*) from academic.attendance_sessions"), "1");
  });
});
