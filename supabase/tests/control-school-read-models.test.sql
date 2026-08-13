begin;
select plan(46);

select has_function('public', 'list_control_school_students', array['text', 'academic.student_record_status', 'integer', 'uuid', 'uuid', 'integer', 'integer'], '01 wrapper listado alumnos existe');
select has_function('public', 'get_control_school_student_detail', array['uuid'], '02 wrapper detalle alumno existe');
select has_function('public', 'list_control_school_groups', array['uuid', 'integer', 'uuid', 'academic.group_status', 'integer', 'integer'], '03 wrapper listado grupos existe');
select has_function('public', 'get_control_school_group_detail', array['uuid'], '04 wrapper detalle grupo existe');
select has_function('public', 'get_control_school_group_schedule', array['uuid', 'uuid'], '05 wrapper horario grupo existe');
select has_function('public', 'get_control_school_structure', array['uuid', 'uuid'], '06 wrapper estructura existe');
select has_function('public', 'list_control_school_enrollments', array['uuid', 'integer', 'uuid', 'academic.period_enrollment_status', 'text', 'integer', 'integer'], '07 wrapper inscripciones existe');
select has_function('public', 'get_control_school_student_trajectory', array['uuid'], '08 wrapper trayectoria existe');

select ok(not has_function_privilege('public', 'public.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer)', 'EXECUTE'), '09 PUBLIC no ejecuta listado alumnos');
select ok(not has_function_privilege('anon', 'public.get_control_school_student_detail(uuid)', 'EXECUTE'), '10 anon no ejecuta detalle alumno');
select ok(has_function_privilege('authenticated', 'public.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer)', 'EXECUTE'), '11 authenticated ejecuta listado alumnos');
select ok(has_function_privilege('authenticated', 'public.get_control_school_group_schedule(uuid, uuid)', 'EXECUTE'), '12 authenticated ejecuta horario grupo');
select ok(not has_schema_privilege('authenticated', 'academic', 'USAGE'), '13 authenticated no recibe USAGE en academic');
select ok(not has_table_privilege('authenticated', 'academic.student_records', 'SELECT'), '14 authenticated no recibe SELECT directo');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','control-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','control-student@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','control-student-2@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','control-teacher@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','control-no-access@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','control-caja@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('82000000-0000-4000-8000-000000000001','ACTIVE'),
('82000000-0000-4000-8000-000000000002','ACTIVE'),
('82000000-0000-4000-8000-000000000003','ACTIVE'),
('82000000-0000-4000-8000-000000000004','ACTIVE'),
('82000000-0000-4000-8000-000000000005','ACTIVE'),
('82000000-0000-4000-8000-000000000006','ACTIVE');

insert into core.accounts(
  id,
  person_id,
  auth_user_id,
  account_status,
  session_version,
  institutional_identifier_type,
  institutional_identifier,
  identifier_assigned_at,
  identifier_changed_at
) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','ACTIVE',1,'ADMINISTRATIVE_ID','CTRL-001',now(),now()),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','ACTIVE',1,'MATRICULA','ALU-CTRL-001',now(),now()),
('83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','ACTIVE',1,'MATRICULA','ALU-CTRL-002',now(),now()),
('83000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000004','ACTIVE',1,'EMPLOYEE_ID','DOC-001',now(),now()),
('83000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000005','ACTIVE',1,'MATRICULA','ALU-NO-ACCESS',now(),now()),
('83000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000006','81000000-0000-4000-8000-000000000006','ACTIVE',1,'ADMINISTRATIVE_ID','CAJA-001',now(),now());

insert into core.account_roles(account_id,role_id)
select seeded.account_id::uuid, roles.id
from (values
('83000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR'),
('83000000-0000-4000-8000-000000000002','ALUMNO'),
('83000000-0000-4000-8000-000000000003','ALUMNO'),
('83000000-0000-4000-8000-000000000004','DOCENTE'),
('83000000-0000-4000-8000-000000000005','ALUMNO'),
('83000000-0000-4000-8000-000000000006','CAJA')
) seeded(account_id, role_code)
join core.roles roles on roles.code = seeded.role_code;

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('84000000-0000-4000-8000-000000000001','CTRL-CYCLE','Cycle Control','ACTIVE','2094-01-01','2094-12-31','83000000-0000-4000-8000-000000000001');

insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values
('84100000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000001','CTRL-P1','Periodo 1',1,'2094-01-01','2094-04-30','ACTIVE','83000000-0000-4000-8000-000000000001'),
('84100000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','CTRL-P2','Periodo 2',2,'2094-08-01','2094-11-30','PLANNED','83000000-0000-4000-8000-000000000001');

insert into academic.study_plans(id,code,name,version,status,valid_from,total_semesters,units_per_subject,created_by_account_id)
values('84200000-0000-4000-8000-000000000001','CTRL-PLAN','Plan Control','V1','ACTIVE','2094-01-01',6,3,'83000000-0000-4000-8000-000000000001');

insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('84300000-0000-4000-8000-000000000001','CTRL-GEN','Generación Control','84000000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values
('84400000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001',1,'Semestre 1',false),
('84400000-0000-4000-8000-000000000002','84200000-0000-4000-8000-000000000001',5,'Semestre 5',true);

insert into academic.training_areas(id,code,name,status,starts_at_semester)
values
('84500000-0000-4000-8000-000000000001','QB','Químico-Biólogos','ACTIVE',5),
('84500000-0000-4000-8000-000000000002','EA','Económico-Administrativos','ACTIVE',5);

insert into academic.subjects(id,code,name,subject_type,status,created_by_account_id)
values
('84600000-0000-4000-8000-000000000001','MAT-501','Matemáticas V','COMMON','ACTIVE','83000000-0000-4000-8000-000000000001'),
('84600000-0000-4000-8000-000000000002','BIO-501','Biología V','AREA_SPECIFIC','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,training_area_id,is_mandatory,display_order,weekly_hours,status)
values
('84700000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001','84400000-0000-4000-8000-000000000002','84600000-0000-4000-8000-000000000001',null,true,1,5,'ACTIVE'),
('84700000-0000-4000-8000-000000000002','84200000-0000-4000-8000-000000000001','84400000-0000-4000-8000-000000000002','84600000-0000-4000-8000-000000000002','84500000-0000-4000-8000-000000000001',true,2,4,'ACTIVE');

insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,training_area_id,code,display_name,capacity,status,created_by_account_id)
values
('84800000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001',5,'84500000-0000-4000-8000-000000000001','5QB-A','5° QB A',40,'ACTIVE','83000000-0000-4000-8000-000000000001'),
('84800000-0000-4000-8000-000000000002','84100000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001',5,'84500000-0000-4000-8000-000000000001','5QB-B','5° QB B',40,'PLANNED','83000000-0000-4000-8000-000000000001');

insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values
('84900000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000001','84700000-0000-4000-8000-000000000001','ACTIVE','83000000-0000-4000-8000-000000000001'),
('84900000-0000-4000-8000-000000000002','84100000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000001','84700000-0000-4000-8000-000000000002','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('85000000-0000-4000-8000-000000000001','TM','Turno Matutino','07:00','14:00','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values('85100000-0000-4000-8000-000000000001','85000000-0000-4000-8000-000000000001','B1','Bloque 1',1,'07:00','07:50',true,false,'ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values('85200000-0000-4000-8000-000000000001','CTRL-TEMP','Plantilla Control','85000000-0000-4000-8000-000000000001','ACTIVE','2094-01-01','83000000-0000-4000-8000-000000000001');

insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values('85300000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','85200000-0000-4000-8000-000000000001','PUBLISHED',1,'2094-01-01','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now());

insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('85400000-0000-4000-8000-000000000001','A-1','Aula 1','CLASSROOM','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,current_training_area_id,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('85500000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000002','83000000-0000-4000-8000-000000000002','84200000-0000-4000-8000-000000000001','84300000-0000-4000-8000-000000000001','ALU-CTRL-001','ACTIVE',5,'84500000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001'),
('85500000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000003','83000000-0000-4000-8000-000000000003','84200000-0000-4000-8000-000000000001','84300000-0000-4000-8000-000000000001','ALU-CTRL-002','ACTIVE',5,'84500000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_training_area_id,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('85600000-0000-4000-8000-000000000001','85500000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','REENROLLMENT',5,'84500000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','83000000-0000-4000-8000-000000000001','REQ-CTRL-1',repeat('1',64)),
('85600000-0000-4000-8000-000000000002','85500000-0000-4000-8000-000000000002','84100000-0000-4000-8000-000000000001','REENROLLMENT',5,'84500000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000002','APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','83000000-0000-4000-8000-000000000001','REQ-CTRL-2',repeat('2',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,training_area_id,group_id,status,enrollment_number,enrolled_by_account_id,enrolled_at)
values
('85700000-0000-4000-8000-000000000001','85500000-0000-4000-8000-000000000001','85600000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001',5,'84500000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000001','ACTIVE','ENR-CTRL-1','83000000-0000-4000-8000-000000000001',now()),
('85700000-0000-4000-8000-000000000002','85500000-0000-4000-8000-000000000002','85600000-0000-4000-8000-000000000002','84100000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001',5,'84500000-0000-4000-8000-000000000001','84800000-0000-4000-8000-000000000002','COMPLETED','ENR-CTRL-2','83000000-0000-4000-8000-000000000001',now());

insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values
('85800000-0000-4000-8000-000000000001','85700000-0000-4000-8000-000000000001','84900000-0000-4000-8000-000000000001','ACTIVE','83000000-0000-4000-8000-000000000001'),
('85800000-0000-4000-8000-000000000002','85700000-0000-4000-8000-000000000001','84900000-0000-4000-8000-000000000002','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('85900000-0000-4000-8000-000000000001','84900000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000004','PRIMARY','ACTIVE','2094-01-01','83000000-0000-4000-8000-000000000001');

insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values('86000000-0000-4000-8000-000000000001','85300000-0000-4000-8000-000000000001','84900000-0000-4000-8000-000000000001','85900000-0000-4000-8000-000000000001','85400000-0000-4000-8000-000000000001',1,'85100000-0000-4000-8000-000000000001','REGULAR_CLASS','ACTIVE','2094-01-01','83000000-0000-4000-8000-000000000001');

insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,resulting_training_area_id,decision_status,reason_code,decided_by_account_id,effective_from_period_id,decided_at,idempotency_key,request_fingerprint)
values('86100000-0000-4000-8000-000000000001','85500000-0000-4000-8000-000000000001','85700000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000001','ADVANCE',6,'84500000-0000-4000-8000-000000000001','CONFIRMED','PREVIOUS_PERIOD_APPROVED','83000000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000002',now(),'DEC-CTRL-1',repeat('d',64));

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

select is(
  (public.list_control_school_students(null, null, null, null, null, 25, 0)->>'totalRows')::integer,
  2,
  '15 listado administrativo de alumnos visible'
);
select is(
  public.list_control_school_students(null, null, null, null, null, 25, 0)->'rows'->0->>'studentIdentifier',
  'ALU-CTRL-001',
  '16 listado alumnos ordena por matrícula'
);
select ok(
  not (public.list_control_school_students(null, null, null, null, null, 25, 0)->'rows'->0 ? 'authUserId'),
  '17 listado alumnos no expone auth_user_id'
);
select ok(
  (public.list_control_school_students('ALU-CTRL-002', null, null, null, null, 25, 0)->>'totalRows')::integer = 1,
  '18 búsqueda por matrícula funciona'
);
select ok(
  (public.list_control_school_students(null, null, 5, null, null, 25, 0)->>'totalRows')::integer = 2,
  '19 filtro por semestre funciona'
);

select is(
  public.get_control_school_student_detail('85500000-0000-4000-8000-000000000001')->>'studentIdentifier',
  'ALU-CTRL-001',
  '20 detalle de alumno visible'
);
select ok(
  not (public.get_control_school_student_detail('85500000-0000-4000-8000-000000000001')->'identity' ? 'authUserId'),
  '21 detalle de alumno no expone identidad Auth'
);

select is(
  (public.list_control_school_groups(null, null, null, null, 25, 0)->>'totalRows')::integer,
  2,
  '22 listado de grupos visible'
);
select is(
  (public.get_control_school_group_detail('84800000-0000-4000-8000-000000000001')->'students'->0->>'studentIdentifier'),
  'ALU-CTRL-001',
  '23 detalle de grupo expone integrantes'
);
select is(
  (public.get_control_school_group_detail('84800000-0000-4000-8000-000000000001')->'subjects'->0->>'subjectCode'),
  'BIO-501',
  '24 detalle de grupo expone materias reales'
);
select is(
  (public.get_control_school_group_detail('84800000-0000-4000-8000-000000000001')->'teachers'->0->>'teacherIdentifier'),
  'DOC-001',
  '25 detalle de grupo expone docente por identificador operativo'
);

select is(
  (public.get_control_school_group_schedule('84800000-0000-4000-8000-000000000001', null)->'rows'->0->>'subjectCode'),
  'MAT-501',
  '26 horario administrativo por grupo usa scheduling real'
);
select ok(
  not (public.get_control_school_group_schedule('84800000-0000-4000-8000-000000000001', null)->'rows'->0 ? 'teacherAccountId'),
  '27 horario administrativo no expone account técnico docente'
);

select ok(
  exists (
    select 1
      from jsonb_array_elements(public.get_control_school_structure(null, null)->'trainingAreas') as item
     where item->>'code' = 'EA'
  ),
  '28 estructura administrativa expone catálogo de áreas'
);
select is(
  (public.list_control_school_enrollments('84100000-0000-4000-8000-000000000001', null, null, null, null, 25, 0)->>'totalRows')::integer,
  2,
  '29 listado administrativo de inscripciones visible'
);
select is(
  (public.get_control_school_student_trajectory('85500000-0000-4000-8000-000000000001')->'progressDecisions'->0->>'decisionType'),
  'ADVANCE',
  '30 trayectoria administrativa reutiliza decisiones persistidas'
);

select throws_ok($$ select public.get_control_school_student_detail('00000000-0000-4000-8000-000000009999') $$,'STUDENT_RECORD_NOT_FOUND','31 studentRecordId inexistente rechazado');
select throws_ok($$ select public.get_control_school_group_detail('00000000-0000-4000-8000-000000009998') $$,'GROUP_NOT_FOUND','32 groupId inexistente rechazado');
select throws_ok($$ select public.get_control_school_group_schedule('84800000-0000-4000-8000-000000000001','84100000-0000-4000-8000-000000000002') $$,'PERIOD_NOT_AVAILABLE','33 periodo ajeno al grupo rechazado');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok($$ select public.list_control_school_students(null, null, null, null, null, 25, 0) $$,'APPLICATION_NOT_ALLOWED','34 actor con aplicación incorrecta rechazado');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok($$ select public.get_control_school_structure(null, null) $$,'ACTOR_NOT_AUTHORIZED','35 actor administrativo sin permiso académico específico es rechazado');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true);
select throws_ok($$ select public.list_control_school_students(null, null, null, null, null, 25, 0) $$,'APPLICATION_NOT_ALLOWED','36 AAL insuficiente rechaza lectura administrativa');

select set_config('request.jwt.claims','{}',true);
select throws_ok($$ select public.list_control_school_students(null, null, null, null, null, 25, 0) $$,'ACTOR_NOT_AUTHORIZED','37 actor no autenticado rechazado');

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select ok(
  (public.list_control_school_students(null, null, null, null, null, 9999, 0)->>'pageSize')::integer = 100,
  '38 límite de paginación se acota'
);
select ok(
  (public.list_control_school_students(null, null, null, null, null, 1, 1)->>'rows')::jsonb <> '[]'::jsonb,
  '39 paginación por offset devuelve segunda fila'
);
select ok(
  (public.list_control_school_groups('84100000-0000-4000-8000-000000000001', 5, '84500000-0000-4000-8000-000000000001', null, 25, 0)->>'totalRows')::integer = 2,
  '40 filtros seguros de grupos funcionan'
);
select ok(
  (public.list_control_school_enrollments(null, 5, '84800000-0000-4000-8000-000000000001', null, null, 25, 0)->>'totalRows')::integer = 1,
  '41 filtros seguros de inscripciones funcionan'
);
select ok(
  public.get_control_school_structure('84100000-0000-4000-8000-000000000001','84200000-0000-4000-8000-000000000001')->'groups' <> '[]'::jsonb,
  '42 estructura admite filtros'
);
select ok(
  public.get_control_school_student_detail('85500000-0000-4000-8000-000000000001')->>'studentDisplayName' is null,
  '43 nombre visible permanece nulo cuando no existe fuente autorizada'
);
select ok(
  public.get_control_school_group_detail('84800000-0000-4000-8000-000000000001')->'teachers'->0->>'teacherDisplayName' is null,
  '44 docente sin nombre visible usa minimización de datos'
);
select ok(
  not (public.list_control_school_enrollments(null, null, null, null, null, 25, 0)->'rows'->0 ? 'personId'),
  '45 inscripciones no exponen person_id'
);
select ok(
  not (public.get_control_school_student_trajectory('85500000-0000-4000-8000-000000000001')->'progressDecisions'->0 ? 'approvedByAccountId'),
  '46 trayectoria no expone actores técnicos'
);

select * from finish();
rollback;
