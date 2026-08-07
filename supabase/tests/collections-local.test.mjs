import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
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

const adminClaims = `select set_config('request.jwt.claims','{"sub":"cc110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const superadminClaims = `select set_config('request.jwt.claims','{"sub":"cc110000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function sql(sqlText) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sqlText, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return (
    result.stdout
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}

function sqlId(sqlText) {
  return sql(sqlText).split("|")[0]?.trim() ?? "";
}

before(() => {
  sql(`
begin;
set session_replication_role=replica;
delete from finance.collection_actions;
delete from finance.payment_commitments;
delete from finance.collection_cases;
delete from finance.payment_allocations where idempotency_key like 'COLL_LOCAL_%';
delete from finance.payments where idempotency_key like 'COLL_LOCAL_%';
delete from finance.financial_events where idempotency_key like 'COLL_LOCAL_%';
delete from finance.financial_commands where idempotency_key like 'COLL_LOCAL_%';
delete from finance.student_charges where idempotency_key like 'COLL_LOCAL_%';
delete from finance.charge_concepts where code='COLL_LOCAL_TUITION';
delete from finance.student_accounts where id='cc160000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where id='cc150000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where id='cc149000-0000-4000-8000-000000000001';
delete from academic.student_records where id='cc148000-0000-4000-8000-000000000001';
delete from academic.groups where id='cc147000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='cc146000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='cc145000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='cc144000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='cc143000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('cc130000-0000-4000-8000-000000000001','cc130000-0000-4000-8000-000000000002','cc130000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('cc130000-0000-4000-8000-000000000001','cc130000-0000-4000-8000-000000000002','cc130000-0000-4000-8000-000000000003');
delete from core.people where id in ('cc120000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000002','cc120000-0000-4000-8000-000000000003');
delete from auth.users where id in ('cc110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000002','cc110000-0000-4000-8000-000000000003');
set session_replication_role=origin;

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','cc110000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','collections-local-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cc110000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','collections-local-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cc110000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','collections-local-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('cc120000-0000-4000-8000-000000000001','ACTIVE'),
('cc120000-0000-4000-8000-000000000002','ACTIVE'),
('cc120000-0000-4000-8000-000000000003','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('cc130000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000001','ACTIVE',1),
('cc130000-0000-4000-8000-000000000002','cc120000-0000-4000-8000-000000000002','cc110000-0000-4000-8000-000000000002','ACTIVE',1),
('cc130000-0000-4000-8000-000000000003','cc120000-0000-4000-8000-000000000003','cc110000-0000-4000-8000-000000000003','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('cc130000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('cc130000-0000-4000-8000-000000000002','SUPERADMIN'),
('cc130000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

${superadminClaims}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('cc143000-0000-4000-8000-000000000001','COLL_LOCAL_CYCLE','Cycle collections local','ACTIVE','2099-01-01','2099-12-31','cc130000-0000-4000-8000-000000000002');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('cc144000-0000-4000-8000-000000000001','cc143000-0000-4000-8000-000000000001','COLL_LOCAL_P1','Periodo collections local',1,'2099-01-01','2099-06-30','ACTIVE','cc130000-0000-4000-8000-000000000002');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('cc145000-0000-4000-8000-000000000001','COLL_LOCAL_PLAN','Plan collections local','V1','ACTIVE','2099-01-01','cc130000-0000-4000-8000-000000000002');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('cc146000-0000-4000-8000-000000000001','COLL_LOCAL_GEN','Generacion collections local','cc143000-0000-4000-8000-000000000001','cc145000-0000-4000-8000-000000000001','ACTIVE','cc130000-0000-4000-8000-000000000002');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('cc147000-0000-4000-8000-000000000001','cc144000-0000-4000-8000-000000000001','cc145000-0000-4000-8000-000000000001',1,'COLL_LOCAL_G1','Grupo local 1','ACTIVE',40,'cc130000-0000-4000-8000-000000000002');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('cc148000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000003','cc130000-0000-4000-8000-000000000003','cc145000-0000-4000-8000-000000000001','cc146000-0000-4000-8000-000000000001','COLL_LOCAL_ALU','ACTIVE',1,'cc130000-0000-4000-8000-000000000002','cc144000-0000-4000-8000-000000000001','cc144000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('cc149000-0000-4000-8000-000000000001','cc148000-0000-4000-8000-000000000001','cc144000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cc130000-0000-4000-8000-000000000002','COLL_LOCAL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('cc150000-0000-4000-8000-000000000001','cc148000-0000-4000-8000-000000000001','cc149000-0000-4000-8000-000000000001','cc144000-0000-4000-8000-000000000001','cc145000-0000-4000-8000-000000000001',1,'cc147000-0000-4000-8000-000000000001','ACTIVE','COLL_LOCAL_ENR','cc130000-0000-4000-8000-000000000002');

insert into finance.student_accounts(id,student_record_id,currency_code,status,opened_at,created_at,updated_at) values
('cc160000-0000-4000-8000-000000000001','cc148000-0000-4000-8000-000000000001','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp());
select * from finance.create_charge_concept('COLL_LOCAL_TUITION','Cargo collections local','Sin datos reales','TUITION','COLL_LOCAL_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='COLL_LOCAL_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge('cc160000-0000-4000-8000-000000000001',(select id from finance.charge_concepts where code='COLL_LOCAL_TUITION'),null,'cc144000-0000-4000-8000-000000000001','cc150000-0000-4000-8000-000000000001','Cargo vencido local',1200.00,'2026-01-10','MANUAL','COLL-LOCAL-REF-1','COLL_LOCAL_CHARGE_CREATE',null);
select set_config('finance.controlled_mutation','on',true);
update finance.student_charges set external_reference='coll-local:1' where idempotency_key='COLL_LOCAL_CHARGE_CREATE';
select set_config('finance.controlled_mutation','off',true);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='COLL_LOCAL_CHARGE_CREATE'),'COLL_LOCAL_CHARGE_POST',null);
commit;
`);
});

