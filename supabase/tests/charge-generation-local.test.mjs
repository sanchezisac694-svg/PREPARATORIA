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

const adminClaims = `select set_config('request.jwt.claims','{"sub":"ca100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const superadminClaims = `select set_config('request.jwt.claims','{"sub":"ca100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function sql(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
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
set session_replication_role=replica;
delete from finance.charge_generation_batch_items;
delete from finance.charge_generation_batches;
delete from finance.charge_generation_exclusions;
delete from finance.charge_generation_rule_versions;
delete from finance.charge_generation_rules;
delete from finance.financial_events where idempotency_key like 'CG_%';
delete from finance.financial_commands where idempotency_key like 'CG_%';
delete from finance.student_charges where external_reference like 'cg:%';
delete from finance.charge_rates where id in ('ca600000-0000-4000-8000-000000000001','ca600000-0000-4000-8000-000000000002');
delete from finance.charge_concepts where id in ('ca610000-0000-4000-8000-000000000001','ca610000-0000-4000-8000-000000000002');
delete from finance.student_accounts where id in ('ca620000-0000-4000-8000-000000000001','ca620000-0000-4000-8000-000000000002','ca620000-0000-4000-8000-000000000003','ca620000-0000-4000-8000-000000000004');
delete from academic.period_enrollments where id in ('ca520000-0000-4000-8000-000000000001','ca520000-0000-4000-8000-000000000002','ca520000-0000-4000-8000-000000000003','ca520000-0000-4000-8000-000000000004');
delete from academic.enrollment_requests where id in ('ca510000-0000-4000-8000-000000000001','ca510000-0000-4000-8000-000000000002','ca510000-0000-4000-8000-000000000003','ca510000-0000-4000-8000-000000000004');
delete from academic.student_records where id in ('ca500000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000003','ca500000-0000-4000-8000-000000000004');
delete from academic.student_generations where id='ca430000-0000-4000-8000-000000000001';
delete from academic.groups where id in ('ca440000-0000-4000-8000-000000000001','ca440000-0000-4000-8000-000000000002');
delete from academic.study_plans where id='ca420000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='ca410000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='ca400000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002','ca300000-0000-4000-8000-000000000011','ca300000-0000-4000-8000-000000000012','ca300000-0000-4000-8000-000000000013','ca300000-0000-4000-8000-000000000014');
delete from core.accounts where id in ('ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002','ca300000-0000-4000-8000-000000000011','ca300000-0000-4000-8000-000000000012','ca300000-0000-4000-8000-000000000013','ca300000-0000-4000-8000-000000000014');
delete from core.people where id in ('ca200000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000002','ca200000-0000-4000-8000-000000000011','ca200000-0000-4000-8000-000000000012','ca200000-0000-4000-8000-000000000013','ca200000-0000-4000-8000-000000000014');
delete from auth.users where id in ('ca100000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000011','ca100000-0000-4000-8000-000000000012','ca100000-0000-4000-8000-000000000013','ca100000-0000-4000-8000-000000000014');
set session_replication_role=origin;

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','charge-generation-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','charge-generation-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000011','authenticated','authenticated','synthetic','charge-generation-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000012','authenticated','authenticated','synthetic','charge-generation-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000013','authenticated','authenticated','synthetic','charge-generation-c@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca100000-0000-4000-8000-000000000014','authenticated','authenticated','synthetic','charge-generation-d@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('ca200000-0000-4000-8000-000000000001','ACTIVE'),
('ca200000-0000-4000-8000-000000000002','ACTIVE'),
('ca200000-0000-4000-8000-000000000011','ACTIVE'),
('ca200000-0000-4000-8000-000000000012','ACTIVE'),
('ca200000-0000-4000-8000-000000000013','ACTIVE'),
('ca200000-0000-4000-8000-000000000014','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('ca300000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000001','ACTIVE',1),
('ca300000-0000-4000-8000-000000000002','ca200000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000002','ACTIVE',1),
('ca300000-0000-4000-8000-000000000011','ca200000-0000-4000-8000-000000000011','ca100000-0000-4000-8000-000000000011','ACTIVE',1),
('ca300000-0000-4000-8000-000000000012','ca200000-0000-4000-8000-000000000012','ca100000-0000-4000-8000-000000000012','ACTIVE',1),
('ca300000-0000-4000-8000-000000000013','ca200000-0000-4000-8000-000000000013','ca100000-0000-4000-8000-000000000013','ACTIVE',1),
('ca300000-0000-4000-8000-000000000014','ca200000-0000-4000-8000-000000000014','ca100000-0000-4000-8000-000000000014','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('ca300000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('ca300000-0000-4000-8000-000000000002','SUPERADMIN'),
('ca300000-0000-4000-8000-000000000011','ALUMNO'),
('ca300000-0000-4000-8000-000000000012','ALUMNO'),
('ca300000-0000-4000-8000-000000000013','ALUMNO'),
('ca300000-0000-4000-8000-000000000014','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

${superadminClaims}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('ca400000-0000-4000-8000-000000000001','CG_CYCLE','Charge generation cycle','ACTIVE','2026-01-01','2026-12-31','ca300000-0000-4000-8000-000000000002');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('ca410000-0000-4000-8000-000000000001','ca400000-0000-4000-8000-000000000001','CG_2026B','Periodo 2026-B',2,'2026-08-01','2026-12-31','ACTIVE','ca300000-0000-4000-8000-000000000002');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('ca420000-0000-4000-8000-000000000001','CG_PLAN','Plan general','V1','ACTIVE','2026-01-01','ca300000-0000-4000-8000-000000000002');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('ca430000-0000-4000-8000-000000000001','CG_GEN','Generación CG','ca400000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001','ACTIVE','ca300000-0000-4000-8000-000000000002');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,training_area_id,code,display_name,status,created_by_account_id)
values
('ca440000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',1,null,'CG_G1','Grupo 1A','ACTIVE','ca300000-0000-4000-8000-000000000002'),
('ca440000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',2,null,'CG_G2','Grupo 2A','ACTIVE','ca300000-0000-4000-8000-000000000002');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('ca500000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000011','ca300000-0000-4000-8000-000000000011','ca420000-0000-4000-8000-000000000001','ca430000-0000-4000-8000-000000000001','CG-A','ACTIVE',1,'ca300000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001'),
('ca500000-0000-4000-8000-000000000002','ca200000-0000-4000-8000-000000000012','ca300000-0000-4000-8000-000000000012','ca420000-0000-4000-8000-000000000001','ca430000-0000-4000-8000-000000000001','CG-B','ACTIVE',1,'ca300000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001'),
('ca500000-0000-4000-8000-000000000003','ca200000-0000-4000-8000-000000000013','ca300000-0000-4000-8000-000000000013','ca420000-0000-4000-8000-000000000001','ca430000-0000-4000-8000-000000000001','CG-C','ACTIVE',1,'ca300000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001'),
('ca500000-0000-4000-8000-000000000004','ca200000-0000-4000-8000-000000000014','ca300000-0000-4000-8000-000000000014','ca420000-0000-4000-8000-000000000001','ca430000-0000-4000-8000-000000000001','CG-D','ACTIVE',2,'ca300000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('ca510000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'ca440000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','ca300000-0000-4000-8000-000000000002','CG_REQ_A',repeat('a',64)),
('ca510000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','REENROLLMENT',1,'ca440000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','ca300000-0000-4000-8000-000000000002','CG_REQ_B',repeat('b',64)),
('ca510000-0000-4000-8000-000000000003','ca500000-0000-4000-8000-000000000003','ca410000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'ca440000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','ca300000-0000-4000-8000-000000000002','CG_REQ_C',repeat('c',64)),
('ca510000-0000-4000-8000-000000000004','ca500000-0000-4000-8000-000000000004','ca410000-0000-4000-8000-000000000001','REPEAT_SEMESTER',2,'ca440000-0000-4000-8000-000000000002','APPROVED','ELIGIBLE','REPEAT_REQUIRED','ca300000-0000-4000-8000-000000000002','CG_REQ_D',repeat('d',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,training_area_id,group_id,status,enrolled_by_account_id)
values
('ca520000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001','ca510000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',1,null,'ca440000-0000-4000-8000-000000000001','ACTIVE','ca300000-0000-4000-8000-000000000002'),
('ca520000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000002','ca510000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',1,null,'ca440000-0000-4000-8000-000000000001','ACTIVE','ca300000-0000-4000-8000-000000000002'),
('ca520000-0000-4000-8000-000000000003','ca500000-0000-4000-8000-000000000003','ca510000-0000-4000-8000-000000000003','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',1,null,'ca440000-0000-4000-8000-000000000001','ACTIVE','ca300000-0000-4000-8000-000000000002'),
('ca520000-0000-4000-8000-000000000004','ca500000-0000-4000-8000-000000000004','ca510000-0000-4000-8000-000000000004','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',2,null,'ca440000-0000-4000-8000-000000000002','ACTIVE','ca300000-0000-4000-8000-000000000002');

insert into finance.student_accounts(id,student_record_id,currency_code,status,opened_at,created_at,updated_at)
values
('ca620000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000001','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('ca620000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000002','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('ca620000-0000-4000-8000-000000000003','ca500000-0000-4000-8000-000000000003','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('ca620000-0000-4000-8000-000000000004','ca500000-0000-4000-8000-000000000004','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp());

insert into finance.charge_concepts(id,code,name,category,currency_code,status,is_system_concept,created_by_account_id)
values
('ca610000-0000-4000-8000-000000000001','CG_TUITION','Colegiatura CG','TUITION','MXN','ACTIVE',false,'ca300000-0000-4000-8000-000000000001'),
('ca610000-0000-4000-8000-000000000002','CG_REPEAT','Repetición CG','REENROLLMENT','MXN','ACTIVE',false,'ca300000-0000-4000-8000-000000000001');

insert into finance.charge_rates(id,charge_concept_id,academic_period_id,academic_plan_id,semester_number,area_id,amount,currency_code,status,valid_from,created_by_account_id,approved_by_account_id,approved_at,created_at,updated_at)
values
('ca600000-0000-4000-8000-000000000001','ca610000-0000-4000-8000-000000000001','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',null,null,1500.00,'MXN','ACTIVE',statement_timestamp(),'ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('ca600000-0000-4000-8000-000000000002','ca610000-0000-4000-8000-000000000002','ca410000-0000-4000-8000-000000000001','ca420000-0000-4000-8000-000000000001',2,null,2200.00,'MXN','ACTIVE',statement_timestamp(),'ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002',statement_timestamp(),statement_timestamp(),statement_timestamp());
`);
});

after(() => {
  sql(`
set session_replication_role=replica;
delete from finance.charge_generation_batch_items;
delete from finance.charge_generation_batches;
delete from finance.charge_generation_exclusions;
delete from finance.charge_generation_rule_versions;
delete from finance.charge_generation_rules;
delete from finance.financial_events where idempotency_key like 'CG_%';
delete from finance.financial_commands where idempotency_key like 'CG_%';
delete from finance.student_charges where external_reference like 'cg:%';
delete from finance.charge_rates where id in ('ca600000-0000-4000-8000-000000000001','ca600000-0000-4000-8000-000000000002');
delete from finance.charge_concepts where id in ('ca610000-0000-4000-8000-000000000001','ca610000-0000-4000-8000-000000000002');
delete from finance.student_accounts where id in ('ca620000-0000-4000-8000-000000000001','ca620000-0000-4000-8000-000000000002','ca620000-0000-4000-8000-000000000003','ca620000-0000-4000-8000-000000000004');
delete from academic.period_enrollments where id in ('ca520000-0000-4000-8000-000000000001','ca520000-0000-4000-8000-000000000002','ca520000-0000-4000-8000-000000000003','ca520000-0000-4000-8000-000000000004');
delete from academic.enrollment_requests where id in ('ca510000-0000-4000-8000-000000000001','ca510000-0000-4000-8000-000000000002','ca510000-0000-4000-8000-000000000003','ca510000-0000-4000-8000-000000000004');
delete from academic.student_records where id in ('ca500000-0000-4000-8000-000000000001','ca500000-0000-4000-8000-000000000002','ca500000-0000-4000-8000-000000000003','ca500000-0000-4000-8000-000000000004');
delete from academic.student_generations where id='ca430000-0000-4000-8000-000000000001';
delete from academic.groups where id in ('ca440000-0000-4000-8000-000000000001','ca440000-0000-4000-8000-000000000002');
delete from academic.study_plans where id='ca420000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='ca410000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='ca400000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002','ca300000-0000-4000-8000-000000000011','ca300000-0000-4000-8000-000000000012','ca300000-0000-4000-8000-000000000013','ca300000-0000-4000-8000-000000000014');
delete from core.accounts where id in ('ca300000-0000-4000-8000-000000000001','ca300000-0000-4000-8000-000000000002','ca300000-0000-4000-8000-000000000011','ca300000-0000-4000-8000-000000000012','ca300000-0000-4000-8000-000000000013','ca300000-0000-4000-8000-000000000014');
delete from core.people where id in ('ca200000-0000-4000-8000-000000000001','ca200000-0000-4000-8000-000000000002','ca200000-0000-4000-8000-000000000011','ca200000-0000-4000-8000-000000000012','ca200000-0000-4000-8000-000000000013','ca200000-0000-4000-8000-000000000014');
delete from auth.users where id in ('ca100000-0000-4000-8000-000000000001','ca100000-0000-4000-8000-000000000002','ca100000-0000-4000-8000-000000000011','ca100000-0000-4000-8000-000000000012','ca100000-0000-4000-8000-000000000013','ca100000-0000-4000-8000-000000000014');
set session_replication_role=origin;
`);
});

test("flujo local de generación de cargos: preview, exclusión, batch, ejecución idempotente, rate congelada y repeat semester", () => {
  const runKey = crypto.randomUUID();
  const ruleId = sqlId(
    `begin;${adminClaims}select * from finance.create_charge_generation_rule('CG_TUITION_2026B','Colegiatura 2026-B','ca610000-0000-4000-8000-000000000001','PERIODIC_TUITION','CG_RULE_TUITION_${runKey}',null);commit;`,
  );
  const versionId = sqlId(
    `begin;${adminClaims}select * from finance.create_charge_generation_rule_version('${ruleId}', 'ca410000-0000-4000-8000-000000000001', 'ca420000-0000-4000-8000-000000000001', 1, null, 'ca600000-0000-4000-8000-000000000001', 'FIXED_DATE', '2026-08-31', null, null, statement_timestamp(), null, 'CG_VERSION_TUITION_${runKey}', null);commit;`,
  );
  sql(
    `begin;${superadminClaims}select * from finance.approve_charge_generation_rule_version('${versionId}','CG_VERSION_TUITION_APPROVE_${runKey}',null);select * from finance.activate_charge_generation_rule_version('${versionId}','CG_VERSION_TUITION_ACTIVATE_${runKey}',null);commit;`,
  );

  assert.equal(
    sql(
      `begin;${adminClaims}select count(*) from finance.preview_charge_generation('${versionId}','ca410000-0000-4000-8000-000000000001',null);commit;`,
    ),
    "3",
  );
  assert.equal(
    sql(
      `begin;${adminClaims}select count(*) from finance.student_charges where external_reference like 'cg:%';commit;`,
    ),
    "0",
  );

  sql(
    `begin;${adminClaims}select entity_id from finance.create_charge_generation_exclusion('ca500000-0000-4000-8000-000000000003','${ruleId}','${versionId}','ca410000-0000-4000-8000-000000000001','MANUAL_REVIEW_REQUIRED',statement_timestamp(),null,'CG_EXCLUSION_C_${runKey}',null);commit;`,
  );

  assert.equal(
    sql(
      `begin;${adminClaims}select count(*) from finance.preview_charge_generation('${versionId}','ca410000-0000-4000-8000-000000000001',null) where eligibility_status='ELIGIBLE';commit;`,
    ),
    "2",
  );
  assert.equal(
    sql(
      `begin;${adminClaims}select count(*) from finance.preview_charge_generation('${versionId}','ca410000-0000-4000-8000-000000000001',null) where eligibility_status='EXPLICITLY_EXCLUDED';commit;`,
    ),
    "1",
  );

  const batchId = sqlId(
    `begin;${adminClaims}select * from finance.create_charge_generation_batch('${versionId}','ca410000-0000-4000-8000-000000000001','CG_BATCH_TUITION_${runKey}',null);commit;`,
  );
  sql(
    `begin;${adminClaims}select * from finance.submit_charge_generation_batch('${batchId}','CG_BATCH_TUITION_SUBMIT_${runKey}',null);commit;`,
  );
  sql(
    `begin;${superadminClaims}select * from finance.approve_charge_generation_batch('${batchId}','CG_BATCH_TUITION_APPROVE_${runKey}',null);commit;`,
  );

  sql(
    `begin;select set_config('finance.controlled_mutation','on',true);update finance.charge_rates set amount = 9999.00 where id = 'ca600000-0000-4000-8000-000000000001';select set_config('finance.controlled_mutation','off',true);commit;`,
  );

  sql(
    `begin;${adminClaims}select * from finance.execute_charge_generation_batch('${batchId}','CG_BATCH_TUITION_EXECUTE_${runKey}',null);commit;`,
  );

  assert.equal(
    sql(
      `select total_generated::text || '|' || total_skipped::text || '|' || total_failed::text from finance.charge_generation_batches where id='${batchId}'`,
    ),
    "2|1|0",
  );
  assert.equal(
    sql(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%'`,
    ),
    "2",
  );
  assert.equal(
    sql(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%' and original_amount = 1500.00`,
    ),
    "2",
  );
  assert.equal(
    sql(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%' and original_amount = 9999.00`,
    ),
    "0",
  );
  assert.equal(
    sql(
      `select count(*) from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='ca500000-0000-4000-8000-000000000003' and processing_status='SKIPPED'`,
    ),
    "1",
  );

  sql(
    `begin;${adminClaims}select * from finance.execute_charge_generation_batch('${batchId}','CG_BATCH_TUITION_EXECUTE_${runKey}',null);commit;`,
  );
  assert.equal(
    sql(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%'`,
    ),
    "2",
  );

  const repeatRuleId = sqlId(
    `begin;${adminClaims}select * from finance.create_charge_generation_rule('CG_REPEAT_2026B','Repetición 2026-B','ca610000-0000-4000-8000-000000000002','REPEAT_SEMESTER','CG_RULE_REPEAT_${runKey}',null);commit;`,
  );
  const repeatVersionId = sqlId(
    `begin;${adminClaims}select * from finance.create_charge_generation_rule_version('${repeatRuleId}', 'ca410000-0000-4000-8000-000000000001', 'ca420000-0000-4000-8000-000000000001', 2, null, 'ca600000-0000-4000-8000-000000000002', 'FIXED_DATE', '2026-09-15', null, null, statement_timestamp(), null, 'CG_VERSION_REPEAT_${runKey}', null);commit;`,
  );
  sql(
    `begin;${superadminClaims}select * from finance.approve_charge_generation_rule_version('${repeatVersionId}','CG_VERSION_REPEAT_APPROVE_${runKey}',null);select * from finance.activate_charge_generation_rule_version('${repeatVersionId}','CG_VERSION_REPEAT_ACTIVATE_${runKey}',null);commit;`,
  );

  assert.equal(
    sql(
      `begin;${adminClaims}select count(*) from finance.preview_charge_generation('${repeatVersionId}','ca410000-0000-4000-8000-000000000001',null) where eligibility_status='ELIGIBLE';commit;`,
    ),
    "1",
  );
  assert.equal(
    sql(
      `begin;${adminClaims}select semester_number from finance.preview_charge_generation('${repeatVersionId}','ca410000-0000-4000-8000-000000000001',null) where student_record_id='ca500000-0000-4000-8000-000000000004';commit;`,
    ),
    "2",
  );
  assert.equal(
    sql(
      `select count(*) from finance.financial_events where event_type in ('CHARGE_GENERATION_BATCH_CREATED','CHARGE_GENERATED','CHARGE_GENERATION_COMPLETED') and details->>'batchId'='${batchId}'`,
    ),
    "4",
  );
});
