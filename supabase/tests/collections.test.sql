begin;
select plan(47);

select ok(
  coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 finance permanece fuera de la Data API'
);

select has_table('finance', 'collection_cases', '02 existe collection_cases');
select has_table('finance', 'collection_actions', '03 existe collection_actions');
select has_table('finance', 'payment_commitments', '04 existe payment_commitments');

select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_case_status'), '05 enum collection_case_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_case_priority'), '06 enum collection_case_priority existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_open_reason_code'), '07 enum collection_open_reason_code existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_close_reason_code'), '08 enum collection_close_reason_code existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_action_type'), '09 enum collection_action_type existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_action_status'), '10 enum collection_action_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'collection_contact_channel'), '11 enum collection_contact_channel existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'payment_commitment_status'), '12 enum payment_commitment_status existe');

select ok((select relrowsecurity from pg_class where oid = 'finance.collection_cases'::regclass), '13 collection_cases tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.collection_actions'::regclass), '14 collection_actions tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.payment_commitments'::regclass), '15 payment_commitments tiene RLS');
select is((select count(*) from pg_policies where schemaname = 'finance' and tablename in ('collection_cases', 'collection_actions', 'payment_commitments')), 0::bigint, '16 no existen policies cliente en tablas de cobranza');
select ok(not has_table_privilege('authenticated', 'finance.collection_cases', 'select'), '17 authenticated no recibe grants directos sobre collection_cases');
select ok(not has_table_privilege('authenticated', 'finance.collection_actions', 'select'), '18 authenticated no recibe grants directos sobre collection_actions');
select ok(not has_table_privilege('authenticated', 'finance.payment_commitments', 'select'), '19 authenticated no recibe grants directos sobre payment_commitments');
select ok(not has_function_privilege('authenticated', 'finance.open_collection_case(uuid,finance.collection_open_reason_code,finance.collection_case_priority,uuid,text,uuid)', 'EXECUTE'), '20 authenticated no ejecuta la funcion interna de apertura');
select ok(has_function_privilege('authenticated', 'public.open_collection_case(uuid,finance.collection_open_reason_code,finance.collection_case_priority,uuid,text,uuid)', 'EXECUTE'), '21 authenticated si ejecuta el wrapper controlado');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','cb410000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','collections-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cb410000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','collections-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cb410000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','collections-student@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','cb410000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','collections-control@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('cb420000-0000-4000-8000-000000000001','ACTIVE'),
('cb420000-0000-4000-8000-000000000002','ACTIVE'),
('cb420000-0000-4000-8000-000000000003','ACTIVE'),
('cb420000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('cb430000-0000-4000-8000-000000000001','cb420000-0000-4000-8000-000000000001','cb410000-0000-4000-8000-000000000001','ACTIVE',1),
('cb430000-0000-4000-8000-000000000002','cb420000-0000-4000-8000-000000000002','cb410000-0000-4000-8000-000000000002','ACTIVE',1),
('cb430000-0000-4000-8000-000000000003','cb420000-0000-4000-8000-000000000003','cb410000-0000-4000-8000-000000000003','ACTIVE',1),
('cb430000-0000-4000-8000-000000000004','cb420000-0000-4000-8000-000000000004','cb410000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('cb430000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('cb430000-0000-4000-8000-000000000002','SUPERADMIN'),
('cb430000-0000-4000-8000-000000000003','ALUMNO'),
('cb430000-0000-4000-8000-000000000004','CONTROL_ESCOLAR')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"cb410000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('cb440000-0000-4000-8000-000000000001','COLL_CYCLE','Cycle collections','ACTIVE','2099-01-01','2099-12-31','cb430000-0000-4000-8000-000000000002');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('cb441000-0000-4000-8000-000000000001','cb440000-0000-4000-8000-000000000001','COLL_P1','Periodo collections',1,'2099-01-01','2099-06-30','ACTIVE','cb430000-0000-4000-8000-000000000002');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('cb442000-0000-4000-8000-000000000001','COLL_PLAN','Plan collections','V1','ACTIVE','2099-01-01','cb430000-0000-4000-8000-000000000002');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('cb443000-0000-4000-8000-000000000001','COLL_GEN','Generacion collections','cb440000-0000-4000-8000-000000000001','cb442000-0000-4000-8000-000000000001','ACTIVE','cb430000-0000-4000-8000-000000000002');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('cb444000-0000-4000-8000-000000000001','cb441000-0000-4000-8000-000000000001','cb442000-0000-4000-8000-000000000001',1,'COLL_G1','Grupo 1','ACTIVE',40,'cb430000-0000-4000-8000-000000000002');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('cb445000-0000-4000-8000-000000000001','cb420000-0000-4000-8000-000000000003','cb430000-0000-4000-8000-000000000003','cb442000-0000-4000-8000-000000000001','cb443000-0000-4000-8000-000000000001','COLL_ALU','ACTIVE',1,'cb430000-0000-4000-8000-000000000002','cb441000-0000-4000-8000-000000000001','cb441000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('cb446000-0000-4000-8000-000000000001','cb445000-0000-4000-8000-000000000001','cb441000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','cb430000-0000-4000-8000-000000000002','COLL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('cb447000-0000-4000-8000-000000000001','cb445000-0000-4000-8000-000000000001','cb446000-0000-4000-8000-000000000001','cb441000-0000-4000-8000-000000000001','cb442000-0000-4000-8000-000000000001',1,'cb444000-0000-4000-8000-000000000001','ACTIVE','COLL_ENR','cb430000-0000-4000-8000-000000000002');

select * from finance.open_student_account('cb445000-0000-4000-8000-000000000001','COLL_ACC_OPEN',null);
select * from finance.create_charge_concept('COLL_TUITION','Cargo collections','Sin datos reales','TUITION','COLL_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='COLL_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='COLL_TUITION'),null,'cb441000-0000-4000-8000-000000000001','cb447000-0000-4000-8000-000000000001','Cargo collections',1000.00,'2026-01-10','MANUAL','COLL-REF-1','COLL_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='COLL_CHARGE_CREATE'),'COLL_CHARGE_POST',null);

select is(
  (select total_outstanding::text from finance.get_student_debt_position((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'2026-08-20') limit 1),
  '1000.00',
  '22 debt position deriva saldo total desde el ledger'
);
select is(
  (select total_overdue::text from finance.get_student_debt_position((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'2026-08-20') limit 1),
  '1000.00',
  '23 debt position marca overdue solo por due_date y balance positivo'
);
select is(
  (select aging_bucket from finance.get_student_debt_position((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'2026-08-20') where charge_id is not null limit 1),
  '91_PLUS_DAYS',
  '24 debt position calcula aging tecnico derivado'
);
select is(
  (select count(*) from finance.list_overdue_student_accounts('cb441000-0000-4000-8000-000000000001',1,'cb444000-0000-4000-8000-000000000001',null,'91_PLUS_DAYS',null,'COLL',10,0,'2026-08-20')),
  1::bigint,
  '25 list_overdue_student_accounts pagina y filtra por periodo/grupo/aging'
);

select set_config('request.jwt.claims','{"sub":"cb410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select results_eq(
$$ select status::text from public.open_collection_case((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'OVERDUE_BALANCE','NORMAL',null,'COLL_CASE_OPEN',null) $$,
$$ values ('OPEN'::text) $$,
'26 open_collection_case abre un caso activo unico'
);
select throws_ok(
$$ select * from public.open_collection_case((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'OVERDUE_BALANCE','NORMAL',null,'COLL_CASE_OPEN_DUP',null) $$,
'CONCURRENT_MODIFICATION',
'27 la base impide un segundo caso activo para la misma cuenta'
);
select results_eq(
$$ select status::text from public.add_collection_action((select id from finance.collection_cases where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')),'PHONE_CONTACT','RECORDED','PHONE','2026-08-20 12:00+00','Seguimiento administrativo factual','2026-08-25 09:00+00','COLL_ACTION_ADD',null) $$,
$$ values ('RECORDED'::text) $$,
'28 add_collection_action registra seguimiento append-only'
);
select throws_ok(
$$ update finance.collection_actions set summary='Reescritura prohibida' where id=(select id from finance.collection_actions limit 1) $$,
'HISTORICAL_RECORD_IMMUTABLE',
'29 collection_actions permanece inmutable'
);
select results_eq(
$$ select status::text from public.create_payment_commitment((select id from finance.collection_cases where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')),(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),1000.00,'2026-08-25','Compromiso administrativo','COLL_COMMITMENT_CREATE',null) $$,
$$ values ('PENDING'::text) $$,
'30 create_payment_commitment crea compromiso sin tocar el ledger'
);
select is((select count(*) from finance.payments where idempotency_key like 'COLL_%'), 0::bigint, '31 el compromiso no crea pagos');
select is((select count(*) from finance.charge_adjustments where idempotency_key like 'COLL_%'), 0::bigint, '32 el compromiso no crea ajustes');
select is(
  (select can_be_marked_fulfilled from finance.evaluate_payment_commitment((select id from finance.payment_commitments where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')), '2026-08-20')),
  false,
  '33 evaluate_payment_commitment no marca fulfilled sin evidencia en ledger'
);

select * from finance.register_payment((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),1000.00,'CASH','COLL-PAY-1','2026-08-22 10:00+00','COLL_PAY_REGISTER',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='COLL_PAY_REGISTER'),'COLL_PAY_CONFIRM',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='COLL_PAY_REGISTER'),(select id from finance.student_charges where idempotency_key='COLL_CHARGE_CREATE'),1000.00,'COLL_PAY_ALLOCATE',null);
select is(
  (select can_be_marked_fulfilled from finance.evaluate_payment_commitment((select id from finance.payment_commitments where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')), '2026-08-22')),
  true,
  '34 evaluate_payment_commitment detecta evidencia suficiente tras el pago aplicado'
);
select results_eq(
$$ select status::text from public.mark_payment_commitment_fulfilled((select id from finance.payment_commitments where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')),'COLL_COMMITMENT_FULFILL',null) $$,
$$ values ('FULFILLED'::text) $$,
'35 mark_payment_commitment_fulfilled exige evidencia y actualiza el workflow'
);
select results_eq(
$$ select status::text from public.close_collection_case((select id from finance.collection_cases where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')),'BALANCE_SETTLED','COLL_CASE_CLOSE',null) $$,
$$ values ('CLOSED'::text) $$,
'36 close_collection_case permite cierre solo con overdue liquidado'
);
select * from finance.reverse_payment_allocation((select id from finance.payment_allocations where idempotency_key='COLL_PAY_ALLOCATE'),'COLL_PAY_ALLOCATE_REVERSE',null);
select * from finance.reverse_payment((select id from finance.payments where idempotency_key='COLL_PAY_REGISTER'),'DUPLICATE_PAYMENT','COLL_PAY_REVERSE',null);
select is(
  (select total_overdue::text from finance.get_student_debt_position((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'2026-08-23') limit 1),
  '1000.00',
  '37 la deuda reaparece por derivacion tras el reverso de pago'
);
select is(
  (select status::text from finance.collection_cases where student_account_id=(select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001')),
  'CLOSED',
  '38 el caso cerrado conserva su snapshot historico y no se reabre automaticamente'
);

select set_config('request.jwt.claims','{"sub":"cb410000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true);
select throws_ok(
$$ select * from public.open_collection_case((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'OVERDUE_BALANCE','NORMAL',null,'COLL_CASE_BAD_AAL',null) $$,
'APPLICATION_NOT_ALLOWED',
'39 AAL1 sin MFA queda bloqueado para apertura'
);

select set_config('request.jwt.claims','{"sub":"cb410000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok(
$$ select * from public.open_collection_case((select id from finance.student_accounts where student_record_id='cb445000-0000-4000-8000-000000000001'),'OVERDUE_BALANCE','NORMAL',null,'COLL_CASE_CONTROL_ESCOLAR',null) $$,
'ACTOR_NOT_AUTHORIZED',
'40 CONTROL_ESCOLAR no abre casos por defecto'
);

select set_config('request.jwt.claims','{"sub":"cb410000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select ok(
  not exists(
    select 1
    from finance.list_overdue_student_accounts('cb441000-0000-4000-8000-000000000001',1,'cb444000-0000-4000-8000-000000000001',null,'1_30_DAYS',null,'COLL',10,0,'2026-08-23') listed
    where row_to_json(listed)::text ~* '(auth_user_id|person_id|phone|email|medical|grades|password|card|bank)'
  ),
  '41 el listado no expone PII ni datos academicos sensibles'
);
select ok(
  not exists(
    select 1
    from finance.financial_events
    where event_type::text like 'COLLECTION_%'
      and coalesce(details::text, '') ~* 'Seguimiento administrativo factual'
  ),
  '42 la auditoria no copia el summary completo en el payload'
);
select is(
  (select count(*) from finance.financial_events where event_type in ('COLLECTION_CASE_OPENED','COLLECTION_ACTION_CREATED','PAYMENT_COMMITMENT_CREATED','PAYMENT_COMMITMENT_FULFILLED','COLLECTION_CASE_CLOSED')),
  5::bigint,
  '43 la auditoria minima del flujo de cobranza queda registrada'
);
select is(
  (select count(*) from finance.financial_commands where command_type in ('OPEN_COLLECTION_CASE','ADD_COLLECTION_ACTION','CREATE_PAYMENT_COMMITMENT','FULFILL_PAYMENT_COMMITMENT','CLOSE_COLLECTION_CASE')),
  5::bigint,
  '44 la idempotencia queda registrada en financial_commands'
);
select is(
  (select count(*) from academic.student_records where id = 'cb445000-0000-4000-8000-000000000001'),
  1::bigint,
  '45 el bloque no muta el dominio academico al gestionar cobranza'
);
select ok(
  exists(
    select 1
    from information_schema.triggers
    where event_object_schema = 'finance'
      and event_object_table = 'collection_cases'
      and trigger_name = 'collection_cases_mutation_guard'
  ),
  '46 collection_cases usa guard especifico de inmutabilidad'
);
select ok(
  exists(
    select 1
    from information_schema.triggers
    where event_object_schema = 'finance'
      and event_object_table = 'payment_commitments'
      and trigger_name = 'payment_commitments_mutation_guard'
  ),
  '47 payment_commitments usa guard especifico de inmutabilidad'
);

select * from finish();
rollback;