after(() => {
  sql(`
begin;
set session_replication_role=replica;
delete from finance.collection_actions;
delete from finance.payment_commitments;
delete from finance.collection_cases;
delete from finance.payment_allocations where idempotency_key like 'COLL_LOCAL_%';
delete from finance.payments where idempotency_key like 'COLL_LOCAL_%';
delete from finance.financial_events where idempotency_key like 'COLL_LOCAL_%';
delete from finance.financial_commands where idempotency_key like 'COLL_LOCAL_%';
delete from finance.student_charges where idempotency_key like 'COLL_LOCAL_%' or external_reference='coll-local:1';
delete from finance.charge_concepts where code='COLL_LOCAL_TUITION';
delete from finance.student_accounts where id='cc160000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where id='cc150000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where id='cc149000-0000-4000-8000-000000000001';
delete from academic.student_records where id='cc148000-0000-4000-8000-000000000001';
delete from academic.groups where id='cc147000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='cc146000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='cc145000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='cc144000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='cc143000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('cc130000-0000-4000-8000-000000000001','cc130000-0000-4000-8000-000000000002','cc130000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('cc130000-0000-4000-8000-000000000001','cc130000-0000-4000-8000-000000000002','cc130000-0000-4000-8000-000000000003');
delete from core.people where id in ('cc120000-0000-4000-8000-000000000001','cc120000-0000-4000-8000-000000000002','cc120000-0000-4000-8000-000000000003');
delete from auth.users where id in ('cc110000-0000-4000-8000-000000000001','cc110000-0000-4000-8000-000000000002','cc110000-0000-4000-8000-000000000003');
set session_replication_role=origin;
commit;
`);
});

