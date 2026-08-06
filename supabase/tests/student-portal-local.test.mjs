import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";

function runSql(sql) {
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { encoding: "utf8", input: sql, shell: false },
  );
  assert.equal(
    result.status,
    0,
    `Fallo la validación local del portal del alumno: ${result.stderr}`,
  );
  return result.stdout;
}

test("el portal del alumno resuelve contexto desde la sesión y aísla alumnos A/B", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','admin-portal@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','10000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','student-b@example.invalid','{}','{}',now(),now());

insert into core.people(id,status)
values
('20000000-0000-4000-8000-000000000001','ACTIVE'),
('20000000-0000-4000-8000-000000000002','ACTIVE'),
('20000000-0000-4000-8000-000000000003','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version)
values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','ACTIVE',1),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','ACTIVE',1),
('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid,r.id
from (values
('30000000-0000-4000-8000-000000000001','SUPERADMIN'),
('30000000-0000-4000-8000-000000000002','ALUMNO'),
('30000000-0000-4000-8000-000000000002','DOCENTE'),
('30000000-0000-4000-8000-000000000003','ALUMNO')
)v(actor,role_code)
join core.roles r on r.code=v.role_code;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('40000000-0000-4000-8000-000000000001','P4_CYCLE','Cycle portal','ACTIVE','2092-01-01','2092-12-31','30000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','P4_P1','Periodo visible',1,'2092-01-01','2092-04-30','ACTIVE','30000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','P4_P2','Periodo ajeno',2,'2092-08-01','2092-11-30','ACTIVE','30000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('60000000-0000-4000-8000-000000000001','P4_PLAN','Plan portal','V1','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('61000000-0000-4000-8000-000000000001','P4_GEN','Generación portal','40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','ACTIVE','30000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('62000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,'Primer semestre',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('63000000-0000-4000-8000-000000000001','PORTAL_MAT','Matemáticas portal','COMMON','30000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('64000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','63000000-0000-4000-8000-000000000001',1);
set local session_replication_role=replica;
insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order)
values
('64000000-0000-4000-8000-000000000001',1,'Unidad 1',1),
('64000000-0000-4000-8000-000000000001',2,'Unidad 2',2),
('64000000-0000-4000-8000-000000000001',3,'Unidad 3',3);
set local session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values
('65000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,'P4_G1','Grupo portal','ACTIVE',10,'30000000-0000-4000-8000-000000000001'),
('65000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',2,'P4_G2','Grupo nuevo','ACTIVE',10,'30000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values('66000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','64000000-0000-4000-8000-000000000001','ACTIVE','30000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('67000000-0000-4000-8000-000000000001','P4_SHIFT','Turno matutino','07:00','14:00','ACTIVE','30000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values
('68000000-0000-4000-8000-000000000001','67000000-0000-4000-8000-000000000001','P4_B1','Bloque 1',1,'07:00','07:50',true,false,'ACTIVE','30000000-0000-4000-8000-000000000001'),
('68000000-0000-4000-8000-000000000002','67000000-0000-4000-8000-000000000001','P4_B2','Bloque 2',2,'08:00','08:50',false,false,'ACTIVE','30000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values
('68100000-0000-4000-8000-000000000001','P4_TEMP_1','Plantilla portal 1','67000000-0000-4000-8000-000000000001','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001'),
('68100000-0000-4000-8000-000000000002','P4_TEMP_2','Plantilla portal 2','67000000-0000-4000-8000-000000000001','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values
('68200000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','68100000-0000-4000-8000-000000000001','PUBLISHED',1,'2092-01-01','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now()),
('68200000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','68100000-0000-4000-8000-000000000002','DRAFT',2,'2092-01-01','30000000-0000-4000-8000-000000000001',null,null);
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('68300000-0000-4000-8000-000000000001','A1','Aula 1','CLASSROOM','ACTIVE','30000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values
('69000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','ALU001','ACTIVE',1,'30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'),
('69000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','ALU002','ACTIVE',1,'30000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('00000000-0000-4000-8000-000000000011','69000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','30000000-0000-4000-8000-000000000001','P4_REQ_A',repeat('a',64)),
('00000000-0000-4000-8000-000000000012','69000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','30000000-0000-4000-8000-000000000001','P4_REQ_B',repeat('b',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('69100000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,'65000000-0000-4000-8000-000000000001','ACTIVE','ENR001','30000000-0000-4000-8000-000000000001'),
('69100000-0000-4000-8000-000000000002','69000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000012','50000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',1,'65000000-0000-4000-8000-000000000001','ACTIVE','ENR002','30000000-0000-4000-8000-000000000001');

insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values
('69200000-0000-4000-8000-000000000001','69100000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','ACTIVE','30000000-0000-4000-8000-000000000001'),
('69200000-0000-4000-8000-000000000002','69100000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000001','ACTIVE','30000000-0000-4000-8000-000000000001');

insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('69300000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','PRIMARY','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001');

insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values
('69400000-0000-4000-8000-000000000001','68200000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','69300000-0000-4000-8000-000000000001','68300000-0000-4000-8000-000000000001',1,'68000000-0000-4000-8000-000000000001','REGULAR_CLASS','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001'),
('69400000-0000-4000-8000-000000000002','68200000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000001','69300000-0000-4000-8000-000000000001','68300000-0000-4000-8000-000000000001',1,'68000000-0000-4000-8000-000000000002','REGULAR_CLASS','ACTIVE','2092-01-01','30000000-0000-4000-8000-000000000001');

insert into academic.attendance_sessions(id,class_session_id,academic_period_id,group_id,academic_offering_id,teaching_assignment_id,session_date,starts_at,ends_at,status,expected_student_count,opened_by_account_id,closed_by_account_id,opened_at,closed_at)
values('69500000-0000-4000-8000-000000000001','69400000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','69300000-0000-4000-8000-000000000001','2092-02-01','2092-02-01 07:00+00','2092-02-01 07:50+00','CLOSED',2,'30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now(),now());

insert into academic.attendance_records(id,attendance_session_id,student_record_id,period_enrollment_id,student_offering_enrollment_id,attendance_status,is_first_period,lateness_minutes,recorded_by_account_id,recorded_at)
values
('69600000-0000-4000-8000-000000000001','69500000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','69100000-0000-4000-8000-000000000001','69200000-0000-4000-8000-000000000001','LATE',true,7,'30000000-0000-4000-8000-000000000001',now()),
('69600000-0000-4000-8000-000000000002','69500000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000002','69100000-0000-4000-8000-000000000002','69200000-0000-4000-8000-000000000002','ABSENT',true,null,'30000000-0000-4000-8000-000000000001',now());

insert into academic.student_lateness_counters(id,student_record_id,academic_period_id,counter_type,current_count,lifetime_count,alert_sequence)
values('69700000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','FIRST_PERIOD_VALIDATED',1,1,0);

insert into academic.student_permissions(id,student_record_id,academic_period_id,permission_type,applies_to_date,status,reason_code,requested_by_account_id,approved_by_account_id,approved_at)
values('69800000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','FULL_DAY_ABSENCE','2092-02-03','APPROVED','MEDICAL','30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',now());

insert into academic.student_unit_grades(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,subject_unit_id,unit_number,raw_grade,normalized_grade,is_accredited,status,captured_by_account_id,finalized_by_account_id,finalized_at)
select
  ('69900000-0000-4000-8000-00000000000' || unit_number::text)::uuid,
  '69000000-0000-4000-8000-000000000001',
  '69100000-0000-4000-8000-000000000001',
  '69200000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000001',
  id,
  unit_number,
  8.0,
  8.0,
  true,
  'FINALIZED',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  now()
from academic.subject_units
where curriculum_subject_id = '64000000-0000-4000-8000-000000000001';

insert into academic.subject_final_results(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,raw_final_grade,rounded_final_grade,result_code,calculation_status,status,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values('70000000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','69100000-0000-4000-8000-000000000001','69200000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001',3,0,8.0,8.0,'AC','COMPLETE','CONFIRMED','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now());

insert into academic.semester_evaluation_summaries(id,student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values('70100000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','69100000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',1,1,1,0,0,'CONFIRMED','MANUAL_REVIEW_REQUIRED','INSTITUTIONAL_REVIEW','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',now());

insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id,created_at)
values('70200000-0000-4000-8000-000000000001','69000000-0000-4000-8000-000000000001','69100000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','REPEAT',1,'CONFIRMED','INSTITUTIONAL_VALIDATION_PENDING','30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','P4_DECISION',repeat('a',64),'50000000-0000-4000-8000-000000000001',now());

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ declare payload jsonb; begin
  select public.get_my_student_portal_overview('50000000-0000-4000-8000-000000000001') into payload;
  if payload->'record'->>'institutionalStudentCode' <> 'ALU001' then raise exception 'overview mismatch'; end if;
  if payload->'attendance'->>'lateCount' <> '1' then raise exception 'attendance summary mismatch'; end if;
end $$;

do $$ declare payload text; begin
  select public.get_my_student_portal_record()::text into payload;
  if payload ~ '69000000|30000000|20000000|admin-portal|student-a@example|student-b@example|approvedByAccountId|decidedByAccountId' then
    raise exception 'sensitive fields leaked';
  end if;
end $$;

do $$ declare payload jsonb; begin
  select public.get_my_student_portal_schedule('50000000-0000-4000-8000-000000000001') into payload;
  if payload #>> '{0,teacherName}' <> 'Docente pendiente de asignación' then raise exception 'teacher fallback mismatch'; end if;
end $$;

do $$ declare payload jsonb; begin
  select public.get_my_student_portal_grades('50000000-0000-4000-8000-000000000001') into payload;
  if payload #>> '{subjectResults,0,resultCode}' <> 'AC' then raise exception 'grade result mismatch'; end if;
  if payload #>> '{summary,evaluationStatus}' <> 'CONFIRMED' then raise exception 'summary visibility mismatch'; end if;
end $$;

do $$ begin
  perform public.get_my_student_portal_overview('00000000-0000-4000-8000-000000009999');
  raise exception 'foreign period accepted';
exception when others then
  if sqlerrm <> 'PERIOD_NOT_AVAILABLE' then raise; end if;
end $$;

do $$ declare payload jsonb; begin
  select public.get_my_student_portal_overview('50000000-0000-4000-8000-000000000001') into payload;
  if payload #>> '{selectedPeriod,id}' <> '50000000-0000-4000-8000-000000000001' then raise exception 'own period rejected'; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ declare payload jsonb; begin
  select public.get_my_student_portal_attendance('50000000-0000-4000-8000-000000000001') into payload;
  if payload #>> '{records,0,attendanceStatus}' <> 'ABSENT' then raise exception 'isolation mismatch'; end if;
  if payload #>> '{records,0,subjectCode}' <> 'PORTAL_MAT' then raise exception 'attendance record missing'; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin
  set local session_replication_role = replica;
  update core.accounts
    set account_status='SUSPENDED', suspended_at=now(), status_changed_at=now()
  where id='30000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  perform public.get_my_student_portal_record();
  raise exception 'suspended account accepted';
exception when others then
  set local session_replication_role = replica;
  update core.accounts
    set account_status='ACTIVE', suspended_at=null, status_changed_at=now()
  where id='30000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  if sqlerrm <> 'APPLICATION_NOT_ALLOWED' then raise; end if;
end $$;

do $$ begin
  set local session_replication_role = replica;
  update core.account_roles
    set revoked_at = now(), revoked_by = '30000000-0000-4000-8000-000000000001'
  where account_id='30000000-0000-4000-8000-000000000002'
    and role_id = (select id from core.roles where code='ALUMNO');
  set local session_replication_role = origin;
  perform public.get_my_student_portal_record();
  raise exception 'docente-only accepted';
exception when others then
  set local session_replication_role = replica;
  update core.account_roles set revoked_at = null, revoked_by = null
  where account_id='30000000-0000-4000-8000-000000000002'
    and role_id = (select id from core.roles where code='ALUMNO');
  set local session_replication_role = origin;
  if sqlerrm <> 'STUDENT_ROLE_REQUIRED' then raise; end if;
end $$;

do $$ begin
  set local session_replication_role = replica;
  update core.account_roles set revoked_at = now(), revoked_by = '30000000-0000-4000-8000-000000000001'
  where account_id='30000000-0000-4000-8000-000000000002';
  insert into core.account_roles(account_id,role_id)
  select '30000000-0000-4000-8000-000000000002', id from core.roles where code='CAJA'
  on conflict do nothing;
  set local session_replication_role = origin;
  perform public.get_my_student_portal_record();
  raise exception 'caja accepted';
exception when others then
  set local session_replication_role = replica;
  delete from core.account_roles where account_id='30000000-0000-4000-8000-000000000002'
    and role_id = (select id from core.roles where code='CAJA');
  update core.account_roles set revoked_at = null, revoked_by = null
  where account_id='30000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  if sqlerrm <> 'APPLICATION_NOT_ALLOWED' then raise; end if;
end $$;

do $$ begin
  set local session_replication_role = replica;
  update core.account_roles set revoked_at = now(), revoked_by = '30000000-0000-4000-8000-000000000001'
  where account_id='30000000-0000-4000-8000-000000000002';
  insert into core.account_roles(account_id,role_id)
  select '30000000-0000-4000-8000-000000000002', id from core.roles where code='PREFECTURA'
  on conflict do nothing;
  set local session_replication_role = origin;
  perform public.get_my_student_portal_record();
  raise exception 'prefectura accepted';
exception when others then
  set local session_replication_role = replica;
  delete from core.account_roles where account_id='30000000-0000-4000-8000-000000000002'
    and role_id = (select id from core.roles where code='PREFECTURA');
  update core.account_roles set revoked_at = null, revoked_by = null
  where account_id='30000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  if sqlerrm <> 'APPLICATION_NOT_ALLOWED' then raise; end if;
end $$;

do $$ begin
  set local session_replication_role = replica;
  update core.account_roles set revoked_at = now(), revoked_by = '30000000-0000-4000-8000-000000000001'
  where account_id='30000000-0000-4000-8000-000000000002';
  insert into core.account_roles(account_id,role_id)
  select '30000000-0000-4000-8000-000000000002', id from core.roles where code='ASPIRANTE'
  on conflict do nothing;
  set local session_replication_role = origin;
  perform public.get_my_student_portal_record();
  raise exception 'aspirante accepted';
exception when others then
  set local session_replication_role = replica;
  delete from core.account_roles where account_id='30000000-0000-4000-8000-000000000002'
    and role_id = (select id from core.roles where code='ASPIRANTE');
  update core.account_roles set revoked_at = null, revoked_by = null
  where account_id='30000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  if sqlerrm <> 'STUDENT_ROLE_REQUIRED' then raise; end if;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.group_schedules set status='DRAFT' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_schedule('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload) <> 0 then raise exception 'draft schedule visible'; end if;
  set local session_replication_role = replica;
  update academic.group_schedules set status='PUBLISHED' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.group_schedules set status='UNDER_REVIEW' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_schedule('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload) <> 0 then raise exception 'under-review schedule visible'; end if;
  set local session_replication_role = replica;
  update academic.group_schedules set status='PUBLISHED' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.group_schedules set status='APPROVED' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_schedule('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload) <> 0 then raise exception 'approved-only schedule visible'; end if;
  set local session_replication_role = replica;
  update academic.group_schedules set status='PUBLISHED' where id='68200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.attendance_sessions
    set status='OPEN',
        closed_at = null
  where id='69500000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_attendance('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload->'records') <> 0 then raise exception 'open attendance visible'; end if;
  set local session_replication_role = replica;
  update academic.attendance_sessions
    set status='CLOSED',
        closed_at = now()
  where id='69500000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='DRAFT' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_grades('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload->'unitGrades') <> 0 then raise exception 'draft grade visible'; end if;
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='FINALIZED' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='CAPTURED' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_grades('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload->'unitGrades') <> 0 then raise exception 'captured grade visible'; end if;
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='FINALIZED' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='REVIEWED' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_grades('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload->'unitGrades') <> 0 then raise exception 'reviewed grade visible'; end if;
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='FINALIZED' where student_record_id='69000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.subject_final_results set status='CALCULATED' where id='70000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_grades('50000000-0000-4000-8000-000000000001') into payload;
  if jsonb_array_length(payload->'subjectResults') <> 0 then raise exception 'unconfirmed result visible'; end if;
  set local session_replication_role = replica;
  update academic.subject_final_results set status='CONFIRMED' where id='70000000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.academic_progress_decisions set decision_status='DRAFT' where id='70200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
  select public.get_my_student_portal_trajectory() into payload;
  if jsonb_array_length(payload->'progressDecisions') <> 0 then raise exception 'draft decision visible'; end if;
  set local session_replication_role = replica;
  update academic.academic_progress_decisions set decision_status='CONFIRMED' where id='70200000-0000-4000-8000-000000000001';
  set local session_replication_role = origin;
end $$;

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":9}',true);
do $$ begin
  perform public.get_my_student_portal_record();
  raise exception 'stale session accepted';
exception when others then
  if sqlerrm <> 'APPLICATION_NOT_ALLOWED' then raise; end if;
end $$;

select 'LOCAL_STUDENT_PORTAL_OK';
rollback;
  `);

  assert.match(output, /LOCAL_STUDENT_PORTAL_OK/);
});
