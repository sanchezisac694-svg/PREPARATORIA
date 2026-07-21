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
  assert.equal(result.status, 0, `Fallo el flujo local de inscripcion: ${result.stderr}`);
  return result.stdout;
}

test("recorre la trayectoria institucional mediante operaciones controladas y revierte fixtures", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','administrative@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','school-control@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','cashier@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','student-one@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c1000000-0000-4000-8000-000000000006','authenticated','authenticated','synthetic','student-two@example.invalid','{}','{}',now(),now());
insert into core.people(id,status)
select ('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.person_status from generate_series(1,6)n;
insert into core.accounts(id,person_id,auth_user_id,account_status)
select ('c3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('c2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('c1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.account_status
from generate_series(1,6)n;
insert into core.account_roles(account_id,role_id)
select actor::uuid,r.id from (values
('c3000000-0000-4000-8000-000000000001','SUPERADMIN'),
('c3000000-0000-4000-8000-000000000002','ADMINISTRATIVO'),
('c3000000-0000-4000-8000-000000000003','CONTROL_ESCOLAR'),
('c3000000-0000-4000-8000-000000000004','CAJA'),
('c3000000-0000-4000-8000-000000000005','ALUMNO'))v(actor,role_code)
join core.roles r on r.code=v.role_code;

select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
('c4000000-0000-4000-8000-000000000001','B2_ENTRY','Entry cycle','ACTIVE','2090-01-01','2090-12-31','c3000000-0000-4000-8000-000000000001'),
('c4000000-0000-4000-8000-000000000002','B2_EXIT','Expected completion','PLANNED','2093-01-01','2093-12-31','c3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('c5000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','B2_P1','Period one',1,'2090-01-01','2090-04-30','ACTIVE','c3000000-0000-4000-8000-000000000001'),
('c5000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000001','B2_P2','Period two',2,'2090-05-01','2090-08-31','PLANNED','c3000000-0000-4000-8000-000000000001'),
('c5000000-0000-4000-8000-000000000003','c4000000-0000-4000-8000-000000000001','B2_P3','Period three',3,'2090-09-01','2090-12-31','PLANNED','c3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('c6000000-0000-4000-8000-000000000001','B2_PLAN','Synthetic plan','V1','ACTIVE','2090-01-01','c3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values
('c6100000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',1,'Semester one',false),
('c6100000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001',2,'Semester two',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values
('c6200000-0000-4000-8000-000000000001','B2_SUB1','Subject one','COMMON','c3000000-0000-4000-8000-000000000001'),
('c6200000-0000-4000-8000-000000000002','B2_SUB2','Subject two','COMMON','c3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values
('c6300000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001','c6200000-0000-4000-8000-000000000001',1),
('c6300000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000002','c6200000-0000-4000-8000-000000000002',1);
set local session_replication_role=replica;
insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order) values
('c6300000-0000-4000-8000-000000000001',1,'Unit 1',1),
('c6300000-0000-4000-8000-000000000001',2,'Unit 2',2),
('c6300000-0000-4000-8000-000000000001',3,'Unit 3',3),
('c6300000-0000-4000-8000-000000000002',1,'Unit 1',1),
('c6300000-0000-4000-8000-000000000002',2,'Unit 2',2),
('c6300000-0000-4000-8000-000000000002',3,'Unit 3',3);
set local session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id) values
('c7000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c6000000-0000-4000-8000-000000000001',1,'B2_G1','Group one','ACTIVE',2,'c3000000-0000-4000-8000-000000000001'),
('c7000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001',2,'B2_G2','Group two','OPEN',2,'c3000000-0000-4000-8000-000000000001'),
('c7000000-0000-4000-8000-000000000003','c5000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000001',2,'B2_G3A','Repeat group A','OPEN',1,'c3000000-0000-4000-8000-000000000001'),
('c7000000-0000-4000-8000-000000000004','c5000000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000001',2,'B2_G3B','Repeat group B','OPEN',1,'c3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values
('c8000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','c7000000-0000-4000-8000-000000000001','c6300000-0000-4000-8000-000000000001','ACTIVE','c3000000-0000-4000-8000-000000000001'),
('c8000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000002','c7000000-0000-4000-8000-000000000002','c6300000-0000-4000-8000-000000000002','ACTIVE','c3000000-0000-4000-8000-000000000001'),
('c8000000-0000-4000-8000-000000000003','c5000000-0000-4000-8000-000000000003','c7000000-0000-4000-8000-000000000003','c6300000-0000-4000-8000-000000000002','ACTIVE','c3000000-0000-4000-8000-000000000001'),
('c8000000-0000-4000-8000-000000000004','c5000000-0000-4000-8000-000000000003','c7000000-0000-4000-8000-000000000004','c6300000-0000-4000-8000-000000000002','ACTIVE','c3000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
create temporary table ids(name text primary key,id uuid);
insert into ids select 'generation',entity_id from academic.create_student_generation('B2_GEN','Synthetic generation','c4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','LOCAL_B2_GEN_CREATE');
select * from academic.activate_student_generation((select id from ids where name='generation'),'LOCAL_B2_GEN_ACTIVATE');
do $$declare first_id uuid; replay_id uuid; begin
  select id into first_id from ids where name='generation';
  select entity_id into replay_id from academic.create_student_generation('B2_GEN','Synthetic generation','c4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','LOCAL_B2_GEN_CREATE');
  if first_id<>replay_id then raise exception 'idempotent generation mismatch'; end if;
end$$;
do $$begin
  perform * from academic.create_student_generation('B2_CHANGED','Synthetic generation','c4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002','c6000000-0000-4000-8000-000000000001','LOCAL_B2_GEN_CREATE');
  raise exception 'fingerprint conflict accepted';
exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end$$;

do $$begin
  perform * from academic.create_student_record('c2000000-0000-4000-8000-000000000006','c3000000-0000-4000-8000-000000000006','c6000000-0000-4000-8000-000000000001',(select id from ids where name='generation'),'000999',1::smallint,null,'LOCAL_B2_RECORD_NO_ROLE');
  raise exception 'account without student role accepted';
exception when others then if sqlerrm<>'STUDENT_ROLE_REQUIRED' then raise; end if; end$$;
insert into ids select 'record',entity_id from academic.create_student_record('c2000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000005','c6000000-0000-4000-8000-000000000001',(select id from ids where name='generation'),'000123',1::smallint,null,'LOCAL_B2_RECORD_CREATE');
select * from academic.activate_student_record((select id from ids where name='record'),'LOCAL_B2_RECORD_ACTIVATE');
do $$begin if (select institutional_student_code from academic.student_records where id=(select id from ids where name='record'))<>'000123' then raise exception 'leading zeros lost'; end if; end$$;

insert into ids select 'request1',entity_id from academic.create_enrollment_request((select id from ids where name='record'),'c5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1::smallint,null,'c7000000-0000-4000-8000-000000000001','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','LOCAL_B2_REQUEST1_CREATE');
select * from academic.submit_enrollment_request((select id from ids where name='request1'),'LOCAL_B2_REQUEST1_SUBMIT');
select * from academic.begin_enrollment_review((select id from ids where name='request1'),'LOCAL_B2_REQUEST1_REVIEW');
select * from academic.approve_enrollment_request((select id from ids where name='request1'),'INITIAL_ENROLLMENT_ALLOWED','LOCAL_B2_REQUEST1_APPROVE');
insert into ids select 'enrollment1',entity_id from academic.create_period_enrollment((select id from ids where name='request1'),'000001','LOCAL_B2_ENROLLMENT1_CREATE');
insert into ids select 'assignment1',entity_id from academic.assign_student_group((select id from ids where name='enrollment1'),'c7000000-0000-4000-8000-000000000001','INITIAL','INITIAL_ENROLLMENT','LOCAL_B2_ASSIGNMENT1');
do $$declare coverage record; begin select * into coverage from academic.validate_group_curriculum_coverage('c7000000-0000-4000-8000-000000000001'); if not coverage.complete or coverage.expected_count<>1 or coverage.offered_count<>1 then raise exception 'coverage mismatch'; end if; end$$;
set local session_replication_role=replica;
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('c6200000-0000-4000-8000-000000000003','B2_INCOMPLETE','Incomplete units','COMMON','c3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('c6300000-0000-4000-8000-000000000003','c6000000-0000-4000-8000-000000000001','c6100000-0000-4000-8000-000000000001','c6200000-0000-4000-8000-000000000003',2);
insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order) values('c6300000-0000-4000-8000-000000000003',1,'Unit 1',1),('c6300000-0000-4000-8000-000000000003',2,'Unit 2',2);
set local session_replication_role=origin;
do $$declare coverage record; begin select * into coverage from academic.validate_group_curriculum_coverage('c7000000-0000-4000-8000-000000000001'); if coverage.complete or coverage.expected_count<>2 or coverage.offered_count<>1 then raise exception 'incomplete three-unit curriculum accepted'; end if; end$$;
set local session_replication_role=replica;
delete from academic.subject_units where curriculum_subject_id='c6300000-0000-4000-8000-000000000003';
delete from academic.curriculum_subjects where id='c6300000-0000-4000-8000-000000000003';
delete from academic.subjects where id='c6200000-0000-4000-8000-000000000003';
set local session_replication_role=origin;
select * from academic.activate_period_enrollment((select id from ids where name='enrollment1'),'LOCAL_B2_ENROLLMENT1_ACTIVATE');
select * from academic.enroll_student_in_group_offerings((select id from ids where name='enrollment1'),'LOCAL_B2_OFFERINGS_REPLAY');
do $$begin
  if (select count(*) from academic.student_offering_enrollments where period_enrollment_id=(select id from ids where name='enrollment1'))<>1 then raise exception 'offering enrollment mismatch'; end if;
  if exists(select 1 from academic.student_offering_enrollments se join academic.academic_offerings o on o.id=se.academic_offering_id join academic.curriculum_subjects c on c.id=o.curriculum_subject_id join academic.plan_semesters ps on ps.id=c.plan_semester_id where se.period_enrollment_id=(select id from ids where name='enrollment1') and ps.semester_number<>1) then raise exception 'mixed semester accepted'; end if;
end$$;
select * from academic.complete_period_enrollment((select id from ids where name='enrollment1'),'LOCAL_B2_ENROLLMENT1_COMPLETE');

insert into ids select 'advance',entity_id from academic.create_progress_decision((select id from ids where name='record'),(select id from ids where name='enrollment1'),'c5000000-0000-4000-8000-000000000001','ADVANCE',2::smallint,null,'PREVIOUS_PERIOD_APPROVED','c5000000-0000-4000-8000-000000000002','LOCAL_B2_ADVANCE_CREATE');
select * from academic.confirm_progress_decision((select id from ids where name='advance'),'LOCAL_B2_ADVANCE_CONFIRM');
insert into ids select 'request2',entity_id from academic.create_enrollment_request((select id from ids where name='record'),'c5000000-0000-4000-8000-000000000002','REENROLLMENT',2::smallint,null,'c7000000-0000-4000-8000-000000000002','ELIGIBLE','PREVIOUS_PERIOD_APPROVED','LOCAL_B2_REQUEST2_CREATE');
select * from academic.submit_enrollment_request((select id from ids where name='request2'),'LOCAL_B2_REQUEST2_SUBMIT');
select * from academic.begin_enrollment_review((select id from ids where name='request2'),'LOCAL_B2_REQUEST2_REVIEW');
select * from academic.approve_enrollment_request((select id from ids where name='request2'),'PREVIOUS_PERIOD_APPROVED','LOCAL_B2_REQUEST2_APPROVE');
insert into ids select 'enrollment2',entity_id from academic.create_period_enrollment((select id from ids where name='request2'),'000002','LOCAL_B2_ENROLLMENT2_CREATE');

insert into ids select 'repeat',entity_id from academic.create_progress_decision((select id from ids where name='record'),(select id from ids where name='enrollment2'),'c5000000-0000-4000-8000-000000000002','REPEAT',2::smallint,null,'REPEAT_REQUIRED','c5000000-0000-4000-8000-000000000003','LOCAL_B2_REPEAT_CREATE');
select * from academic.confirm_progress_decision((select id from ids where name='repeat'),'LOCAL_B2_REPEAT_CONFIRM');
do $$begin if (select current_semester_number from academic.student_records where id=(select id from ids where name='record'))<>2 then raise exception 'repeat advanced semester'; end if; end$$;
insert into ids select 'request3',entity_id from academic.create_enrollment_request((select id from ids where name='record'),'c5000000-0000-4000-8000-000000000003','REPEAT_SEMESTER',2::smallint,null,'c7000000-0000-4000-8000-000000000003','ELIGIBLE','REPEAT_REQUIRED','LOCAL_B2_REQUEST3_CREATE');
select * from academic.submit_enrollment_request((select id from ids where name='request3'),'LOCAL_B2_REQUEST3_SUBMIT');
select * from academic.begin_enrollment_review((select id from ids where name='request3'),'LOCAL_B2_REQUEST3_REVIEW');
select * from academic.approve_enrollment_request((select id from ids where name='request3'),'REPEAT_REQUIRED','LOCAL_B2_REQUEST3_APPROVE');
insert into ids select 'enrollment3',entity_id from academic.create_period_enrollment((select id from ids where name='request3'),'000003','LOCAL_B2_ENROLLMENT3_CREATE');
insert into ids select 'assignment3',entity_id from academic.assign_student_group((select id from ids where name='enrollment3'),'c7000000-0000-4000-8000-000000000003','INITIAL','REPEAT_REQUIRED','LOCAL_B2_ASSIGNMENT3');

select * from academic.apply_academic_hold((select id from ids where name='record'),'LOCAL_B2_HOLD');
do $$begin
  perform * from academic.create_enrollment_request((select id from ids where name='record'),'c5000000-0000-4000-8000-000000000003','REPEAT_SEMESTER',2::smallint,null,'c7000000-0000-4000-8000-000000000004','ELIGIBLE','REPEAT_REQUIRED','LOCAL_B2_HELD_REQUEST');
  raise exception 'held student accepted';
exception when others then if sqlerrm<>'STUDENT_RECORD_NOT_ACTIVE' then raise; end if; end$$;
select * from academic.release_academic_hold((select id from ids where name='record'),'LOCAL_B2_HOLD_RELEASE');
select * from academic.apply_temporary_withdrawal((select id from ids where name='record'),'LOCAL_B2_TEMP_WITHDRAW');
select * from academic.reactivate_student_record((select id from ids where name='record'),'LOCAL_B2_REACTIVATE');
insert into ids select 'assignment4',entity_id from academic.change_student_group((select id from ids where name='enrollment3'),'c7000000-0000-4000-8000-000000000004','ADMINISTRATIVE_CHANGE','CORRECTIVE_ACTION','LOCAL_B2_GROUP_CHANGE');
do $$begin
  if (select count(*) from academic.student_group_assignments where period_enrollment_id=(select id from ids where name='enrollment3'))<>2 then raise exception 'group history lost'; end if;
  perform * from academic.change_student_group((select id from ids where name='enrollment3'),'c7000000-0000-4000-8000-000000000001','ADMINISTRATIVE_CHANGE','CORRECTIVE_ACTION','LOCAL_B2_BAD_GROUP');
  raise exception 'incompatible group accepted';
exception when others then if sqlerrm<>'GROUP_NOT_COMPATIBLE' then raise; end if; end$$;

insert into core.account_roles(account_id,role_id) select 'c3000000-0000-4000-8000-000000000006',id from core.roles where code='ALUMNO';
insert into ids select 'record2',entity_id from academic.create_student_record('c2000000-0000-4000-8000-000000000006','c3000000-0000-4000-8000-000000000006','c6000000-0000-4000-8000-000000000001',(select id from ids where name='generation'),'000124',2::smallint,null,'LOCAL_B2_RECORD2_CREATE');
select * from academic.activate_student_record((select id from ids where name='record2'),'LOCAL_B2_RECORD2_ACTIVATE');
insert into academic.academic_progress_decisions(student_record_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id)
values((select id from ids where name='record2'),'c5000000-0000-4000-8000-000000000002','REPEAT',2,'CONFIRMED','REPEAT_REQUIRED','c3000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001','LOCAL_B2_RECORD2_DECISION',repeat('a',64),'c5000000-0000-4000-8000-000000000003');
insert into ids select 'request4',entity_id from academic.create_enrollment_request((select id from ids where name='record2'),'c5000000-0000-4000-8000-000000000003','REPEAT_SEMESTER',2::smallint,null,'c7000000-0000-4000-8000-000000000004','ELIGIBLE','REPEAT_REQUIRED','LOCAL_B2_REQUEST4_CREATE');
select * from academic.submit_enrollment_request((select id from ids where name='request4'),'LOCAL_B2_REQUEST4_SUBMIT');
select * from academic.begin_enrollment_review((select id from ids where name='request4'),'LOCAL_B2_REQUEST4_REVIEW');
select * from academic.approve_enrollment_request((select id from ids where name='request4'),'REPEAT_REQUIRED','LOCAL_B2_REQUEST4_APPROVE');
do $$begin
  perform * from academic.create_period_enrollment((select id from ids where name='request4'),'000004','LOCAL_B2_CAPACITY');
  raise exception 'capacity exceeded';
exception when others then if sqlerrm<>'GROUP_CAPACITY_REACHED' then raise; end if; end$$;

select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
select academic.require_student_enrollment_permission('academic.students.manage');
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);
select academic.require_student_enrollment_permission('academic.progress.manage');
do $$begin perform academic.require_student_enrollment_permission('academic.withdrawals.manage'); raise exception 'school control permanent withdrawal accepted'; exception when others then if sqlerrm<>'ACTOR_NOT_AUTHORIZED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$begin perform academic.require_student_enrollment_permission('academic.enrollments.manage'); raise exception 'cashier accepted'; exception when others then if sqlerrm<>'ACTOR_NOT_AUTHORIZED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$begin perform academic.require_student_enrollment_permission('academic.enrollments.manage'); raise exception 'aal1 accepted'; exception when others then if sqlerrm<>'AAL2_REQUIRED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":99}',true);
do $$begin perform academic.require_student_enrollment_permission('academic.enrollments.manage'); raise exception 'stale session accepted'; exception when others then if sqlerrm<>'SESSION_VERSION_INVALID' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

do $$begin
  update academic.student_status_history set reason_code='CORRECTIVE_ACTION' where student_record_id=(select id from ids where name='record');
  raise exception 'append-only history changed';
exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin
  delete from academic.student_records where id=(select id from ids where name='record');
  raise exception 'student record deleted';
exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin
  if not exists(select 1 from academic.student_academic_events where student_record_id=(select id from ids where name='record')) then raise exception 'audit events missing'; end if;
  if not exists(select 1 from academic.student_status_history where student_record_id=(select id from ids where name='record')) then raise exception 'status history missing'; end if;
  if exists(select idempotency_key from academic.student_academic_events group by idempotency_key having count(*)>1) then raise exception 'duplicate event'; end if;
end$$;
do $$begin set local role authenticated; perform 1 from academic.student_records; raise exception 'direct table access accepted'; exception when insufficient_privilege then null; end$$;
reset role;
select 'LOCAL_STUDENT_ENROLLMENT_43_STEPS_OK';
rollback;
  `);
  assert.match(output, /LOCAL_STUDENT_ENROLLMENT_43_STEPS_OK/);
});
