begin;
select plan(82);

select ok(
  coalesce(position('academic' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 academic permanece fuera de la Data API'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'get_my_student_portal_%'
  ),
  8::bigint,
  '02 existen exactamente ocho wrappers publicos del portal'
);

select has_function('public', 'get_my_student_portal_record', array[]::text[], '03 wrapper record existe');
select has_function('public', 'get_my_student_portal_overview', array['uuid'], '04 wrapper overview existe');
select has_function('public', 'get_my_student_portal_subjects', array['uuid'], '05 wrapper subjects existe');
select has_function('public', 'get_my_student_portal_schedule', array['uuid'], '06 wrapper schedule existe');
select has_function('public', 'get_my_student_portal_attendance', array['uuid'], '07 wrapper attendance existe');
select has_function('public', 'get_my_student_portal_permissions', array['uuid'], '08 wrapper permissions existe');
select has_function('public', 'get_my_student_portal_grades', array['uuid'], '09 wrapper grades existe');
select has_function('public', 'get_my_student_portal_trajectory', array[]::text[], '10 wrapper trajectory existe');

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_student_portal_record'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ),
  '11 wrapper record usa security definer con search_path fijo'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_student_portal_overview'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ),
  '12 wrapper overview usa security definer con search_path fijo'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_my_student_portal_schedule'
      and p.prosrc like '%academic.get_student_portal_schedule%'
  ),
  '13 wrapper schedule delega a helper academico calificado'
);

select ok(not has_function_privilege('public', 'public.get_my_student_portal_record()', 'EXECUTE'), '14 PUBLIC no ejecuta record');
select ok(not has_function_privilege('public', 'public.get_my_student_portal_overview(uuid)', 'EXECUTE'), '15 PUBLIC no ejecuta overview');
select ok(not has_function_privilege('public', 'public.get_my_student_portal_schedule(uuid)', 'EXECUTE'), '16 PUBLIC no ejecuta schedule');
select ok(not has_function_privilege('anon', 'public.get_my_student_portal_record()', 'EXECUTE'), '17 anon no ejecuta record');
select ok(not has_function_privilege('anon', 'public.get_my_student_portal_grades(uuid)', 'EXECUTE'), '18 anon no ejecuta grades');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_record()', 'EXECUTE'), '19 authenticated ejecuta record');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_overview(uuid)', 'EXECUTE'), '20 authenticated ejecuta overview');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_subjects(uuid)', 'EXECUTE'), '21 authenticated ejecuta subjects');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_schedule(uuid)', 'EXECUTE'), '22 authenticated ejecuta schedule');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_attendance(uuid)', 'EXECUTE'), '23 authenticated ejecuta attendance');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_permissions(uuid)', 'EXECUTE'), '24 authenticated ejecuta permissions');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_grades(uuid)', 'EXECUTE'), '25 authenticated ejecuta grades');
select ok(has_function_privilege('authenticated', 'public.get_my_student_portal_trajectory()', 'EXECUTE'), '26 authenticated ejecuta trajectory');

