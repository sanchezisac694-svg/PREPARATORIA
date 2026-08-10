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

test("convenios: snapshot, aprobacion, pago real, reconciliacion y cancelacion", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','aca10000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','agreement-local-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aca10000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','agreement-local-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','aca10000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','agreement-local-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('aca11000-0000-4000-8000-000000000001','ACTIVE'),
('aca11000-0000-4000-8000-000000000002','ACTIVE'),
('aca11000-0000-4000-8000-000000000003','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('aca12000-0000-4000-8000-000000000001','aca11000-0000-4000-8000-000000000001','aca10000-0000-4000-8000-000000000001','ACTIVE',1),
('aca12000-0000-4000-8000-000000000002','aca11000-0000-4000-8000-000000000002','aca10000-0000-4000-8000-000000000002','ACTIVE',1),
('aca12000-0000-4000-8000-000000000003','aca11000-0000-4000-8000-000000000003','aca10000-0000-4000-8000-000000000003','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('aca12000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('aca12000-0000-4000-8000-000000000002','SUPERADMIN'),
('aca12000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"aca10000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
('aca13000-0000-4000-8000-000000000001','PAL_CYCLE','Cycle local agreements','ACTIVE','2099-01-01','2099-12-31','aca12000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('aca13100-0000-4000-8000-000000000001','aca13000-0000-4000-8000-000000000001','PAL_P1','Periodo local agreements',1,'2099-01-01','2099-06-30','ACTIVE','aca12000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values
('aca13200-0000-4000-8000-000000000001','PAL_PLAN','Plan local agreements','V1','ACTIVE','2099-01-01','aca12000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values
('aca13300-0000-4000-8000-000000000001','PAL_GEN','Generacion local agreements','aca13000-0000-4000-8000-000000000001','aca13200-0000-4000-8000-000000000001','ACTIVE','aca12000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id) values
('aca13400-0000-4000-8000-000000000001','aca13100-0000-4000-8000-000000000001','aca13200-0000-4000-8000-000000000001',1,'PAL_G1','Grupo local agreements','ACTIVE',20,'aca12000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id) values
('aca13500-0000-4000-8000-000000000001','aca11000-0000-4000-8000-000000000003','aca12000-0000-4000-8000-000000000003','aca13200-0000-4000-8000-000000000001','aca13300-0000-4000-8000-000000000001','PAL_ALU','ACTIVE',1,'aca12000-0000-4000-8000-000000000001','aca13100-0000-4000-8000-000000000001','aca13100-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint) values
('aca13600-0000-4000-8000-000000000001','aca13500-0000-4000-8000-000000000001','aca13100-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','aca12000-0000-4000-8000-000000000001','PAL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id) values
('aca13700-0000-4000-8000-000000000001','aca13500-0000-4000-8000-000000000001','aca13600-0000-4000-8000-000000000001','aca13100-0000-4000-8000-000000000001','aca13200-0000-4000-8000-000000000001',1,'aca13400-0000-4000-8000-000000000001','ACTIVE','PAL_ENR','aca12000-0000-4000-8000-000000000001');
select * from finance.open_student_account('aca13500-0000-4000-8000-000000000001','PAL_ACC',null);
select * from finance.create_charge_concept('PAL_TUITION','Colegiatura local agreements','Sin datos reales','TUITION','PAL_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='PAL_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='aca13500-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='PAL_TUITION'),null,'aca13100-0000-4000-8000-000000000001','aca13700-0000-4000-8000-000000000001','Cargo local agreements',1200.00,'2099-02-01','MANUAL','PAL-CHARGE','PAL_CHARGE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='PAL_CHARGE'),'PAL_POST',null);
select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id='aca13500-0000-4000-8000-000000000001'),null,1200.00,3,'2026-01-20','PENDING_INSTITUTIONAL_VALIDATION',array['2026-01-31'::date,'2026-02-28'::date,'2026-03-31'::date],array[400.00,400.00,400.00],'Convenio local','PAL_CREATE',null);
select set_config('request.jwt.claims','{"sub":"aca10000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.approve_payment_agreement((select id from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001'),'PAL_APPROVE',null);
select * from finance.register_payment((select id from finance.student_accounts where student_record_id='aca13500-0000-4000-8000-000000000001'),400.00,'CASH','PAL-PAY-1','2026-01-31 09:00+00','PAL_PAY_REG',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='PAL_PAY_REG'),'PAL_PAY_CONFIRM',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='PAL_PAY_REG'),(select id from finance.student_charges where idempotency_key='PAL_CHARGE'),400.00,'PAL_PAY_ALLOC',null);
insert into finance.payment_agreement_allocations(installment_id,payment_allocation_id,amount_applied_to_installment) values
((select id from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001') and installment_number=1),(select id from finance.payment_allocations where idempotency_key='PAL_PAY_ALLOC'),400.00);
select * from public.reconcile_payment_agreement_installment((select id from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001') and installment_number=1),'PAL_RECONCILE',null);
select * from public.cancel_payment_agreement((select id from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001'),'Cierre local','PAL_CANCEL',null);
select (select original_outstanding_snapshot::text from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001')
  || '|' || (select status::text from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001')
  || '|' || (select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='PAL_CHARGE'))::text)
  || '|' || (select status::text from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='aca12000-0000-4000-8000-000000000001') and installment_number=1);
rollback;
`);

  const [snapshot, status, balance, installmentStatus] = output.split("|");
  assert.equal(snapshot, "1200.00");
  assert.equal(status, "CANCELLED");
  assert.equal(balance, "800.00");
  assert.equal(installmentStatus, "FULFILLED");
});
