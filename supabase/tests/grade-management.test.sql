begin;
create extension if not exists pgtap with schema extensions;
select plan(139);

select has_table('academic',name,'tabla de calificaciones existe') from unnest(array['grade_capture_windows','student_unit_grades','student_unit_grade_history','subject_final_results','subject_result_history','semester_evaluation_summaries','grade_corrections','grade_commands','grade_events']) name;
select ok(c.relrowsecurity,name||' tiene RLS') from pg_class c join pg_namespace n on n.oid=c.relnamespace join unnest(array['grade_capture_windows','student_unit_grades','student_unit_grade_history','subject_final_results','subject_result_history','semester_evaluation_summaries','grade_corrections','grade_commands','grade_events']) name on name=c.relname where n.nspname='academic';
select is((select count(*)::integer from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname=name),0,name||' no tiene policies') from unnest(array['grade_capture_windows','student_unit_grades','student_unit_grade_history','subject_final_results','subject_result_history','semester_evaluation_summaries','grade_corrections','grade_commands','grade_events']) name;
select is((select count(*)::integer from information_schema.role_table_grants where table_schema='academic' and table_name=name and grantee in ('PUBLIC','anon','authenticated')),0,name||' no tiene grants de aplicación') from unnest(array['grade_capture_windows','student_unit_grades','student_unit_grade_history','subject_final_results','subject_result_history','semester_evaluation_summaries','grade_corrections','grade_commands','grade_events']) name;

select is(academic.apply_institutional_grade_rounding(v)::text,expected,label) from (values
 (6.00::numeric,'6','6.00'),(6.24,'6','6.24'),(6.25,'6','6.25'),(6.26,'6.5','6.26'),(6.50,'6.5','6.50'),(6.75,'6.5','6.75'),(6.76,'7','6.76'),
 (7.25,'7','7.25'),(7.26,'7.5','7.26'),(7.75,'7.5','7.75'),(7.76,'8','7.76'),(8.25,'8','8.25'),(8.26,'8.5','8.26'),(8.75,'8.5','8.75'),
 (8.76,'9','8.76'),(9.25,'9','9.25'),(9.26,'9.5','9.26'),(9.75,'9.5','9.75'),(9.76,'10','9.76'),(10.0,'10','10'),(5.95,'5.95','5.95 nunca sube a 6')
) cases(v,expected,label);

select has_type('academic',name,'enum cerrado existe') from unnest(array['grade_window_type','grade_window_status','unit_grade_status','subject_result_code','grade_calculation_status','subject_result_status','semester_evaluation_status','progress_proposal','grade_correction_status','grade_command_status','grade_command_type','grade_event_type']) name;
select has_function('academic',name,'función controlada existe') from unnest(array['apply_institutional_grade_rounding','create_grade_capture_window','open_grade_capture_window','close_grade_capture_window','capture_student_unit_grade','review_student_unit_grade','finalize_student_unit_grade','calculate_subject_final_result','calculate_semester_evaluation_summary','create_grade_correction']) name;

