import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

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

const adminClaims = `select set_config('request.jwt.claims','{"sub":"cd110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const superadminClaims = `select set_config('request.jwt.claims','{"sub":"cd110000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const staleAdminClaims = `select set_config('request.jwt.claims','{"sub":"cd110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function lastLine(output) {
  return (
    output
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

function sqlSync(sqlText) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sqlText, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return lastLine(result.stdout);
}

function sqlAsync(sqlText) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) =>
      resolve({ status, stdout: lastLine(stdout), stderr: stderr.trim() }),
    );
    child.stdin.end(sqlText);
  });
}

function sqlId(sqlText) {
  return sqlSync(sqlText).split("|")[0]?.trim() ?? "";
}

function resetCollectionsState() {
  sqlSync(`
begin;
set session_replication_role=replica;
delete from finance.collection_actions;
delete from finance.payment_commitments;
delete from finance.collection_cases;
delete from finance.payment_allocations where idempotency_key like 'COLL_CONC_%';
delete from finance.payments where idempotency_key like 'COLL_CONC_%';
delete from finance.financial_events where idempotency_key like 'COLL_CONC_%';
delete from finance.financial_commands where idempotency_key like 'COLL_CONC_%';
delete from finance.student_charges where idempotency_key like 'COLL_CONC_%';
delete from finance.charge_concepts where code in ('COLL_CONC_TUITION_A','COLL_CONC_TUITION_B');
delete from finance.student_accounts where id in ('cd160000-0000-4000-8000-000000000001','cd160000-0000-4000-8000-000000000002');
delete from academic.period_enrollments where id in ('cd150000-0000-4000-8000-000000000001','cd150000-0000-4000-8000-000000000002');
delete from academic.enrollment_requests where id in ('cd149000-0000-4000-8000-000000000001','cd149000-0000-4000-8000-000000000002');
delete from academic.student_records where id in ('cd148000-0000-4000-8000-000000000001','cd148000-0000-4000-8000-000000000002');
delete from academic.groups where id='cd147000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='cd146000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='cd145000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='cd144000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='cd143000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('cd130000-0000-4000-8000-000000000001','cd130000-0000-4000-8000-000000000002','cd130000-0000-4000-8000-000000000003','cd130000-0000-4000-8000-000000000004');
delete from core.accounts where id in ('cd130000-0000-4000-8000-000000000001','cd130000-0000-4000-8000-000000000002','cd130000-0000-4000-8000-000000000003','cd130000-0000-4000-8000-000000000004');
delete from core.people where id in ('cd120000-0000-4000-8000-000000000001','cd120000-0000-4000-8000-000000000002','cd120000-0000-4000-8000-000000000003','cd120000-0000-4000-8000-000000000004');
delete from auth.users where id in ('cd110000-0000-4000-8000-000000000001','cd110000-0000-4000-8000-000000000002','cd110000-0000-4000-8000-000000000003','cd110000-0000-4000-8000-000000000004');
set session_replication_role=origin;
commit;
`);
}

