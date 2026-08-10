begin;
select plan(25);

select ok(coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0, '01 finance sigue fuera de Data API');
select has_table('finance', 'scholarship_programs', '02 existe scholarship_programs');
select has_table('finance', 'student_scholarships', '03 existe student_scholarships');
select has_table('finance', 'scholarship_applications', '04 existe scholarship_applications');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'scholarship_program_status'), '05 enum scholarship_program_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'student_scholarship_status'), '06 enum student_scholarship_status existe');
select ok((select relrowsecurity from pg_class where oid = 'finance.scholarship_programs'::regclass), '07 scholarship_programs tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.student_scholarships'::regclass), '08 student_scholarships tiene RLS');
select ok(not has_table_privilege('authenticated', 'finance.scholarship_programs', 'select'), '09 authenticated no recibe grants directos');
select ok(not has_function_privilege('authenticated', 'finance.create_scholarship_program(text,text,finance.scholarship_benefit_type,numeric,numeric,numeric,date,date,text,uuid)', 'EXECUTE'), '10 authenticated no ejecuta funciones internas de becas');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fb100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','benefits-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','benefits-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fb100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','benefits-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('fb110000-0000-4000-8000-000000000001','ACTIVE'),
('fb110000-0000-4000-8000-000000000002','ACTIVE'),
('fb110000-0000-4000-8000-000000000003','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('fb120000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','ACTIVE',1),
('fb120000-0000-4000-8000-000000000002','fb110000-0000-4000-8000-000000000002','fb100000-0000-4000-8000-000000000002','ACTIVE',1),
('fb120000-0000-4000-8000-000000000003','fb110000-0000-4000-8000-000000000003','fb100000-0000-4000-8000-000000000003','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('fb120000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('fb120000-0000-4000-8000-000000000002','SUPERADMIN'),
('fb120000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('fb130000-0000-4000-8000-000000000001','FB_CYCLE','Cycle benefits','ACTIVE','2099-01-01','2099-12-31','fb120000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('fb131000-0000-4000-8000-000000000001','fb130000-0000-4000-8000-000000000001','FB_P1','Periodo benefits',1,'2099-01-01','2099-06-30','ACTIVE','fb120000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('fb132000-0000-4000-8000-000000000001','FB_PLAN','Plan benefits','V1','ACTIVE','2099-01-01','fb120000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('fb133000-0000-4000-8000-000000000001','FB_GEN','Generacion benefits','fb130000-0000-4000-8000-000000000001','fb132000-0000-4000-8000-000000000001','ACTIVE','fb120000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('fb134000-0000-4000-8000-000000000001','fb131000-0000-4000-8000-000000000001','fb132000-0000-4000-8000-000000000001',1,'FB_G1','Grupo benefits','ACTIVE',25,'fb120000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('fb135000-0000-4000-8000-000000000001','fb110000-0000-4000-8000-000000000003','fb120000-0000-4000-8000-000000000003','fb132000-0000-4000-8000-000000000001','fb133000-0000-4000-8000-000000000001','FB_ALU','ACTIVE',1,'fb120000-0000-4000-8000-000000000001','fb131000-0000-4000-8000-000000000001','fb131000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('fb136000-0000-4000-8000-000000000001','fb135000-0000-4000-8000-000000000001','fb131000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','fb120000-0000-4000-8000-000000000001','FB_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('fb137000-0000-4000-8000-000000000001','fb135000-0000-4000-8000-000000000001','fb136000-0000-4000-8000-000000000001','fb131000-0000-4000-8000-000000000001','fb132000-0000-4000-8000-000000000001',1,'fb134000-0000-4000-8000-000000000001','ACTIVE','FB_ENR','fb120000-0000-4000-8000-000000000001');

select * from finance.open_student_account('fb135000-0000-4000-8000-000000000001','FB_ACC_OPEN',null);
select * from finance.create_charge_concept('FB_TUITION','Colegiatura benefits','Sin datos reales','TUITION','FB_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FB_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='fb135000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='FB_TUITION'),null,'fb131000-0000-4000-8000-000000000001','fb137000-0000-4000-8000-000000000001','Cargo benefits',1000.00,'2099-02-10','MANUAL','FB-CHARGE-1','FB_CHARGE_CREATE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),'FB_CHARGE_POST',null);

select * from finance.create_scholarship_program('FB_SCH_50','Beca 50','PERCENTAGE',50.00,null,700.00,'2099-01-01','2099-12-31','FB_PROGRAM_CREATE',null);
select * from finance.submit_scholarship_program((select id from finance.scholarship_programs where code='FB_SCH_50'),'FB_PROGRAM_SUBMIT',null);
select throws_ok(
  $$ select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='FB_SCH_50'),'FB_PROGRAM_APPROVE_DENIED',null) $$,
  'ACTOR_NOT_AUTHORIZED',
  '11 autoaprobacion de programa se bloquea'
);
select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='FB_SCH_50'),'FB_PROGRAM_APPROVE',null);
select * from finance.activate_scholarship_program((select id from finance.scholarship_programs where code='FB_SCH_50'),'FB_PROGRAM_ACTIVATE',null);

select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='FB_SCH_50'),'fb135000-0000-4000-8000-000000000001',(select id from finance.student_accounts where student_record_id='fb135000-0000-4000-8000-000000000001'),'fb131000-0000-4000-8000-000000000001',null,null,700.00,'2099-01-01','2099-12-31','PENDING_INSTITUTIONAL_VALIDATION','FB_SCHOLARSHIP_ASSIGN',null);
select * from finance.submit_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),'FB_SCHOLARSHIP_SUBMIT',null);
select throws_ok(
  $$ select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),'FB_SCHOLARSHIP_APPROVE_DENIED',null) $$,
  'ACTOR_NOT_AUTHORIZED',
  '12 autoaprobacion de asignacion se bloquea'
);
select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),'FB_SCHOLARSHIP_APPROVE',null);
select * from finance.activate_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),'FB_SCHOLARSHIP_ACTIVATE',null);
select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),(select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),'FB_SCHOLARSHIP_APPLY',null);

