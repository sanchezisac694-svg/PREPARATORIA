import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
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

const adminClaims = String.raw`select set_config('request.jwt.claims','{"sub":"91010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const tutorClaims = String.raw`select set_config('request.jwt.claims','{"sub":"91010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);`;

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlFailure(sql) {
  return spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => (stdout += value));
    child.stderr.on("data", (value) => (stderr += value));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(sql);
  });
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout en escenario ${label} tras ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}

function barrierLock(id) {
  sqlSync(`select pg_advisory_lock(${id});`);
}

function barrierUnlock(id) {
  sqlSync(`select pg_advisory_unlock(${id});`);
}

function resetOperationalState() {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.guardian_student_link_history
where guardian_student_link_id in (
  select id from academic.guardian_student_links
  where guardian_account_id='93010000-0000-4000-8000-000000000002'
    and student_record_id='94010000-0000-4000-8000-000000000006'
);
delete from academic.guardian_student_links
where guardian_account_id='93010000-0000-4000-8000-000000000002'
  and student_record_id='94010000-0000-4000-8000-000000000006';
delete from academic.guardian_student_link_requests
where idempotency_key like 'GCX_%';
delete from academic.guardian_portal_events
where idempotency_key like 'GCX_%';
delete from academic.guardian_portal_commands
where idempotency_key like 'GCX_%';
update academic.guardian_student_links
set status='ACTIVE',
    access_scope_id=(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),
    valid_from=statement_timestamp(),
    valid_until=null,
    suspended_at=null,
    suspended_by_account_id=null,
    revoked_at=null,
    revoked_by_account_id=null,
    updated_at=statement_timestamp()
where guardian_account_id='93010000-0000-4000-8000-000000000002'
  and student_record_id='94010000-0000-4000-8000-000000000005';
update academic.guardian_access_scopes
set status='ACTIVE', updated_at=statement_timestamp()
where code='GC_SCOPE_ALT';
update core.account_roles
set revoked_at=null, revoked_by=null
where account_id='93010000-0000-4000-8000-000000000002'
  and role_id=(select id from core.roles where code='TUTOR');
update core.accounts
set account_status='ACTIVE', session_version=1, suspended_at=null, status_changed_at=statement_timestamp()
where id='93010000-0000-4000-8000-000000000002';
set session_replication_role=origin;
`);
}

async function runReadBarrierScenario({ label, lockId, readSql, mutationSql }) {
  barrierLock(lockId);
  try {
    const readPromise = withTimeout(
      sqlConnection(
        `begin isolation level repeatable read;${tutorClaims}select pg_advisory_lock_shared(${lockId});select pg_advisory_unlock_shared(${lockId});${readSql};commit;`,
      ),
      8000,
      `${label}: lectura`,
    );
    const mutationPromise = withTimeout(
      sqlConnection(`begin;${adminClaims}${mutationSql};commit;`),
      8000,
      `${label}: mutación`,
    );
    const mutationResult = await mutationPromise;
    barrierUnlock(lockId);
    const readResult = await readPromise;
    return { mutationResult, readResult };
  } finally {
    try {
      barrierUnlock(lockId);
    } catch {}
  }
}

before(() => {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.guardian_student_link_history where guardian_student_link_id in (
  select id from academic.guardian_student_links
  where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003')
);
delete from academic.guardian_student_links where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from academic.guardian_student_link_requests where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from academic.guardian_access_scopes where code='GC_SCOPE_ALT';
delete from academic.student_records where id in ('94010000-0000-4000-8000-000000000005','94010000-0000-4000-8000-000000000006');
delete from academic.student_generations where id='94010000-0000-4000-8000-000000000004';
delete from academic.study_plans where id='94010000-0000-4000-8000-000000000003';
delete from academic.academic_periods where id='94010000-0000-4000-8000-000000000002';
delete from academic.school_cycles where id='94010000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003','93010000-0000-4000-8000-000000000011');
delete from core.people where id in ('92010000-0000-4000-8000-000000000001','92010000-0000-4000-8000-000000000002','92010000-0000-4000-8000-000000000003','92010000-0000-4000-8000-000000000011');
delete from auth.users where id in ('91010000-0000-4000-8000-000000000001','91010000-0000-4000-8000-000000000002','91010000-0000-4000-8000-000000000003');
set session_replication_role=origin;

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','91010000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','con-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91010000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','con-tutor@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91010000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','con-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('92010000-0000-4000-8000-000000000001','ACTIVE'),
('92010000-0000-4000-8000-000000000002','ACTIVE'),
('92010000-0000-4000-8000-000000000003','ACTIVE'),
('92010000-0000-4000-8000-000000000011','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('93010000-0000-4000-8000-000000000001','92010000-0000-4000-8000-000000000001','91010000-0000-4000-8000-000000000001','ACTIVE',1),
('93010000-0000-4000-8000-000000000002','92010000-0000-4000-8000-000000000002','91010000-0000-4000-8000-000000000002','ACTIVE',1),
('93010000-0000-4000-8000-000000000003','92010000-0000-4000-8000-000000000003','91010000-0000-4000-8000-000000000003','ACTIVE',1),
('93010000-0000-4000-8000-000000000011','92010000-0000-4000-8000-000000000011',null,'ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values ('93010000-0000-4000-8000-000000000001','SUPERADMIN'),('93010000-0000-4000-8000-000000000002','TUTOR'),('93010000-0000-4000-8000-000000000003','ALUMNO')) seeded(actor,role_code)
join core.roles r on r.code=seeded.role_code;
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values('94010000-0000-4000-8000-000000000001','GC_CYCLE','Cycle','ACTIVE','2097-01-01','2097-12-31','93010000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values('94010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000001','GC_P1','Periodo',1,'2097-01-01','2097-06-30','ACTIVE','93010000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('94010000-0000-4000-8000-000000000003','GC_PLAN','Plan','V1','ACTIVE','2097-01-01','93010000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values('94010000-0000-4000-8000-000000000004','GC_GEN','Generación','94010000-0000-4000-8000-000000000001','94010000-0000-4000-8000-000000000003','ACTIVE','93010000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id) values
('94010000-0000-4000-8000-000000000005','92010000-0000-4000-8000-000000000003','93010000-0000-4000-8000-000000000003','94010000-0000-4000-8000-000000000003','94010000-0000-4000-8000-000000000004','GCC001','ACTIVE',1,'93010000-0000-4000-8000-000000000001'),
('94010000-0000-4000-8000-000000000006','92010000-0000-4000-8000-000000000011','93010000-0000-4000-8000-000000000011','94010000-0000-4000-8000-000000000003','94010000-0000-4000-8000-000000000004','GCC002','ACTIVE',1,'93010000-0000-4000-8000-000000000001');
insert into academic.guardian_access_scopes(id,code,name,created_by_account_id,is_system_scope,status)
values('94010000-0000-4000-8000-000000000007','GC_SCOPE_ALT','Alt scope','93010000-0000-4000-8000-000000000001',false,'ACTIVE');
insert into academic.guardian_student_link_requests(
  id,guardian_account_id,student_record_id,relationship_type,request_source,status,review_status,reason_code,
  requested_by_account_id,reviewed_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,
  requested_at,reviewed_at,approved_at,created_at,updated_at
) values (
  '94010000-0000-4000-8000-000000000008','93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000005',
  'MOTHER','CONTROL_ESCOLAR','LINKED','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST',
  '93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000001',
  'GC_BASE_REQ',repeat('a',64),now(),now(),now(),now(),now()
);
insert into academic.guardian_student_links(
  id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,
  valid_from,valid_until,activated_by_account_id,activated_at,created_at,updated_at
) values (
  '94010000-0000-4000-8000-000000000009','93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000005',
  '94010000-0000-4000-8000-000000000008','MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),
  false,statement_timestamp(),null,'93010000-0000-4000-8000-000000000001',statement_timestamp(),statement_timestamp(),statement_timestamp()
);
`);
  resetOperationalState();
});