function bootstrapBase() {
  resetCollectionsState();
  sqlSync(`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','cd110000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','collections-concurrency-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cd110000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','collections-concurrency-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cd110000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','collections-concurrency-student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cd110000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','collections-concurrency-student-b@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('cd120000-0000-4000-8000-000000000001','ACTIVE'),
('cd120000-0000-4000-8000-000000000002','ACTIVE'),
('cd120000-0000-4000-8000-000000000003','ACTIVE'),
('cd120000-0000-4000-8000-000000000004','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('cd130000-0000-4000-8000-000000000001','cd120000-0000-4000-8000-000000000001','cd110000-0000-4000-8000-000000000001','ACTIVE',1),
('cd130000-0000-4000-8000-000000000002','cd120000-0000-4000-8000-000000000002','cd110000-0000-4000-8000-000000000002','ACTIVE',1),
('cd130000-0000-4000-8000-000000000003','cd120000-0000-4000-8000-000000000003','cd110000-0000-4000-8000-000000000003','ACTIVE',1),
('cd130000-0000-4000-8000-000000000004','cd120000-0000-4000-8000-000000000004','cd110000-0000-4000-8000-000000000004','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('cd130000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('cd130000-0000-4000-8000-000000000002','SUPERADMIN'),
('cd130000-0000-4000-8000-000000000003','ALUMNO'),
('cd130000-0000-4000-8000-000000000004','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
${superadminClaims}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('cd143000-0000-4000-8000-000000000001','COLL_CONC_CYCLE','Cycle collections concurrency','ACTIVE','2099-01-01','2099-12-31','cd130000-0000-4000-8000-000000000002');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('cd144000-0000-4000-8000-000000000001','cd143000-0000-4000-8000-000000000001','COLL_CONC_P1','Periodo collections concurrency',1,'2099-01-01','2099-06-30','ACTIVE','cd130000-0000-4000-8000-000000000002');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('cd145000-0000-4000-8000-000000000001','COLL_CONC_PLAN','Plan collections concurrency','V1','ACTIVE','2099-01-01','cd130000-0000-4000-8000-000000000002');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('cd146000-0000-4000-8000-000000000001','COLL_CONC_GEN','Generacion collections concurrency','cd143000-0000-4000-8000-000000000001','cd145000-0000-4000-8000-000000000001','ACTIVE','cd130000-0000-4000-8000-000000000002');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('cd147000-0000-4000-8000-000000000001','cd144000-0000-4000-8000-000000000001','cd145000-0000-4000-8000-000000000001',1,'COLL_CONC_G1','Grupo concurrency','ACTIVE',40,'cd130000-0000-4000-8000-000000000002');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('cd148000-0000-4000-8000-000000000001','cd120000-0000-4000-8000-000000000003','cd130000-0000-4000-8000-000000000003','cd145000-0000-4000-8000-000000000001','cd146000-0000-4000-8000-000000000001','COLL_CONC_A','ACTIVE',1,'cd130000-0000-4000-8000-000000000002','cd144000-0000-4000-8000-000000000001','cd144000-0000-4000-8000-000000000001'),
('cd148000-0000-4000-8000-000000000002','cd120000-0000-4000-8000-000000000004','cd130000-0000-4000-8000-000000000004','cd145000-0000-4000-8000-000000000001','cd146000-0000-4000-8000-000000000001','COLL_CONC_B','ACTIVE',1,'cd130000-0000-4000-8000-000000000002','cd144000-0000-4000-8000-000000000001','cd144000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('cd149000-0000-4000-8000-000000000001','cd148000-0000-4000-8000-000000000001','cd144000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cd130000-0000-4000-8000-000000000002','COLL_CONC_REQ_A',repeat('a',64)),
('cd149000-0000-4000-8000-000000000002','cd148000-0000-4000-8000-000000000002','cd144000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cd130000-0000-4000-8000-000000000002','COLL_CONC_REQ_B',repeat('b',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('cd150000-0000-4000-8000-000000000001','cd148000-0000-4000-8000-000000000001','cd149000-0000-4000-8000-000000000001','cd144000-0000-4000-8000-000000000001','cd145000-0000-4000-8000-000000000001',1,'cd147000-0000-4000-8000-000000000001','ACTIVE','COLL_CONC_ENR_A','cd130000-0000-4000-8000-000000000002'),
('cd150000-0000-4000-8000-000000000002','cd148000-0000-4000-8000-000000000002','cd149000-0000-4000-8000-000000000002','cd144000-0000-4000-8000-000000000001','cd145000-0000-4000-8000-000000000001',1,'cd147000-0000-4000-8000-000000000001','ACTIVE','COLL_CONC_ENR_B','cd130000-0000-4000-8000-000000000002');
insert into finance.student_accounts(id,student_record_id,currency_code,status,opened_at,created_at,updated_at) values
('cd160000-0000-4000-8000-000000000001','cd148000-0000-4000-8000-000000000001','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('cd160000-0000-4000-8000-000000000002','cd148000-0000-4000-8000-000000000002','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp());
select * from finance.create_charge_concept('COLL_CONC_TUITION_A','Cargo concurrency A','Sin datos reales','TUITION','COLL_CONC_CONCEPT_A',null);
select * from finance.create_charge_concept('COLL_CONC_TUITION_B','Cargo concurrency B','Sin datos reales','TUITION','COLL_CONC_CONCEPT_B',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code in ('COLL_CONC_TUITION_A','COLL_CONC_TUITION_B');
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge('cd160000-0000-4000-8000-000000000001',(select id from finance.charge_concepts where code='COLL_CONC_TUITION_A'),null,'cd144000-0000-4000-8000-000000000001','cd150000-0000-4000-8000-000000000001','Cargo concurrency A',1000.00,'2026-01-10','MANUAL','coll-conc:A','COLL_CONC_CHARGE_A',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='COLL_CONC_CHARGE_A'),'COLL_CONC_CHARGE_POST_A',null);
select * from finance.create_student_charge('cd160000-0000-4000-8000-000000000002',(select id from finance.charge_concepts where code='COLL_CONC_TUITION_B'),null,'cd144000-0000-4000-8000-000000000001','cd150000-0000-4000-8000-000000000002','Cargo concurrency B',900.00,'2026-01-10','MANUAL','coll-conc:B','COLL_CONC_CHARGE_B',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='COLL_CONC_CHARGE_B'),'COLL_CONC_CHARGE_POST_B',null);
commit;
`);
}

