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

test("cierre financiero local conserva snapshot, exige segundo aprobador y preserva historial", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','fc-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','fc-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','fc-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('fc110000-0000-4000-8000-000000000001','ACTIVE'),
('fc110000-0000-4000-8000-000000000002','ACTIVE'),
('fc110000-0000-4000-8000-000000000003','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('fc120000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','ACTIVE',1),
('fc120000-0000-4000-8000-000000000002','fc110000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000002','ACTIVE',1),
('fc120000-0000-4000-8000-000000000003','fc110000-0000-4000-8000-000000000003','fc100000-0000-4000-8000-000000000003','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('fc120000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('fc120000-0000-4000-8000-000000000002','SUPERADMIN'),
('fc120000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('fc130000-0000-4000-8000-000000000001','FC_CYCLE','Cycle closures','ACTIVE','2026-01-01','2026-12-31','fc120000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('fc131000-0000-4000-8000-000000000001','fc130000-0000-4000-8000-000000000001','FC_P1','Periodo closures',1,'2026-01-01','2026-06-30','ACTIVE','fc120000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('fc132000-0000-4000-8000-000000000001','FC_PLAN','Plan closures','V1','ACTIVE','2026-01-01','fc120000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('fc133000-0000-4000-8000-000000000001','FC_GEN','Generacion closures','fc130000-0000-4000-8000-000000000001','fc132000-0000-4000-8000-000000000001','ACTIVE','fc120000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('fc134000-0000-4000-8000-000000000001','fc131000-0000-4000-8000-000000000001','fc132000-0000-4000-8000-000000000001',1,'FC_G1','Grupo closures','ACTIVE',20,'fc120000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('fc135000-0000-4000-8000-000000000001','fc110000-0000-4000-8000-000000000003','fc120000-0000-4000-8000-000000000003','fc132000-0000-4000-8000-000000000001','fc133000-0000-4000-8000-000000000001','FC_ALU_001','ACTIVE',1,'fc120000-0000-4000-8000-000000000001','fc131000-0000-4000-8000-000000000001','fc131000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('fc136000-0000-4000-8000-000000000001','fc135000-0000-4000-8000-000000000001','fc131000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','fc120000-0000-4000-8000-000000000001','FC_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('fc137000-0000-4000-8000-000000000001','fc135000-0000-4000-8000-000000000001','fc136000-0000-4000-8000-000000000001','fc131000-0000-4000-8000-000000000001','fc132000-0000-4000-8000-000000000001',1,'fc134000-0000-4000-8000-000000000001','ACTIVE','FC_ENR_001','fc120000-0000-4000-8000-000000000001');

select * from finance.open_student_account('fc135000-0000-4000-8000-000000000001','FC_ACCOUNT_OPEN',null);
select * from finance.create_charge_concept('FC_TUITION','Colegiatura closures','Sin datos reales','TUITION','FC_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FC_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='fc135000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='FC_TUITION'),null,'fc131000-0000-4000-8000-000000000001','fc137000-0000-4000-8000-000000000001','Cargo closures',1000.00,'2026-08-05','MANUAL','FC-CHARGE-REF','FC_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FC_CHARGE_CREATE'),'FC_CHARGE_POST',null);
select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FC_CHARGE_CREATE'),100.00,'Descuento previo','FC_DISCOUNT_BEFORE',null);
select * from finance.register_payment((select id from finance.student_accounts where student_record_id='fc135000-0000-4000-8000-000000000001'),550.00,'BANK_TRANSFER','FC-PAY-001','2026-08-10 09:00+00','FC_PAY_REGISTER_1',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='FC_PAY_REGISTER_1'),'FC_PAY_CONFIRM_1',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='FC_PAY_REGISTER_1'),(select id from finance.student_charges where idempotency_key='FC_CHARGE_CREATE'),550.00,'FC_PAY_ALLOCATE_1',null);

select * from public.create_financial_period_close('fc131000-0000-4000-8000-000000000001','2026-08-10','FC_CLOSE_CREATE_1',null);
select (public.get_financial_period_close((select entity_id from public.create_financial_period_close('fc131000-0000-4000-8000-000000000001','2026-08-10','FC_CLOSE_CREATE_1',null) limit 1))->>'status');

do $$
begin
  perform * from public.approve_financial_period_close((select id from finance.financial_period_closures where created_by_account_id='fc120000-0000-4000-8000-000000000001' limit 1),'FC_CLOSE_APPROVE_SELF',null);
  raise exception 'self approval allowed';
exception when others then
  if sqlerrm <> 'ACTOR_NOT_AUTHORIZED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.approve_financial_period_close((select id from finance.financial_period_closures where created_by_account_id='fc120000-0000-4000-8000-000000000001' limit 1),'FC_CLOSE_APPROVE_OK',null);

do $$
begin
  update finance.financial_period_closures set outstanding = 999.99 where created_by_account_id='fc120000-0000-4000-8000-000000000001';
  raise exception 'approved closure mutated';
exception when others then
  if sqlerrm <> 'HISTORICAL_RECORD_IMMUTABLE' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.register_payment((select id from finance.student_accounts where student_record_id='fc135000-0000-4000-8000-000000000001'),100.00,'BANK_TRANSFER','FC-PAY-002','2026-08-11 09:00+00','FC_PAY_REGISTER_2',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='FC_PAY_REGISTER_2'),'FC_PAY_CONFIRM_2',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='FC_PAY_REGISTER_2'),(select id from finance.student_charges where idempotency_key='FC_CHARGE_CREATE'),100.00,'FC_PAY_ALLOCATE_2',null);
select * from finance.reverse_payment_allocation((select id from finance.payment_allocations where idempotency_key='FC_PAY_ALLOCATE_2'),'FC_PAY_ALLOCATE_REVERSE_2',null);
select * from finance.reverse_payment((select id from finance.payments where idempotency_key='FC_PAY_REGISTER_2'),'DUPLICATE_PAYMENT','FC_PAY_REVERSE_2',null);
select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FC_CHARGE_CREATE'),25.00,'Descuento posterior','FC_DISCOUNT_AFTER',null);

select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.supersede_financial_period_close((select id from finance.financial_period_closures where status='APPROVED' limit 1),'2026-08-11','FC_CLOSE_SUPERSEDE_1',null);

select jsonb_build_object(
  'approvedClosure', public.get_financial_period_close((select id from finance.financial_period_closures where version=1 limit 1)),
  'replacementClosure', public.get_financial_period_close((select id from finance.financial_period_closures where version=2 limit 1)),
  'summaryAfterPayment', public.get_financial_period_summary('fc131000-0000-4000-8000-000000000001','2026-08-11'),
  'events', (
    select jsonb_agg(event_type order by event_type)
    from finance.financial_events
    where event_type::text like 'FINANCIAL_PERIOD_CLOSE_%'
  )
)::text;
rollback;
`);

  const payload = parseLastJsonLine(output);
  assert.equal(payload.approvedClosure.status, "SUPERSEDED");
  assert.equal(payload.approvedClosure.outstanding, "350.00");
  assert.equal(payload.replacementClosure.status, "UNDER_REVIEW");
  assert.equal(payload.replacementClosure.version, 2);
  assert.equal(payload.replacementClosure.supersedesClosureId, payload.approvedClosure.closureId);
  assert.equal(payload.summaryAfterPayment.outstanding, "325.00");
  assert.equal(payload.summaryAfterPayment.confirmedPayments, "550.00");
  assert.equal(payload.summaryAfterPayment.reversedPayments, "100.00");
  assert.equal(payload.summaryAfterPayment.netCollections, "450.00");
  assert.match(JSON.stringify(payload.events), /FINANCIAL_PERIOD_CLOSE_CREATED/);
  assert.match(JSON.stringify(payload.events), /FINANCIAL_PERIOD_CLOSE_APPROVED/);
  assert.match(JSON.stringify(payload.events), /FINANCIAL_PERIOD_CLOSE_SUPERSEDED/);
});
