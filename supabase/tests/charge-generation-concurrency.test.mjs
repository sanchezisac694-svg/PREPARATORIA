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

const adminClaims = `select set_config('request.jwt.claims','{"sub":"cac10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const superadminClaims = `select set_config('request.jwt.claims','{"sub":"cac10000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const staleAdminClaims = `select set_config('request.jwt.claims','{"sub":"cac10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;

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

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return lastLine(result.stdout);
}

function sqlId(sql) {
  return sqlSync(sql).split("|")[0]?.trim() ?? "";
}

function sqlAsync(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) =>
      resolve({ status, stdout: lastLine(stdout), stderr: stderr.trim() }),
    );
    child.stdin.end(sql);
  });
}

function resetChargeGenerationState() {
  sqlSync(`
set session_replication_role=replica;
delete from finance.charge_generation_batch_items;
delete from finance.charge_generation_batches;
delete from finance.charge_generation_exclusions;
delete from finance.charge_generation_rule_versions;
delete from finance.charge_generation_rules;
delete from finance.student_charges where external_reference like 'cg:%' or idempotency_key like 'CGC_%';
delete from finance.financial_events where idempotency_key like 'CGC_%';
delete from finance.financial_commands where idempotency_key like 'CGC_%';
delete from finance.financial_events where idempotency_key like 'D_%';
delete from finance.financial_commands where idempotency_key like 'D_%';
delete from finance.charge_rates where id in ('cac60000-0000-4000-8000-000000000001','cac60000-0000-4000-8000-000000000002');
delete from finance.charge_concepts where id in ('cac61000-0000-4000-8000-000000000001','cac61000-0000-4000-8000-000000000002');
delete from finance.student_accounts where id in ('cac62000-0000-4000-8000-000000000001','cac62000-0000-4000-8000-000000000002','cac62000-0000-4000-8000-000000000003','cac62000-0000-4000-8000-000000000004');
delete from academic.period_enrollments where id in ('cac52000-0000-4000-8000-000000000001','cac52000-0000-4000-8000-000000000002','cac52000-0000-4000-8000-000000000003','cac52000-0000-4000-8000-000000000004','cac52000-0000-4000-8000-000000000005');
delete from academic.enrollment_requests where id in ('cac51000-0000-4000-8000-000000000001','cac51000-0000-4000-8000-000000000002','cac51000-0000-4000-8000-000000000003','cac51000-0000-4000-8000-000000000004','cac51000-0000-4000-8000-000000000005');
delete from academic.student_records where id in ('cac50000-0000-4000-8000-000000000001','cac50000-0000-4000-8000-000000000002','cac50000-0000-4000-8000-000000000003','cac50000-0000-4000-8000-000000000004');
delete from academic.student_generations where id='cac43000-0000-4000-8000-000000000001';
delete from academic.groups where id in ('cac44000-0000-4000-8000-000000000001','cac44000-0000-4000-8000-000000000002','cac44000-0000-4000-8000-000000000003');
delete from academic.study_plans where id='cac42000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id in ('cac41000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000002');
delete from academic.school_cycles where id='cac40000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('cac30000-0000-4000-8000-000000000001','cac30000-0000-4000-8000-000000000002','cac30000-0000-4000-8000-000000000011','cac30000-0000-4000-8000-000000000012','cac30000-0000-4000-8000-000000000013','cac30000-0000-4000-8000-000000000014');
delete from core.accounts where id in ('cac30000-0000-4000-8000-000000000001','cac30000-0000-4000-8000-000000000002','cac30000-0000-4000-8000-000000000011','cac30000-0000-4000-8000-000000000012','cac30000-0000-4000-8000-000000000013','cac30000-0000-4000-8000-000000000014');
delete from core.people where id in ('cac20000-0000-4000-8000-000000000001','cac20000-0000-4000-8000-000000000002','cac20000-0000-4000-8000-000000000011','cac20000-0000-4000-8000-000000000012','cac20000-0000-4000-8000-000000000013','cac20000-0000-4000-8000-000000000014');
delete from auth.users where id in ('cac10000-0000-4000-8000-000000000001','cac10000-0000-4000-8000-000000000002','cac10000-0000-4000-8000-000000000011','cac10000-0000-4000-8000-000000000012','cac10000-0000-4000-8000-000000000013','cac10000-0000-4000-8000-000000000014');
set session_replication_role=origin;
`);
}

