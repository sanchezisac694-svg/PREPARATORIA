begin;
select plan(20);

select has_table('finance', 'payment_agreements', '01 existe payment_agreements');
select has_table('finance', 'payment_agreement_installments', '02 existe payment_agreement_installments');
select has_table('finance', 'payment_agreement_allocations', '03 existe payment_agreement_allocations');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'payment_agreement_status'), '04 enum payment_agreement_status existe');
select ok((select relrowsecurity from pg_class where oid = 'finance.payment_agreements'::regclass), '05 payment_agreements tiene RLS');
select ok(not has_table_privilege('authenticated', 'finance.payment_agreements', 'select'), '06 authenticated no recibe grants directos');
select ok(has_function_privilege('authenticated', 'public.create_payment_agreement(uuid,uuid,numeric,integer,date,finance.payment_agreement_reason_code,date[],numeric[],text,text,uuid)', 'EXECUTE'), '07 wrapper publico de convenio si es ejecutable');
select ok(not has_function_privilege('authenticated', 'finance.create_payment_agreement(uuid,uuid,numeric,integer,date,finance.payment_agreement_reason_code,date[],numeric[],text,text,uuid)', 'EXECUTE'), '08 funcion interna de convenio no es ejecutable');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','ea100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','agreement-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ea100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','agreement-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ea100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','agreement-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('ea110000-0000-4000-8000-000000000001','ACTIVE'),
('ea110000-0000-4000-8000-000000000002','ACTIVE'),
('ea110000-0000-4000-8000-000000000003','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('ea120000-0000-4000-8000-000000000001','ea110000-0000-4000-8000-000000000001','ea100000-0000-4000-8000-000000000001','ACTIVE',1),
('ea120000-0000-4000-8000-000000000002','ea110000-0000-4000-8000-000000000002','ea100000-0000-4000-8000-000000000002','ACTIVE',1),
('ea120000-0000-4000-8000-000000000003','ea110000-0000-4000-8000-000000000003','ea100000-0000-4000-8000-000000000003','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('ea120000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('ea120000-0000-4000-8000-000000000002','SUPERADMIN'),
('ea120000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"ea100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('ea130000-0000-4000-8000-000000000001','PA_CYCLE','Cycle agreements','ACTIVE','2099-01-01','2099-12-31','ea120000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('ea131000-0000-4000-8000-000000000001','ea130000-0000-4000-8000-000000000001','PA_P1','Periodo agreements',1,'2099-01-01','2099-06-30','ACTIVE','ea120000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('ea132000-0000-4000-8000-000000000001','PA_PLAN','Plan agreements','V1','ACTIVE','2099-01-01','ea120000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('ea133000-0000-4000-8000-000000000001','PA_GEN','Generacion agreements','ea130000-0000-4000-8000-000000000001','ea132000-0000-4000-8000-000000000001','ACTIVE','ea120000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('ea134000-0000-4000-8000-000000000001','ea131000-0000-4000-8000-000000000001','ea132000-0000-4000-8000-000000000001',1,'PA_G1','Grupo agreements','ACTIVE',25,'ea120000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('ea135000-0000-4000-8000-000000000001','ea110000-0000-4000-8000-000000000003','ea120000-0000-4000-8000-000000000003','ea132000-0000-4000-8000-000000000001','ea133000-0000-4000-8000-000000000001','PA_ALU','ACTIVE',1,'ea120000-0000-4000-8000-000000000001','ea131000-0000-4000-8000-000000000001','ea131000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('ea136000-0000-4000-8000-000000000001','ea135000-0000-4000-8000-000000000001','ea131000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','ea120000-0000-4000-8000-000000000001','PA_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('ea137000-0000-4000-8000-000000000001','ea135000-0000-4000-8000-000000000001','ea136000-0000-4000-8000-000000000001','ea131000-0000-4000-8000-000000000001','ea132000-0000-4000-8000-000000000001',1,'ea134000-0000-4000-8000-000000000001','ACTIVE','PA_ENR','ea120000-0000-4000-8000-000000000001');

select * from finance.open_student_account('ea135000-0000-4000-8000-000000000001','PA_ACC_OPEN',null);
select * from finance.create_charge_concept('PA_TUITION','Colegiatura agreements','Sin datos reales','TUITION','PA_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='PA_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='ea135000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='PA_TUITION'),null,'ea131000-0000-4000-8000-000000000001','ea137000-0000-4000-8000-000000000001','Cargo agreements',1200.00,'2099-02-15','MANUAL','PA-CHARGE-1','PA_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'),'PA_CHARGE_POST',null);

select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'))::text),'1200.00','09 saldo base inicial');
select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id='ea135000-0000-4000-8000-000000000001'),null,1200.00,3,'2026-01-20','PENDING_INSTITUTIONAL_VALIDATION',array['2026-01-31'::date,'2026-02-28'::date,'2026-03-31'::date],array[400.00,400.00,400.00],'Convenio tecnico','PA_AGREEMENT_CREATE',null);
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'))::text),'1200.00','10 crear convenio no altera ledger');
select throws_ok(
  $$ select * from public.approve_payment_agreement((select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'PA_AGREEMENT_APPROVE_DENIED',null) $$,
  'ACTOR_NOT_AUTHORIZED',
  '11 creador no puede autoaprobar convenio'
);
select set_config('request.jwt.claims','{"sub":"ea100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from public.approve_payment_agreement((select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'PA_AGREEMENT_APPROVE',null);
select is((select status::text from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'ACTIVE','12 convenio queda activo');
select is((select sum(scheduled_amount)::text from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001')),'1200.00','13 suma de parcialidades coincide con agreed_amount');
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'))::text),'1200.00','14 aprobar convenio no altera ledger');

select * from finance.register_payment((select id from finance.student_accounts where student_record_id='ea135000-0000-4000-8000-000000000001'),400.00,'CASH','PA-PAY-1','2026-01-31 10:00+00','PA_PAY_REG',null);
select * from finance.confirm_payment((select id from finance.payments where idempotency_key='PA_PAY_REG'),'PA_PAY_CONFIRM',null);
select * from finance.allocate_payment((select id from finance.payments where idempotency_key='PA_PAY_REG'),(select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'),400.00,'PA_PAY_ALLOC',null);
insert into finance.payment_agreement_allocations(installment_id,payment_allocation_id,amount_applied_to_installment)
values(
  (select id from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001') and installment_number=1),
  (select id from finance.payment_allocations where idempotency_key='PA_PAY_ALLOC'),
  400.00
);
select * from public.reconcile_payment_agreement_installment((select id from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001') and installment_number=1),'PA_INSTALLMENT_RECONCILE',null);
select is((select status::text from finance.payment_agreement_installments where payment_agreement_id=(select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001') and installment_number=1),'FULFILLED','15 reconciliacion marca parcialidad cumplida');
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='PA_CHARGE_CREATE'))::text),'800.00','16 pago real cambia saldo via allocation');

select results_eq(
  $$ select evaluation_status::text from public.evaluate_payment_agreement((select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'2026-02-01') $$,
  $$ values ('ON_TRACK'::text) $$,
  '17 evaluacion deriva estatus sin mutar'
);

select * from public.mark_payment_agreement_defaulted((select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'Incumplimiento verificado','PA_AGREEMENT_DEFAULT',null);
select is((select status::text from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'DEFAULTED','18 default es manual y controlado');
select * from public.cancel_payment_agreement((select id from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'Cierre administrativo','PA_AGREEMENT_CANCEL',null);
select is((select status::text from finance.payment_agreements where created_by_account_id='ea120000-0000-4000-8000-000000000001'),'CANCELLED','19 cancelacion conserva historial');
select ok(exists(select 1 from finance.financial_events where event_type in ('PAYMENT_AGREEMENT_CREATED','PAYMENT_AGREEMENT_APPROVED','PAYMENT_AGREEMENT_ACTIVATED','PAYMENT_AGREEMENT_RECONCILED','PAYMENT_AGREEMENT_DEFAULTED','PAYMENT_AGREEMENT_CANCELLED')), '20 eventos de auditoria de convenios se registran');

select * from finish();
rollback;
