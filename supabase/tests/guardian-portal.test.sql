begin;
create extension if not exists pgtap;
select plan(104);

select has_table('academic', 'guardian_access_scopes', '01 tabla guardian_access_scopes existe');
select has_table('academic', 'guardian_student_link_requests', '02 tabla guardian_student_link_requests existe');
select has_table('academic', 'guardian_student_links', '03 tabla guardian_student_links existe');
select has_table('academic', 'guardian_student_link_history', '04 tabla guardian_student_link_history existe');
select has_table('academic', 'guardian_portal_commands', '05 tabla guardian_portal_commands existe');
select has_table('academic', 'guardian_portal_events', '06 tabla guardian_portal_events existe');

select has_type('academic', 'guardian_link_request_status', '07 enum guardian_link_request_status existe');
select has_type('academic', 'guardian_link_status', '08 enum guardian_link_status existe');
select has_type('academic', 'guardian_scope_status', '09 enum guardian_scope_status existe');

select has_index('academic', 'guardian_student_link_requests', 'guardian_link_request_one_operational', '10 índice único de solicitudes existe');
select has_index('academic', 'guardian_student_links', 'guardian_link_one_operational', '11 índice único de vínculos existe');

select has_trigger('academic', 'guardian_access_scopes', 'guardian_access_scopes_guardian_history', '12 trigger de scopes existe');
select has_trigger('academic', 'guardian_student_link_requests', 'guardian_student_link_requests_guardian_history', '13 trigger de solicitudes existe');
select has_trigger('academic', 'guardian_student_links', 'guardian_student_links_guardian_history', '14 trigger de vínculos existe');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname in ('guardian_access_scopes','guardian_student_link_requests','guardian_student_links','guardian_student_link_history','guardian_portal_commands','guardian_portal_events') and c.relrowsecurity),
  6,
  '15 RLS habilitada en las seis tablas'
);

select is(
  (select count(*)::int from pg_policies where schemaname='academic' and tablename in ('guardian_access_scopes','guardian_student_link_requests','guardian_student_links','guardian_student_link_history','guardian_portal_commands','guardian_portal_events')),
  0,
  '16 no hay policies directas'
);

select is_empty(
  $$ select 1
     from information_schema.role_table_grants
     where table_schema='academic'
       and table_name in ('guardian_access_scopes','guardian_student_link_requests','guardian_student_links','guardian_student_link_history','guardian_portal_commands','guardian_portal_events')
       and grantee in ('PUBLIC','anon','authenticated') $$,
  '17 no hay grants directos de tabla'
);

select is_empty(
  $$ select 1
     from information_schema.role_usage_grants
     where object_schema='academic'
       and grantee in ('anon','authenticated') $$,
  '18 academic sin USAGE para anon/authenticated'
);