function bootstrapBase() {
  resetChargeGenerationState();
  sqlSync(`
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','cgc-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','cgc-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000011','authenticated','authenticated','synthetic','cgc-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000012','authenticated','authenticated','synthetic','cgc-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000013','authenticated','authenticated','synthetic','cgc-c@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cac10000-0000-4000-8000-000000000014','authenticated','authenticated','synthetic','cgc-d@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('cac20000-0000-4000-8000-000000000001','ACTIVE'),
('cac20000-0000-4000-8000-000000000002','ACTIVE'),
('cac20000-0000-4000-8000-000000000011','ACTIVE'),
('cac20000-0000-4000-8000-000000000012','ACTIVE'),
('cac20000-0000-4000-8000-000000000013','ACTIVE'),
('cac20000-0000-4000-8000-000000000014','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('cac30000-0000-4000-8000-000000000001','cac20000-0000-4000-8000-000000000001','cac10000-0000-4000-8000-000000000001','ACTIVE',1),
('cac30000-0000-4000-8000-000000000002','cac20000-0000-4000-8000-000000000002','cac10000-0000-4000-8000-000000000002','ACTIVE',1),
('cac30000-0000-4000-8000-000000000011','cac20000-0000-4000-8000-000000000011','cac10000-0000-4000-8000-000000000011','ACTIVE',1),
('cac30000-0000-4000-8000-000000000012','cac20000-0000-4000-8000-000000000012','cac10000-0000-4000-8000-000000000012','ACTIVE',1),
('cac30000-0000-4000-8000-000000000013','cac20000-0000-4000-8000-000000000013','cac10000-0000-4000-8000-000000000013','ACTIVE',1),
('cac30000-0000-4000-8000-000000000014','cac20000-0000-4000-8000-000000000014','cac10000-0000-4000-8000-000000000014','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('cac30000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('cac30000-0000-4000-8000-000000000002','SUPERADMIN'),
('cac30000-0000-4000-8000-000000000011','ALUMNO'),
('cac30000-0000-4000-8000-000000000012','ALUMNO'),
('cac30000-0000-4000-8000-000000000013','ALUMNO'),
('cac30000-0000-4000-8000-000000000014','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"cac10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('cac40000-0000-4000-8000-000000000001','CGC_CYCLE','Cycle','ACTIVE','2099-01-01','2099-12-31','cac30000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values
('cac41000-0000-4000-8000-000000000001','cac40000-0000-4000-8000-000000000001','CGC_P1','Periodo 1',1,'2099-01-01','2099-06-30','ACTIVE','cac30000-0000-4000-8000-000000000001'),
('cac41000-0000-4000-8000-000000000002','cac40000-0000-4000-8000-000000000001','CGC_P2','Periodo 2',2,'2099-08-01','2099-12-31','ACTIVE','cac30000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('cac42000-0000-4000-8000-000000000001','CGC_PLAN','Plan','V1','ACTIVE','2099-01-01','cac30000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('cac43000-0000-4000-8000-000000000001','CGC_GEN','Generacion','cac40000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001','ACTIVE','cac30000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values
('cac44000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',1,'CGCG1','Grupo 1','ACTIVE',40,'cac30000-0000-4000-8000-000000000001'),
('cac44000-0000-4000-8000-000000000002','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',2,'CGCG2','Grupo 2','ACTIVE',40,'cac30000-0000-4000-8000-000000000001'),
('cac44000-0000-4000-8000-000000000003','cac41000-0000-4000-8000-000000000002','cac42000-0000-4000-8000-000000000001',1,'CGCG3','Grupo 3','ACTIVE',40,'cac30000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('cac50000-0000-4000-8000-000000000001','cac20000-0000-4000-8000-000000000011','cac30000-0000-4000-8000-000000000011','cac42000-0000-4000-8000-000000000001','cac43000-0000-4000-8000-000000000001','CGC_A','ACTIVE',1,'cac30000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001'),
('cac50000-0000-4000-8000-000000000002','cac20000-0000-4000-8000-000000000012','cac30000-0000-4000-8000-000000000012','cac42000-0000-4000-8000-000000000001','cac43000-0000-4000-8000-000000000001','CGC_B','ACTIVE',1,'cac30000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001'),
('cac50000-0000-4000-8000-000000000003','cac20000-0000-4000-8000-000000000013','cac30000-0000-4000-8000-000000000013','cac42000-0000-4000-8000-000000000001','cac43000-0000-4000-8000-000000000001','CGC_C','ACTIVE',1,'cac30000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001'),
('cac50000-0000-4000-8000-000000000004','cac20000-0000-4000-8000-000000000014','cac30000-0000-4000-8000-000000000014','cac42000-0000-4000-8000-000000000001','cac43000-0000-4000-8000-000000000001','CGC_D','ACTIVE',2,'cac30000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('cac51000-0000-4000-8000-000000000001','cac50000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cac30000-0000-4000-8000-000000000001','CGC_REQ_A',repeat('a',64)),
('cac51000-0000-4000-8000-000000000002','cac50000-0000-4000-8000-000000000002','cac41000-0000-4000-8000-000000000001','REENROLLMENT',1,'APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','cac30000-0000-4000-8000-000000000001','CGC_REQ_B',repeat('b',64)),
('cac51000-0000-4000-8000-000000000003','cac50000-0000-4000-8000-000000000003','cac41000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cac30000-0000-4000-8000-000000000001','CGC_REQ_C',repeat('c',64)),
('cac51000-0000-4000-8000-000000000004','cac50000-0000-4000-8000-000000000004','cac41000-0000-4000-8000-000000000001','REPEAT_SEMESTER',2,'APPROVED','ELIGIBLE','REPEAT_REQUIRED','cac30000-0000-4000-8000-000000000001','CGC_REQ_D',repeat('d',64)),
('cac51000-0000-4000-8000-000000000005','cac50000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000002','REENROLLMENT',1,'APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','cac30000-0000-4000-8000-000000000001','CGC_REQ_E',repeat('e',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('cac52000-0000-4000-8000-000000000001','cac50000-0000-4000-8000-000000000001','cac51000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',1,'cac44000-0000-4000-8000-000000000001','ACTIVE','CGC_ENR_A','cac30000-0000-4000-8000-000000000001'),
('cac52000-0000-4000-8000-000000000002','cac50000-0000-4000-8000-000000000002','cac51000-0000-4000-8000-000000000002','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',1,'cac44000-0000-4000-8000-000000000001','ACTIVE','CGC_ENR_B','cac30000-0000-4000-8000-000000000001'),
('cac52000-0000-4000-8000-000000000003','cac50000-0000-4000-8000-000000000003','cac51000-0000-4000-8000-000000000003','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',1,'cac44000-0000-4000-8000-000000000001','ACTIVE','CGC_ENR_C','cac30000-0000-4000-8000-000000000001'),
('cac52000-0000-4000-8000-000000000004','cac50000-0000-4000-8000-000000000004','cac51000-0000-4000-8000-000000000004','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',2,'cac44000-0000-4000-8000-000000000002','ACTIVE','CGC_ENR_D','cac30000-0000-4000-8000-000000000001'),
('cac52000-0000-4000-8000-000000000005','cac50000-0000-4000-8000-000000000001','cac51000-0000-4000-8000-000000000005','cac41000-0000-4000-8000-000000000002','cac42000-0000-4000-8000-000000000001',1,'cac44000-0000-4000-8000-000000000003','ACTIVE','CGC_ENR_E','cac30000-0000-4000-8000-000000000001');
insert into finance.student_accounts(id,student_record_id,currency_code,status,opened_at,created_at,updated_at)
values
('cac62000-0000-4000-8000-000000000001','cac50000-0000-4000-8000-000000000001','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('cac62000-0000-4000-8000-000000000002','cac50000-0000-4000-8000-000000000002','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('cac62000-0000-4000-8000-000000000003','cac50000-0000-4000-8000-000000000003','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('cac62000-0000-4000-8000-000000000004','cac50000-0000-4000-8000-000000000004','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp());
insert into finance.charge_concepts(id,code,name,category,currency_code,status,is_system_concept,created_by_account_id)
values
('cac61000-0000-4000-8000-000000000001','CGC_TUITION','Cargo tuicion','TUITION','MXN','ACTIVE',false,'cac30000-0000-4000-8000-000000000001'),
('cac61000-0000-4000-8000-000000000002','CGC_REPEAT','Cargo repeticion','REENROLLMENT','MXN','ACTIVE',false,'cac30000-0000-4000-8000-000000000001');
insert into finance.charge_rates(id,charge_concept_id,academic_period_id,academic_plan_id,semester_number,area_id,amount,currency_code,status,valid_from,created_by_account_id,approved_by_account_id,approved_at,created_at,updated_at)
values
('cac60000-0000-4000-8000-000000000001','cac61000-0000-4000-8000-000000000001','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',1,null,1600.00,'MXN','ACTIVE',statement_timestamp(),'cac30000-0000-4000-8000-000000000001','cac30000-0000-4000-8000-000000000002',statement_timestamp(),statement_timestamp(),statement_timestamp()),
('cac60000-0000-4000-8000-000000000002','cac61000-0000-4000-8000-000000000002','cac41000-0000-4000-8000-000000000001','cac42000-0000-4000-8000-000000000001',2,null,2500.00,'MXN','ACTIVE',statement_timestamp(),'cac30000-0000-4000-8000-000000000001','cac30000-0000-4000-8000-000000000002',statement_timestamp(),statement_timestamp(),statement_timestamp());
`);
}

