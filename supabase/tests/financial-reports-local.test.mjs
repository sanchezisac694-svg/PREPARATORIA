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

function parseLastJsonLine(output) {
  const jsonLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("{") || line.startsWith("["))
    .at(-1);

  assert.ok(jsonLine, "No JSON payload found in SQL output");
  return JSON.parse(jsonLine);
}

test("reportes financieros locales derivan del ledger existente sin segunda contabilidad", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fa100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','fr-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','fr-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','fr-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fa100000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','fr-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('fa110000-0000-4000-8000-000000000001','ACTIVE'),
('fa110000-0000-4000-8000-000000000002','ACTIVE'),
('fa110000-0000-4000-8000-000000000003','ACTIVE'),
('fa110000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('fa120000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001','ACTIVE',1),
('fa120000-0000-4000-8000-000000000002','fa110000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000002','ACTIVE',1),
('fa120000-0000-4000-8000-000000000003','fa110000-0000-4000-8000-000000000003','fa100000-0000-4000-8000-000000000003','ACTIVE',1),
('fa120000-0000-4000-8000-000000000004','fa110000-0000-4000-8000-000000000004','fa100000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('fa120000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('fa120000-0000-4000-8000-000000000002','SUPERADMIN'),
('fa120000-0000-4000-8000-000000000003','CAJA'),
('fa120000-0000-4000-8000-000000000004','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('fa130000-0000-4000-8000-000000000001','FR_CYCLE','Cycle reports','ACTIVE','2026-01-01','2026-12-31','fa120000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('fa131000-0000-4000-8000-000000000001','fa130000-0000-4000-8000-000000000001','FR_P1','Periodo reports',1,'2026-01-01','2026-06-30','ACTIVE','fa120000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('fa132000-0000-4000-8000-000000000001','FR_PLAN','Plan reports','V1','ACTIVE','2026-01-01','fa120000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('fa133000-0000-4000-8000-000000000001','FR_GEN','Generacion reports','fa130000-0000-4000-8000-000000000001','fa132000-0000-4000-8000-000000000001','ACTIVE','fa120000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('fa134000-0000-4000-8000-000000000001','fa131000-0000-4000-8000-000000000001','fa132000-0000-4000-8000-000000000001',1,'FR_G1','Grupo reports','ACTIVE',30,'fa120000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('fa135000-0000-4000-8000-000000000001','fa110000-0000-4000-8000-000000000004','fa120000-0000-4000-8000-000000000004','fa132000-0000-4000-8000-000000000001','fa133000-0000-4000-8000-000000000001','FR_ALU_001','ACTIVE',1,'fa120000-0000-4000-8000-000000000001','fa131000-0000-4000-8000-000000000001','fa131000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('fa136000-0000-4000-8000-000000000001','fa135000-0000-4000-8000-000000000001','fa131000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','fa120000-0000-4000-8000-000000000001','FR_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('fa137000-0000-4000-8000-000000000001','fa135000-0000-4000-8000-000000000001','fa136000-0000-4000-8000-000000000001','fa131000-0000-4000-8000-000000000001','fa132000-0000-4000-8000-000000000001',1,'fa134000-0000-4000-8000-000000000001','ACTIVE','FR_ENR_001','fa120000-0000-4000-8000-000000000001');

select * from finance.open_student_account('fa135000-0000-4000-8000-000000000001','FR_ACCOUNT_OPEN',null);
select * from finance.create_charge_concept('FR_TUITION','Colegiatura reports','Sin datos reales','TUITION','FR_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FR_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='FR_TUITION'),'fa131000-0000-4000-8000-000000000001','fa132000-0000-4000-8000-000000000001',1::smallint,null::uuid,1000.00,statement_timestamp(),null::timestamptz,'FR_RATE_CREATE',null);
select * from finance.approve_charge_rate((select id from finance.charge_rates where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_RATE_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_RATE_ACTIVATE',null);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='FR_TUITION'),(select id from finance.charge_rates where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'fa131000-0000-4000-8000-000000000001','fa137000-0000-4000-8000-000000000001','Cargo reports',1000.00,'2026-08-05','MANUAL','FR-CHARGE-REF','FR_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FR_CHARGE_CREATE'),'FR_CHARGE_POST',null);

select * from finance.create_scholarship_program('FR_SCH_20','Beca reports 20','PERCENTAGE',25.00,null,200.00,'2026-01-01','2026-12-31','FR_PROGRAM_CREATE',null);
select * from finance.submit_scholarship_program((select id from finance.scholarship_programs where code='FR_SCH_20'),'FR_PROGRAM_SUBMIT',null);
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='FR_SCH_20'),'FR_PROGRAM_APPROVE',null);
select * from finance.activate_scholarship_program((select id from finance.scholarship_programs where code='FR_SCH_20'),'FR_PROGRAM_ACTIVATE',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='FR_SCH_20'),'fa135000-0000-4000-8000-000000000001',(select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),'fa131000-0000-4000-8000-000000000001',null,null,200.00,'2026-01-01','2026-12-31','PENDING_INSTITUTIONAL_VALIDATION','FR_SCH_ASSIGN',null);
select * from finance.submit_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_SCH_SUBMIT',null);
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_SCH_APPROVE',null);
select * from finance.activate_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_SCH_ACTIVATE',null);
select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fa120000-0000-4000-8000-000000000001'),(select id from finance.student_charges where idempotency_key='FR_CHARGE_CREATE'),'FR_SCH_APPLY',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FR_CHARGE_CREATE'),100.00,'Descuento reports','FR_DISCOUNT_APPLY',null);
select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='FR_CHARGE_CREATE'),50.00,'Waiver reports','FR_WAIVER_CREATE',null);
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FR_WAIVER_CREATE'),'FR_WAIVER_APPROVE',null);
select * from finance.apply_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FR_WAIVER_CREATE'),'FR_WAIVER_APPLY',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.create_cash_register('FR_CAJA_01','Caja reports','Recepcion','ACTIVE','FR_CASH_REGISTER',null);
select * from finance.assign_cashier_to_register((select id from finance.cash_registers where code='FR_CAJA_01'),'fa120000-0000-4000-8000-000000000003',statement_timestamp(),null,'FR_CASH_ASSIGN',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.open_cash_session((select id from finance.cash_registers where code='FR_CAJA_01'),'2026-08-10',50.00,'FR_CASH_OPEN',null);
select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where business_date='2026-08-10'),300.00,'CASH','FR-CASH-PAY-01','2026-08-10 09:00+00','FR_PAY_REGISTER','FR_PAY_CONFIRM',(select id from finance.student_charges where idempotency_key='FR_CHARGE_CREATE'),300.00,'FR_PAY_ALLOCATE','FR_PAY_LINK',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.open_collection_case((select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),'OVERDUE_BALANCE','NORMAL',null,'FR_CASE_OPEN',null);
select * from public.create_payment_commitment((select id from finance.collection_cases where opened_by_account_id='fa120000-0000-4000-8000-000000000001'),(select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),350.00,'2026-08-20','Compromiso reports','FR_COMMITMENT_CREATE',null);
select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id='fa135000-0000-4000-8000-000000000001'),(select id from finance.collection_cases where opened_by_account_id='fa120000-0000-4000-8000-000000000001'),350.00,2,'2026-08-10','PENDING_INSTITUTIONAL_VALIDATION',array['2026-08-20'::date,'2026-08-30'::date],array[175.00,175.00],'Convenio reports','FR_AGREEMENT_CREATE',null);
select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.approve_payment_agreement((select id from finance.payment_agreements where created_by_account_id='fa120000-0000-4000-8000-000000000001'),'FR_AGREEMENT_APPROVE',null);

select set_config('request.jwt.claims','{"sub":"fa100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select jsonb_build_object(
  'summary', public.get_financial_period_summary('fa131000-0000-4000-8000-000000000001','2026-08-10'),
  'charges', public.report_charges('fa131000-0000-4000-8000-000000000001','2026-08-01','2026-08-10',null,1,'fa134000-0000-4000-8000-000000000001',null,null,'2026-08-10',50,0),
  'payments', public.report_payments('2026-08-01','2026-08-10','fa131000-0000-4000-8000-000000000001','CASH',null,null,null,50,0),
  'debt', public.report_debt_summary('fa131000-0000-4000-8000-000000000001',1,'fa134000-0000-4000-8000-000000000001',null,null,null,'FR_ALU',50,0,'2026-08-10'),
  'cash', public.report_cash_operations('2026-08-10',null,null,null,50,0),
  'benefits', public.report_financial_benefits('fa131000-0000-4000-8000-000000000001','2026-08-01','2026-08-10',50,0),
  'agreements', public.report_payment_agreements('fa131000-0000-4000-8000-000000000001',50,0,'2026-08-10')
)::text;
rollback;
`);

  const payload = parseLastJsonLine(output);
  assert.equal(payload.summary.grossCharges, "1000.00");
  assert.equal(payload.summary.discounts, "100.00");
  assert.equal(payload.summary.scholarshipAdjustments, "200.00");
  assert.equal(payload.summary.waivers, "50.00");
  assert.equal(payload.summary.netCharges, "650.00");
  assert.equal(payload.summary.confirmedPayments, "300.00");
  assert.equal(payload.summary.netCollections, "300.00");
  assert.equal(payload.summary.outstanding, "350.00");
  assert.equal(payload.summary.overdue, "350.00");
  assert.equal(payload.summary.cashExpected, "0.00");

  assert.equal(payload.charges.rows[0].studentIdentifier, "FR_ALU_001");
  assert.equal(payload.charges.rows[0].appliedAdjustments, "-350.00");
  assert.equal(payload.charges.rows[0].amountPaid, "300.00");
  assert.equal(payload.charges.rows[0].outstanding, "350.00");
  assert.equal(payload.charges.rows[0].isOverdue, true);

  assert.equal(payload.payments.rows[0].method, "CASH");
  assert.equal(payload.payments.rows[0].status, "APPLIED");
  assert.equal(payload.payments.rows[0].amount, "300.00");
  assert.equal(payload.payments.rows[0].appliedAmount, "300.00");
  assert.equal(payload.payments.rows[0].cashSession.cashRegisterCode, "FR_CAJA_01");

  assert.equal(payload.debt.summary.totalOutstanding, "350.00");
  assert.equal(payload.debt.summary.totalOverdue, "350.00");
  assert.equal(payload.debt.rows[0].caseStatus, "PROMISE_PENDING");

  assert.equal(payload.cash.rows[0].cashReceipts, "300.00");
  assert.equal(payload.cash.rows[0].opening, "50.00");
  assert.equal(payload.cash.rows[0].expected, null);

  assert.deepEqual(payload.benefits.rows.map((row) => row.benefitType).sort(), [
    "AUTHORIZED_DISCOUNT",
    "SCHOLARSHIP",
    "WAIVER",
  ]);

  assert.equal(payload.agreements.rows[0].agreementStatus, "ACTIVE");
  assert.equal(payload.agreements.rows[0].scheduledTotal, "350.00");
  assert.equal(payload.agreements.rows[0].remaining, "350.00");

  assert.doesNotMatch(output, /auth_user_id|person_id|email|phone|guardian|notes|medical/i);
});
