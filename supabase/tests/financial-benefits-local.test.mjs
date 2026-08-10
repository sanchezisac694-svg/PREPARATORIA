import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  "-At",
];

function runSql(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && line !== "ROLLBACK" && line !== "COMMIT")
    .at(-1);
}

test("beneficios financieros: beca, descuento, condonacion, reversal e historial", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aba10000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','benefits-local-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aba10000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','benefits-local-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aba10000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','benefits-local-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('aba11000-0000-4000-8000-000000000001','ACTIVE'),
('aba11000-0000-4000-8000-000000000002','ACTIVE'),
('aba11000-0000-4000-8000-000000000003','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('aba12000-0000-4000-8000-000000000001','aba11000-0000-4000-8000-000000000001','aba10000-0000-4000-8000-000000000001','ACTIVE',1),
('aba12000-0000-4000-8000-000000000002','aba11000-0000-4000-8000-000000000002','aba10000-0000-4000-8000-000000000002','ACTIVE',1),
('aba12000-0000-4000-8000-000000000003','aba11000-0000-4000-8000-000000000003','aba10000-0000-4000-8000-000000000003','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('aba12000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('aba12000-0000-4000-8000-000000000002','SUPERADMIN'),
('aba12000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
('aba13000-0000-4000-8000-000000000001','FBL_CYCLE','Cycle local','ACTIVE','2099-01-01','2099-12-31','aba12000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('aba13100-0000-4000-8000-000000000001','aba13000-0000-4000-8000-000000000001','FBL_P1','Periodo local',1,'2099-01-01','2099-06-30','ACTIVE','aba12000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values
('aba13200-0000-4000-8000-000000000001','FBL_PLAN','Plan local','V1','ACTIVE','2099-01-01','aba12000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values
('aba13300-0000-4000-8000-000000000001','FBL_GEN','Generacion local','aba13000-0000-4000-8000-000000000001','aba13200-0000-4000-8000-000000000001','ACTIVE','aba12000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id) values
('aba13400-0000-4000-8000-000000000001','aba13100-0000-4000-8000-000000000001','aba13200-0000-4000-8000-000000000001',1,'FBL_G1','Grupo local','ACTIVE',20,'aba12000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id) values
('aba13500-0000-4000-8000-000000000001','aba11000-0000-4000-8000-000000000003','aba12000-0000-4000-8000-000000000003','aba13200-0000-4000-8000-000000000001','aba13300-0000-4000-8000-000000000001','FBL_ALU','ACTIVE',1,'aba12000-0000-4000-8000-000000000001','aba13100-0000-4000-8000-000000000001','aba13100-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint) values
('aba13600-0000-4000-8000-000000000001','aba13500-0000-4000-8000-000000000001','aba13100-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','aba12000-0000-4000-8000-000000000001','FBL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id) values
('aba13700-0000-4000-8000-000000000001','aba13500-0000-4000-8000-000000000001','aba13600-0000-4000-8000-000000000001','aba13100-0000-4000-8000-000000000001','aba13200-0000-4000-8000-000000000001',1,'aba13400-0000-4000-8000-000000000001','ACTIVE','FBL_ENR','aba12000-0000-4000-8000-000000000001');
select * from finance.open_student_account('aba13500-0000-4000-8000-000000000001','FBL_ACC',null);
select * from finance.create_charge_concept('FBL_TUITION','Colegiatura local','Sin datos reales','TUITION','FBL_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FBL_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='aba13500-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='FBL_TUITION'),null,'aba13100-0000-4000-8000-000000000001','aba13700-0000-4000-8000-000000000001','Cargo local',1000.00,'2099-02-01','MANUAL','FBL-CHARGE','FBL_CHARGE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FBL_CHARGE'),'FBL_POST',null);
select * from finance.create_scholarship_program('FBL_SCH','Beca local','PERCENTAGE',70.00,null,700.00,'2099-01-01','2099-12-31','FBL_PROGRAM_CREATE',null);
select * from finance.submit_scholarship_program((select id from finance.scholarship_programs where code='FBL_SCH'),'FBL_PROGRAM_SUBMIT',null);
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='FBL_SCH'),'FBL_PROGRAM_APPROVE',null);
select * from finance.activate_scholarship_program((select id from finance.scholarship_programs where code='FBL_SCH'),'FBL_PROGRAM_ACTIVATE',null);
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='FBL_SCH'),'aba13500-0000-4000-8000-000000000001',(select id from finance.student_accounts where student_record_id='aba13500-0000-4000-8000-000000000001'),'aba13100-0000-4000-8000-000000000001',null,null,700.00,'2099-01-01','2099-12-31','PENDING_INSTITUTIONAL_VALIDATION','FBL_ASSIGN',null);
select * from finance.submit_student_scholarship((select id from finance.student_scholarships where created_by_account_id='aba12000-0000-4000-8000-000000000001'),'FBL_SUBMIT',null);
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='aba12000-0000-4000-8000-000000000001'),'FBL_APPROVE',null);
select * from finance.activate_student_scholarship((select id from finance.student_scholarships where created_by_account_id='aba12000-0000-4000-8000-000000000001'),'FBL_ACTIVATE',null);
select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id='aba12000-0000-4000-8000-000000000001'),(select id from finance.student_charges where idempotency_key='FBL_CHARGE'),'FBL_APPLY',null);
select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FBL_CHARGE'),100.00,'Descuento local','FBL_DISCOUNT',null);
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='FBL_CHARGE'),50.00,'Waiver local','FBL_WAIVER_CREATE',null);
select set_config('request.jwt.claims','{"sub":"aba10000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FBL_WAIVER_CREATE'),'FBL_WAIVER_APPROVE',null);
select * from finance.apply_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FBL_WAIVER_CREATE'),'FBL_WAIVER_APPLY',null);
select * from finance.reverse_financial_benefit((select id from finance.charge_adjustments where idempotency_key='FBL_WAIVER_CREATE'),'PAYMENT_REVERSAL','Reversal local','FBL_WAIVER_REVERSE',null);
select (select original_amount::text from finance.student_charges where idempotency_key='FBL_CHARGE')
  || '|' || (select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='FBL_CHARGE'))::text)
  || '|' || (select count(*)::text from finance.scholarship_applications)
  || '|' || (select count(*)::text from finance.financial_events where idempotency_key like 'FBL_%');
rollback;
`);

  const [originalAmount, balance, scholarshipLinks, eventCount] = output.split("|");
  assert.equal(originalAmount, "1000.00");
  assert.equal(balance, "250.00");
  assert.equal(scholarshipLinks, "1");
  assert.ok(Number(eventCount) >= 8);
});