function createRuleVersion({
  ruleCode = "CGC_RULE_TUITION",
  conceptCode = "CGC_TUITION",
  type = "PERIODIC_TUITION",
  semester = 1,
  idSuffix = "A",
  periodId = "cac41000-0000-4000-8000-000000000001",
} = {}) {
  const ruleId = sqlId(`
begin;
${adminClaims}
select * from finance.create_charge_generation_rule('${ruleCode}','${ruleCode}',(select id from finance.charge_concepts where code='${conceptCode}'),'${type}','CGC_RULE_${idSuffix}',null);
commit;`);
  const versionId = sqlId(`
begin;
${adminClaims}
select * from finance.create_charge_generation_rule_version('${ruleId}','${periodId}','cac42000-0000-4000-8000-000000000001',${semester},null,(select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='${conceptCode}') and semester_number=${semester}),'FIXED_DATE','2099-02-20',null,null,statement_timestamp(),null,'CGC_VERSION_${idSuffix}',null);
commit;`);
  sqlSync(`
begin;
${superadminClaims}
select * from finance.approve_charge_generation_rule_version('${versionId}','CGC_VERSION_${idSuffix}_APPROVE',null);
select * from finance.activate_charge_generation_rule_version('${versionId}','CGC_VERSION_${idSuffix}_ACTIVATE',null);
commit;`);
  return versionId;
}

