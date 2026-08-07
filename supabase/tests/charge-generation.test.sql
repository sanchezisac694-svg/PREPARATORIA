begin;
select plan(46);

select ok(
  coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 finance permanece fuera de la Data API'
);

select has_table('finance', 'charge_generation_rules', '02 existe charge_generation_rules');
select has_table('finance', 'charge_generation_rule_versions', '03 existe charge_generation_rule_versions');
select has_table('finance', 'charge_generation_batches', '04 existe charge_generation_batches');
select has_table('finance', 'charge_generation_batch_items', '05 existe charge_generation_batch_items');
select has_table('finance', 'charge_generation_exclusions', '06 existe charge_generation_exclusions');

select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_type'), '07 enum charge_generation_type existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_rule_status'), '08 enum charge_generation_rule_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_rule_version_status'), '09 enum charge_generation_rule_version_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_due_date_strategy'), '10 enum charge_generation_due_date_strategy existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_batch_status'), '11 enum charge_generation_batch_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_item_status'), '12 enum charge_generation_item_status existe');
select ok(exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'charge_generation_eligibility_status'), '13 enum charge_generation_eligibility_status existe');

select ok((select relrowsecurity from pg_class where oid = 'finance.charge_generation_rules'::regclass), '14 rules tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.charge_generation_rule_versions'::regclass), '15 versions tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.charge_generation_batches'::regclass), '16 batches tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.charge_generation_batch_items'::regclass), '17 batch_items tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.charge_generation_exclusions'::regclass), '18 exclusions tiene RLS');
select is((select count(*) from pg_policies where schemaname = 'finance' and tablename like 'charge_generation%'), 0::bigint, '19 no existen policies cliente en tablas nuevas');
select ok(not has_table_privilege('authenticated', 'finance.charge_generation_batches', 'select'), '20 authenticated no recibe grants directos sobre batches');
select ok(not has_function_privilege('authenticated', 'finance.execute_charge_generation_batch(uuid,text,uuid)', 'EXECUTE'), '21 authenticated no ejecuta la función interna de execute');
select ok(has_function_privilege('authenticated', 'public.execute_charge_generation_batch(uuid,text,uuid)', 'EXECUTE'), '22 authenticated sí ejecuta el wrapper controlado');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','cg-sql-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','cg-sql-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000011','authenticated','authenticated','synthetic','cg-sql-student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000012','authenticated','authenticated','synthetic','cg-sql-student-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000013','authenticated','authenticated','synthetic','cg-sql-student-c@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','ca710000-0000-4000-8000-000000000014','authenticated','authenticated','synthetic','cg-sql-student-d@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('ca720000-0000-4000-8000-000000000001','ACTIVE'),
('ca720000-0000-4000-8000-000000000002','ACTIVE'),
('ca720000-0000-4000-8000-000000000011','ACTIVE'),
('ca720000-0000-4000-8000-000000000012','ACTIVE'),
('ca720000-0000-4000-8000-000000000013','ACTIVE'),
('ca720000-0000-4000-8000-000000000014','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('ca730000-0000-4000-8000-000000000001','ca720000-0000-4000-8000-000000000001','ca710000-0000-4000-8000-000000000001','ACTIVE',1),
('ca730000-0000-4000-8000-000000000002','ca720000-0000-4000-8000-000000000002','ca710000-0000-4000-8000-000000000002','ACTIVE',1),
('ca730000-0000-4000-8000-000000000011','ca720000-0000-4000-8000-000000000011','ca710000-0000-4000-8000-000000000011','ACTIVE',1),
('ca730000-0000-4000-8000-000000000012','ca720000-0000-4000-8000-000000000012','ca710000-0000-4000-8000-000000000012','ACTIVE',1),
('ca730000-0000-4000-8000-000000000013','ca720000-0000-4000-8000-000000000013','ca710000-0000-4000-8000-000000000013','ACTIVE',1),
('ca730000-0000-4000-8000-000000000014','ca720000-0000-4000-8000-000000000014','ca710000-0000-4000-8000-000000000014','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('ca730000-0000-4000-8000-000000000001','ADMINISTRATIVO'),
('ca730000-0000-4000-8000-000000000002','SUPERADMIN'),
('ca730000-0000-4000-8000-000000000011','ALUMNO'),
('ca730000-0000-4000-8000-000000000012','ALUMNO'),
('ca730000-0000-4000-8000-000000000013','ALUMNO'),
('ca730000-0000-4000-8000-000000000014','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('ca740000-0000-4000-8000-000000000001','CG_SQL_CYCLE','Charge generation cycle','ACTIVE','2099-01-01','2099-12-31','ca730000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('ca741000-0000-4000-8000-000000000001','ca740000-0000-4000-8000-000000000001','CG_SQL_P1','Periodo charge generation',1,'2099-01-01','2099-06-30','ACTIVE','ca730000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('ca742000-0000-4000-8000-000000000001','CG_SQL_PLAN','Plan charge generation','V1','ACTIVE','2099-01-01','ca730000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('ca743000-0000-4000-8000-000000000001','CG_SQL_GEN','Generacion charge generation','ca740000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001','ACTIVE','ca730000-0000-4000-8000-000000000001');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values
('ca744000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1,'CGSQLG1','Grupo 1','ACTIVE',40,'ca730000-0000-4000-8000-000000000001'),
('ca744000-0000-4000-8000-000000000002','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',2,'CGSQLG2','Grupo 2','ACTIVE',40,'ca730000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('ca745000-0000-4000-8000-000000000001','ca720000-0000-4000-8000-000000000011','ca730000-0000-4000-8000-000000000011','ca742000-0000-4000-8000-000000000001','ca743000-0000-4000-8000-000000000001','CG_A','ACTIVE',1,'ca730000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001'),
('ca745000-0000-4000-8000-000000000002','ca720000-0000-4000-8000-000000000012','ca730000-0000-4000-8000-000000000012','ca742000-0000-4000-8000-000000000001','ca743000-0000-4000-8000-000000000001','CG_B','ACTIVE',1,'ca730000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001'),
('ca745000-0000-4000-8000-000000000003','ca720000-0000-4000-8000-000000000013','ca730000-0000-4000-8000-000000000013','ca742000-0000-4000-8000-000000000001','ca743000-0000-4000-8000-000000000001','CG_C','ACTIVE',1,'ca730000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001'),
('ca745000-0000-4000-8000-000000000004','ca720000-0000-4000-8000-000000000014','ca730000-0000-4000-8000-000000000014','ca742000-0000-4000-8000-000000000001','ca743000-0000-4000-8000-000000000001','CG_D','ACTIVE',2,'ca730000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('ca746000-0000-4000-8000-000000000001','ca745000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','ca730000-0000-4000-8000-000000000001','CG_SQL_REQ_A',repeat('a',64)),
('ca746000-0000-4000-8000-000000000002','ca745000-0000-4000-8000-000000000002','ca741000-0000-4000-8000-000000000001','REENROLLMENT',1,'APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','ca730000-0000-4000-8000-000000000001','CG_SQL_REQ_B',repeat('b',64)),
('ca746000-0000-4000-8000-000000000003','ca745000-0000-4000-8000-000000000003','ca741000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','ca730000-0000-4000-8000-000000000001','CG_SQL_REQ_C',repeat('c',64)),
('ca746000-0000-4000-8000-000000000004','ca745000-0000-4000-8000-000000000004','ca741000-0000-4000-8000-000000000001','REPEAT_SEMESTER',2,'APPROVED','ELIGIBLE','REPEAT_REQUIRED','ca730000-0000-4000-8000-000000000001','CG_SQL_REQ_D',repeat('d',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('ca747000-0000-4000-8000-000000000001','ca745000-0000-4000-8000-000000000001','ca746000-0000-4000-8000-000000000001','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1,'ca744000-0000-4000-8000-000000000001','ACTIVE','CG_ENR_A','ca730000-0000-4000-8000-000000000001'),
('ca747000-0000-4000-8000-000000000002','ca745000-0000-4000-8000-000000000002','ca746000-0000-4000-8000-000000000002','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1,'ca744000-0000-4000-8000-000000000001','ACTIVE','CG_ENR_B','ca730000-0000-4000-8000-000000000001'),
('ca747000-0000-4000-8000-000000000003','ca745000-0000-4000-8000-000000000003','ca746000-0000-4000-8000-000000000003','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1,'ca744000-0000-4000-8000-000000000001','ACTIVE','CG_ENR_C','ca730000-0000-4000-8000-000000000001'),
('ca747000-0000-4000-8000-000000000004','ca745000-0000-4000-8000-000000000004','ca746000-0000-4000-8000-000000000004','ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',2,'ca744000-0000-4000-8000-000000000002','ACTIVE','CG_ENR_D','ca730000-0000-4000-8000-000000000001');

select * from finance.open_student_account('ca745000-0000-4000-8000-000000000001','CG_SQL_ACC_A',null);
select * from finance.open_student_account('ca745000-0000-4000-8000-000000000002','CG_SQL_ACC_B',null);
select * from finance.open_student_account('ca745000-0000-4000-8000-000000000003','CG_SQL_ACC_C',null);
select * from finance.open_student_account('ca745000-0000-4000-8000-000000000004','CG_SQL_ACC_D',null);
select * from finance.create_charge_concept('CG_SQL_TUITION','Cargo recurrente','Sin datos reales','TUITION','CG_SQL_CONCEPT_TUITION',null);
select * from finance.create_charge_concept('CG_SQL_REPEAT','Cargo repeticion','Sin datos reales','REENROLLMENT','CG_SQL_CONCEPT_REPEAT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code in ('CG_SQL_TUITION','CG_SQL_REPEAT');
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='CG_SQL_TUITION'),'ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1::smallint,null::uuid,1500.00,statement_timestamp(),null::timestamptz,'CG_SQL_RATE_TUITION',null::uuid);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='CG_SQL_REPEAT'),'ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',2::smallint,null::uuid,2200.00,statement_timestamp(),null::timestamptz,'CG_SQL_RATE_REPEAT',null::uuid);
select * from finance.approve_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_TUITION') and semester_number=1),'CG_SQL_RATE_TUITION_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_TUITION') and semester_number=1),'CG_SQL_RATE_TUITION_ACTIVATE',null);
select * from finance.approve_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_REPEAT') and semester_number=2),'CG_SQL_RATE_REPEAT_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_REPEAT') and semester_number=2),'CG_SQL_RATE_REPEAT_ACTIVATE',null);

select results_eq(
$$ select status::text from finance.create_charge_generation_rule('CG_SQL_RULE_TUITION','Tuition rule',(select id from finance.charge_concepts where code='CG_SQL_TUITION'),'PERIODIC_TUITION','CG_SQL_RULE_CREATE',null) $$,
$$ values ('DRAFT'::text) $$,
'23 create_charge_generation_rule crea regla draft'
);

select results_eq(
$$ select status::text from finance.create_charge_generation_rule_version((select id from finance.charge_generation_rules where code='CG_SQL_RULE_TUITION'),'ca741000-0000-4000-8000-000000000001','ca742000-0000-4000-8000-000000000001',1,null,(select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_TUITION') and semester_number=1),'FIXED_DATE','2099-02-10',null,null,statement_timestamp(),null,'CG_SQL_VERSION_CREATE',null) $$,
$$ values ('DRAFT'::text) $$,
'24 create_charge_generation_rule_version crea versión draft'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select results_eq(
$$ select status::text from finance.approve_charge_generation_rule_version((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'CG_SQL_VERSION_APPROVE',null) $$,
$$ values ('APPROVED'::text) $$,
'25 approve_charge_generation_rule_version aprueba versión'
);
select results_eq(
$$ select status::text from finance.activate_charge_generation_rule_version((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'CG_SQL_VERSION_ACTIVATE',null) $$,
$$ values ('ACTIVE'::text) $$,
'26 activate_charge_generation_rule_version activa versión'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select is(
  (select count(*) from finance.preview_charge_generation((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'ca741000-0000-4000-8000-000000000001',null) where eligibility_status='ELIGIBLE'),
  3::bigint,
  '27 preview inicial encuentra tres elegibles; el repetidor de semestre 2 queda fuera de una versión fijada al semestre 1'
);
select is((select count(*) from finance.student_charges where external_reference like 'cg:%'), 0::bigint, '28 preview no genera cargos');

select results_eq(
$$ select status::text from finance.create_charge_generation_exclusion('ca745000-0000-4000-8000-000000000003',(select id from finance.charge_generation_rules where code='CG_SQL_RULE_TUITION'),(select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'ca741000-0000-4000-8000-000000000001','MANUAL_REVIEW_REQUIRED',current_date,null,'CG_SQL_EXCLUSION',null) $$,
$$ values ('ACTIVE'::text) $$,
'29 create_charge_generation_exclusion devuelve el contrato real entity_id/status y registra la exclusión'
);
select is(
  (select count(*) from finance.charge_generation_exclusions where student_record_id='ca745000-0000-4000-8000-000000000003' and reason_code='MANUAL_REVIEW_REQUIRED'),
  1::bigint,
  '30 se persiste la exclusión con el reason_code correcto'
);
select is(
  (select count(*) from finance.preview_charge_generation((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'ca741000-0000-4000-8000-000000000001',null) where eligibility_status='EXPLICITLY_EXCLUDED'),
  1::bigint,
  '31 preview posterior refleja exclusión'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok(
$$ select * from finance.approve_charge_generation_batch((select id from finance.charge_generation_batches limit 1),'CG_SQL_BATCH_SELF_APPROVE',null) $$,
'CHARGE_GENERATION_BATCH_NOT_FOUND',
'32 self approval todavía no puede aprobar un batch inexistente'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select results_eq(
$$ select status::text from finance.create_charge_generation_batch((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'ca741000-0000-4000-8000-000000000001','CG_SQL_BATCH_CREATE',null) $$,
$$ values ('PREVIEWED'::text) $$,
'33 create_charge_generation_batch crea batch previewed'
);
select is((select count(*) from finance.charge_generation_batch_items), 3::bigint, '34 batch materializa tres items del semestre aplicable');
select is((select count(*) from finance.charge_generation_batch_items where eligibility_status='EXPLICITLY_EXCLUDED'), 1::bigint, '35 batch conserva snapshot de exclusión');
select is((select estimated_total from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE')::text, '3000.00', '36 batch congela monto estimado de los dos elegibles restantes');

select results_eq(
$$ select status::text from finance.submit_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'),'CG_SQL_BATCH_SUBMIT',null) $$,
$$ values ('UNDER_REVIEW'::text) $$,
'37 submit mueve batch a under_review'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok(
$$ select * from finance.approve_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'),'CG_SQL_BATCH_APPROVE_SELF',null) $$,
'CHARGE_GENERATION_SELF_APPROVAL_NOT_ALLOWED',
'38 batch no permite self approval'
);

select set_config('request.jwt.claims','{"sub":"ca710000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select results_eq(
$$ select status::text from finance.approve_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'),'CG_SQL_BATCH_APPROVE',null) $$,
$$ values ('APPROVED'::text) $$,
'39 approve mueve batch a approved'
);

select set_config('finance.controlled_mutation','on',true);
update finance.charge_rates set amount = 9999.00 where charge_concept_id=(select id from finance.charge_concepts where code='CG_SQL_TUITION') and semester_number=1;
select set_config('finance.controlled_mutation','off',true);

select results_eq(
$$ select status::text from finance.execute_charge_generation_batch((select id from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'),'CG_SQL_BATCH_EXECUTE',null) $$,
$$ values ('COMPLETED'::text) $$,
'40 execute completa batch'
);
select is((select count(*) from finance.student_charges where external_reference like 'cg:%'), 2::bigint, '41 execute crea dos cargos reales');
select is((select count(*) from finance.student_charges where external_reference like 'cg:%' and original_amount = 1500.00), 2::bigint, '42 snapshot mantiene monto congelado tras cambio de rate');
select is((select total_generated from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'), 2::integer, '43 batch registra total_generated');
select is((select total_skipped from finance.charge_generation_batches where idempotency_key='CG_SQL_BATCH_CREATE'), 1::integer, '44 batch registra total_skipped');

select results_eq(
$$ select eligibility_status::text from finance.preview_charge_generation((select id from finance.charge_generation_rule_versions where created_by_account_id='ca730000-0000-4000-8000-000000000001' order by created_at desc limit 1),'ca741000-0000-4000-8000-000000000001',null) where student_record_id='ca745000-0000-4000-8000-000000000001' $$,
$$ values ('ALREADY_CHARGED'::text) $$,
'45 preview posterior marca duplicate estructural'
);

select is(
  (select count(*) from finance.financial_events where event_type in ('CHARGE_GENERATION_BATCH_CREATED','CHARGE_GENERATION_BATCH_APPROVED','CHARGE_GENERATED','CHARGE_GENERATION_COMPLETED')),
  5::bigint,
  '46 auditoría mínima del flujo queda registrada'
);

select * from finish();
rollback;