-- Functional behavior is exercised below with synthetic rows and rolled back.
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','grade-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','grade-teacher@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','grade-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values ('e2000000-0000-4000-8000-000000000001','ACTIVE'),('e2000000-0000-4000-8000-000000000003','ACTIVE'),('e2000000-0000-4000-8000-000000000006','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status) values
('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','ACTIVE'),
('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','ACTIVE'),
('e3000000-0000-4000-8000-000000000006','e2000000-0000-4000-8000-000000000006','e1000000-0000-4000-8000-000000000006','ACTIVE');
insert into core.account_roles(account_id,role_id) select v.account_id::uuid,r.id from (values ('e3000000-0000-4000-8000-000000000001','SUPERADMIN'),('e3000000-0000-4000-8000-000000000003','DOCENTE'),('e3000000-0000-4000-8000-000000000006','ALUMNO')) v(account_id,role_code) join core.roles r on r.code=v.role_code;
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values('e4000000-0000-4000-8000-000000000001','B5T_CYCLE','Synthetic','ACTIVE','2096-01-01','2096-12-31','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values('e4100000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001','B5T_PERIOD','Synthetic',1,'2096-01-01','2096-06-30','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('e4200000-0000-4000-8000-000000000001','B5T_PLAN','Synthetic','V1','ACTIVE','2096-01-01','e3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values('e4300000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'One',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('e4400000-0000-4000-8000-000000000001','B5T_SUBJECT','Synthetic','COMMON','e3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('e4500000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001','e4300000-0000-4000-8000-000000000001','e4400000-0000-4000-8000-000000000001',1);
select set_config('academic.actor_account_id','e3000000-0000-4000-8000-000000000001',true),set_config('academic.operation_key','B5T_UNITS',true);
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order) values ('e5600000-0000-4000-8000-000000000001','e4500000-0000-4000-8000-000000000001',1,'U1',1),('e5600000-0000-4000-8000-000000000002','e4500000-0000-4000-8000-000000000001',2,'U2',2),('e5600000-0000-4000-8000-000000000003','e4500000-0000-4000-8000-000000000001',3,'U3',3);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,created_by_account_id) values('e4600000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'B5T_GROUP','Synthetic','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values('e4700000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e4600000-0000-4000-8000-000000000001','e4500000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id) values('e4800000-0000-4000-8000-000000000001','e4700000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003','PRIMARY','ACTIVE','2096-01-01','e3000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values('e5000000-0000-4000-8000-000000000001','B5T_GEN','Synthetic','e4000000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,first_enrollment_period_id,last_enrollment_period_id,created_by_account_id) values('e5100000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000006','e3000000-0000-4000-8000-000000000006','e4200000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','B5T_STUDENT','ACTIVE',1,'e4100000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint) values('e5200000-0000-4000-8000-000000000001','e5100000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'e4600000-0000-4000-8000-000000000001','ENROLLED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','e3000000-0000-4000-8000-000000000001','B5T_REQUEST',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id) values('e5300000-0000-4000-8000-000000000001','e5100000-0000-4000-8000-000000000001','e5200000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'e4600000-0000-4000-8000-000000000001','ACTIVE','B5T_E1','e3000000-0000-4000-8000-000000000001');
insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id) values('e5500000-0000-4000-8000-000000000001','e5300000-0000-4000-8000-000000000001','e4700000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select lives_ok($$select * from academic.create_grade_capture_window('e4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE'::academic.grade_window_type,'2020-01-01'::timestamptz,'2100-01-01'::timestamptz,'T_WINDOW_1')$$,'ventana válida');
select throws_ok($$select * from academic.create_grade_capture_window('e4100000-0000-4000-8000-000000000001',2::smallint,'UNIT_CAPTURE'::academic.grade_window_type,'2100-01-01'::timestamptz,'2020-01-01'::timestamptz,'T_BAD_WINDOW')$$,'GRADE_WINDOW_INVALID_STATE','ventana inválida');
select throws_ok($$select * from academic.create_grade_capture_window('e4100000-0000-4000-8000-000000000001',1::smallint,'UNIT_CAPTURE'::academic.grade_window_type,'2020-01-01'::timestamptz,'2100-01-01'::timestamptz,'T_DUP_WINDOW')$$,'23505',null,'ventana operativa duplicada');
select lives_ok($$select * from academic.create_grade_capture_window('e4100000-0000-4000-8000-000000000001',2::smallint,'UNIT_CAPTURE'::academic.grade_window_type,'2020-01-01'::timestamptz,'2100-01-01'::timestamptz,'T_WINDOW_2')$$,'ventana unidad 2');
select lives_ok($$select * from academic.create_grade_capture_window('e4100000-0000-4000-8000-000000000001',3::smallint,'UNIT_CAPTURE'::academic.grade_window_type,'2020-01-01'::timestamptz,'2100-01-01'::timestamptz,'T_WINDOW_3')$$,'ventana unidad 3');
select lives_ok(format('select * from academic.open_grade_capture_window(%L,%L)',id,'T_OPEN_'||unit_number)) from academic.grade_capture_windows order by unit_number;
select is((select count(*)::integer from academic.grade_capture_windows where status='OPEN'),3,'apertura de ventanas');
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select throws_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000001',-0.01,'T_NEGATIVE')$$,'INVALID_GRADE_VALUE','grado menor a cero rechazado');
select throws_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000001',10.01,'T_OVER_TEN')$$,'INVALID_GRADE_VALUE','grado mayor a diez rechazado');
select throws_ok($$select * from academic.capture_student_unit_grade('00000000-0000-4000-8000-000000000099','e5600000-0000-4000-8000-000000000001',7,'T_NOT_ENROLLED')$$,'STUDENT_NOT_ENROLLED','alumno no inscrito rechazado');
select lives_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000001',0,'T_GRADE_1')$$,'captura grado cero');
select lives_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000002',10,'T_GRADE_2')$$,'captura grado diez');
select lives_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000003',7,'T_GRADE_3')$$,'captura tercera unidad');
select is((select count(*)::integer from academic.student_unit_grades),3,'exactamente tres unidades capturadas');
select is((select normalized_grade from academic.student_unit_grades where unit_number=1),0::numeric,'grado cero normalizado');
select is((select normalized_grade from academic.student_unit_grades where unit_number=2),10::numeric,'grado diez normalizado');
select is((select entity_id from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000001',0,'T_GRADE_1')),(select id from academic.student_unit_grades where unit_number=1),'captura idempotente');
select throws_ok($$select * from academic.capture_student_unit_grade('e5500000-0000-4000-8000-000000000001','e5600000-0000-4000-8000-000000000001',1,'T_GRADE_1')$$,'IDEMPOTENCY_CONFLICT','conflicto de huella');
select lives_ok(format('select * from academic.review_student_unit_grade(%L,%L)',id,'T_REVIEW_'||unit_number)) from academic.student_unit_grades order by unit_number;
select is((select count(*)::integer from academic.student_unit_grades where status='REVIEWED'),3,'revisión de tres unidades');
select lives_ok(format('select * from academic.finalize_student_unit_grade(%L,%L)',id,'T_FINAL_'||unit_number)) from academic.student_unit_grades order by unit_number;
select is((select count(*)::integer from academic.student_unit_grades where status='FINALIZED'),3,'finalización de tres unidades');
select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select lives_ok($$select * from academic.calculate_subject_final_result('e5500000-0000-4000-8000-000000000001','T_RESULT')$$,'cálculo de resultado');
select is((select result_code::text from academic.subject_final_results),'AC','dos de tres produce AC');
select is((select accredited_unit_count::integer from academic.subject_final_results),2,'conteo 2 de 3');
select is((select raw_final_grade from academic.subject_final_results),null::numeric,'nota final numérica nullable');
select is((select calculation_status::text from academic.subject_final_results),'MANUAL_REVIEW_REQUIRED','promedio pendiente exige revisión manual');
select is((select entity_id from academic.calculate_subject_final_result('e5500000-0000-4000-8000-000000000001','T_RESULT')),(select id from academic.subject_final_results),'cálculo idempotente');
select lives_ok(format('select * from academic.create_grade_correction(%L,8,%L,%L)',id,'DATA_ENTRY_ERROR','T_CORRECTION')) from academic.student_unit_grades where unit_number=1;
select is((select entity_id from academic.create_grade_correction((select id from academic.student_unit_grades where unit_number=1),8,'DATA_ENTRY_ERROR','T_CORRECTION')),(select id from academic.grade_corrections),'creación de corrección idempotente');
select throws_ok(format('select * from academic.create_grade_correction(%L,9,%L,%L)',(select id from academic.student_unit_grades where unit_number=1),'DATA_ENTRY_ERROR','T_CORRECTION'),'IDEMPOTENCY_CONFLICT','corrección detecta conflicto de huella');
select lives_ok(format('select * from academic.submit_grade_correction(%L,%L)',id,'T_CORRECTION_SUBMIT')) from academic.grade_corrections;
select lives_ok(format('select * from academic.begin_grade_correction_review(%L,%L)',id,'T_CORRECTION_REVIEW')) from academic.grade_corrections;
select lives_ok(format('select * from academic.approve_grade_correction(%L,%L)',id,'T_CORRECTION_APPROVE')) from academic.grade_corrections;
select lives_ok(format('select * from academic.approve_grade_correction(%L,%L)',id,'T_CORRECTION_APPROVE')) from academic.grade_corrections;
select lives_ok(format('select * from academic.apply_grade_correction(%L,%L)',id,'T_CORRECTION_APPLY')) from academic.grade_corrections;
select lives_ok(format('select * from academic.apply_grade_correction(%L,%L)',id,'T_CORRECTION_APPLY')) from academic.grade_corrections;
select is((select raw_grade from academic.student_unit_grades where unit_number=1),8::numeric,'corrección recalcula unidad');
select is((select count(*)::integer from academic.student_unit_grade_history where correction_id is not null),1,'corrección no duplica historial');
select is((select count(*)::integer from academic.grade_events where event_type='GRADE_CORRECTION_APPLIED'),1,'corrección no duplica evento');
select is((select status::text from academic.subject_final_results),'CORRECTED','corrección invalida resultado calculado');
select lives_ok($$select * from academic.calculate_subject_final_result('e5500000-0000-4000-8000-000000000001','T_RESULT_RECALCULATED')$$,'recalcula resultado después de corrección');
select lives_ok(format('select * from academic.confirm_subject_final_result(%L,%L)',id,'T_CONFIRM')) from academic.subject_final_results;
select lives_ok(format('select * from academic.confirm_subject_final_result(%L,%L)',id,'T_CONFIRM')) from academic.subject_final_results;
select is((select count(*)::integer from academic.grade_events where event_type='SUBJECT_RESULT_CONFIRMED'),1,'confirmación no duplica evento');
select throws_ok($$delete from academic.subject_final_results$$,'HISTORICAL_GRADE_IMMUTABLE','DELETE histórico rechazado');
select throws_ok($$update academic.subject_final_results set result_code='NA'$$,'HISTORICAL_GRADE_IMMUTABLE','UPDATE directo rechazado');
select ok(not exists(select 1 from academic.grade_commands where request_fingerprint !~ '^[0-9a-f]{64}$'),'huellas SHA-256');
select throws_ok($$update academic.grade_commands set status='FAILED' where status='COMPLETED'$$,'HISTORICAL_GRADE_IMMUTABLE','comando final inmutable');
select is((select count(*)::integer from auth.users where id::text like 'e100%'),3,'Auth intacto durante el fixture transaccional');
select is((select count(*)::integer from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgname like '%grade%'),0,'sin triggers de calificaciones en Auth');
select is(
  (
    select count(*)::integer
    from information_schema.routines
    where routine_schema = 'public'
      and routine_name = 'get_my_student_portal_grades'
  ),
  1,
  'solo existe el wrapper público de calificaciones propias'
);
select is((select count(*)::integer from academic.subject_result_history where resulting_status='CONFIRMED'),1,'historial de confirmación único');
select ok((select count(*) from academic.grade_commands where status='COMPLETED')>=11,'mutaciones registradas como comandos completos');

select * from finish();
rollback;