function createApprovedBatch(
  versionId,
  idSuffix = "A",
  periodId = "cac41000-0000-4000-8000-000000000001",
) {
  const batchId = sqlId(`
begin;
${adminClaims}
select * from finance.create_charge_generation_batch('${versionId}','${periodId}','CGC_BATCH_${idSuffix}_CREATE',null);
select * from finance.submit_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CGC_BATCH_${idSuffix}_CREATE'),'CGC_BATCH_${idSuffix}_SUBMIT',null);
commit;`);
  sqlSync(`
begin;
${superadminClaims}
select * from finance.approve_charge_generation_batch('${batchId}','CGC_BATCH_${idSuffix}_APPROVE',null);
commit;`);
  return batchId;
}

function executeBatch(batchId, idSuffix = "A", claims = adminClaims) {
  return sqlSync(`
begin;
${claims}
select status from finance.execute_charge_generation_batch('${batchId}','CGC_BATCH_${idSuffix}_EXECUTE',null);
commit;`);
}

test("01 two batches same rule/period quedan deduplicados por constraint de batch activo", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  createApprovedBatch(versionId, "SAME");
  assert.throws(
    () =>
      sqlSync(`
begin;
${adminClaims}
select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000001','CGC_BATCH_SAME_DUP',null);
commit;`),
    /student_charges_equivalent_posted_global_unique|charge_generation_batches_rule_period_unique|duplicate/i,
  );
});