function accountId(suffix = "A") {
  return suffix === "A"
    ? "cd160000-0000-4000-8000-000000000001"
    : "cd160000-0000-4000-8000-000000000002";
}

function createCaseFor(studentAccountId, idSuffix = "A") {
  return sqlId(
    `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_CASE_${idSuffix}',null);commit;`,
  );
}

test("01 double open same account", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_OPEN_A',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_OPEN_B',null);commit;`,
    ),
  ]);
  assert.equal(
    sqlSync(
      `select count(*) from finance.collection_cases where student_account_id='${studentAccountId}'`,
    ),
    "1",
  );
  assert.ok([a.status, b.status].some((status) => status === 0));
});

test("02 case open vs payment", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const [openResult, paymentResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_OPEN_PAY',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from finance.register_payment('${studentAccountId}',200.00,'CASH','COLL-CONC-PAY-1','2026-08-15 10:00+00','COLL_CONC_PAY_REGISTER',null);commit;`,
    ),
  ]);
  assert.equal(openResult.status, 0, openResult.stderr);
  assert.equal(paymentResult.status, 0, paymentResult.stderr);
});

test("03 case close vs payment", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const caseId = createCaseFor(studentAccountId, "CLOSEPAY");
  const [closeResult, paymentResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.close_collection_case('${caseId}','OPENED_IN_ERROR','COLL_CONC_CLOSE_PAY',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from finance.register_payment('${studentAccountId}',50.00,'CASH','COLL-CONC-PAY-2','2026-08-15 11:00+00','COLL_CONC_PAY_REGISTER_2',null);commit;`,
    ),
  ]);
  assert.equal(closeResult.status, 0, closeResult.stderr);
  assert.equal(paymentResult.status, 0, paymentResult.stderr);
});

test("04 two actions same idempotency", async () => {
  bootstrapBase();
  const caseId = createCaseFor(accountId("A"), "ACTIONS");
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.add_collection_action('${caseId}','PHONE_CONTACT','RECORDED','PHONE','2026-08-15 09:00+00','Seguimiento 1',null,'COLL_CONC_ACTION_SAME',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.add_collection_action('${caseId}','PHONE_CONTACT','RECORDED','PHONE','2026-08-15 09:00+00','Seguimiento 1',null,'COLL_CONC_ACTION_SAME',null);commit;`,
    ),
  ]);
  assert.ok([a.status, b.status].every((status) => status === 0));
  assert.equal(
    sqlSync(`select count(*) from finance.collection_actions where collection_case_id='${caseId}'`),
    "1",
  );
});