select ok(
  coalesce(position('academic' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '19 academic no expone tablas en Data API'
);

select ok(
  exists(
    select 1
    from information_schema.role_routine_grants
    where routine_schema='public'
      and routine_name='get_my_guardian_student_overview'
      and grantee='authenticated'
      and privilege_type='EXECUTE'
  ),
  '20 wrappers públicos conservan mínimo EXECUTE para authenticated'
);

select is_empty(
  $$ select 1
     from information_schema.role_routine_grants
     where routine_schema='academic'
       and routine_name in (
         'create_guardian_link_request',
         'submit_guardian_link_request',
         'begin_guardian_link_review',
         'approve_guardian_link_request',
         'reject_guardian_link_request',
         'cancel_guardian_link_request',
         'expire_guardian_link_request',
         'change_guardian_link_request_status',
         'create_guardian_student_link',
         'activate_guardian_student_link',
         'suspend_guardian_student_link',
         'reactivate_guardian_student_link',
         'revoke_guardian_student_link',
         'expire_guardian_student_link'
       )
       and grantee='PUBLIC'
       and privilege_type='EXECUTE' $$,
  '21 funciones administrativas sin EXECUTE para PUBLIC'
);

select is_empty(
  $$ select 1
     from information_schema.role_routine_grants
     where routine_schema='academic'
       and routine_name in (
         'create_guardian_link_request',
         'submit_guardian_link_request',
         'begin_guardian_link_review',
         'approve_guardian_link_request',
         'reject_guardian_link_request',
         'cancel_guardian_link_request',
         'expire_guardian_link_request',
         'change_guardian_link_request_status',
         'create_guardian_student_link',
         'activate_guardian_student_link',
         'suspend_guardian_student_link',
         'reactivate_guardian_student_link',
         'revoke_guardian_student_link',
         'expire_guardian_student_link'
       )
       and grantee='anon'
       and privilege_type='EXECUTE' $$,
  '22 funciones administrativas sin EXECUTE para anon'
);

select is_empty(
  $$ select 1
     from information_schema.role_routine_grants
     where routine_schema='academic'
       and routine_name in (
         'create_guardian_link_request',
         'submit_guardian_link_request',
         'begin_guardian_link_review',
         'approve_guardian_link_request',
         'reject_guardian_link_request',
         'cancel_guardian_link_request',
         'expire_guardian_link_request',
         'change_guardian_link_request_status',
         'create_guardian_student_link',
         'activate_guardian_student_link',
         'suspend_guardian_student_link',
         'reactivate_guardian_student_link',
         'revoke_guardian_student_link',
         'expire_guardian_student_link'
       )
       and grantee='authenticated'
       and privilege_type='EXECUTE' $$,
  '23 funciones administrativas sin EXECUTE para authenticated'
);

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','guardian-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','guardian-tutor@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','guardian-student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','guardian-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','guardian-control@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','guardian-docente@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000007','authenticated','authenticated','synthetic','guardian-prefectura@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000008','authenticated','authenticated','synthetic','guardian-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000009','authenticated','authenticated','synthetic','guardian-alumno@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000010','authenticated','authenticated','synthetic','guardian-aspirante@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000011','authenticated','authenticated','synthetic','guardian-tutor-suspended@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000012','authenticated','authenticated','synthetic','guardian-student-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000013','authenticated','authenticated','synthetic','guardian-tutor-future@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000014','authenticated','authenticated','synthetic','guardian-self-tutor@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','51000000-0000-4000-8000-000000000015','authenticated','authenticated','synthetic','guardian-second-tutor@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('52000000-0000-4000-8000-000000000001','ACTIVE'),
('52000000-0000-4000-8000-000000000002','ACTIVE'),
('52000000-0000-4000-8000-000000000003','ACTIVE'),
('52000000-0000-4000-8000-000000000004','ACTIVE'),
('52000000-0000-4000-8000-000000000005','ACTIVE'),
('52000000-0000-4000-8000-000000000006','ACTIVE'),
('52000000-0000-4000-8000-000000000007','ACTIVE'),
('52000000-0000-4000-8000-000000000008','ACTIVE'),
('52000000-0000-4000-8000-000000000009','ACTIVE'),
('52000000-0000-4000-8000-000000000010','ACTIVE'),
('52000000-0000-4000-8000-000000000011','ACTIVE'),
('52000000-0000-4000-8000-000000000012','ACTIVE'),
('52000000-0000-4000-8000-000000000013','ACTIVE'),
('52000000-0000-4000-8000-000000000014','ACTIVE'),
('52000000-0000-4000-8000-000000000015','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version,suspended_at) values
('53000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','51000000-0000-4000-8000-000000000001','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','51000000-0000-4000-8000-000000000002','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000003','52000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000003','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000004','52000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000004','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000005','52000000-0000-4000-8000-000000000005','51000000-0000-4000-8000-000000000005','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000006','52000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000006','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000007','52000000-0000-4000-8000-000000000007','51000000-0000-4000-8000-000000000007','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000008','52000000-0000-4000-8000-000000000008','51000000-0000-4000-8000-000000000008','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000009','52000000-0000-4000-8000-000000000009','51000000-0000-4000-8000-000000000009','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000010','52000000-0000-4000-8000-000000000010','51000000-0000-4000-8000-000000000010','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000011','52000000-0000-4000-8000-000000000011','51000000-0000-4000-8000-000000000011','SUSPENDED',1,now()),
('53000000-0000-4000-8000-000000000012','52000000-0000-4000-8000-000000000012','51000000-0000-4000-8000-000000000012','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000013','52000000-0000-4000-8000-000000000013','51000000-0000-4000-8000-000000000013','ACTIVE',2,null),
('53000000-0000-4000-8000-000000000014','52000000-0000-4000-8000-000000000014','51000000-0000-4000-8000-000000000014','ACTIVE',1,null),
('53000000-0000-4000-8000-000000000015','52000000-0000-4000-8000-000000000015','51000000-0000-4000-8000-000000000015','ACTIVE',1,null);

insert into core.account_roles(account_id, role_id)
select actor::uuid, r.id
from (values
('53000000-0000-4000-8000-000000000001','SUPERADMIN'),
('53000000-0000-4000-8000-000000000002','TUTOR'),
('53000000-0000-4000-8000-000000000003','ALUMNO'),
('53000000-0000-4000-8000-000000000004','ADMINISTRATIVO'),
('53000000-0000-4000-8000-000000000005','CONTROL_ESCOLAR'),
('53000000-0000-4000-8000-000000000006','DOCENTE'),
('53000000-0000-4000-8000-000000000007','PREFECTURA'),
('53000000-0000-4000-8000-000000000008','CAJA'),
('53000000-0000-4000-8000-000000000009','ALUMNO'),
('53000000-0000-4000-8000-000000000010','ASPIRANTE'),
('53000000-0000-4000-8000-000000000011','TUTOR'),
('53000000-0000-4000-8000-000000000012','ALUMNO'),
('53000000-0000-4000-8000-000000000013','TUTOR'),
('53000000-0000-4000-8000-000000000014','TUTOR'),
('53000000-0000-4000-8000-000000000015','TUTOR')
) seeded(actor, role_code)
join core.roles r on r.code=seeded.role_code;

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('54000000-0000-4000-8000-000000000001','GUA_CYCLE','Cycle','ACTIVE','2099-01-01','2099-12-31','53000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values
('54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000001','GUA_P1','Periodo 1',1,'2099-01-01','2099-06-30','ACTIVE','53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000001','GUA_P2','Periodo 2',2,'2099-07-01','2099-12-31','ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('54000000-0000-4000-8000-000000000004','GUA_PLAN','Plan','V1','ACTIVE','2099-01-01','53000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('54000000-0000-4000-8000-000000000005','GUA_GEN','Generación','54000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000004','ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('54000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-000000000004',1,'Primer semestre',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('54000000-0000-4000-8000-000000000007','GUA_SUB','Materia','COMMON','53000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('54000000-0000-4000-8000-000000000008','54000000-0000-4000-8000-000000000004','54000000-0000-4000-8000-000000000006','54000000-0000-4000-8000-000000000007',1);
set local session_replication_role=replica;
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order)
values
('54000000-0000-4000-8000-000000000009','54000000-0000-4000-8000-000000000008',1,'Unidad 1',1),
('54000000-0000-4000-8000-000000000046','54000000-0000-4000-8000-000000000008',2,'Unidad 2',2),
('54000000-0000-4000-8000-000000000047','54000000-0000-4000-8000-000000000008',3,'Unidad 3',3);
set local session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000004',1,'GUA_G1','Grupo','ACTIVE',20,'53000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values('54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000008','ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('54000000-0000-4000-8000-000000000012','GUA_SHIFT','Turno','07:00','14:00','ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values('54000000-0000-4000-8000-000000000013','54000000-0000-4000-8000-000000000012','GUA_B1','Bloque 1',1,'07:00','07:50',true,false,'ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values('54000000-0000-4000-8000-000000000014','GUA_TMP','Plantilla','54000000-0000-4000-8000-000000000012','ACTIVE','2099-01-01','53000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values
('54000000-0000-4000-8000-000000000015','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000014','PUBLISHED',1,'2099-01-01','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000016','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000014','DRAFT',2,'2099-01-01','53000000-0000-4000-8000-000000000001',null,null);
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('54000000-0000-4000-8000-000000000017','GUA_A1','Aula','CLASSROOM','ACTIVE','53000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id)
values
('54000000-0000-4000-8000-000000000018','52000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000004','54000000-0000-4000-8000-000000000005','GUA001','ACTIVE',1,'53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000019','52000000-0000-4000-8000-000000000012','53000000-0000-4000-8000-000000000012','54000000-0000-4000-8000-000000000004','54000000-0000-4000-8000-000000000005','GUA002','ACTIVE',1,'53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000048','52000000-0000-4000-8000-000000000014','53000000-0000-4000-8000-000000000014','54000000-0000-4000-8000-000000000004','54000000-0000-4000-8000-000000000005','GUA003','ACTIVE',1,'53000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('54000000-0000-4000-8000-000000000020','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000002','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','53000000-0000-4000-8000-000000000001','GUA_ENR_A',repeat('a',64)),
('54000000-0000-4000-8000-000000000021','54000000-0000-4000-8000-000000000019','54000000-0000-4000-8000-000000000002','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','53000000-0000-4000-8000-000000000001','GUA_ENR_B',repeat('b',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000020','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000004',1,'54000000-0000-4000-8000-000000000010','ACTIVE','ENR_A','53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000023','54000000-0000-4000-8000-000000000019','54000000-0000-4000-8000-000000000021','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000004',1,'54000000-0000-4000-8000-000000000010','ACTIVE','ENR_B','53000000-0000-4000-8000-000000000001');
insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values
('54000000-0000-4000-8000-000000000024','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000011','ACTIVE','53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000025','54000000-0000-4000-8000-000000000023','54000000-0000-4000-8000-000000000011','ACTIVE','53000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values
('54000000-0000-4000-8000-000000000026','54000000-0000-4000-8000-000000000011','53000000-0000-4000-8000-000000000001','PRIMARY','ACTIVE','2099-01-01','53000000-0000-4000-8000-000000000001');
insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values
('54000000-0000-4000-8000-000000000027','54000000-0000-4000-8000-000000000015','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000026','54000000-0000-4000-8000-000000000017',1,'54000000-0000-4000-8000-000000000013','REGULAR_CLASS','ACTIVE','2099-01-01','53000000-0000-4000-8000-000000000001'),
('54000000-0000-4000-8000-000000000028','54000000-0000-4000-8000-000000000016','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000026','54000000-0000-4000-8000-000000000017',2,'54000000-0000-4000-8000-000000000013','REGULAR_CLASS','ACTIVE','2099-01-01','53000000-0000-4000-8000-000000000001');
insert into academic.attendance_sessions(id,class_session_id,academic_period_id,group_id,academic_offering_id,teaching_assignment_id,session_date,starts_at,ends_at,status,expected_student_count,opened_by_account_id,closed_by_account_id,opened_at,closed_at)
values
('54000000-0000-4000-8000-000000000029','54000000-0000-4000-8000-000000000027','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000026','2099-02-01','2099-02-01 07:00+00','2099-02-01 07:50+00','CLOSED',2,'53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now(),now()),
('54000000-0000-4000-8000-000000000030','54000000-0000-4000-8000-000000000027','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000026','2099-02-02','2099-02-02 07:00+00','2099-02-02 07:50+00','LOCKED',2,'53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now(),now()),
('54000000-0000-4000-8000-000000000031','54000000-0000-4000-8000-000000000027','54000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000010','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000026','2099-02-03','2099-02-03 07:00+00','2099-02-03 07:50+00','OPEN',2,'53000000-0000-4000-8000-000000000001',null,now(),null);
insert into academic.attendance_records(id,attendance_session_id,student_record_id,period_enrollment_id,student_offering_enrollment_id,attendance_status,is_first_period,lateness_minutes,recorded_by_account_id,recorded_at)
values
('54000000-0000-4000-8000-000000000032','54000000-0000-4000-8000-000000000029','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','LATE',true,5,'53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000033','54000000-0000-4000-8000-000000000030','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','PRESENT',false,null,'53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000034','54000000-0000-4000-8000-000000000031','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','PRESENT',false,null,'53000000-0000-4000-8000-000000000001',now());
insert into academic.student_lateness_counters(id,student_record_id,academic_period_id,counter_type,current_count,lifetime_count,alert_sequence)
values('54000000-0000-4000-8000-000000000035','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000002','FIRST_PERIOD_VALIDATED',1,1,0);
insert into academic.student_permissions(id,student_record_id,academic_period_id,permission_type,applies_to_date,status,reason_code,requested_by_account_id,approved_by_account_id,approved_at)
values('54000000-0000-4000-8000-000000000036','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000002','FULL_DAY_ABSENCE','2099-02-04','APPROVED','MEDICAL','53000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000001',now());
insert into academic.student_unit_grades(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,subject_unit_id,unit_number,raw_grade,normalized_grade,is_accredited,status,captured_by_account_id,finalized_by_account_id,finalized_at)
values
('54000000-0000-4000-8000-000000000037','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000009',1,9.0,9.0,true,'FINALIZED','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000038','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000046',2,8.0,8.0,true,'CORRECTED','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000039','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','54000000-0000-4000-8000-000000000011','54000000-0000-4000-8000-000000000047',3,7.0,7.0,true,'DRAFT','53000000-0000-4000-8000-000000000001',null,null);
insert into academic.subject_final_results(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,raw_final_grade,rounded_final_grade,result_code,calculation_status,status,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values
('54000000-0000-4000-8000-000000000040','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000024','54000000-0000-4000-8000-000000000011',2,0,9.0,9.0,'AC','COMPLETE','CONFIRMED','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000041','54000000-0000-4000-8000-000000000019','54000000-0000-4000-8000-000000000023','54000000-0000-4000-8000-000000000025','54000000-0000-4000-8000-000000000011',0,1,5.0,5.0,'NA','COMPLETE','CALCULATED','53000000-0000-4000-8000-000000000001',null,null);
insert into academic.semester_evaluation_summaries(id,student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values
('54000000-0000-4000-8000-000000000042','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000002',1,1,1,0,0,'CONFIRMED','ADVANCE','ALL_SUBJECTS_AC','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',now()),
('54000000-0000-4000-8000-000000000043','54000000-0000-4000-8000-000000000019','54000000-0000-4000-8000-000000000023','54000000-0000-4000-8000-000000000002',1,1,0,0,1,'MANUAL_REVIEW_REQUIRED','REPEAT','INSTITUTIONAL_REVIEW','53000000-0000-4000-8000-000000000001',null,null);
insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id,created_at)
values
('54000000-0000-4000-8000-000000000044','54000000-0000-4000-8000-000000000018','54000000-0000-4000-8000-000000000022','54000000-0000-4000-8000-000000000002','ADVANCE',2,'CONFIRMED','INSTITUTIONAL_VALIDATION_PENDING','53000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','GUA_DEC_001',repeat('c',64),'54000000-0000-4000-8000-000000000003',now()),
('54000000-0000-4000-8000-000000000045','54000000-0000-4000-8000-000000000019','54000000-0000-4000-8000-000000000023','54000000-0000-4000-8000-000000000002','REPEAT',1,'DRAFT','INSTITUTIONAL_VALIDATION_PENDING','53000000-0000-4000-8000-000000000001',null,'GUA_DEC_002',repeat('d',64),'54000000-0000-4000-8000-000000000003',now());

select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_001',null) $$,'24 creación válida de solicitud');
select throws_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000003','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_002',null) $$,'GUARDIAN_ROLE_REQUIRED','25 cuenta no TUTOR rechazada');
select throws_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000014','54000000-0000-4000-8000-000000000048','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_003',null) $$,'SELF_RELATIONSHIP_NOT_ALLOWED','26 tutor y alumno distintos obligatorios');
select throws_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_004',null) $$,'duplicate key value violates unique constraint "guardian_link_request_one_operational"','27 duplicado operativo rechazado');
select is((select status::text from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'DRAFT','28 solicitud inicia en DRAFT');
select lives_ok($$ select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'GUA_SUB_001',null) $$,'29 envío válido');
select lives_ok($$ select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'GUA_REV_001',null) $$,'30 revisión válida');
select lives_ok($$ select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'GUA_APP_001',null) $$,'31 aprobación válida');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000019','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_REJ',null) $$,'32 solicitud para rechazo');
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ'),'GUA_REJ_SUB',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ'),'GUA_REJ_REV',null);
select lives_ok($$ select * from academic.reject_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ'),'GUA_REJ_001',null) $$,'35 rechazo válido');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000013','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_CAN',null) $$,'36 solicitud para cancelación');
select lives_ok($$ select * from academic.cancel_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_CAN'),'GUA_CAN_001',null) $$,'37 cancelación válida');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000013','54000000-0000-4000-8000-000000000019','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_EXP',null) $$,'38 solicitud para expiración');
select lives_ok($$ select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP'),'GUA_EXP_SUBMIT',null) $$,'39 expiración preparación submit');
select lives_ok($$ select * from academic.expire_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP'),'GUA_EXP_001',null) $$,'40 expiración válida');
select throws_ok($$ select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ'),'GUA_SUB_BAD',null) $$,'GUARDIAN_LINK_REQUEST_INVALID_STATE','41 transición inválida rechazada');
select throws_ok($$ select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'GUA_APP_DUP',null) $$,'GUARDIAN_LINK_REQUEST_INVALID_STATE','42 doble aprobación rechazada');
select throws_ok($$ update academic.guardian_student_link_requests set status='SUBMITTED' where id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ') $$,'GUARDIAN_PORTAL_IMMUTABLE','43 solicitud terminal inmutable');

select lives_ok($$ select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GUA_LINK_001',null) $$,'44 creación de vínculo desde solicitud APPROVED');
select throws_ok($$ select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_REJ'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GUA_LINK_BAD',null) $$,'GUARDIAN_LINK_REQUEST_INVALID_STATE','45 solicitud no aprobada no crea vínculo');
select lives_ok($$ select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001')),'GUA_ACT_001',null) $$,'46 activación válida');
select lives_ok($$ select * from academic.suspend_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001')),'GUA_SUS_001',null) $$,'47 suspensión válida');
select lives_ok($$ select * from academic.reactivate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001')),'GUA_REA_001',null) $$,'48 reactivación válida');
select lives_ok($$ select * from academic.revoke_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001')),'GUA_REV_001',null) $$,'49 revocación válida');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000019','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_ACTIVE_BASE',null) $$,'50 solicitud para vínculo positivo base');
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE'),'GUA_ACTIVE_SUB',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE'),'GUA_ACTIVE_REV',null);
select lives_ok($$ select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE'),'GUA_ACTIVE_APP',null) $$,'53 aprobación para vínculo positivo base');
select lives_ok($$ select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GUA_LINK_ACTIVE_BASE',null) $$,'54 creación de vínculo positivo base');
select lives_ok($$ select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE')),'GUA_LINK_ACTIVE_ACT',null) $$,'55 activación de vínculo positivo base');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000013','54000000-0000-4000-8000-000000000018','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_EXP_LINK',null) $$,'56 solicitud para vínculo expirable');
select lives_ok($$ select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK'),'GUA_EXP_SUB',null) $$,'57 envío para vínculo expirable');
select lives_ok($$ select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK'),'GUA_EXP_REV',null) $$,'58 revisión para vínculo expirable');
select lives_ok($$ select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK'),'GUA_EXP_APP',null) $$,'59 aprobación para vínculo expirable');
select lives_ok($$ select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK'),'STANDARD_ACADEMIC_READ',statement_timestamp(),statement_timestamp() + interval '1 day',false,'GUA_LINK_EXP',null) $$,'60 creación de vínculo expirable');
select lives_ok($$ select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK')),'GUA_LINK_EXP_ACT',null) $$,'61 activación de vínculo expirable');
select lives_ok($$ select * from academic.expire_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK')),'GUA_EXP_LINK_001',null) $$,'62 expiración válida');
select throws_ok($$ select * from academic.reactivate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_001')),'GUA_REA_BAD',null) $$,'GUARDIAN_LINK_CONFLICT','63 REVOKED no reactiva');
select throws_ok($$ select * from academic.reactivate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK')),'GUA_REA_BAD_2',null) $$,'GUARDIAN_LINK_CONFLICT','64 EXPIRED no reactiva');
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_MULTI_S2',null) $$,'65 solicitud segundo alumno para tutor positivo');
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_S2'),'GUA_MULTI_S2_SUB',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_S2'),'GUA_MULTI_S2_REV',null);
select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_S2'),'GUA_MULTI_S2_APP',null);
select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_S2'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GUA_LINK_MULTI_S2',null);
select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_S2')),'GUA_LINK_MULTI_S2_ACT',null);
select lives_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000015','54000000-0000-4000-8000-000000000018','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_MULTI_T1',null) $$,'66 solicitud segundo tutor');
select lives_ok($$ select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1'),'GUA_MULTI_T1_SUB',null) $$,'67 envío segundo tutor');
select lives_ok($$ select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1'),'GUA_MULTI_T1_REV',null) $$,'68 revisión segundo tutor');
select lives_ok($$ select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1'),'GUA_MULTI_T1_APP',null) $$,'69 aprobación segundo tutor');
select lives_ok($$ select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GUA_LINK_MULTI_T1',null) $$,'70 vínculo segundo tutor');
select lives_ok($$ select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1')),'GUA_LINK_MULTI_T1_ACT',null) $$,'71 activación segundo tutor');
select ok((select count(distinct guardian_account_id) = 2 from academic.guardian_student_links where student_record_id='54000000-0000-4000-8000-000000000018' and status='ACTIVE'),'61 alumno con varios tutores');
select ok((select count(distinct student_record_id) = 2 from academic.guardian_student_links where guardian_account_id='53000000-0000-4000-8000-000000000002' and status='ACTIVE'),'72 tutor con varios alumnos');
select ok((select count(*) >= 6 from academic.guardian_student_link_history),'73 historial append-only');
select throws_ok($$ delete from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK') $$,'GUARDIAN_PORTAL_IMMUTABLE','74 DELETE directo rechazado');
select throws_ok($$ update academic.guardian_student_links set status='SUSPENDED' where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_EXP_LINK') $$,'GUARDIAN_PORTAL_IMMUTABLE','75 UPDATE directo rechazado');

select ok(exists(select 1 from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),'66 STANDARD_ACADEMIC_READ existe');
select ok(exists(select 1 from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ' and is_system_scope),'67 is_system_scope = true');
select ok(exists(select 1 from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ' and created_by_account_id is null),'68 created_by_account_id null permitido solo en sistema');
select throws_ok($$ insert into academic.guardian_access_scopes(code,name,created_by_account_id,is_system_scope) values('BAD_SCOPE','Bad scope',null,false) $$,'new row for relation "guardian_access_scopes" violates check constraint "guardian_access_scopes_system_traceability_check"','76 scope institucional exige actor');
select throws_ok($$ delete from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ' $$,'GUARDIAN_PORTAL_IMMUTABLE','77 scope de sistema no se elimina');
select lives_ok($$ insert into academic.guardian_access_scopes(code,name,created_by_account_id,is_system_scope,can_view_overview,status) values('INACTIVE_SCOPE','Inactive scope','53000000-0000-4000-8000-000000000001',false,true,'RETIRED') $$,'78 scope inactivo preparado');

select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'79 cuenta sin PORTAL_ESCOLAR obtiene lista vacía');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select lives_ok($$ select public.get_my_linked_students() $$,'80 rol TUTOR puede leer propio listado');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select lives_ok($$ select public.get_my_guardian_student_overview((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE')), null) $$,'81 AAL1 permite lectura propia');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true);
select throws_ok($$ select * from academic.create_guardian_link_request('53000000-0000-4000-8000-000000000002','54000000-0000-4000-8000-000000000019','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GUA_REQ_AAL_BAD',null) $$,'APPLICATION_NOT_ALLOWED','82 AAL1 administrativa queda bloqueada antes de mutación');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":2}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'83 session_version obsoleta devuelve lista vacía');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select lives_ok($$ select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE'))) $$,'84 linkId propio permitido');
select throws_ok($$ select public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_MULTI_T1'))) $$,'GUARDIAN_PORTAL_ACCESS_DENIED','85 linkId ajeno rechazado');
select lives_ok($$ select public.get_my_guardian_student_overview((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE')),'54000000-0000-4000-8000-000000000002') $$,'86 periodId propio permitido');
select throws_ok($$ select public.get_my_guardian_student_overview((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE')),'54000000-0000-4000-8000-000000000003') $$,'GUARDIAN_PORTAL_ACCESS_DENIED','87 periodId ajeno rechazado');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'88 ADMINISTRATIVO no usa funciones my');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'89 CONTROL_ESCOLAR no usa funciones my');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'90 DOCENTE rechazado');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'91 PREFECTURA rechazada');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'92 CAJA rechazada');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'93 ALUMNO rechazado');
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000010","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(public.get_my_linked_students(),'[]'::jsonb,'94 ASPIRANTE rechazado');

select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
select ok(jsonb_array_length(public.get_my_linked_students()) = 2,'95 ACTIVE vigente aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'linkStatus'='PENDING_ACTIVATION'),'96 PENDING_ACTIVATION no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'linkStatus'='SUSPENDED'),'97 SUSPENDED no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'linkStatus'='EXPIRED'),'98 EXPIRED no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'linkStatus'='REVOKED'),'99 REVOKED no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'linkStatus'='CANCELLED'),'100 CANCELLED no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where (item->>'validFrom')::timestamptz > statement_timestamp()),'101 valid_from futuro no aparece');
select ok(not exists(select 1 from jsonb_array_elements(public.get_my_linked_students()) item where item->>'validUntil' is not null and (item->>'validUntil')::timestamptz <= now()),'102 valid_until vencido no aparece');
select is((public.get_my_guardian_portal_overview()->>'totalLinkedStudents')::int,2,'103 overview cuenta solo vínculos activos vigentes');
select ok((public.get_my_guardian_student_schedule((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GUA_REQ_ACTIVE_BASE')),'54000000-0000-4000-8000-000000000002')::text like '%GUA_SUB%'),'104 horario PUBLISHED visible');

select * from finish();
rollback;