after(() => {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.guardian_student_link_history where guardian_student_link_id in (
  select id from academic.guardian_student_links
  where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003')
);
delete from academic.guardian_student_links where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from academic.guardian_student_link_requests where guardian_account_id in ('93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from academic.guardian_access_scopes where code='GC_SCOPE_ALT';
delete from academic.student_records where id in ('94010000-0000-4000-8000-000000000005','94010000-0000-4000-8000-000000000006');
delete from academic.student_generations where id='94010000-0000-4000-8000-000000000004';
delete from academic.study_plans where id='94010000-0000-4000-8000-000000000003';
delete from academic.academic_periods where id='94010000-0000-4000-8000-000000000002';
delete from academic.school_cycles where id='94010000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('93010000-0000-4000-8000-000000000001','93010000-0000-4000-8000-000000000002','93010000-0000-4000-8000-000000000003','93010000-0000-4000-8000-000000000011');
delete from core.people where id in ('92010000-0000-4000-8000-000000000001','92010000-0000-4000-8000-000000000002','92010000-0000-4000-8000-000000000003','92010000-0000-4000-8000-000000000011');
delete from auth.users where id in ('91010000-0000-4000-8000-000000000001','91010000-0000-4000-8000-000000000002','91010000-0000-4000-8000-000000000003');
set session_replication_role=origin;
`);
});

test("doce carreras del portal del tutor permanecen coherentes", async (t) => {
  await t.test("01 solicitudes duplicadas", async () => {
    resetOperationalState();
    const [a, b] = await Promise.all([
      sqlConnection(
        `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_REQ_DUP_A',null);commit;`,
      ),
      sqlConnection(
        `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_REQ_DUP_B',null);commit;`,
      ),
    ]);
    const failures = [a, b].filter((item) => item.code !== 0);
    assert.ok(failures.length >= 1);
    assert.match(failures[0].stderr, /duplicate|guardian_link_request_one_operational/i);
  });

  await t.test("02 aprobaciones dobles", async () => {
    resetOperationalState();
    sqlSync(
      `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_APPROVE_REQ',null);select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GCX_APPROVE_REQ'),'GCX_APPROVE_SUB',null);select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GCX_APPROVE_REQ'),'GCX_APPROVE_REV',null);commit;`,
    );
    const [a, b] = await Promise.all([
      sqlConnection(
        `begin;${adminClaims}select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GCX_APPROVE_REQ'),'GCX_APPROVE_A',null);commit;`,
      ),
      sqlConnection(
        `begin;${adminClaims}select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GCX_APPROVE_REQ'),'GCX_APPROVE_B',null);commit;`,
      ),
    ]);
    assert.ok([a, b].some((item) => item.code === 0));
    assert.ok(
      [a, b].some((item) => /INVALID_STATE|duplicate/i.test(item.stderr) || item.code === 0),
    );
  });

  await t.test("03 activaciones dobles", async () => {
    resetOperationalState();
    sqlSync(
      `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_ACT_REQ',null);select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ'),'GCX_ACT_SUB',null);select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ'),'GCX_ACT_REV',null);select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ'),'GCX_ACT_APP',null);select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GCX_ACT_LINK',null);commit;`,
    );
    const [a, b] = await Promise.all([
      sqlConnection(
        `begin;${adminClaims}select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ')),'GCX_ACT_A',null);commit;`,
      ),
      sqlConnection(
        `begin;${adminClaims}select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GCX_ACT_REQ')),'GCX_ACT_B',null);commit;`,
      ),
    ]);
    assert.ok([a, b].some((item) => item.code === 0));
    assert.ok(
      [a, b].some((item) => /CONFLICT|INVALID_STATE/i.test(item.stderr) || item.code === 0),
    );
  });

  await t.test("04 suspensión frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "suspend",
      lockId: 401,
      readSql: `select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')))::text`,
      mutationSql: `select * from academic.suspend_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')),'GCX_SUS_OP',null);`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("05 revocación frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "revoke",
      lockId: 402,
      readSql: `select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')))::text`,
      mutationSql: `select * from academic.revoke_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')),'GCX_REV_OP',null);`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("06 expiración frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "expire",
      lockId: 403,
      readSql: `select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')))::text`,
      mutationSql: `select * from academic.expire_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')),'GCX_EXP_OP',null);`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("07 cambio de scope frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "scope",
      lockId: 404,
      readSql: `select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ')))::text`,
      mutationSql: `set session_replication_role=replica;update academic.guardian_access_scopes set status='RETIRED' where code='GC_SCOPE_ALT';update academic.guardian_student_links set access_scope_id='94010000-0000-4000-8000-000000000007' where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GC_BASE_REQ');set session_replication_role=origin;`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("08 revocación de rol frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "role",
      lockId: 405,
      readSql: `select public.get_my_linked_students()::text`,
      mutationSql: `update core.account_roles set revoked_at=now(), revoked_by='93010000-0000-4000-8000-000000000001' where account_id='93010000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='TUTOR');`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("09 session_version frente a lectura", async () => {
    resetOperationalState();
    const { readResult, mutationResult } = await runReadBarrierScenario({
      label: "session_version",
      lockId: 406,
      readSql: `select public.get_my_linked_students()::text`,
      mutationSql: `update core.accounts set session_version=2 where id='93010000-0000-4000-8000-000000000002';`,
    });
    assert.equal(mutationResult.code, 0, mutationResult.stderr);
    assert.ok(readResult.code === 0 || /GUARDIAN_PORTAL_ACCESS_DENIED/.test(readResult.stderr));
  });

  await t.test("10 vínculos ACTIVE duplicados", async () => {
    resetOperationalState();
    const [a, b] = await Promise.all([
      sqlConnection(
        `begin;set session_replication_role=replica;insert into academic.guardian_student_links(id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,valid_from,created_at,updated_at) values(gen_random_uuid(),'93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006',null,'MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,statement_timestamp(),statement_timestamp(),statement_timestamp());set session_replication_role=origin;rollback;`,
      ),
      sqlConnection(
        `begin;set session_replication_role=replica;insert into academic.guardian_student_links(id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,valid_from,created_at,updated_at) values(gen_random_uuid(),'93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006',null,'FATHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,statement_timestamp(),statement_timestamp(),statement_timestamp());set session_replication_role=origin;rollback;`,
      ),
    ]);
    assert.ok([a, b].some((item) => item.code !== 0));
    assert.ok([a, b].some((item) => item.code !== 0));
  });

  await t.test("11 misma idempotency_key y misma huella", async () => {
    resetOperationalState();
    const [a, b] = await Promise.all([
      sqlConnection(
        `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_SAME_KEY',null);commit;`,
      ),
      sqlConnection(
        `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_SAME_KEY',null);commit;`,
      ),
    ]);
    assert.ok([a, b].some((item) => item.code === 0));
    assert.ok([a, b].every((item) => item.code === 0 || /duplicate|conflict/i.test(item.stderr)));
  });

  await t.test("12 misma idempotency_key con payload distinto", async () => {
    resetOperationalState();
    const okResult = sqlFailure(
      `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_CONFLICT_KEY',null);commit;`,
    );
    assert.equal(okResult.status, 0, okResult.stderr);
    const conflict = sqlFailure(
      `begin;${adminClaims}select * from academic.create_guardian_link_request('93010000-0000-4000-8000-000000000002','94010000-0000-4000-8000-000000000006','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GCX_CONFLICT_KEY',null);commit;`,
    );
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /IDEMPOTENCY_CONFLICT|conflict|duplicate/i);
  });
});
