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
  return result.stdout.trim();
}

test("flujo financiero local: cuenta, cargo, pago, recibo, idempotencia y tutor fail-closed", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f5100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','finance-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f5100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','finance-student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f5100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','finance-student-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f5100000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','finance-guardian@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('f5200000-0000-4000-8000-000000000001','ACTIVE'),
('f5200000-0000-4000-8000-000000000002','ACTIVE'),
('f5200000-0000-4000-8000-000000000003','ACTIVE'),
('f5200000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('f5300000-0000-4000-8000-000000000001','f5200000-0000-4000-8000-000000000001','f5100000-0000-4000-8000-000000000001','ACTIVE',1),
('f5300000-0000-4000-8000-000000000002','f5200000-0000-4000-8000-000000000002','f5100000-0000-4000-8000-000000000002','ACTIVE',1),
('f5300000-0000-4000-8000-000000000003','f5200000-0000-4000-8000-000000000003','f5100000-0000-4000-8000-000000000003','ACTIVE',1),
('f5300000-0000-4000-8000-000000000004','f5200000-0000-4000-8000-000000000004','f5100000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('f5300000-0000-4000-8000-000000000001','SUPERADMIN'),
('f5300000-0000-4000-8000-000000000002','ALUMNO'),
('f5300000-0000-4000-8000-000000000003','ALUMNO'),
('f5300000-0000-4000-8000-000000000004','TUTOR')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"f5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('f5400000-0000-4000-8000-000000000001','FIN_CYCLE','Cycle finance','ACTIVE','2099-01-01','2099-12-31','f5300000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('f5410000-0000-4000-8000-000000000001','f5400000-0000-4000-8000-000000000001','FIN_P1','Periodo finance',1,'2099-01-01','2099-06-30','ACTIVE','f5300000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('f5420000-0000-4000-8000-000000000001','FIN_PLAN','Plan finance','V1','ACTIVE','2099-01-01','f5300000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('f5430000-0000-4000-8000-000000000001','FIN_GEN','Generación finance','f5400000-0000-4000-8000-000000000001','f5420000-0000-4000-8000-000000000001','ACTIVE','f5300000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('f5440000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001','f5420000-0000-4000-8000-000000000001',1,'FIN_G1','Grupo finance','ACTIVE',20,'f5300000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('f5450000-0000-4000-8000-000000000001','f5200000-0000-4000-8000-000000000002','f5300000-0000-4000-8000-000000000002','f5420000-0000-4000-8000-000000000001','f5430000-0000-4000-8000-000000000001','FIN_ALU_A','ACTIVE',1,'f5300000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001'),
('f5450000-0000-4000-8000-000000000002','f5200000-0000-4000-8000-000000000003','f5300000-0000-4000-8000-000000000003','f5420000-0000-4000-8000-000000000001','f5430000-0000-4000-8000-000000000001','FIN_ALU_B','ACTIVE',1,'f5300000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('f5460000-0000-4000-8000-000000000001','f5450000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','f5300000-0000-4000-8000-000000000001','FIN_ENROLL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('f5470000-0000-4000-8000-000000000001','f5450000-0000-4000-8000-000000000001','f5460000-0000-4000-8000-000000000001','f5410000-0000-4000-8000-000000000001','f5420000-0000-4000-8000-000000000001',1,'f5440000-0000-4000-8000-000000000001','ACTIVE','FIN_ENR_001','f5300000-0000-4000-8000-000000000001');

select * from finance.open_student_account('f5450000-0000-4000-8000-000000000001','FIN_ACC_OPEN',null);
select * from finance.create_charge_concept('FIN_INSCRIPTION','Inscripción técnica','Sin datos reales','ENROLLMENT','FIN_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FIN_INSCRIPTION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate(
  (select id from finance.charge_concepts where code='FIN_INSCRIPTION'),
  'f5410000-0000-4000-8000-000000000001',
  'f5420000-0000-4000-8000-000000000001',
  1::smallint,
  null::uuid,
  1000.00,
  statement_timestamp(),
  null::timestamptz,
  'FIN_RATE_CREATE',
  null::uuid
);
select * from finance.approve_charge_rate((select id from finance.charge_rates where created_by_account_id='f5300000-0000-4000-8000-000000000001'),'FIN_RATE_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where created_by_account_id='f5300000-0000-4000-8000-000000000001'),'FIN_RATE_ACTIVATE',null);
select * from finance.create_student_charge(
  (select id from finance.student_accounts where student_record_id='f5450000-0000-4000-8000-000000000001'),
  (select id from finance.charge_concepts where code='FIN_INSCRIPTION'),
  (select id from finance.charge_rates where created_by_account_id='f5300000-0000-4000-8000-000000000001'),
  'f5410000-0000-4000-8000-000000000001',
  'f5470000-0000-4000-8000-000000000001',
  'Cargo técnico',
  1000.00,
  '2099-02-01',
  'MANUAL',
  'REF-0001-1234',
  'FIN_CHARGE_CREATE',
  null
);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FIN_CHARGE_CREATE'),'FIN_CHARGE_POST',null);
select * from finance.register_payment((select id from finance.student_accounts where student_record_id='f5450000-0000-4000-8000-000000000001'),500.00,'CASH','ABC1234','2099-01-15 12:00+00','FIN_PAY_REG',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='FIN_PAY_REG'),'FIN_PAY_CONFIRM',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='FIN_PAY_REG'),(select id from finance.student_charges where idempotency_key='FIN_CHARGE_CREATE'),500.00,'FIN_ALLOC',null);
select * from finance.register_payment((select id from finance.student_accounts where student_record_id='f5450000-0000-4000-8000-000000000001'),500.00,'CASH','ABC1234','2099-01-15 12:00+00','FIN_PAY_REG',null);

set local session_replication_role=replica;
insert into academic.guardian_student_link_requests(id,guardian_account_id,student_record_id,relationship_type,request_source,status,review_status,reason_code,requested_by_account_id,idempotency_key,request_fingerprint,requested_at,reviewed_at,approved_at,created_at,updated_at)
values('f5480000-0000-4000-8000-000000000001','f5300000-0000-4000-8000-000000000004','f5450000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','APPROVED','VERIFIED','MANUAL_REVIEW_REQUIRED','f5300000-0000-4000-8000-000000000001','FIN_LINK_REQ',repeat('b',64),now(),now(),now(),now(),now());
insert into academic.guardian_student_links(id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,valid_from,valid_until,activated_by_account_id,activated_at,created_at,updated_at)
values('f5490000-0000-4000-8000-000000000001','f5300000-0000-4000-8000-000000000004','f5450000-0000-4000-8000-000000000001','f5480000-0000-4000-8000-000000000001','MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,now(),null,'f5300000-0000-4000-8000-000000000001',now(),now(),now());
set local session_replication_role=origin;

select set_config('request.jwt.claims','{"sub":"f5100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select public.get_my_student_financial_summary()::text;
select public.get_my_student_account_statement('f5410000-0000-4000-8000-000000000001')::text;
select public.get_my_student_payments('f5410000-0000-4000-8000-000000000001')::text;
select public.get_my_student_receipt((select id from finance.payments where idempotency_key='FIN_PAY_REG'))::text;

select set_config('request.jwt.claims','{"sub":"f5100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin
  perform public.get_my_student_payment((select id from finance.payments where idempotency_key='FIN_PAY_REG'));
  raise exception 'foreign student accepted';
exception when others then
  if sqlerrm <> 'FINANCE_ACCESS_DENIED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"f5100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_version":1}',true);
select public.get_my_guardian_student_financial_summary('f5490000-0000-4000-8000-000000000001')::text;
select 'LOCAL_STUDENT_FINANCE_OK';
rollback;
  `);

  assert.match(output, /"totalBalance": "500\.00"/);
  assert.match(output, /REC-\d{4}-\d{6}/);
  assert.match(output, /No constituye CFDI ni comprobante fiscal/);
  assert.match(output, /"paymentReferenceMasked": "\*+1234"/);
  assert.match(output, /"error": "FINANCE_SCOPE_DENIED"/);
  assert.match(output, /LOCAL_STUDENT_FINANCE_OK/);
  assert.doesNotMatch(
    output,
    /account_id|person_id|auth_user_id|student_record_id|CFDI real|Pagar ahora/i,
  );
});
