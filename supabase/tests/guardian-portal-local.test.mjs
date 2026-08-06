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
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test("el portal del tutor resuelve vínculos activos y aísla tutores A/B", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','guardian-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','guardian-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','guardian-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','guardian-student-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','guardian-student-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','guardian-docente@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000007','authenticated','authenticated','synthetic','guardian-prefectura@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000008','authenticated','authenticated','synthetic','guardian-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000009','authenticated','authenticated','synthetic','guardian-alumno@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','81000000-0000-4000-8000-000000000010','authenticated','authenticated','synthetic','guardian-aspirante@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('82000000-0000-4000-8000-000000000001','ACTIVE'),
('82000000-0000-4000-8000-000000000002','ACTIVE'),
('82000000-0000-4000-8000-000000000003','ACTIVE'),
('82000000-0000-4000-8000-000000000004','ACTIVE'),
('82000000-0000-4000-8000-000000000005','ACTIVE'),
('82000000-0000-4000-8000-000000000006','ACTIVE'),
('82000000-0000-4000-8000-000000000007','ACTIVE'),
('82000000-0000-4000-8000-000000000008','ACTIVE'),
('82000000-0000-4000-8000-000000000009','ACTIVE'),
('82000000-0000-4000-8000-000000000010','ACTIVE'),
('82000000-0000-4000-8000-000000000011','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('83000000-0000-4000-8000-000000000001','82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','ACTIVE',1),
('83000000-0000-4000-8000-000000000002','82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000002','ACTIVE',1),
('83000000-0000-4000-8000-000000000003','82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000003','ACTIVE',1),
('83000000-0000-4000-8000-000000000004','82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000004','ACTIVE',1),
('83000000-0000-4000-8000-000000000005','82000000-0000-4000-8000-000000000005','81000000-0000-4000-8000-000000000005','ACTIVE',1),
('83000000-0000-4000-8000-000000000006','82000000-0000-4000-8000-000000000006','81000000-0000-4000-8000-000000000006','ACTIVE',1),
('83000000-0000-4000-8000-000000000007','82000000-0000-4000-8000-000000000007','81000000-0000-4000-8000-000000000007','ACTIVE',1),
('83000000-0000-4000-8000-000000000008','82000000-0000-4000-8000-000000000008','81000000-0000-4000-8000-000000000008','ACTIVE',1),
('83000000-0000-4000-8000-000000000009','82000000-0000-4000-8000-000000000009','81000000-0000-4000-8000-000000000009','ACTIVE',1),
('83000000-0000-4000-8000-000000000010','82000000-0000-4000-8000-000000000010','81000000-0000-4000-8000-000000000010','ACTIVE',1),
('83000000-0000-4000-8000-000000000011','82000000-0000-4000-8000-000000000011',null,'ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('83000000-0000-4000-8000-000000000001','SUPERADMIN'),
('83000000-0000-4000-8000-000000000002','TUTOR'),
('83000000-0000-4000-8000-000000000003','TUTOR'),
('83000000-0000-4000-8000-000000000004','ALUMNO'),
('83000000-0000-4000-8000-000000000005','ALUMNO'),
('83000000-0000-4000-8000-000000000006','DOCENTE'),
('83000000-0000-4000-8000-000000000007','PREFECTURA'),
('83000000-0000-4000-8000-000000000008','CAJA'),
('83000000-0000-4000-8000-000000000009','ALUMNO'),
('83000000-0000-4000-8000-000000000010','ASPIRANTE')
) seeded(actor,role_code)
join core.roles r on r.code=seeded.role_code;

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('84000000-0000-4000-8000-000000000001','GL_CYCLE','Cycle','ACTIVE','2098-01-01','2098-12-31','83000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000001','GL_P1','Periodo visible',1,'2098-01-01','2098-06-30','ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('84000000-0000-4000-8000-000000000003','GL_PLAN','Plan','V1','ACTIVE','2098-01-01','83000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000004','GL_GEN','Generación','84000000-0000-4000-8000-000000000001','84000000-0000-4000-8000-000000000003','ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('84000000-0000-4000-8000-000000000005','84000000-0000-4000-8000-000000000003',1,'Primer semestre',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('84000000-0000-4000-8000-000000000006','GL_MAT','Materia tutor','COMMON','83000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('84000000-0000-4000-8000-000000000007','84000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000005','84000000-0000-4000-8000-000000000006',1);
set local session_replication_role=replica;
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order)
values('84000000-0000-4000-8000-000000000008','84000000-0000-4000-8000-000000000007',1,'Unidad 1',1);
set local session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('84000000-0000-4000-8000-000000000009','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003',1,'GL_G1','Grupo tutor','ACTIVE',20,'83000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000010','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000009','84000000-0000-4000-8000-000000000007','ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000011','GL_SHIFT','Turno','07:00','14:00','ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000012','84000000-0000-4000-8000-000000000011','GL_B1','Bloque 1',1,'07:00','07:50',true,false,'ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values('84000000-0000-4000-8000-000000000013','GL_TMP','Plantilla','84000000-0000-4000-8000-000000000011','ACTIVE','2098-01-01','83000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values('84000000-0000-4000-8000-000000000014','84000000-0000-4000-8000-000000000009','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000013','PUBLISHED',1,'2098-01-01','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now());
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('84000000-0000-4000-8000-000000000015','GL_A1','Aula','CLASSROOM','ACTIVE','83000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id)
values
('84000000-0000-4000-8000-000000000016','82000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000004','84000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','GLA001','ACTIVE',1,'83000000-0000-4000-8000-000000000001'),
('84000000-0000-4000-8000-000000000017','82000000-0000-4000-8000-000000000005','83000000-0000-4000-8000-000000000005','84000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','GLB001','ACTIVE',1,'83000000-0000-4000-8000-000000000001'),
('84000000-0000-4000-8000-000000000035','82000000-0000-4000-8000-000000000011','83000000-0000-4000-8000-000000000011','84000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000004','GLC001','ACTIVE',1,'83000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values
('84000000-0000-4000-8000-000000000018','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000002','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','83000000-0000-4000-8000-000000000001','GL_REQ_A',repeat('a',64)),
('84000000-0000-4000-8000-000000000019','84000000-0000-4000-8000-000000000017','84000000-0000-4000-8000-000000000002','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','83000000-0000-4000-8000-000000000001','GL_REQ_B',repeat('b',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values
('84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000018','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003',1,'84000000-0000-4000-8000-000000000009','ACTIVE','GL_ENR_A','83000000-0000-4000-8000-000000000001'),
('84000000-0000-4000-8000-000000000021','84000000-0000-4000-8000-000000000017','84000000-0000-4000-8000-000000000019','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000003',1,'84000000-0000-4000-8000-000000000009','ACTIVE','GL_ENR_B','83000000-0000-4000-8000-000000000001');
insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values
('84000000-0000-4000-8000-000000000022','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000010','ACTIVE','83000000-0000-4000-8000-000000000001'),
('84000000-0000-4000-8000-000000000023','84000000-0000-4000-8000-000000000021','84000000-0000-4000-8000-000000000010','ACTIVE','83000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('84000000-0000-4000-8000-000000000024','84000000-0000-4000-8000-000000000010','83000000-0000-4000-8000-000000000001','PRIMARY','ACTIVE','2098-01-01','83000000-0000-4000-8000-000000000001');
insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values('84000000-0000-4000-8000-000000000025','84000000-0000-4000-8000-000000000014','84000000-0000-4000-8000-000000000010','84000000-0000-4000-8000-000000000024','84000000-0000-4000-8000-000000000015',1,'84000000-0000-4000-8000-000000000012','REGULAR_CLASS','ACTIVE','2098-01-01','83000000-0000-4000-8000-000000000001');
insert into academic.attendance_sessions(id,class_session_id,academic_period_id,group_id,academic_offering_id,teaching_assignment_id,session_date,starts_at,ends_at,status,expected_student_count,opened_by_account_id,closed_by_account_id,opened_at,closed_at)
values('84000000-0000-4000-8000-000000000026','84000000-0000-4000-8000-000000000025','84000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000009','84000000-0000-4000-8000-000000000010','84000000-0000-4000-8000-000000000024','2098-02-01','2098-02-01 07:00+00','2098-02-01 07:50+00','CLOSED',2,'83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now(),now());
insert into academic.attendance_records(id,attendance_session_id,student_record_id,period_enrollment_id,student_offering_enrollment_id,attendance_status,is_first_period,lateness_minutes,recorded_by_account_id,recorded_at)
values
('84000000-0000-4000-8000-000000000027','84000000-0000-4000-8000-000000000026','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000022','LATE',true,5,'83000000-0000-4000-8000-000000000001',now()),
('84000000-0000-4000-8000-000000000028','84000000-0000-4000-8000-000000000026','84000000-0000-4000-8000-000000000017','84000000-0000-4000-8000-000000000021','84000000-0000-4000-8000-000000000023','ABSENT',true,null,'83000000-0000-4000-8000-000000000001',now());
insert into academic.student_lateness_counters(id,student_record_id,academic_period_id,counter_type,current_count,lifetime_count,alert_sequence)
values('84000000-0000-4000-8000-000000000029','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000002','FIRST_PERIOD_VALIDATED',1,1,0);
insert into academic.student_permissions(id,student_record_id,academic_period_id,permission_type,applies_to_date,status,reason_code,requested_by_account_id,approved_by_account_id,approved_at)
values('84000000-0000-4000-8000-000000000030','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000002','FULL_DAY_ABSENCE','2098-02-03','APPROVED','MEDICAL','83000000-0000-4000-8000-000000000004','83000000-0000-4000-8000-000000000001',now());
insert into academic.student_unit_grades(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,subject_unit_id,unit_number,raw_grade,normalized_grade,is_accredited,status,captured_by_account_id,finalized_by_account_id,finalized_at)
values('84000000-0000-4000-8000-000000000031','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000022','84000000-0000-4000-8000-000000000010','84000000-0000-4000-8000-000000000008',1,9.0,9.0,true,'FINALIZED','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now());
insert into academic.subject_final_results(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,raw_final_grade,rounded_final_grade,result_code,calculation_status,status,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values('84000000-0000-4000-8000-000000000032','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000022','84000000-0000-4000-8000-000000000010',1,0,9.0,9.0,'AC','COMPLETE','CONFIRMED','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now());
insert into academic.semester_evaluation_summaries(id,student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id,confirmed_by_account_id,confirmed_at)
values('84000000-0000-4000-8000-000000000033','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000002',1,1,1,0,0,'CONFIRMED','MANUAL_REVIEW_REQUIRED','INSTITUTIONAL_REVIEW','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001',now());
insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id,created_at)
values('84000000-0000-4000-8000-000000000034','84000000-0000-4000-8000-000000000016','84000000-0000-4000-8000-000000000020','84000000-0000-4000-8000-000000000002','REPEAT',1,'CONFIRMED','INSTITUTIONAL_VALIDATION_PENDING','83000000-0000-4000-8000-000000000001','83000000-0000-4000-8000-000000000001','GL_DEC_001',repeat('c',64),'84000000-0000-4000-8000-000000000002',now());

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.create_guardian_link_request('83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000016','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GL_REQ_001',null);
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_001'),'GL_REQ_SUB_001',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_001'),'GL_REQ_REV_001',null);
select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_001'),'GL_REQ_APP_001',null);
select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_001'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GL_LINK_001',null);
select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_001')),'GL_LINK_ACT_001',null);
select * from academic.create_guardian_link_request('83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000017','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GL_REQ_002',null);
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_002'),'GL_REQ_SUB_002',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_002'),'GL_REQ_REV_002',null);
select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_002'),'GL_REQ_APP_002',null);
select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_002'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GL_LINK_002',null);
select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_002')),'GL_LINK_ACT_002',null);
select * from academic.create_guardian_link_request('83000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000017','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GL_REQ_003',null);
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_003'),'GL_REQ_SUB_003',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_003'),'GL_REQ_REV_003',null);
select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_003'),'GL_REQ_APP_003',null);
select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_003'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GL_LINK_003',null);
select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_003')),'GL_LINK_ACT_003',null);

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ declare linked jsonb; payload jsonb; begin
  select public.get_my_linked_students() into linked;
  if jsonb_array_length(linked) <> 2 then raise exception 'linked students mismatch'; end if;
  select public.get_my_guardian_student_overview((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'), '84000000-0000-4000-8000-000000000002') into payload;
  if payload #>> '{metrics,totalSubjects}' <> '1' then raise exception 'overview mismatch'; end if;
  if payload #>> '{attendance,lateCount}' <> '1' then raise exception 'attendance mismatch'; end if;
  if (public.get_my_guardian_student_schedule((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'), '84000000-0000-4000-8000-000000000002') #>> '{0,subjectCode}') <> 'GL_MAT' then raise exception 'schedule mismatch'; end if;
  if (public.get_my_guardian_student_grades((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'), '84000000-0000-4000-8000-000000000002') #>> '{subjectResults,0,resultCode}') <> 'AC' then raise exception 'grades mismatch'; end if;
end $$;

do $$ begin
  perform public.get_my_guardian_student_overview((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000003' and student_record_id='84000000-0000-4000-8000-000000000017'), null);
  raise exception 'cross guardian access accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.suspend_guardian_student_link((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'),'GL_LINK_SUS_001',null);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin
  perform public.get_my_guardian_student_record((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'));
  raise exception 'suspended link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.reactivate_guardian_student_link((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'),'GL_LINK_REA_001',null);
select * from academic.revoke_guardian_student_link((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'),'GL_LINK_REV_001',null);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin
  perform public.get_my_guardian_student_record((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000016'));
  raise exception 'revoked link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.guardian_access_scopes(id,code,name,created_by_account_id,is_system_scope,status)
values('84000000-0000-4000-8000-000000000036','GL_RET_SCOPE','Scope retirado','83000000-0000-4000-8000-000000000001',false,'RETIRED');
select * from academic.create_guardian_link_request('83000000-0000-4000-8000-000000000003','84000000-0000-4000-8000-000000000016','FATHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GL_REQ_PENDING',null);
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING'),'GL_REQ_SUB_PENDING',null);
select * from academic.begin_guardian_link_review((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING'),'GL_REQ_REV_PENDING',null);
select * from academic.approve_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING'),'GL_REQ_APP_PENDING',null);
select * from academic.create_guardian_student_link((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING'),'STANDARD_ACADEMIC_READ',statement_timestamp(),null,false,'GL_LINK_PENDING',null);
select * from academic.create_guardian_link_request('83000000-0000-4000-8000-000000000002','84000000-0000-4000-8000-000000000035','MOTHER','CONTROL_ESCOLAR','MANUAL_REVIEW_REQUIRED','CONTROL_ESCOLAR_REQUEST','GL_REQ_CANCEL',null);
select * from academic.submit_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_CANCEL'),'GL_REQ_SUB_CANCEL',null);
select * from academic.cancel_guardian_link_request((select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_CANCEL'),'GL_REQ_CANCEL_OP',null);

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ declare payload text; begin
  select public.get_my_guardian_student_record((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000017'))::text into payload;
  if payload ~ '84000000-0000|83000000-0000|82000000-0000|guardian-admin@example.invalid|guardian-a@example.invalid|guardian-b@example.invalid|approvedByAccountId|personId|accountId|authUserId' then
    raise exception 'privacy leak';
  end if;
end $$;
do $$ begin
  perform public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING')));
  raise exception 'pending link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set valid_from = statement_timestamp() + interval '1 day'
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
  if jsonb_array_length(public.get_my_linked_students()) <> 0 then raise exception 'future link visible'; end if;
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set valid_from = statement_timestamp()
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set valid_from = statement_timestamp() - interval '2 day',
        valid_until = statement_timestamp() - interval '1 minute'
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
  if jsonb_array_length(public.get_my_linked_students()) <> 0 then raise exception 'expired-by-date link visible'; end if;
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set valid_from = statement_timestamp(),
        valid_until = null
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set access_scope_id = '84000000-0000-4000-8000-000000000036'
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
  perform public.get_my_guardian_student_record((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000017'));
  raise exception 'inactive scope accepted';
exception when others then
  set local session_replication_role = replica;
  update academic.guardian_student_links
    set access_scope_id = (select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ')
  where guardian_account_id='83000000-0000-4000-8000-000000000002'
    and student_record_id='84000000-0000-4000-8000-000000000017';
  set local session_replication_role = origin;
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;
do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.group_schedules set status='DRAFT' where id='84000000-0000-4000-8000-000000000014';
  set local session_replication_role = origin;
  select public.get_my_guardian_student_schedule((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000017'),'84000000-0000-4000-8000-000000000002') into payload;
  if jsonb_array_length(payload) <> 0 then raise exception 'draft schedule visible'; end if;
  set local session_replication_role = replica;
  update academic.group_schedules set status='PUBLISHED' where id='84000000-0000-4000-8000-000000000014';
  set local session_replication_role = origin;
end $$;
do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.attendance_sessions set status='OPEN', closed_at = null, closed_by_account_id = null where id='84000000-0000-4000-8000-000000000026';
  set local session_replication_role = origin;
  select public.get_my_guardian_student_attendance((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000017'),'84000000-0000-4000-8000-000000000002') into payload;
  if jsonb_array_length(payload->'records') <> 0 then raise exception 'open attendance visible'; end if;
  set local session_replication_role = replica;
  update academic.attendance_sessions set status='CLOSED', closed_at = now(), closed_by_account_id = '83000000-0000-4000-8000-000000000001' where id='84000000-0000-4000-8000-000000000026';
  set local session_replication_role = origin;
end $$;
do $$ declare payload jsonb; begin
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='CAPTURED', finalized_at = null, finalized_by_account_id = null where id='84000000-0000-4000-8000-000000000031';
  set local session_replication_role = origin;
  select public.get_my_guardian_student_grades((select id from academic.guardian_student_links where guardian_account_id='83000000-0000-4000-8000-000000000002' and student_record_id='84000000-0000-4000-8000-000000000017'),'84000000-0000-4000-8000-000000000002') into payload;
  if jsonb_array_length(payload->'unitGrades') <> 0 then raise exception 'captured grade visible'; end if;
  set local session_replication_role = replica;
  update academic.student_unit_grades set status='FINALIZED', finalized_at = now(), finalized_by_account_id = '83000000-0000-4000-8000-000000000001' where id='84000000-0000-4000-8000-000000000031';
  set local session_replication_role = origin;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update core.accounts set account_status='SUSPENDED', suspended_at=now(), status_changed_at=now() where id='83000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
  if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'suspended account accepted'; end if;
  set local session_replication_role = replica;
  update core.accounts set account_status='ACTIVE', suspended_at=null, status_changed_at=now() where id='83000000-0000-4000-8000-000000000002';
  set local session_replication_role = origin;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update core.account_roles set revoked_at=now(), revoked_by='83000000-0000-4000-8000-000000000001'
  where account_id='83000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='TUTOR');
  set local session_replication_role = origin;
  if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'revoked tutor role accepted'; end if;
  set local session_replication_role = replica;
  update core.account_roles set revoked_at=null, revoked_by=null
  where account_id='83000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='TUTOR');
  set local session_replication_role = origin;
end $$;
do $$ begin
  set local session_replication_role = replica;
  update core.account_roles set revoked_at=now(), revoked_by='83000000-0000-4000-8000-000000000001'
  where account_id='83000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='TUTOR');
  insert into core.account_roles(account_id,role_id)
  select '83000000-0000-4000-8000-000000000002', id from core.roles where code='ADMINISTRATIVO'
  on conflict do nothing;
  set local session_replication_role = origin;
  if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'application-revoked account accepted'; end if;
  set local session_replication_role = replica;
  delete from core.account_roles where account_id='83000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='ADMINISTRATIVO');
  update core.account_roles set revoked_at=null, revoked_by=null
  where account_id='83000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='TUTOR');
  set local session_replication_role = origin;
end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":2}',true);
do $$ begin
  if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'stale session accepted'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'docente accepted'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000007","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'prefectura accepted'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000008","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'caja accepted'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000009","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'alumno accepted'; end if; end $$;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000010","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin if public.get_my_linked_students() <> '[]'::jsonb then raise exception 'aspirante accepted'; end if; end $$;

select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.activate_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING')),'GL_LINK_ACT_PENDING',null);
select * from academic.expire_guardian_student_link((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING')),'GL_LINK_EXP_PENDING',null);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$ begin
  perform public.get_my_guardian_student_record((select id from academic.guardian_student_links where source_request_id=(select id from academic.guardian_student_link_requests where idempotency_key='GL_REQ_PENDING')));
  raise exception 'expired link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;

select 'LOCAL_GUARDIAN_PORTAL_OK';
rollback;
  `);

  assert.match(output, /LOCAL_GUARDIAN_PORTAL_OK/);
});
