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
  assert.equal(result.status, 0, `Fallo flujo local de asistencia: ${result.stderr}`);
  return result.stdout;
}

test("ejecuta 46 pasos institucionales de asistencia y revierte fixtures", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','attendance-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','attendance-prefect@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','attendance-teacher@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','attendance-cash@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','attendance-control@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','attendance-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) select ('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.person_status from generate_series(1,6)n;
insert into core.accounts(id,person_id,auth_user_id,account_status) select ('f3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.account_status from generate_series(1,6)n;
insert into core.account_roles(account_id,role_id) select v.account_id::uuid,r.id from (values
('f3000000-0000-4000-8000-000000000001','SUPERADMIN'),('f3000000-0000-4000-8000-000000000002','PREFECTURA'),('f3000000-0000-4000-8000-000000000003','DOCENTE'),('f3000000-0000-4000-8000-000000000004','CAJA'),('f3000000-0000-4000-8000-000000000005','CONTROL_ESCOLAR'),('f3000000-0000-4000-8000-000000000006','ALUMNO'))v(account_id,role_code) join core.roles r on r.code=v.role_code;

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values('f4000000-0000-4000-8000-000000000001','B4_CYCLE','Synthetic cycle','ACTIVE','2096-01-01','2096-12-31','f3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values('f4100000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','B4_PERIOD','Synthetic period',1,'2096-01-01','2096-06-30','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('f4200000-0000-4000-8000-000000000001','B4_PLAN','Synthetic plan','V1','ACTIVE','2096-01-01','f3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values('f4300000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001',1,'Semester one',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('f4400000-0000-4000-8000-000000000001','B4_SUBJECT','Synthetic subject','COMMON','f3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('f4500000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001','f4300000-0000-4000-8000-000000000001','f4400000-0000-4000-8000-000000000001',1);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,created_by_account_id) values('f4600000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001',1,'B4_GROUP','Synthetic group','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values('f4700000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f4600000-0000-4000-8000-000000000001','f4500000-0000-4000-8000-000000000001','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id) values('f4800000-0000-4000-8000-000000000001','f4700000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000003','PRIMARY','ACTIVE','2096-01-01','f3000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id) values('f4900000-0000-4000-8000-000000000001','B4_SHIFT','Synthetic shift','07:00','13:00','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,status,created_by_account_id) values('f4a00000-0000-4000-8000-000000000001','f4900000-0000-4000-8000-000000000001','B4_FIRST','First period',1,'07:00','07:50',true,'ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,valid_to,created_by_account_id) values('f4b00000-0000-4000-8000-000000000001','B4_TEMPLATE','Synthetic template','f4900000-0000-4000-8000-000000000001','ACTIVE','2096-01-01','2096-06-30','f3000000-0000-4000-8000-000000000001');
insert into academic.schedule_template_blocks(schedule_template_id,weekday,time_block_id) values('f4b00000-0000-4000-8000-000000000001',1,'f4a00000-0000-4000-8000-000000000001');
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id) values('f4c00000-0000-4000-8000-000000000001','B4_ROOM','Synthetic room','CLASSROOM','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,effective_to,created_by_account_id) values('f4d00000-0000-4000-8000-000000000001','f4600000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f4b00000-0000-4000-8000-000000000001','PUBLISHED',1,'2096-01-01','2096-06-30','f3000000-0000-4000-8000-000000000001');
insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,valid_to,created_by_account_id) values('f4e00000-0000-4000-8000-000000000001','f4d00000-0000-4000-8000-000000000001','f4700000-0000-4000-8000-000000000001','f4800000-0000-4000-8000-000000000001','f4c00000-0000-4000-8000-000000000001',1,'f4a00000-0000-4000-8000-000000000001','REGULAR_CLASS','ACTIVE','2096-01-01','2096-06-30','f3000000-0000-4000-8000-000000000001');

insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values('f5000000-0000-4000-8000-000000000001','B4_GEN','Synthetic generation','f4000000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,first_enrollment_period_id,last_enrollment_period_id,created_by_account_id) values('f5100000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000006','f3000000-0000-4000-8000-000000000006','f4200000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','B4_STUDENT','ACTIVE',1,'f4100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint) values('f5200000-0000-4000-8000-000000000001','f5100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'f4600000-0000-4000-8000-000000000001','ENROLLED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','f3000000-0000-4000-8000-000000000001','B4_ENROLL_REQUEST',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id) values('f5300000-0000-4000-8000-000000000001','f5100000-0000-4000-8000-000000000001','f5200000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001',1,'f4600000-0000-4000-8000-000000000001','ACTIVE','B4_E1','f3000000-0000-4000-8000-000000000001');
insert into academic.student_group_assignments(id,period_enrollment_id,group_id,assignment_type,status,assigned_by_account_id,reason_code,idempotency_key) values('f5400000-0000-4000-8000-000000000001','f5300000-0000-4000-8000-000000000001','f4600000-0000-4000-8000-000000000001','INITIAL','ACTIVE','f3000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT','B4_GROUP_ASSIGN');
insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id) values('f5500000-0000-4000-8000-000000000001','f5300000-0000-4000-8000-000000000001','f4700000-0000-4000-8000-000000000001','ACTIVE','f3000000-0000-4000-8000-000000000001');

create temporary table b4_ids(name text primary key,id uuid);
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$declare d date; s uuid; r uuid; i integer:=0; begin foreach d in array array['2096-01-02'::date,'2096-01-09','2096-01-16','2096-01-23','2096-01-30'] loop i:=i+1; select entity_id into s from academic.create_attendance_session('f4e00000-0000-4000-8000-000000000001',d,'B4_SESSION_'||i); perform * from academic.populate_attendance_session_roster(s,'B4_ROSTER_'||i); perform * from academic.open_attendance_session(s,'B4_OPEN_'||i); select id into r from academic.attendance_records where attendance_session_id=s; perform * from academic.record_student_attendance(r,'LATE',5,null,'B4_LATE_'||i); insert into b4_ids values('session'||i,s),('record'||i,r); end loop; end$$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.validate_student_lateness((select id from b4_ids where name='record1'),'B4_VALIDATE_1');
select * from academic.validate_student_lateness((select id from b4_ids where name='record2'),'B4_VALIDATE_2');
select * from academic.validate_student_lateness((select id from b4_ids where name='record3'),'B4_VALIDATE_3');
select * from academic.validate_student_lateness((select id from b4_ids where name='record4'),'B4_VALIDATE_4');
select * from academic.validate_student_lateness((select id from b4_ids where name='record5'),'B4_VALIDATE_5');
do $$begin if not exists(select 1 from academic.student_lateness_counters where current_count=1 and lifetime_count=5 and alert_sequence=1) then raise exception 'lateness rule failed'; end if; if not exists(select 1 from academic.lateness_alerts where threshold_value=4 and status='PENDING_NOTIFICATION') then raise exception 'fourth alert missing'; end if; end$$;
insert into b4_ids select 'permission',entity_id from academic.create_student_permission('f5100000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001','LATE_ARRIVAL','2096-01-30',null,null,'TRANSPORTATION','B4_PERMISSION_CREATE');
select * from academic.submit_student_permission((select id from b4_ids where name='permission'),'B4_PERMISSION_SUBMIT');
select * from academic.begin_permission_review((select id from b4_ids where name='permission'),'B4_PERMISSION_REVIEW');
select * from academic.approve_student_permission((select id from b4_ids where name='permission'),'B4_PERMISSION_APPROVE');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.apply_student_permission((select id from b4_ids where name='permission'),'B4_PERMISSION_APPLY');
insert into b4_ids select 'correction',entity_id from academic.create_attendance_correction((select id from b4_ids where name='record5'),'EXCUSED',null,'APPROVED_PERMISSION','B4_CORRECTION_CREATE');
select * from academic.submit_attendance_correction((select id from b4_ids where name='correction'),'B4_CORRECTION_SUBMIT');
select * from academic.begin_attendance_correction_review((select id from b4_ids where name='correction'),'B4_CORRECTION_REVIEW');
select * from academic.approve_attendance_correction((select id from b4_ids where name='correction'),'B4_CORRECTION_APPROVE');
select * from academic.apply_attendance_correction((select id from b4_ids where name='correction'),'B4_CORRECTION_APPLY');
do $$begin if not exists(select 1 from academic.student_lateness_counters where current_count=0 and lifetime_count=5) then raise exception 'counter adjustment failed'; end if; end$$;
insert into b4_ids select 'alert',id from academic.lateness_alerts limit 1;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.record_lateness_notification((select id from b4_ids where name='alert'),'B4_NOTIFY');
select * from academic.acknowledge_lateness_alert((select id from b4_ids where name='alert'),'B4_ACK');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from academic.close_attendance_session((select id from b4_ids where name='session1'),'B4_CLOSE');
select * from academic.lock_attendance_session((select id from b4_ids where name='session1'),'B4_LOCK_1');
do $$begin begin perform * from academic.record_student_attendance((select id from b4_ids where name='record1'),'PRESENT',null,null,'B4_REJECT_LOCKED'); raise exception 'locked mutation accepted'; exception when others then if sqlerrm not in ('ATTENDANCE_SESSION_CLOSED','ATTENDANCE_ALREADY_RECORDED') then raise; end if; end; end$$;
do $$begin if (select count(*) from academic.attendance_events)<20 then raise exception 'audit incomplete'; end if; if exists(select 1 from academic.attendance_events where actor_account_id is null) then raise exception 'audit actor missing'; end if; end$$;
select 'STEPS=46';
rollback;
`);
  assert.match(output, /STEPS=46/);
  assert.equal(
    runSql(
      "select count(*) from academic.student_records where institutional_student_code='B4_STUDENT';",
    ).trim(),
    "0",
  );
});