test("flujo local de cobranza: deuda derivada, caso, accion, compromiso, pago, fulfill, cierre e historial", () => {
  const runKey = crypto.randomUUID();
  const studentAccountId = "cc160000-0000-4000-8000-000000000001";

  assert.equal(
    sql(
      `begin;${adminClaims}select total_overdue::text from finance.get_student_debt_position('${studentAccountId}','2026-08-20') limit 1;commit;`,
    ),
    "1200.00",
  );

  const caseId = sqlId(
    `begin;${adminClaims}select * from public.open_collection_case('${studentAccountId}','OVERDUE_BALANCE','NORMAL',null,'COLL_LOCAL_CASE_${runKey}',null);commit;`,
  );
  assert.ok(caseId);
  assert.equal(sql(`select status from finance.collection_cases where id='${caseId}'`), "OPEN");

  const actionId = sqlId(
    `begin;${adminClaims}select * from public.add_collection_action('${caseId}','PHONE_CONTACT','RECORDED','PHONE','2026-08-20 12:00+00','Seguimiento administrativo minimo','2026-08-25 10:00+00','COLL_LOCAL_ACTION_${runKey}',null);commit;`,
  );
  assert.ok(actionId);
  assert.equal(
    sql(`select status from finance.collection_cases where id='${caseId}'`),
    "IN_FOLLOW_UP",
  );

  const commitmentId = sqlId(
    `begin;${adminClaims}select * from public.create_payment_commitment('${caseId}','${studentAccountId}',1200.00,'2026-08-25','Compromiso controlado','COLL_LOCAL_COMMIT_${runKey}',null);commit;`,
  );
  assert.ok(commitmentId);
  assert.equal(
    sql(`select status from finance.collection_cases where id='${caseId}'`),
    "PROMISE_PENDING",
  );
  assert.equal(
    sql(
      `select count(*) from finance.payments where idempotency_key='COLL_LOCAL_COMMIT_${runKey}'`,
    ),
    "0",
  );

  assert.equal(
    sql(
      `begin;${adminClaims}select can_be_marked_fulfilled::text from finance.evaluate_payment_commitment('${commitmentId}','2026-08-20');commit;`,
    ),
    "false",
  );

  sql(`
begin;
${adminClaims}
select * from finance.register_payment('${studentAccountId}',1200.00,'CASH','COLL-LOCAL-PAY-${runKey}','2026-08-22 10:00+00','COLL_LOCAL_PAY_REGISTER_${runKey}',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='COLL_LOCAL_PAY_REGISTER_${runKey}'),'COLL_LOCAL_PAY_CONFIRM_${runKey}',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='COLL_LOCAL_PAY_REGISTER_${runKey}'),(select id from finance.student_charges where idempotency_key='COLL_LOCAL_CHARGE_CREATE'),1200.00,'COLL_LOCAL_PAY_ALLOCATE_${runKey}',null);
commit;`);

  assert.equal(
    sql(
      `begin;${adminClaims}select can_be_marked_fulfilled::text from finance.evaluate_payment_commitment('${commitmentId}','2026-08-22');commit;`,
    ),
    "true",
  );
  assert.equal(
    sql(
      `begin;${adminClaims}select * from public.mark_payment_commitment_fulfilled('${commitmentId}','COLL_LOCAL_FULFILL_${runKey}',null);commit;`,
    )
      .split("|")
      .at(-1),
    "FULFILLED",
  );
  assert.equal(
    sql(`select status from finance.payment_commitments where id='${commitmentId}'`),
    "FULFILLED",
  );

  assert.equal(
    sql(
      `begin;${adminClaims}select * from public.close_collection_case('${caseId}','BALANCE_SETTLED','COLL_LOCAL_CLOSE_${runKey}',null);commit;`,
    )
      .split("|")
      .at(-1),
    "CLOSED",
  );
  assert.equal(sql(`select status from finance.collection_cases where id='${caseId}'`), "CLOSED");

  sql(`
begin;
${adminClaims}
select * from finance.reverse_payment_allocation((select id from finance.payment_allocations where idempotency_key='COLL_LOCAL_PAY_ALLOCATE_${runKey}'),'COLL_LOCAL_ALLOC_REVERSE_${runKey}',null);
select * from finance.reverse_payment((select id from finance.payments where idempotency_key='COLL_LOCAL_PAY_REGISTER_${runKey}'),'DUPLICATE_PAYMENT','COLL_LOCAL_REVERSE_${runKey}',null);
commit;`);
  assert.equal(
    sql(
      `begin;${adminClaims}select total_overdue::text from finance.get_student_debt_position('${studentAccountId}','2026-08-23') limit 1;commit;`,
    ),
    "1200.00",
  );
  assert.equal(sql(`select status from finance.collection_cases where id='${caseId}'`), "CLOSED");
  assert.equal(
    sql(
      `select count(*) from finance.financial_events where event_type in ('COLLECTION_CASE_OPENED','COLLECTION_ACTION_CREATED','PAYMENT_COMMITMENT_CREATED','PAYMENT_COMMITMENT_FULFILLED','COLLECTION_CASE_CLOSED') and idempotency_key like 'COLL_LOCAL_%'`,
    ),
    "5",
  );
});
