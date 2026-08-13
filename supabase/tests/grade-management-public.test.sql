begin;
select plan(43);

select has_function('public', 'list_grade_management_offerings', array['uuid','uuid','uuid','text','uuid','academic.grade_window_status','academic.offering_status','integer','integer'], '01 listado administrativo de offerings existe');
select has_function('public', 'list_my_grade_management_offerings', array['uuid','academic.grade_window_status','academic.offering_status','integer','integer'], '02 listado docente propio existe');
select has_function('public', 'get_grade_management_offering_detail', array['uuid'], '03 detalle de offering existe');
select has_function('public', 'get_grade_management_unit_grade_history', array['uuid'], '04 historial de unidad existe');
select has_function('public', 'get_grade_management_subject_result_history', array['uuid'], '05 historial de resultado existe');
select has_function('public', 'list_grade_management_corrections', array['uuid','uuid','academic.grade_correction_status','integer','integer'], '06 listado de correcciones existe');
select has_function('public', 'list_grade_capture_windows', array['uuid','academic.grade_window_type','academic.grade_window_status','integer','integer'], '07 listado de ventanas existe');
select ok(not has_function_privilege('anon', 'public.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer)', 'EXECUTE'), '08 anon no ejecuta listado');
select ok(has_function_privilege('authenticated', 'public.get_grade_management_offering_detail(uuid)', 'EXECUTE'), '09 authenticated ejecuta detalle');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','grades-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','grades-teacher@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','grades-teacher-other@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','grades-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','grades-student@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','grades-inactive@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('92000000-0000-4000-8000-000000000001','ACTIVE'),
('92000000-0000-4000-8000-000000000002','ACTIVE'),
('92000000-0000-4000-8000-000000000003','ACTIVE'),
('92000000-0000-4000-8000-000000000004','ACTIVE'),
('92000000-0000-4000-8000-000000000005','ACTIVE'),
('92000000-0000-4000-8000-000000000006','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version,institutional_identifier_type,institutional_identifier,identifier_assigned_at,identifier_changed_at,suspended_at) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','ACTIVE',1,'ADMINISTRATIVE_ID','GRADE-ADMIN',now(),now(),null),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','ACTIVE',1,'EMPLOYEE_ID','GRADE-DOC-1',now(),now(),null),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003','ACTIVE',1,'EMPLOYEE_ID','GRADE-DOC-2',now(),now(),null),
('93000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000004','ACTIVE',1,'ADMINISTRATIVE_ID','GRADE-CAJA',now(),now(),null),
('93000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000005','ACTIVE',1,'MATRICULA','GRADE-STUDENT',now(),now(),null),
('93000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000006','SUSPENDED',1,'ADMINISTRATIVE_ID','GRADE-INACTIVE',now(),now(),now());

insert into core.account_roles(account_id, role_id)
select seeded.account_id::uuid, roles.id
from (values
('93000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR'),
('93000000-0000-4000-8000-000000000002','DOCENTE'),
('93000000-0000-4000-8000-000000000002','CONTROL_ESCOLAR'),
('93000000-0000-4000-8000-000000000003','DOCENTE'),
('93000000-0000-4000-8000-000000000003','CONTROL_ESCOLAR'),
('93000000-0000-4000-8000-000000000004','CAJA'),
('93000000-0000-4000-8000-000000000005','ALUMNO'),
('93000000-0000-4000-8000-000000000006','ADMINISTRATIVO')
) seeded(account_id, role_code)
join core.roles roles on roles.code = seeded.role_code;

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('94000000-0000-4000-8000-000000000001','G-PUB-CYCLE','Ciclo grades','ACTIVE','2095-01-01','2095-12-31','93000000-0000-4000-8000-000000000001');

insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('94100000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','G-PUB-P1','Periodo grades',1,'2095-01-01','2095-04-30','ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.study_plans(id,code,name,version,status,valid_from,total_semesters,units_per_subject,created_by_account_id)
values('94200000-0000-4000-8000-000000000001','G-PUB-PLAN','Plan grades','V1','ACTIVE','2095-01-01',6,3,'93000000-0000-4000-8000-000000000001');

insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('94300000-0000-4000-8000-000000000001','G-PUB-GEN','Generación grades','94000000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('94400000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001',5,'Semestre 5',true);

insert into academic.training_areas(id,code,name,status,starts_at_semester)
values('94500000-0000-4000-8000-000000000001','QB','Químico Biólogos','ACTIVE',5);

insert into academic.subjects(id,code,name,subject_type,status,created_by_account_id)
values('94600000-0000-4000-8000-000000000001','MAT-G5','Matemáticas Grades','COMMON','ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,training_area_id,is_mandatory,display_order,weekly_hours,status)
values('94700000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001','94400000-0000-4000-8000-000000000001','94600000-0000-4000-8000-000000000001',null,true,1,5,'ACTIVE');

select set_config('academic.actor_account_id','93000000-0000-4000-8000-000000000001',true);
select set_config('academic.operation_key','GPUB_UNITS_CREATE',true);

insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order)
values
('94800000-0000-4000-8000-000000000001','94700000-0000-4000-8000-000000000001',1,'U1',1),
('94800000-0000-4000-8000-000000000002','94700000-0000-4000-8000-000000000001',2,'U2',2),
('94800000-0000-4000-8000-000000000003','94700000-0000-4000-8000-000000000001',3,'U3',3);

insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,training_area_id,code,display_name,capacity,status,created_by_account_id)
values('94900000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001',5,'94500000-0000-4000-8000-000000000001','5G-A','5° G A',40,'ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values('95000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','94900000-0000-4000-8000-000000000001','94700000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,current_training_area_id,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('95100000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000005','93000000-0000-4000-8000-000000000005','94200000-0000-4000-8000-000000000001','94300000-0000-4000-8000-000000000001','GRADE-STU-001','ACTIVE',5,'94500000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_training_area_id,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('95200000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','REENROLLMENT',5,'94500000-0000-4000-8000-000000000001','94900000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','93000000-0000-4000-8000-000000000001','G-REQ-1',repeat('a',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,training_area_id,group_id,status,enrollment_number,enrolled_by_account_id,enrolled_at)
values('95300000-0000-4000-8000-000000000001','95100000-0000-4000-8000-000000000001','95200000-0000-4000-8000-000000000001','94100000-0000-4000-8000-000000000001','94200000-0000-4000-8000-000000000001',5,'94500000-0000-4000-8000-000000000001','94900000-0000-4000-8000-000000000001','ACTIVE','G-ENR-1','93000000-0000-4000-8000-000000000001',now());

insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values('95400000-0000-4000-8000-000000000001','95300000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');

insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('95500000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','PRIMARY','ACTIVE','2095-01-01','93000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

select lives_ok($$select * from public.create_grade_capture_window('94100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','GPUB_W1')$$,'10 crea ventana U1');
select lives_ok($$select * from public.create_grade_capture_window('94100000-0000-4000-8000-000000000001',2::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','GPUB_W2')$$,'11 crea ventana U2');
select lives_ok($$select * from public.create_grade_capture_window('94100000-0000-4000-8000-000000000001',3::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','GPUB_W3')$$,'12 crea ventana U3');
select lives_ok(format('select * from public.open_grade_capture_window(%L,%L)',id,'GPUB_OPEN_'||unit_number)) from academic.grade_capture_windows order by unit_number;

select is((public.list_grade_management_offerings('94100000-0000-4000-8000-000000000001',null,null,null,null,'OPEN','ACTIVE',25,0)->>'totalRows')::integer,1,'13 listado administrativo por periodo/ventana/status');
select is(public.list_grade_management_offerings(null,null,null,null,null,null,null,25,0)->'rows'->0->>'academicOfferingId','95000000-0000-4000-8000-000000000001','14 offering visible');
select is((public.list_grade_capture_windows('94100000-0000-4000-8000-000000000001','UNIT_CAPTURE',null,25,0)->>'totalRows')::integer,3,'15 ventanas visibles');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);

select is((public.list_my_grade_management_offerings('94100000-0000-4000-8000-000000000001','OPEN','ACTIVE',25,0)->>'totalRows')::integer,1,'16 docente solo ve su carga propia');
select lives_ok($$select * from public.capture_student_unit_grade('95400000-0000-4000-8000-000000000001','94800000-0000-4000-8000-000000000001',5.95,'GPUB_G1')$$,'17 captura unidad 1');
select lives_ok($$select * from public.capture_student_unit_grade('95400000-0000-4000-8000-000000000001','94800000-0000-4000-8000-000000000002',6.25,'GPUB_G2')$$,'18 captura unidad 2');
select lives_ok($$select * from public.capture_student_unit_grade('95400000-0000-4000-8000-000000000001','94800000-0000-4000-8000-000000000003',6.26,'GPUB_G3')$$,'19 captura unidad 3');
select throws_ok($$select * from public.capture_student_unit_grade('95400000-0000-4000-8000-000000000001','94800000-0000-4000-8000-000000000001',10.01,'GPUB_BAD')$$,'INVALID_GRADE_VALUE','20 valor >10 rechazado');
select lives_ok(format('select * from public.review_student_unit_grade(%L,%L)',id,'GPUB_R_'||unit_number)) from academic.student_unit_grades order by unit_number;
select lives_ok(format('select * from public.finalize_student_unit_grade(%L,%L)',id,'GPUB_F_'||unit_number)) from academic.student_unit_grades order by unit_number;

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok($$select public.get_grade_management_offering_detail('95000000-0000-4000-8000-000000000001')$$,'TEACHER_NOT_AUTHORIZED','21 docente ajeno no ve detalle');

select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select lives_ok($$select * from public.calculate_subject_final_result('95400000-0000-4000-8000-000000000001','GPUB_RESULT')$$,'22 calcula resultado');
select is((public.get_grade_management_offering_detail('95000000-0000-4000-8000-000000000001')->'students'->0->'subjectResult'->>'resultCode')::text,'AC','23 2 de 3 produce AC');
select is((public.get_grade_management_offering_detail('95000000-0000-4000-8000-000000000001')->'students'->0->'subjectResult'->>'rawFinalGrade')::text,null,'24 final raw permanece null');
select is((public.get_grade_management_offering_detail('95000000-0000-4000-8000-000000000001')->'students'->0->'subjectResult'->>'roundedFinalGrade')::text,null,'25 final rounded permanece null');
select is(academic.apply_institutional_grade_rounding(5.95)::text,'5.95','26 5.95 no sube');
select is(academic.apply_institutional_grade_rounding(6.25)::text,'6','27 6.25 conserva frontera backend');
select is(academic.apply_institutional_grade_rounding(6.26)::text,'6.5','28 6.26 conserva frontera backend');

select lives_ok($$select * from public.create_grade_correction((select id from academic.student_unit_grades where unit_number=1),8,'DATA_ENTRY_ERROR','GPUB_CORR_CREATE')$$,'29 crea corrección');
select lives_ok($$select * from public.submit_grade_correction((select id from academic.grade_corrections limit 1),'GPUB_CORR_SUBMIT')$$,'30 submit corrección');
select is((public.list_grade_management_corrections('95000000-0000-4000-8000-000000000001',null,null,25,0)->>'totalRows')::integer,1,'31 listado de correcciones visible');
select ok(
  jsonb_path_exists(
    public.get_grade_management_unit_grade_history((select id from academic.student_unit_grades where unit_number=1)),
    '$.history[*] ? (@.resultingStatus == "FINALIZED")'
  ),
  '32 historial de unidad incluye FINALIZED'
);

select lives_ok($$select * from public.confirm_subject_final_result((select id from academic.subject_final_results limit 1),'GPUB_RESULT_CONFIRM')$$,'33 confirma resultado');
select ok(
  jsonb_path_exists(
    public.get_grade_management_subject_result_history((select id from academic.subject_final_results limit 1)),
    '$.history[*] ? (@.resultingStatus == "CONFIRMED")'
  ),
  '34 historial de resultado incluye CONFIRMED'
);

select * from finish();
rollback;
