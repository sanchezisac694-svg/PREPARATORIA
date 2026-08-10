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

test("flujo local de caja: apertura, cobro, transferencia, movimiento, cierre con diferencia y aprobación segregada", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','local-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','local-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','local-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f7100000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','local-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('f7200000-0000-4000-8000-000000000001','ACTIVE'),
('f7200000-0000-4000-8000-000000000002','ACTIVE'),
('f7200000-0000-4000-8000-000000000003','ACTIVE'),
('f7200000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('f7300000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000001','f7100000-0000-4000-8000-000000000001','ACTIVE',1),
('f7300000-0000-4000-8000-000000000002','f7200000-0000-4000-8000-000000000002','f7100000-0000-4000-8000-000000000002','ACTIVE',1),
('f7300000-0000-4000-8000-000000000003','f7200000-0000-4000-8000-000000000003','f7100000-0000-4000-8000-000000000003','ACTIVE',1),
('f7300000-0000-4000-8000-000000000004','f7200000-0000-4000-8000-000000000004','f7100000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('f7300000-0000-4000-8000-000000000001','SUPERADMIN'),
('f7300000-0000-4000-8000-000000000002','CAJA'),
('f7300000-0000-4000-8000-000000000003','ADMINISTRATIVO'),
('f7300000-0000-4000-8000-000000000004','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('f7400000-0000-4000-8000-000000000001','LOCAL_CYCLE','Local cash cycle','ACTIVE','2099-01-01','2099-12-31','f7300000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('f7410000-0000-4000-8000-000000000001','f7400000-0000-4000-8000-000000000001','LOCAL_P1','Local period',1,'2099-01-01','2099-06-30','ACTIVE','f7300000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('f7420000-0000-4000-8000-000000000001','LOCAL_PLAN','Local plan','V1','ACTIVE','2099-01-01','f7300000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('f7430000-0000-4000-8000-000000000001','LOCAL_GEN','Local generation','f7400000-0000-4000-8000-000000000001','f7420000-0000-4000-8000-000000000001','ACTIVE','f7300000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('f7450000-0000-4000-8000-000000000001','f7200000-0000-4000-8000-000000000004','f7300000-0000-4000-8000-000000000004','f7420000-0000-4000-8000-000000000001','f7430000-0000-4000-8000-000000000001','LOCAL_ALU','ACTIVE',1,'f7300000-0000-4000-8000-000000000001','f7410000-0000-4000-8000-000000000001','f7410000-0000-4000-8000-000000000001');

select * from finance.open_student_account('f7450000-0000-4000-8000-000000000001','LOCAL_ACC_OPEN',null);
select * from finance.create_charge_concept('LOCAL_INSCRIPTION','Inscripción local','Sin datos reales','ENROLLMENT','LOCAL_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='LOCAL_INSCRIPTION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='LOCAL_INSCRIPTION'),'f7410000-0000-4000-8000-000000000001','f7420000-0000-4000-8000-000000000001',1::smallint,null::uuid,500.00,statement_timestamp(),null::timestamptz,'LOCAL_RATE_CREATE',null::uuid);
select * from finance.approve_charge_rate((select id from finance.charge_rates where created_by_account_id='f7300000-0000-4000-8000-000000000001'),'LOCAL_RATE_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where created_by_account_id='f7300000-0000-4000-8000-000000000001'),'LOCAL_RATE_ACTIVATE',null);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='f7450000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='LOCAL_INSCRIPTION'),(select id from finance.charge_rates where created_by_account_id='f7300000-0000-4000-8000-000000000001'),'f7410000-0000-4000-8000-000000000001',null,'Cargo local',500.00,'2099-02-01','MANUAL','LOCAL-REF-1234','LOCAL_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='LOCAL_CHARGE_CREATE'),'LOCAL_CHARGE_POST',null);

select * from finance.create_cash_register('LOCAL_CAJA_01','Caja local','Recepción','ACTIVE','LOCAL_REGISTER_CREATE',null);
select * from finance.assign_cashier_to_register((select id from finance.cash_registers where code='LOCAL_CAJA_01'),'f7300000-0000-4000-8000-000000000002',statement_timestamp(),null,'LOCAL_ASSIGNMENT_CREATE',null);

select set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.open_cash_session((select id from finance.cash_registers where code='LOCAL_CAJA_01'),'2099-03-01',100.00,'LOCAL_SESSION_OPEN',null);
select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='f7450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='OPEN'),200.00,'CASH','LOCAL-CASH-1234','2099-03-01 10:00+00','LOCAL_PAY_REGISTER','LOCAL_PAY_CONFIRM',(select id from finance.student_charges where idempotency_key='LOCAL_CHARGE_CREATE'),200.00,'LOCAL_PAY_ALLOCATE','LOCAL_PAY_LINK',null);
select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='f7450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='OPEN'),50.00,'BANK_TRANSFER','LOCAL-TR-1234','2099-03-01 10:05+00','LOCAL_PAY_TR_REGISTER','LOCAL_PAY_TR_CONFIRM',null,null,null,'LOCAL_PAY_TR_LINK',null);
select * from public.register_cash_movement((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='OPEN'),'CASH_WITHDRAWAL',20.00,'SAFE_DROP','Retiro local','2099-03-01 11:00+00','LOCAL_MOVEMENT_OUT',null);
select finance.calculate_expected_cash((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='OPEN'))::text;
select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='OPEN'),'LOCAL_BEGIN_CLOSE',null);
select * from public.record_cash_count((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='CLOSING'),275.00,'LOCAL_COUNT',null);
select * from public.close_cash_session((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='CLOSING'),'OTHER_MANUAL_REVIEW','Diferencia local','LOCAL_CLOSE',null);

do $$ begin
  perform public.approve_cash_difference((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='RECONCILIATION_REQUIRED'),'LOCAL_SELF_APPROVAL',null);
  raise exception 'self approval accepted';
exception when others then
  if sqlerrm <> 'ACTOR_NOT_AUTHORIZED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.approve_cash_difference((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='LOCAL_CAJA_01') and business_date='2099-03-01' and status='RECONCILIATION_REQUIRED'),'LOCAL_SUPERVISOR_APPROVAL',null);

select set_config('request.jwt.claims','{"sub":"f7100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$ begin
  perform finance.reverse_payment((select id from finance.payments where idempotency_key='LOCAL_PAY_TR_REGISTER'),'DUPLICATE_PAYMENT','LOCAL_REVERSE_AFTER_CLOSE',null);
end $$;
select json_build_object(
  'commands', (select count(*) from finance.financial_commands where command_type in ('OPEN_CASH_SESSION','LINK_PAYMENT_TO_CASH_SESSION','CREATE_CASH_MOVEMENT','BEGIN_CASH_SESSION_CLOSE','RECORD_CASH_COUNT','CLOSE_CASH_SESSION','APPROVE_CASH_DIFFERENCE')),
  'difference', (select difference_amount from finance.cash_sessions where business_date='2099-03-01'),
  'expected', (select expected_cash_amount from finance.cash_sessions where business_date='2099-03-01'),
  'reversedTransferPayments', (select count(*) from finance.payments where idempotency_key='LOCAL_REVERSE_AFTER_CLOSE_REVERSAL' and status='REVERSED'),
  'status', (select status from finance.cash_sessions where business_date='2099-03-01'),
  'transferLinks', (select count(*) from finance.cash_session_payments links join finance.payments payments on payments.id=links.payment_id where payments.idempotency_key='LOCAL_PAY_TR_REGISTER'),
  'cashLinks', (select count(*) from finance.cash_session_payments links join finance.payments payments on payments.id=links.payment_id where payments.idempotency_key='LOCAL_PAY_REGISTER')
)::text;
rollback;
  `);

  const lines = output.split(/\r?\n/).filter(Boolean);
  const summary = JSON.parse(lines.at(-2));
  assert.equal(
    lines.some((line) => line === "280.00"),
    true,
  );
  assert.equal(summary.status, "CLOSED");
  assert.equal(Number(summary.expected), 280);
  assert.equal(Number(summary.difference), -5);
  assert.equal(summary.reversedTransferPayments, 1);
  assert.equal(summary.cashLinks, 1);
  assert.equal(summary.transferLinks, 1);
  assert.ok(summary.commands >= 7);
  assert.doesNotMatch(output, /auth_user_id|person_id|service_role|CFDI|pago en línea/i);
});