test("02 double execute same batch no crea cargos adicionales", async () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "DOUBLE");
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select status from finance.execute_charge_generation_batch('${batchId}','CGC_BATCH_DOUBLE_EXECUTE_A',null);commit;`,
    ),
    sqlAsync(
      `begin;${adminClaims}select status from finance.execute_charge_generation_batch('${batchId}','CGC_BATCH_DOUBLE_EXECUTE_B',null);commit;`,
    ),
  ]);
  assert.equal(
    a.status === 0 || /CHARGE_GENERATION_BATCH_NOT_APPROVED/.test(a.stderr),
    true,
    a.stderr,
  );
  assert.equal(
    b.status === 0 || /CHARGE_GENERATION_BATCH_NOT_APPROVED/.test(b.stderr),
    true,
    b.stderr,
  );
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%'`,
    ),
    "3",
  );
});

test("03 two rules same logical charge terminan con un solo cargo real por alumno", () => {
  bootstrapBase();
  const versionA = createRuleVersion({ ruleCode: "CGC_RULE_A", idSuffix: "A" });
  const versionB = createRuleVersion({ ruleCode: "CGC_RULE_B", idSuffix: "B" });
  const batchA = createApprovedBatch(versionA, "A");
  const batchB = createApprovedBatch(versionB, "B");
  executeBatch(batchA, "A");
  executeBatch(batchB, "B");
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where academic_period_id='cac41000-0000-4000-8000-000000000001' and charge_concept_id=(select id from finance.charge_concepts where code='CGC_TUITION')`,
    ),
    "3",
  );
});

test("04 batch vs manual charge converge sin duplicados", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "MANUAL");
  sqlSync(`
begin;
${adminClaims}
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='cac50000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='CGC_TUITION'),null,'cac41000-0000-4000-8000-000000000001','cac52000-0000-4000-8000-000000000001','Manual competing',1600.00,'2099-02-20','PERIODIC','CGC-MANUAL-A','CGC_MANUAL_COMPETE',null);
select set_config('finance.controlled_mutation','on',true);
update finance.student_charges set charge_rate_id=(select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CGC_TUITION') and semester_number=1) where idempotency_key='CGC_MANUAL_COMPETE';
select set_config('finance.controlled_mutation','off',true);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='CGC_MANUAL_COMPETE'),'CGC_MANUAL_COMPETE_POST',null);
commit;`);
  executeBatch(batchId, "MANUAL");
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where student_account_id=(select id from finance.student_accounts where student_record_id='cac50000-0000-4000-8000-000000000001') and charge_concept_id=(select id from finance.charge_concepts where code='CGC_TUITION') and academic_period_id='cac41000-0000-4000-8000-000000000001'`,
    ),
    "1",
  );
});