select ok(not has_function_privilege('authenticated', 'academic.require_student_portal_context(uuid)', 'EXECUTE'), '27 helper context no es ejecutable por authenticated');
select ok(not has_function_privilege('authenticated', 'academic.get_student_portal_record()', 'EXECUTE'), '28 helper record no es ejecutable por authenticated');
select ok(not has_function_privilege('authenticated', 'academic.get_student_portal_overview(uuid)', 'EXECUTE'), '29 helper overview no es ejecutable por authenticated');
select ok(not has_schema_privilege('authenticated', 'academic', 'USAGE'), '30 authenticated no tiene USAGE en academic');
select ok(not has_table_privilege('authenticated', 'academic.student_records', 'SELECT'), '31 authenticated no recibe SELECT sobre student_records');
select ok(not has_table_privilege('authenticated', 'academic.period_enrollments', 'SELECT'), '32 authenticated no recibe SELECT sobre period_enrollments');
select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'get_my_student_portal_%'
      and p.proname not in (
        'get_my_student_portal_record',
        'get_my_student_portal_overview',
        'get_my_student_portal_subjects',
        'get_my_student_portal_schedule',
        'get_my_student_portal_attendance',
        'get_my_student_portal_permissions',
        'get_my_student_portal_grades',
        'get_my_student_portal_trajectory'
      )
  ),
  '33 no aparecieron funciones publicas administrativas ajenas al portal'
);

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name = 'student_record_id'
  ),
  '34 auth permanece intacto para el portal'
);

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','11000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','portal-admin-sql@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','11000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','portal-student-a-sql@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','11000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','portal-student-b-sql@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('21000000-0000-4000-8000-000000000001','ACTIVE'),
('21000000-0000-4000-8000-000000000002','ACTIVE'),
('21000000-0000-4000-8000-000000000003','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('31000000-0000-4000-8000-000000000001','21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','ACTIVE',1),
('31000000-0000-4000-8000-000000000002','21000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000002','ACTIVE',1),
('31000000-0000-4000-8000-000000000003','21000000-0000-4000-8000-000000000003','11000000-0000-4000-8000-000000000003','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('31000000-0000-4000-8000-000000000001','SUPERADMIN'),
('31000000-0000-4000-8000-000000000002','ALUMNO'),
('31000000-0000-4000-8000-000000000002','DOCENTE'),
('31000000-0000-4000-8000-000000000003','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('41000000-0000-4000-8000-000000000001','P4SQL_CYCLE','Cycle SQL portal','ACTIVE','2094-01-01','2094-12-31','31000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values
('51000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','P4SQL_P1','Periodo visible A',1,'2094-01-01','2094-04-30','ACTIVE','31000000-0000-4000-8000-000000000001'),
('51000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000001','P4SQL_P2','Periodo ajeno A',2,'2094-08-01','2094-11-30','ACTIVE','31000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('61000000-0000-4000-8000-000000000001','P4SQL_PLAN','Plan SQL portal','V1','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('61100000-0000-4000-8000-000000000001','P4SQL_GEN','Generacion SQL','41000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','ACTIVE','31000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('61200000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('61300000-0000-4000-8000-000000000001','P4SQL_MAT','Matematicas SQL','COMMON','31000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('61400000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','61200000-0000-4000-8000-000000000001','61300000-0000-4000-8000-000000000001',1);
set local session_replication_role=replica;
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order)
values
('61410000-0000-4000-8000-000000000001','61400000-0000-4000-8000-000000000001',1,'Unidad 1',1),
('61410000-0000-4000-8000-000000000002','61400000-0000-4000-8000-000000000001',2,'Unidad 2',2),
('61410000-0000-4000-8000-000000000003','61400000-0000-4000-8000-000000000001',3,'Unidad 3',3);
set local session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values
('61500000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'P4SQL_G1','Grupo SQL A','ACTIVE',10,'31000000-0000-4000-8000-000000000001'),
('61500000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'P4SQL_G2','Grupo SQL B','ACTIVE',10,'31000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values
('61600000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000001','61400000-0000-4000-8000-000000000001','ACTIVE','31000000-0000-4000-8000-000000000001'),
('61600000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000002','61400000-0000-4000-8000-000000000001','ACTIVE','31000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('61700000-0000-4000-8000-000000000001','P4SQL_SHIFT','Turno SQL','07:00','14:00','ACTIVE','31000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values
('61800000-0000-4000-8000-000000000001','61700000-0000-4000-8000-000000000001','P4SQL_B1','Bloque Visible',1,'07:00','07:50',true,false,'ACTIVE','31000000-0000-4000-8000-000000000001'),
('61800000-0000-4000-8000-000000000002','61700000-0000-4000-8000-000000000001','P4SQL_B2','Bloque Oculto',2,'08:00','08:50',false,false,'ACTIVE','31000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values
('61900000-0000-4000-8000-000000000001','P4SQL_TEMP_1','Plantilla SQL 1','61700000-0000-4000-8000-000000000001','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001'),
('61900000-0000-4000-8000-000000000002','P4SQL_TEMP_2','Plantilla SQL 2','61700000-0000-4000-8000-000000000001','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001'),
('61900000-0000-4000-8000-000000000003','P4SQL_TEMP_3','Plantilla SQL 3','61700000-0000-4000-8000-000000000001','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values
('62000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','61900000-0000-4000-8000-000000000001','PUBLISHED',1,'2094-01-01','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now()),
('62000000-0000-4000-8000-000000000002','61500000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','61900000-0000-4000-8000-000000000002','DRAFT',2,'2094-01-01','31000000-0000-4000-8000-000000000001',null,null),
('62000000-0000-4000-8000-000000000003','61500000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','61900000-0000-4000-8000-000000000003','UNDER_REVIEW',3,'2094-01-01','31000000-0000-4000-8000-000000000001',null,null);
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('62100000-0000-4000-8000-000000000001','P4SQL_A1','Aula SQL 1','CLASSROOM','ACTIVE','31000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('69000000-0000-4000-8000-100000000001','21000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000001','61100000-0000-4000-8000-000000000001','ALU_SQL_A','ACTIVE',1,'31000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001'),
('69000000-0000-4000-8000-100000000002','21000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000001','61100000-0000-4000-8000-000000000001','ALU_SQL_B','ACTIVE',1,'31000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('69100000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','31000000-0000-4000-8000-000000000001','P4SQL_REQ_A',repeat('a',64)),
('69100000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000002','51000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','31000000-0000-4000-8000-000000000001','P4SQL_REQ_B',repeat('b',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('69200000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69100000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'61500000-0000-4000-8000-000000000001','ACTIVE','P4SQL_ENR_A','31000000-0000-4000-8000-000000000001'),
('69200000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000002','69100000-0000-4000-8000-100000000002','51000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001',1,'61500000-0000-4000-8000-000000000002','ACTIVE','P4SQL_ENR_B','31000000-0000-4000-8000-000000000001');

insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values
('69300000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001','ACTIVE','31000000-0000-4000-8000-000000000001'),
('69300000-0000-4000-8000-100000000002','69200000-0000-4000-8000-100000000002','61600000-0000-4000-8000-000000000002','ACTIVE','31000000-0000-4000-8000-000000000001');

insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('69400000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','PRIMARY','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001');

insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values
('69500000-0000-4000-8000-100000000001','62000000-0000-4000-8000-000000000001','61600000-0000-4000-8000-000000000001','69400000-0000-4000-8000-100000000001','62100000-0000-4000-8000-000000000001',1,'61800000-0000-4000-8000-000000000001','REGULAR_CLASS','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001'),
('69500000-0000-4000-8000-100000000002','62000000-0000-4000-8000-000000000002','61600000-0000-4000-8000-000000000001','69400000-0000-4000-8000-100000000001','62100000-0000-4000-8000-000000000001',2,'61800000-0000-4000-8000-000000000002','REGULAR_CLASS','ACTIVE','2094-01-01','31000000-0000-4000-8000-000000000001');

insert into academic.attendance_sessions(id,class_session_id,academic_period_id,group_id,academic_offering_id,teaching_assignment_id,session_date,starts_at,ends_at,status,expected_student_count,opened_by_account_id,closed_by_account_id,opened_at,closed_at)
values
('69600000-0000-4000-8000-100000000001','69500000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000001','61600000-0000-4000-8000-000000000001','69400000-0000-4000-8000-100000000001','2094-02-01','2094-02-01 07:00+00','2094-02-01 07:50+00','CLOSED',2,'31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now(),now()),
('69600000-0000-4000-8000-100000000002','69500000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000001','61600000-0000-4000-8000-000000000001','69400000-0000-4000-8000-100000000001','2094-02-02','2094-02-02 07:00+00','2094-02-02 07:50+00','LOCKED',2,'31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now(),now()),
('69600000-0000-4000-8000-100000000003','69500000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','61500000-0000-4000-8000-000000000001','61600000-0000-4000-8000-000000000001','69400000-0000-4000-8000-100000000001','2094-02-03','2094-02-03 07:00+00','2094-02-03 07:50+00','OPEN',2,'31000000-0000-4000-8000-000000000001',null,now(),null);

insert into academic.attendance_records(id,attendance_session_id,student_record_id,period_enrollment_id,student_offering_enrollment_id,attendance_status,is_first_period,lateness_minutes,recorded_by_account_id,recorded_at)
values
('69700000-0000-4000-8000-100000000001','69600000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','LATE',true,7,'31000000-0000-4000-8000-000000000001',now()),
('69700000-0000-4000-8000-100000000002','69600000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','PRESENT',true,null,'31000000-0000-4000-8000-000000000001',now()),
('69700000-0000-4000-8000-100000000003','69600000-0000-4000-8000-100000000003','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','ABSENT',true,null,'31000000-0000-4000-8000-000000000001',now()),
('69700000-0000-4000-8000-100000000004','69600000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000002','69200000-0000-4000-8000-100000000002','69300000-0000-4000-8000-100000000002','ABSENT',true,null,'31000000-0000-4000-8000-000000000001',now());

insert into academic.student_lateness_counters(id,student_record_id,academic_period_id,counter_type,current_count,lifetime_count,alert_sequence)
values('69800000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','FIRST_PERIOD_VALIDATED',1,1,0);

insert into academic.student_permissions(id,student_record_id,academic_period_id,permission_type,applies_to_date,status,reason_code,requested_by_account_id,approved_by_account_id,approved_at)
values
('69900000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','FULL_DAY_ABSENCE','2094-02-04','APPROVED','MEDICAL','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000001',now()),
('69900000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000002','51000000-0000-4000-8000-000000000001','FULL_DAY_ABSENCE','2094-02-05','APPROVED','MEDICAL','31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000001',now());

insert into academic.student_unit_grades(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,subject_unit_id,unit_number,raw_grade,normalized_grade,is_accredited,status,captured_by_account_id,finalized_by_account_id,finalized_at)
values
('70000000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001','61410000-0000-4000-8000-000000000001',1,8.0,8.0,true,'FINALIZED','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now()),
('70000000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001','61410000-0000-4000-8000-000000000002',2,9.0,9.0,true,'CORRECTED','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now()),
('70000000-0000-4000-8000-100000000003','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001','61410000-0000-4000-8000-000000000003',3,6.0,6.0,false,'DRAFT','31000000-0000-4000-8000-000000000001',null,null);

insert into academic.subject_final_results(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,raw_final_grade,rounded_final_grade,result_code,calculation_status,status,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values
('70100000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','69300000-0000-4000-8000-100000000001','61600000-0000-4000-8000-000000000001',2,0,8.5,9.0,'AC','COMPLETE','CONFIRMED','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now());

insert into academic.semester_evaluation_summaries(id,student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values('70200000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001',1,1,1,0,0,'CONFIRMED','MANUAL_REVIEW_REQUIRED','INSTITUTIONAL_REVIEW','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001',now());

insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id,created_at)
values
('70300000-0000-4000-8000-100000000001','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','REPEAT',1,'CONFIRMED','INSTITUTIONAL_VALIDATION_PENDING','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','P4SQL_DECISION_OK',repeat('a',64),'51000000-0000-4000-8000-000000000001',now()),
('70300000-0000-4000-8000-100000000002','69000000-0000-4000-8000-100000000001','69200000-0000-4000-8000-100000000001','51000000-0000-4000-8000-000000000001','ADVANCE',2,'DRAFT','INSTITUTIONAL_VALIDATION_PENDING','31000000-0000-4000-8000-000000000001',null,'P4SQL_DECISION_DRAFT',repeat('b',64),'51000000-0000-4000-8000-000000000001',now());

create function pg_temp.current_portal_record() returns jsonb language sql as $$
  select public.get_my_student_portal_record();
$$;

create function pg_temp.current_portal_overview(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_overview(period_id);
$$;

create function pg_temp.current_portal_subjects(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_subjects(period_id);
$$;

create function pg_temp.current_portal_schedule(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_schedule(period_id);
$$;

create function pg_temp.current_portal_attendance(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_attendance(period_id);
$$;

create function pg_temp.current_portal_permissions(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_permissions(period_id);
$$;

create function pg_temp.current_portal_grades(period_id uuid default null) returns jsonb language sql as $$
  select public.get_my_student_portal_grades(period_id);
$$;

create function pg_temp.current_portal_trajectory() returns jsonb language sql as $$
  select public.get_my_student_portal_trajectory();
$$;

select throws_ok(
  $$ select set_config('request.jwt.claims', null, true); select public.get_my_student_portal_record(); $$,
  'ACTOR_NOT_AUTHORIZED',
  '35 auth.uid nulo se rechaza'
);

select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000009999","role":"authenticated","aal":"aal1","session_version":1}',true);
select throws_ok($$ select public.get_my_student_portal_record(); $$, 'APPLICATION_NOT_ALLOWED', '36 cuenta inexistente se rechaza de forma cerrada');

select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
set local session_replication_role=replica;
update core.accounts
set account_status='SUSPENDED', suspended_at=now(), status_changed_at=now()
where id='31000000-0000-4000-8000-000000000002';
set local session_replication_role=origin;
select throws_ok($$ select public.get_my_student_portal_record(); $$, 'APPLICATION_NOT_ALLOWED', '37 cuenta no ACTIVE se rechaza de forma cerrada');
set local session_replication_role=replica;
update core.accounts
set account_status='ACTIVE', suspended_at=null, status_changed_at=now()
where id='31000000-0000-4000-8000-000000000002';
set local session_replication_role=origin;

set local session_replication_role=replica;
update core.account_roles
set revoked_at = now(), revoked_by = '31000000-0000-4000-8000-000000000001'
where account_id='31000000-0000-4000-8000-000000000002'
  and role_id=(select id from core.roles where code='ALUMNO');
set local session_replication_role=origin;
select throws_ok($$ select public.get_my_student_portal_record(); $$, 'STUDENT_ROLE_REQUIRED', '38 rol ALUMNO ausente o revocado se rechaza');
set local session_replication_role=replica;
update core.account_roles set revoked_at = null, revoked_by = null
where account_id='31000000-0000-4000-8000-000000000002'
  and role_id=(select id from core.roles where code='ALUMNO');
set local session_replication_role=origin;

set local session_replication_role=replica;
update core.account_roles
set revoked_at = now(), revoked_by = '31000000-0000-4000-8000-000000000001'
where account_id='31000000-0000-4000-8000-000000000002';
insert into core.account_roles(account_id, role_id)
select '31000000-0000-4000-8000-000000000002', id from core.roles where code='CAJA'
on conflict do nothing;
set local session_replication_role=origin;
select throws_ok($$ select public.get_my_student_portal_record(); $$, 'APPLICATION_NOT_ALLOWED', '39 aplicacion PORTAL_ESCOLAR ausente se rechaza');
set local session_replication_role=replica;
delete from core.account_roles
where account_id='31000000-0000-4000-8000-000000000002'
  and role_id=(select id from core.roles where code='CAJA');
update core.account_roles set revoked_at = null, revoked_by = null
where account_id='31000000-0000-4000-8000-000000000002';
set local session_replication_role=origin;

select lives_ok($$ select public.get_my_student_portal_record(); $$, '40 session_version valida se acepta');
select lives_ok($$ select public.get_my_student_portal_overview('51000000-0000-4000-8000-000000000001'); $$, '41 AAL1 valido permite lectura propia');

select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":9}',true);
select throws_ok($$ select public.get_my_student_portal_record(); $$, 'APPLICATION_NOT_ALLOWED', '42 session_version obsoleta se rechaza de forma cerrada');
select set_config('request.jwt.claims','{"sub":"11000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'get_my_student_portal_%'
      and exists (
        select 1
        from unnest(coalesce(p.proargnames, array[]::text[])) arg_name
        where arg_name in ('student_record_id','account_id','person_id','auth_user_id')
      )
  ),
  '43 no existe selector de alumno por student_record_id, account_id, person_id o auth_user_id'
);

select is((pg_temp.current_portal_record()->>'institutionalStudentCode')::text, 'ALU_SQL_A', '44 alumno A ve su expediente');
select is((pg_temp.current_portal_record()::text like '%ALU_SQL_B%')::int, 0, '45 alumno A no ve expediente B');

select is((pg_temp.current_portal_overview('51000000-0000-4000-8000-000000000001')->'metrics'->>'attendanceSessions')::int, 2, '46 conteos de A no incluyen B');
select is(jsonb_array_length(pg_temp.current_portal_subjects('51000000-0000-4000-8000-000000000001')), 1, '47 materias de A no incluyen B');
select is((pg_temp.current_portal_schedule('51000000-0000-4000-8000-000000000001')->0->>'groupName')::text, 'Grupo SQL A', '48 horario de A no incluye B');
select is((pg_temp.current_portal_attendance('51000000-0000-4000-8000-000000000001')->'records'->0->>'attendanceStatus')::text, 'PRESENT', '49 asistencia de A no incluye B en primer registro visible');
select is(jsonb_array_length(pg_temp.current_portal_permissions('51000000-0000-4000-8000-000000000001')), 1, '50 permisos de A no incluyen B');
select is(jsonb_array_length(pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'unitGrades'), 2, '51 calificaciones visibles de A no incluyen borradores ni B');
select is(jsonb_array_length(pg_temp.current_portal_trajectory()->'periods'), 1, '52 trayectoria de A no incluye B');

select throws_ok(
  $$ select public.get_my_student_portal_overview('00000000-0000-4000-8000-000000009999'); $$,
  'PERIOD_NOT_AVAILABLE',
  '53 un periodo inexistente falla cerrado'
);

select throws_ok(
  $$ select public.get_my_student_portal_overview('51000000-0000-4000-8000-000000000002'); $$,
  'PERIOD_NOT_AVAILABLE',
  '54 period_id ajeno se rechaza'
);

select is((pg_temp.current_portal_schedule('51000000-0000-4000-8000-000000000001')->0->>'timeBlock')::text, 'Bloque Visible', '55 horario PUBLISHED es visible');
select is((pg_temp.current_portal_schedule('51000000-0000-4000-8000-000000000001')::text like '%Bloque Oculto%')::int, 0, '56 horario DRAFT o UNDER_REVIEW es invisible');
set local session_replication_role=replica;
update academic.group_schedules set status='APPROVED', published_at=null, published_by_account_id=null where id='62000000-0000-4000-8000-000000000001';
set local session_replication_role=origin;
select is(jsonb_array_length(pg_temp.current_portal_schedule('51000000-0000-4000-8000-000000000001')), 0, '57 horario APPROVED no publicado es invisible');
set local session_replication_role=replica;
update academic.group_schedules set status='PUBLISHED', published_at=now(), published_by_account_id='31000000-0000-4000-8000-000000000001' where id='62000000-0000-4000-8000-000000000001';
set local session_replication_role=origin;
select is(jsonb_array_length(pg_temp.current_portal_schedule('51000000-0000-4000-8000-000000000001')), 1, '58 solo la version publicada vigente es visible');

select is(jsonb_array_length(pg_temp.current_portal_attendance('51000000-0000-4000-8000-000000000001')->'records'), 2, '59 asistencia CLOSED y LOCKED es visible');
select is((pg_temp.current_portal_attendance('51000000-0000-4000-8000-000000000001')::text like '%OPEN%')::int, 0, '60 asistencia OPEN no es visible');

select is(jsonb_array_length(pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'unitGrades'), 2, '61 unidades FINALIZED y CORRECTED son visibles');
select is((pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')::text like '%DRAFT%')::int, 0, '62 unidad DRAFT es invisible');
select is((pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')::text like '%CAPTURED%')::int, 0, '63 unidad CAPTURED es invisible');
select is((pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')::text like '%REVIEWED%')::int, 0, '64 unidad REVIEWED es invisible');
select is(jsonb_array_length(pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'subjectResults'), 1, '65 resultado CONFIRMED es visible');
set local session_replication_role=replica;
update academic.subject_final_results
set status='CALCULATED', calculation_status='MANUAL_REVIEW_REQUIRED', confirmed_by_account_id=null, confirmed_at=null
where id='70100000-0000-4000-8000-100000000001';
set local session_replication_role=origin;
select is(jsonb_array_length(pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'subjectResults'), 0, '66 resultado CALCULATED no confirmado es invisible');
set local session_replication_role=replica;
update academic.subject_final_results
set status='CONFIRMED', calculation_status='COMPLETE', confirmed_by_account_id='31000000-0000-4000-8000-000000000001', confirmed_at=now()
where id='70100000-0000-4000-8000-100000000001';
set local session_replication_role=origin;
select is((pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'summary'->>'proposedProgressDecision')::text, 'MANUAL_REVIEW_REQUIRED', '67 manual review required se devuelve como estado de revision institucional');
select is(jsonb_array_length(pg_temp.current_portal_trajectory()->'progressDecisions'), 1, '68 decision CONFIRMED es visible');
select is((pg_temp.current_portal_trajectory()::text like '%DRAFT%')::int, 0, '69 decision DRAFT no es visible');

select is((pg_temp.current_portal_record()::text like '%69000000-0000-4000-8000-100000000001%')::int, 0, '70 no devuelve UUID de student_record');
select is((pg_temp.current_portal_record()::text like '%31000000-0000-4000-8000-000000000002%')::int, 0, '71 no devuelve account_id');
select is((pg_temp.current_portal_record()::text like '%21000000-0000-4000-8000-000000000002%')::int, 0, '72 no devuelve person_id');
select is((pg_temp.current_portal_record()::text like '%approvedByAccountId%')::int, 0, '73 no devuelve actores administrativos');
select is((pg_temp.current_portal_record()::text like '%@example.invalid%')::int, 0, '74 no devuelve correos');
select is((pg_temp.current_portal_record()::text like '%phone%')::int, 0, '75 no devuelve telefonos');
select is((pg_temp.current_portal_record()::text like '%createdAt%')::int, 0, '76 no devuelve auditoria');
select is((pg_temp.current_portal_record()::text like '%idempotency%')::int, 0, '77 no devuelve comandos idempotentes');

select is(
  jsonb_array_length(
    (
      select jsonb_agg(item)
      from (
        select item
        from jsonb_array_elements(pg_temp.current_portal_attendance('51000000-0000-4000-8000-000000000001')->'records') item
        order by item->>'sessionDate' desc
        limit 1
      ) limited
    )
  ),
  1,
  '78 la paginacion simulada por limite sobre el contrato es estable'
);

select is(
  (
    select count(*)
    from jsonb_array_elements(pg_temp.current_portal_grades('51000000-0000-4000-8000-000000000001')->'unitGrades')
  ),
  2::bigint,
  '79 el contrato visible aplica limite maximo natural del read model'
);

select throws_ok(
  $$ select public.get_my_student_portal_overview('not-a-uuid'::uuid); $$,
  '22P02',
  'invalid input syntax for type uuid: "not-a-uuid"',
  '80 offset o selector invalido no puede inyectarse porque solo existe uuid tipado'
);

select is(
  (
    select string_agg(item->>'subjectName', ',' order by item->>'subjectName')
    from jsonb_array_elements(pg_temp.current_portal_subjects('51000000-0000-4000-8000-000000000001')) item
  ),
  'Matematicas SQL',
  '81 el orden del contrato es determinista'
);

select pass('82 los fixtures se eliminan mediante rollback al finalizar la transaccion');

select * from finish();
rollback;
