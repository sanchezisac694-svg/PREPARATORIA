begin;
select plan(40);

select ok(
  coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 finance permanece fuera de la Data API'
);

select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'cash_register_status'), '02 enum cash_register_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'cashier_assignment_status'), '03 enum cashier_assignment_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'cash_session_status'), '04 enum cash_session_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'cash_movement_type'), '05 enum cash_movement_type existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'cash_reconciliation_status'), '06 enum cash_reconciliation_status existe');

select has_table('finance', 'cash_registers', '07 cash_registers existe');
select has_table('finance', 'cashier_assignments', '08 cashier_assignments existe');
select has_table('finance', 'cash_sessions', '09 cash_sessions existe');
select has_table('finance', 'cash_session_payments', '10 cash_session_payments existe');
select has_table('finance', 'cash_movements', '11 cash_movements existe');
select has_table('finance', 'cash_counts', '12 cash_counts existe');
select has_table('finance', 'cash_reconciliations', '13 cash_reconciliations existe');

select ok((select relrowsecurity from pg_class where oid = 'finance.cash_registers'::regclass), '14 cash_registers tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.cash_sessions'::regclass), '15 cash_sessions tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.cash_reconciliations'::regclass), '16 cash_reconciliations tiene RLS');
select is((select count(*) from pg_policies where schemaname = 'finance' and tablename like 'cash_%'), 0::bigint, '17 tablas de caja no tienen policies directas');
select ok(not has_table_privilege('authenticated', 'finance.cash_sessions', 'select'), '18 authenticated no recibe grants directos de tabla');
select ok(not has_function_privilege('authenticated', 'finance.open_cash_session(uuid,date,numeric,text,uuid)', 'EXECUTE'), '19 authenticated no ejecuta función interna');
select ok(has_function_privilege('authenticated', 'public.open_cash_session(uuid,date,numeric,text,uuid)', 'EXECUTE'), '20 authenticated sí ejecuta wrapper controlado');
select ok(not exists(select 1 from pg_proc join pg_namespace n on n.oid = pronamespace where n.nspname = 'public' and proname = 'cancel_cash_session'), '21 no existe cancel_cash_session pública');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f6100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','cash-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f6100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','cash-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f6100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','cash-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f6100000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','cash-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('f6200000-0000-4000-8000-000000000001','ACTIVE'),
('f6200000-0000-4000-8000-000000000002','ACTIVE'),
('f6200000-0000-4000-8000-000000000003','ACTIVE'),
('f6200000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('f6300000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000001','f6100000-0000-4000-8000-000000000001','ACTIVE',1),
('f6300000-0000-4000-8000-000000000002','f6200000-0000-4000-8000-000000000002','f6100000-0000-4000-8000-000000000002','ACTIVE',1),
('f6300000-0000-4000-8000-000000000003','f6200000-0000-4000-8000-000000000003','f6100000-0000-4000-8000-000000000003','ACTIVE',1),
('f6300000-0000-4000-8000-000000000004','f6200000-0000-4000-8000-000000000004','f6100000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('f6300000-0000-4000-8000-000000000001','SUPERADMIN'),
('f6300000-0000-4000-8000-000000000002','CAJA'),
('f6300000-0000-4000-8000-000000000003','ADMINISTRATIVO'),
('f6300000-0000-4000-8000-000000000004','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('f6400000-0000-4000-8000-000000000001','CASH_CYCLE','Cycle cash','ACTIVE','2099-01-01','2099-12-31','f6300000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('f6410000-0000-4000-8000-000000000001','f6400000-0000-4000-8000-000000000001','CASH_P1','Periodo cash',1,'2099-01-01','2099-06-30','ACTIVE','f6300000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('f6420000-0000-4000-8000-000000000001','CASH_PLAN','Plan cash','V1','ACTIVE','2099-01-01','f6300000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('f6430000-0000-4000-8000-000000000001','CASH_GEN','Generación cash','f6400000-0000-4000-8000-000000000001','f6420000-0000-4000-8000-000000000001','ACTIVE','f6300000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('f6450000-0000-4000-8000-000000000001','f6200000-0000-4000-8000-000000000004','f6300000-0000-4000-8000-000000000004','f6420000-0000-4000-8000-000000000001','f6430000-0000-4000-8000-000000000001','CASH_ALU','ACTIVE',1,'f6300000-0000-4000-8000-000000000001','f6410000-0000-4000-8000-000000000001','f6410000-0000-4000-8000-000000000001');

select * from finance.open_student_account('f6450000-0000-4000-8000-000000000001','CASH_ACC_OPEN',null);
select * from finance.create_charge_concept('CASH_INSCRIPTION','Inscripción caja','Sin datos reales','ENROLLMENT','CASH_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='CASH_INSCRIPTION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='CASH_INSCRIPTION'),'f6410000-0000-4000-8000-000000000001','f6420000-0000-4000-8000-000000000001',1::smallint,null::uuid,500.00,statement_timestamp(),null::timestamptz,'CASH_RATE_CREATE',null::uuid);
select * from finance.approve_charge_rate((select id from finance.charge_rates where created_by_account_id='f6300000-0000-4000-8000-000000000001'),'CASH_RATE_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where created_by_account_id='f6300000-0000-4000-8000-000000000001'),'CASH_RATE_ACTIVATE',null);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='f6450000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='CASH_INSCRIPTION'),(select id from finance.charge_rates where created_by_account_id='f6300000-0000-4000-8000-000000000001'),'f6410000-0000-4000-8000-000000000001',null,'Cargo técnico caja',500.00,'2099-02-01','MANUAL','CASH-REF-1234','CASH_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='CASH_CHARGE_CREATE'),'CASH_CHARGE_POST',null);

select results_eq(
$$ select status from finance.create_cash_register('CAJA_01','Caja principal','Recepción','ACTIVE','CASH_REGISTER_CREATE',null) $$,
$$ values ('ACTIVE'::text) $$,
'22 create_cash_register crea caja activa'
);

select results_eq(
$$ select status from finance.assign_cashier_to_register((select id from finance.cash_registers where code='CAJA_01'),'f6300000-0000-4000-8000-000000000002',statement_timestamp(),null,'CASH_ASSIGNMENT_CREATE',null) $$,
$$ values ('ACTIVE'::text) $$,
'23 assign_cashier_to_register crea asignación activa'
);

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);

select results_eq(
$$ select status from public.open_cash_session((select id from finance.cash_registers where code='CAJA_01'),'2099-03-01',100.00,'CASH_SESSION_OPEN',null) $$,
$$ values ('OPEN'::text) $$,
'24 open_cash_session abre turno'
);

select throws_ok(
$$ select * from public.open_cash_session((select id from finance.cash_registers where code='CAJA_01'),'2099-03-01',100.00,'CASH_SESSION_OPEN_DUP',null) $$,
'CASH_SESSION_ALREADY_OPEN',
'25 no permite doble turno operativo'
);

select results_eq(
$$ select payment_status from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='f6450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where status='OPEN'),200.00,'CASH','REF-CASH-1234','2099-03-01 10:00+00','CASH_PAY_REGISTER','CASH_PAY_CONFIRM',(select id from finance.student_charges where idempotency_key='CASH_CHARGE_CREATE'),200.00,'CASH_PAY_ALLOCATE','CASH_PAY_LINK',null) $$,
$$ values ('APPLIED'::text) $$,
'26 register_cashier_payment registra y vincula pago en efectivo'
);

select is(
  finance.calculate_expected_cash((select id from finance.cash_sessions where status='OPEN'))::text,
  '300.00',
  '27 expected cash incluye apertura y pago CASH'
);

select results_eq(
$$ select payment_status from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='f6450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where status='OPEN'),50.00,'BANK_TRANSFER','REF-TR-1234','2099-03-01 10:05+00','CASH_TRANSFER_PAY_REGISTER','CASH_TRANSFER_PAY_CONFIRM',null,null,null,'CASH_TRANSFER_PAY_LINK',null) $$,
$$ values ('CONFIRMED'::text) $$,
'28 BANK_TRANSFER puede vincularse sin aumentar efectivo esperado'
);

select is(
  finance.calculate_expected_cash((select id from finance.cash_sessions where status='OPEN'))::text,
  '300.00',
  '29 expected cash ignora transferencias bancarias'
);

select results_eq(
$$ select status from public.register_cash_movement((select id from finance.cash_sessions where status='OPEN'),'CASH_WITHDRAWAL',20.00,'SAFE_DROP','Retiro controlado','2099-03-01 11:00+00','CASH_MOVEMENT_OUT',null) $$,
$$ values ('ACTIVE'::text) $$,
'30 register_cash_movement registra retiro manual'
);

select is(
  finance.calculate_expected_cash((select id from finance.cash_sessions where status='OPEN'))::text,
  '280.00',
  '31 expected cash descuenta retiros'
);

select results_eq(
$$ select status from public.begin_cash_session_close((select id from finance.cash_sessions where status='OPEN'),'CASH_BEGIN_CLOSE',null) $$,
$$ values ('CLOSING'::text) $$,
'32 begin_cash_session_close mueve a CLOSING'
);

select throws_ok(
$$ select * from public.register_cash_movement((select id from finance.cash_sessions where status='CLOSING'),'CASH_OUT',10.00,'CORRECTION','Bloqueado','2099-03-01 11:05+00','CASH_MOVEMENT_BLOCKED',null) $$,
'CASH_SESSION_NOT_OPEN',
'33 CLOSING bloquea nuevos movimientos'
);

select results_eq(
$$ select status from public.record_cash_count((select id from finance.cash_sessions where status='CLOSING'),275.00,'CASH_COUNT_RECORD',null) $$,
$$ values ('RECORDED'::text) $$,
'34 record_cash_count registra arqueo'
);

select results_eq(
$$ select status from public.close_cash_session((select id from finance.cash_sessions where status='CLOSING'),'OTHER_MANUAL_REVIEW','Diferencia controlada','CASH_CLOSE_WITH_DIFFERENCE',null) $$,
$$ values ('RECONCILIATION_REQUIRED'::text) $$,
'35 close_cash_session con diferencia exige conciliación'
);

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok(
$$ select * from public.approve_cash_difference((select id from finance.cash_sessions where status='RECONCILIATION_REQUIRED'),'CASH_SELF_APPROVAL',null) $$,
'ACTOR_NOT_AUTHORIZED',
'36 CAJA no puede aprobar diferencias'
);

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select results_eq(
$$ select status from public.approve_cash_difference((select id from finance.cash_sessions where status='RECONCILIATION_REQUIRED'),'CASH_SUPERVISOR_APPROVAL',null) $$,
$$ values ('CLOSED'::text) $$,
'37 supervisor aprueba diferencia y cierra turno'
);

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok(
$$ select * from finance.reverse_payment((select id from finance.payments where idempotency_key='CASH_TRANSFER_PAY_REGISTER'),'DUPLICATE_PAYMENT','CASH_REVERSE_AFTER_CLOSE',null) $$,
'PAYMENT_ALREADY_APPLIED',
'38 reverso de pago posterior al cierre no reescribe el turno y hoy queda bloqueado por regla financiera heredada'
);
select is(
  (select difference_amount::text from finance.cash_sessions where id = (select id from finance.cash_sessions where business_date='2099-03-01')),
  '-5.00',
  '39 snapshot histórico del turno cerrado permanece intacto'
);

select set_config('request.jwt.claims','{"sub":"f6100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select throws_ok(
$$ select * from public.open_cash_session((select id from finance.cash_registers where code='CAJA_01'),'2099-03-02',10.00,'CASH_BAD_AAL',null) $$,
'APPLICATION_NOT_ALLOWED',
'40 AAL1 sin MFA no abre un nuevo turno'
);

select * from finish();
rollback;