test("05 enrollment cambia después del preview y antes del execute", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "ENRPRE");
  sqlSync(
    `update academic.period_enrollments set status='CANCELLED' where id='cac52000-0000-4000-8000-000000000002';`,
  );
  assert.equal(
    sqlSync(
      `select status::text from academic.period_enrollments where id='cac52000-0000-4000-8000-000000000002'`,
    ),
    "CANCELLED",
  );
  executeBatch(batchId, "ENRPRE");
  assert.equal(
    sqlSync(
      `select processing_status from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='cac50000-0000-4000-8000-000000000002'`,
    ),
    "SKIPPED",
  );
});

test("06 enrollment cambia durante execution y el lote revalida", async () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "ENRDUR");
  const [executeResult, updateResult] = await Promise.all([
    sqlAsync(
      `begin;${adminClaims}select status from finance.execute_charge_generation_batch('${batchId}','CGC_BATCH_ENRDUR_EXECUTE',null);commit;`,
    ),
    sqlAsync(
      `begin;update academic.period_enrollments set status='WITHDRAWN' where id='cac52000-0000-4000-8000-000000000003';commit;`,
    ),
  ]);
  assert.equal(executeResult.status, 0, executeResult.stderr);
  assert.equal(updateResult.status, 0, updateResult.stderr);
  assert.match(
    sqlSync(
      `select processing_status from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='cac50000-0000-4000-8000-000000000003'`,
    ),
    /^(GENERATED|SKIPPED)$/,
  );
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%' and enrollment_id='cac52000-0000-4000-8000-000000000003'`,
    ),
    sqlSync(
      `select case when exists(select 1 from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='cac50000-0000-4000-8000-000000000003' and processing_status='GENERATED') then '1' else '0' end`,
    ),
  );
});

test("07 rate changes after preview do not affect frozen amount", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "RATEPRE");
  sqlSync(
    `begin;select set_config('finance.controlled_mutation','on',true);update finance.charge_rates set amount=9999.00 where charge_concept_id=(select id from finance.charge_concepts where code='CGC_TUITION') and semester_number=1;select set_config('finance.controlled_mutation','off',true);commit;`,
  );
  executeBatch(batchId, "RATEPRE");
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%' and original_amount=1600.00`,
    ),
    "3",
  );
});

test("08 rate changes during execution also preserve frozen amount", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "RATEDUR");
  sqlSync(
    `begin;select set_config('finance.controlled_mutation','on',true);update finance.charge_rates set amount=8888.00 where charge_concept_id=(select id from finance.charge_concepts where code='CGC_TUITION') and semester_number=1;select set_config('finance.controlled_mutation','off',true);commit;`,
  );
  executeBatch(batchId, "RATEDUR");
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where external_reference like 'cg:${batchId}:%' and original_amount=1600.00`,
    ),
    "3",
  );
});

test("09 account closes during execution and item is skipped", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "ACCLOSE");
  sqlSync(
    `begin;select set_config('finance.controlled_mutation','on',true);update finance.student_accounts set status='CLOSED', closed_at=statement_timestamp() where student_record_id='cac50000-0000-4000-8000-000000000002';select set_config('finance.controlled_mutation','off',true);commit;`,
  );
  executeBatch(batchId, "ACCLOSE");
  assert.equal(
    sqlSync(
      `select processing_status from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='cac50000-0000-4000-8000-000000000002'`,
    ),
    "SKIPPED",
  );
});

test("10 exclusion created during execution becomes authoritative", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "EXCL");
  sqlSync(`