test("05 commitment create vs payment", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const caseId = createCaseFor(studentAccountId, "COMMITPAY");
  const [commitmentResult, paymentResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.create_payment_commitment('${caseId}','${studentAccountId}',1000.00,'2026-08-20','Compromiso', 'COLL_CONC_COMMIT_CREATE',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from finance.register_payment('${studentAccountId}',100.00,'CASH','COLL-CONC-PAY-3','2026-08-16 11:00+00','COLL_CONC_PAY_REGISTER_3',null);commit;`,
    ),
  ]);
  assert.equal(commitmentResult.status, 0, commitmentResult.stderr);
  assert.equal(paymentResult.status, 0, paymentResult.stderr);
});

test("06 commitment fulfillment vs payment reversal", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const caseId = createCaseFor(studentAccountId, "FULFILLREV");
  const commitmentId = sqlId(
    `begin;${adminClaims}select * from public.create_payment_commitment('${caseId}','${studentAccountId}',1000.00,'2026-08-20','Compromiso', 'COLL_CONC_COMMIT_REV',null);commit;`,
  );
  sqlSync(`
begin;
${adminClaims}
select * from finance.register_payment('${studentAccountId}',1000.00,'CASH','COLL-CONC-PAY-4','2026-08-16 11:00+00','COLL_CONC_PAY_REGISTER_4',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='COLL_CONC_PAY_REGISTER_4'),'COLL_CONC_PAY_CONFIRM_4',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='COLL_CONC_PAY_REGISTER_4'),(select id from finance.student_charges where idempotency_key='COLL_CONC_CHARGE_A'),1000.00,'COLL_CONC_PAY_ALLOCATE_4',null);
commit;`);
  const [fulfillResult, reverseResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.mark_payment_commitment_fulfilled('${commitmentId}','COLL_CONC_FULFILL',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from finance.reverse_payment_allocation((select id from finance.payment_allocations where idempotency_key='COLL_CONC_PAY_ALLOCATE_4'),'COLL_CONC_ALLOC_REVERSE',null);select * from finance.reverse_payment((select id from finance.payments where idempotency_key='COLL_CONC_PAY_REGISTER_4'),'DUPLICATE_PAYMENT','COLL_CONC_REVERSE',null);commit;`,
    ),
  ]);
  assert.ok([fulfillResult.status, reverseResult.status].every((status) => status === 0));
});

test("07 two commitments concurrent", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const caseId = createCaseFor(studentAccountId, "2COMMIT");
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.create_payment_commitment('${caseId}','${studentAccountId}',1000.00,'2026-08-20','Compromiso A','COLL_CONC_COMMIT_A',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.create_payment_commitment('${caseId}','${studentAccountId}',1000.00,'2099-01-21','Compromiso B','COLL_CONC_COMMIT_B',null);commit;`,
    ),
  ]);
  assert.ok([a.status, b.status].some((status) => status !== 0));
  assert.equal(
    sqlSync(
      `select count(*) from finance.payment_commitments where collection_case_id='${caseId}' and status='PENDING'`,
    ),
    "1",
  );
});

test("08 case assign vs close", async () => {
  bootstrapBase();
  const caseId = createCaseFor(accountId("A"), "ASSIGNCLOSE");
  const [assignResult, closeResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.add_collection_action('${caseId}','ACCOUNT_REVIEW','RECORDED','NONE','2026-08-15 12:00+00','Asignacion tecnica','2026-08-17 10:00+00','COLL_CONC_ASSIGN_CASE',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.close_collection_case('${caseId}','OPENED_IN_ERROR','COLL_CONC_CLOSE_ASSIGN',null);commit;`,
    ),
  ]);
  assert.equal(closeResult.status, 0, closeResult.stderr);
  assert.ok(
    assignResult.status === 0 || /COLLECTION_CASE_INVALID_STATE/.test(assignResult.stderr),
    assignResult.stderr,
  );
});