select is((select original_amount::text from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),'1000.00','13 original_amount permanece intacto');
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'))::text),'500.00','14 beca reduce outstanding actual');
select is((select count(*) from finance.scholarship_applications),1::bigint,'15 existe trazabilidad scholarship -> adjustment');
select is((select adjustment_type::text from finance.charge_adjustments where id in (select charge_adjustment_id from finance.scholarship_applications limit 1)),'DISCOUNT','16 la beca crea adjustment DISCOUNT');

select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),100.00,'Descuento autorizado','FB_DISCOUNT_APPLY',null);
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'))::text),'400.00','17 descuento autorizado reutiliza charge_adjustments');

select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),50.00,'Condonacion parcial','FB_WAIVER_CREATE',null);
select set_config('request.jwt.claims','{"sub":"fb100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FB_WAIVER_CREATE'),'FB_WAIVER_APPROVE',null);
select * from finance.apply_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='FB_WAIVER_CREATE'),'FB_WAIVER_APPLY',null);
select is((select adjustment_type::text from finance.charge_adjustments where idempotency_key='FB_WAIVER_CREATE'),'WAIVER','18 condonacion usa adjustment WAIVER');
select is((select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'))::text),'350.00','19 waiver reduce saldo sin borrar cargo');

select * from finance.revoke_student_scholarship((select id from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001'),'FB_SCHOLARSHIP_REVOKE',null);
select is((select status::text from finance.student_scholarships where created_by_account_id='fb120000-0000-4000-8000-000000000001' limit 1),'REVOKED','20 beca revocada cambia estado');
select is((select count(*) from finance.scholarship_applications),1::bigint,'21 revocacion no elimina aplicacion historica');

select throws_ok(
  $$ select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='FB_CHARGE_CREATE'),500.00,'Exceso','FB_DISCOUNT_EXCESS',null) $$,
  'ADJUSTMENT_EXCEEDS_BALANCE',
  '22 no se permite exceder outstanding'
);

select is((select count(*) from finance.financial_events where event_type in ('SCHOLARSHIP_PROGRAM_CREATED','SCHOLARSHIP_PROGRAM_APPROVED','SCHOLARSHIP_ASSIGNED','SCHOLARSHIP_APPROVED','SCHOLARSHIP_ACTIVATED','SCHOLARSHIP_APPLIED','DISCOUNT_APPLIED','WAIVER_CREATED','WAIVER_APPROVED','WAIVER_APPLIED','SCHOLARSHIP_REVOKED')),11::bigint,'23 se registran eventos de auditoria esperados');
select ok(exists(select 1 from finance.financial_commands where command_type='APPLY_STUDENT_SCHOLARSHIP'), '24 idempotencia de beca queda registrada');
select ok(exists(select 1 from finance.financial_commands where command_type='APPLY_AUTHORIZED_DISCOUNT'), '25 idempotencia de descuento queda registrada');

select * from finish();
rollback;