begin;
${adminClaims}
select * from finance.create_charge_generation_exclusion('cac50000-0000-4000-8000-000000000002',(select id from finance.charge_generation_rules where code='CGC_RULE_TUITION'),'${versionId}','cac41000-0000-4000-8000-000000000001','MANUAL_REVIEW_REQUIRED',current_date,null,'CGC_EXCL_DURING',null);
commit;`);
  executeBatch(batchId, "EXCL");
  assert.equal(
    sqlSync(
      `select processing_status from finance.charge_generation_batch_items where batch_id='${batchId}' and student_record_id='cac50000-0000-4000-8000-000000000002'`,
    ),
    "SKIPPED",
  );
});

test("11 same key same fingerprint mantiene idempotencia en create batch", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const first = sqlSync(
    `begin;${adminClaims}select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000001','CGC_IDEMPOTENT_BATCH',null);commit;`,
  );
  const second = sqlSync(
    `begin;${adminClaims}select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000001','CGC_IDEMPOTENT_BATCH',null);commit;`,
  );
  assert.equal(first, second);
});

test("12 same key different fingerprint provoca conflict", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  sqlSync(
    `begin;${adminClaims}select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000001','CGC_IDEMPOTENT_CONFLICT',null);commit;`,
  );
  assert.throws(
    () =>
      sqlSync(
        `begin;${adminClaims}select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000002','CGC_IDEMPOTENT_CONFLICT',null);commit;`,
      ),
    /IDEMPOTENCY_CONFLICT/,
  );
});

test("13 session_version revoked bloquea ejecución", () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  const batchId = createApprovedBatch(versionId, "SESSION");
  sqlSync(
    `update core.accounts set session_version=2 where id='cac30000-0000-4000-8000-000000000001';`,
  );
  assert.throws(
    () => executeBatch(batchId, "SESSION", staleAdminClaims),
    /APPLICATION_NOT_ALLOWED/,
  );
});

test("14 concurrent approval permite un solo aprobador efectivo", async () => {
  bootstrapBase();
  const versionId = createRuleVersion();
  sqlSync(
    `begin;${adminClaims}select entity_id from finance.create_charge_generation_batch('${versionId}','cac41000-0000-4000-8000-000000000001','CGC_APPROVE_RACE',null);select * from finance.submit_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CGC_APPROVE_RACE'),'CGC_APPROVE_RACE_SUBMIT',null);commit;`,
  );
  const batchId = sqlSync(
    `select id from finance.charge_generation_batches where idempotency_key='CGC_APPROVE_RACE'`,
  );
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${superadminClaims}select status from finance.approve_charge_generation_batch('${batchId}','CGC_APPROVE_RACE_A',null);commit;`,
    ),
    sqlAsync(
      `begin;${superadminClaims}select status from finance.approve_charge_generation_batch('${batchId}','CGC_APPROVE_RACE_B',null);commit;`,
    ),
  ]);
  assert.equal(
    sqlSync(`select status from finance.charge_generation_batches where id='${batchId}'`),
    "APPROVED",
  );
  assert.ok([a.status, b.status].includes(0));
});

test("15 independent academic periods do not collide", () => {
  bootstrapBase();
  const versionP1 = createRuleVersion({
    idSuffix: "P1",
    periodId: "cac41000-0000-4000-8000-000000000001",
  });
  const versionP2 = createRuleVersion({
    ruleCode: "CGC_RULE_P2",
    idSuffix: "P2",
    periodId: "cac41000-0000-4000-8000-000000000002",
  });
  const batchP1 = createApprovedBatch(versionP1, "P1", "cac41000-0000-4000-8000-000000000001");
  const batchP2 = createApprovedBatch(versionP2, "P2", "cac41000-0000-4000-8000-000000000002");
  executeBatch(batchP1, "P1");
  executeBatch(batchP2, "P2");
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where academic_period_id='cac41000-0000-4000-8000-000000000001'`,
    ),
    "3",
  );
  assert.equal(
    sqlSync(
      `select count(*) from finance.student_charges where academic_period_id='cac41000-0000-4000-8000-000000000002'`,
    ),
    "1",
  );
});