test("09 account closes vs case open", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const [closeAccount, openCase] = await Promise.all([
    sqlAsync(
      `begin;select set_config('finance.controlled_mutation','on',true);update finance.student_accounts set status='CLOSED', closed_at=statement_timestamp(), updated_at=statement_timestamp() where id='${studentAccountId}';select set_config('finance.controlled_mutation','off',true);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_OPEN_CLOSED_ACCOUNT',null);commit;`,
    ),
  ]);
  assert.equal(closeAccount.status, 0, closeAccount.stderr);
  assert.notEqual(openCase.status, 0);
});

test("10 charge cancelled vs case view", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const caseId = createCaseFor(studentAccountId, "CANCELVIEW");
  const [cancelCharge, readDebt] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from finance.cancel_student_charge((select id from finance.student_charges where idempotency_key='COLL_CONC_CHARGE_A'),'MANUAL_REVIEW_REQUIRED','COLL_CONC_CANCEL_CHARGE',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select total_overdue::text from finance.get_student_debt_position('${studentAccountId}','2026-08-15') limit 1;commit;`,
    ),
  ]);
  assert.equal(cancelCharge.status, 0, cancelCharge.stderr);
  assert.equal(readDebt.status, 0, readDebt.stderr);
  assert.equal(sqlSync(`select status from finance.collection_cases where id='${caseId}'`), "OPEN");
});

test("11 payment allocation vs debt query", async () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  sqlSync(
    `begin;${adminClaims}select * from finance.register_payment('${studentAccountId}',200.00,'CASH','COLL-CONC-PAY-5','2026-08-16 11:00+00','COLL_CONC_PAY_REGISTER_5',null);select * from finance.confirm_payment((select id from finance.payments where idempotency_key='COLL_CONC_PAY_REGISTER_5'),'COLL_CONC_PAY_CONFIRM_5',null);commit;`,
  );
  const [allocateResult, queryResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from finance.allocate_payment((select id from finance.payments where idempotency_key='COLL_CONC_PAY_REGISTER_5'),(select id from finance.student_charges where idempotency_key='COLL_CONC_CHARGE_A'),200.00,'COLL_CONC_PAY_ALLOCATE_5',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select total_overdue::text from finance.get_student_debt_position('${studentAccountId}','2026-08-16') limit 1;commit;`,
    ),
  ]);
  assert.equal(allocateResult.status, 0, allocateResult.stderr);
  assert.equal(queryResult.status, 0, queryResult.stderr);
});

test("12 session_version revoked", () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  sqlSync(
    `update core.accounts set session_version=2 where id='cd130000-0000-4000-8000-000000000001';`,
  );
  assert.throws(
    () =>
      sqlSync(
        `begin;${staleAdminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_STALE_SESSION',null);commit;`,
      ),
    /APPLICATION_NOT_ALLOWED|SESSION_VERSION_INVALID/,
  );
});

test("13 same key same fingerprint", () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  const first = sqlSync(
    `begin;${adminClaims}select entity_id from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_IDEMPOTENT_SAME',null);commit;`,
  );
  const second = sqlSync(
    `begin;${adminClaims}select entity_id from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_IDEMPOTENT_SAME',null);commit;`,
  );
  assert.equal(first, second);
});

test("14 same key different fingerprint", () => {
  bootstrapBase();
  const studentAccountId = accountId("A");
  sqlSync(
    `begin;${adminClaims}select entity_id from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_IDEMPOTENT_CONFLICT',null);commit;`,
  );
  assert.throws(
    () =>
      sqlSync(
        `begin;${adminClaims}select entity_id from public.open_collection_case('${studentAccountId}','MANUAL_REVIEW','HIGH',null,'COLL_CONC_IDEMPOTENT_CONFLICT',null);commit;`,
      ),
    /IDEMPOTENCY_CONFLICT/,
  );
});

test("15 independent accounts", async () => {
  bootstrapBase();
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${accountId("A")}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_INDEP_A',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select * from public.open_collection_case('${accountId("B")}','OVERDUE_BALANCE','NORMAL',null,'COLL_CONC_INDEP_B',null);commit;`,
    ),
  ]);
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(
    sqlSync(
      `select count(*) from finance.collection_cases where student_account_id in ('${accountId("A")}','${accountId("B")}')`,
    ),
    "2",
  );
});
