import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const adminClaims = String.raw`select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const studentClaims = String.raw`select set_config('request.jwt.claims','{"sub":"91000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);`;
const psqlArgs = [
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
  "-Atq",
];

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlFailure(sql) {
  return spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (value) => (stdout += value));
    child.stderr.on("data", (value) => (stderr += value));
    child.on("close", (code) => resolve({ code, stderr, stdout }));
    child.stdin.end(sql);
  });
}

function readJson(text) {
  return JSON.parse(text.trim().split(/\r?\n/).filter(Boolean).at(-1));
}

function jsonArrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function resetOperationalState() {
  sqlSync(String.raw`
set session_replication_role=replica;
update academic.period_enrollments
set semester_number=1,group_id='96500000-0000-4000-8000-000000000001'
where id='96910000-0000-4000-8000-000000000001';
update academic.group_schedules
set status='APPROVED'::academic.group_schedule_status,
    published_at=null,
    published_by_account_id=null
where id in ('96820000-0000-4000-8000-000000000001','96820000-0000-4000-8000-000000000002');
update academic.group_schedules
set status='PUBLISHED'::academic.group_schedule_status,
    published_at=now(),
    published_by_account_id='93000000-0000-4000-8000-000000000001'::uuid
where id='96820000-0000-4000-8000-000000000001';
update academic.attendance_sessions
set status='OPEN'::academic.attendance_session_status,closed_at=null,closed_by_account_id=null
where id='96950000-0000-4000-8000-000000000001';
delete from academic.attendance_records where id='96960000-0000-4000-8000-000000000001';
update academic.student_unit_grades
set status='CAPTURED'::academic.unit_grade_status,normalized_grade=9.0,finalized_at=null,finalized_by_account_id=null
where id='96990000-0000-4000-8000-000000000001';
update academic.subject_final_results
set status='CALCULATED'::academic.subject_result_status,confirmed_at=null,confirmed_by_account_id=null
where id='97000000-0000-4000-8000-000000000001';
update academic.academic_progress_decisions
set decision_status='DRAFT'
where id='97020000-0000-4000-8000-000000000001';
update core.account_roles set revoked_at=null,revoked_by=null
where account_id='93000000-0000-4000-8000-000000000002';
delete from core.account_roles
where account_id='93000000-0000-4000-8000-000000000002'
  and role_id in (
    select id
    from core.roles
    where code in ('CAJA','PREFECTURA','ASPIRANTE')
  );
update core.accounts set session_version=1 where id='93000000-0000-4000-8000-000000000002';
set session_replication_role=origin;
`);
}

async function runReadAndMutation(readSql, mutationSql) {
  return Promise.all([
    sqlConnection(
      `begin isolation level repeatable read;${studentClaims}select pg_sleep(0.12);${readSql};commit;`,
    ),
    sqlConnection(`begin;${adminClaims}select pg_sleep(0.02);${mutationSql};commit;`),
  ]);
}

before(() => {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.attendance_records where id='96960000-0000-4000-8000-000000000001';
delete from academic.attendance_sessions where id='96950000-0000-4000-8000-000000000001';
delete from academic.class_sessions where id in ('96940000-0000-4000-8000-000000000001','96940000-0000-4000-8000-000000000002');
delete from academic.academic_progress_decisions where id='97020000-0000-4000-8000-000000000001';
delete from academic.semester_evaluation_summaries where id='97010000-0000-4000-8000-000000000001';
delete from academic.subject_final_results where id='97000000-0000-4000-8000-000000000001';
delete from academic.student_unit_grades where id='96990000-0000-4000-8000-000000000001';
delete from academic.student_lateness_counters where id='96970000-0000-4000-8000-000000000001';
delete from academic.teaching_assignments where id='96930000-0000-4000-8000-000000000001';
delete from academic.student_offering_enrollments where id='96920000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where id='96910000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where id='96901000-0000-4000-8000-000000000001';
delete from academic.student_records where id='96900000-0000-4000-8000-000000000001';
delete from academic.group_schedules where id in ('96820000-0000-4000-8000-000000000001','96820000-0000-4000-8000-000000000002');
delete from academic.schedule_templates where id in ('96810000-0000-4000-8000-000000000001','96810000-0000-4000-8000-000000000002');
delete from academic.schedule_time_blocks where id in ('96710000-0000-4000-8000-000000000001','96710000-0000-4000-8000-000000000002');
delete from academic.academic_shifts where id='96700000-0000-4000-8000-000000000001';
delete from academic.academic_offerings where id='96600000-0000-4000-8000-000000000001';
delete from academic.groups where id in ('96500000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000002');
delete from academic.subject_units where id='96410000-0000-4000-8000-000000000001';
delete from academic.curriculum_subjects where id='96400000-0000-4000-8000-000000000001';
delete from academic.subjects where id='96300000-0000-4000-8000-000000000001';
delete from academic.plan_semesters where id='96200000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='96100000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='96000000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='95000000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='94000000-0000-4000-8000-000000000001';
delete from academic.academic_spaces where id='96830000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');
delete from core.people where id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000003');
delete from auth.users where id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
set session_replication_role=origin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','portal-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','portal-student@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('92000000-0000-4000-8000-000000000001','ACTIVE'),
('92000000-0000-4000-8000-000000000002','ACTIVE'),
('92000000-0000-4000-8000-000000000003','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('93000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','ACTIVE',1),
('93000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','ACTIVE',1),
('93000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000003',null,'ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select account_id::uuid, role_id
from (
  values
    ('93000000-0000-4000-8000-000000000001',(select id from core.roles where code='SUPERADMIN')),
    ('93000000-0000-4000-8000-000000000002',(select id from core.roles where code='ALUMNO')),
    ('93000000-0000-4000-8000-000000000002',(select id from core.roles where code='DOCENTE')),
    ('93000000-0000-4000-8000-000000000003',(select id from core.roles where code='DOCENTE'))
) seeded(account_id,role_id);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('94000000-0000-4000-8000-000000000001','P4C_CYCLE','Portal concurrency','ACTIVE','2097-01-01','2097-12-31','93000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('95000000-0000-4000-8000-000000000001','94000000-0000-4000-8000-000000000001','P4C_P1','Periodo portal',1,'2097-01-01','2097-06-30','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('96000000-0000-4000-8000-000000000001','P4C_PLAN','Plan portal','V1','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('96100000-0000-4000-8000-000000000001','P4C_GEN','Generacion portal','94000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('96200000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('96300000-0000-4000-8000-000000000001','P4C_SUB','Materia portal','COMMON','93000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('96400000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001','96200000-0000-4000-8000-000000000001','96300000-0000-4000-8000-000000000001',1);
set session_replication_role=replica;
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order)
values ('96410000-0000-4000-8000-000000000001','96400000-0000-4000-8000-000000000001',1,'Unidad 1',1);
set session_replication_role=origin;
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values
('96500000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,'P4C_G1','Grupo A','ACTIVE',10,'93000000-0000-4000-8000-000000000001'),
('96500000-0000-4000-8000-000000000002','95000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',2,'P4C_G2','Grupo B','ACTIVE',10,'93000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
values('96600000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000001','96400000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id)
values('96700000-0000-4000-8000-000000000001','P4C_SHIFT','Turno portal','07:00','14:00','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,is_first_period,is_break,status,created_by_account_id)
values
('96710000-0000-4000-8000-000000000001','96700000-0000-4000-8000-000000000001','P4C_B1','Bloque 1',1,'07:00','07:50',true,false,'ACTIVE','93000000-0000-4000-8000-000000000001'),
('96710000-0000-4000-8000-000000000002','96700000-0000-4000-8000-000000000001','P4C_B2','Bloque 2',2,'08:00','08:50',false,false,'ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,valid_from,created_by_account_id)
values
('96810000-0000-4000-8000-000000000001','P4C_TEMP_1','Plantilla 1','96700000-0000-4000-8000-000000000001','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001'),
('96810000-0000-4000-8000-000000000002','P4C_TEMP_2','Plantilla 2','96700000-0000-4000-8000-000000000001','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,effective_from,created_by_account_id,published_by_account_id,published_at)
values
('96820000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96810000-0000-4000-8000-000000000001','PUBLISHED',1,'2097-01-01','93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001',now()),
('96820000-0000-4000-8000-000000000002','96500000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96810000-0000-4000-8000-000000000002','APPROVED',2,'2097-01-01','93000000-0000-4000-8000-000000000001',null,null);
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id)
values('96830000-0000-4000-8000-000000000001','P4C_A1','Aula portal','CLASSROOM','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('96900000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000002','96000000-0000-4000-8000-000000000001','96100000-0000-4000-8000-000000000001','P4C_ALU001','ACTIVE',1,'93000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('96901000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','93000000-0000-4000-8000-000000000001','P4C_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('96910000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96901000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96000000-0000-4000-8000-000000000001',1,'96500000-0000-4000-8000-000000000001','ACTIVE','P4C_ENR','93000000-0000-4000-8000-000000000001');
insert into academic.student_offering_enrollments(id,period_enrollment_id,academic_offering_id,status,enrolled_by_account_id)
values('96920000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001','ACTIVE','93000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id)
values('96930000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000003','PRIMARY','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001');
insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,created_by_account_id)
values
('96940000-0000-4000-8000-000000000001','96820000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001','96930000-0000-4000-8000-000000000001','96830000-0000-4000-8000-000000000001',1,'96710000-0000-4000-8000-000000000001','REGULAR_CLASS','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001'),
('96940000-0000-4000-8000-000000000002','96820000-0000-4000-8000-000000000002','96600000-0000-4000-8000-000000000001','96930000-0000-4000-8000-000000000001','96830000-0000-4000-8000-000000000001',1,'96710000-0000-4000-8000-000000000002','REGULAR_CLASS','ACTIVE','2097-01-01','93000000-0000-4000-8000-000000000001');
insert into academic.attendance_sessions(id,class_session_id,academic_period_id,group_id,academic_offering_id,teaching_assignment_id,session_date,starts_at,ends_at,status,expected_student_count,opened_by_account_id,opened_at)
values('96950000-0000-4000-8000-000000000001','96940000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001','96930000-0000-4000-8000-000000000001','2097-02-01','2097-02-01 07:00+00','2097-02-01 07:50+00','OPEN',1,'93000000-0000-4000-8000-000000000001',now());
insert into academic.student_lateness_counters(id,student_record_id,academic_period_id,counter_type,current_count,lifetime_count,alert_sequence)
values('96970000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','FIRST_PERIOD_VALIDATED',0,0,0);
insert into academic.student_unit_grades(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,subject_unit_id,unit_number,raw_grade,normalized_grade,is_accredited,status,captured_by_account_id)
values('96990000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','96920000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001','96410000-0000-4000-8000-000000000001',1,9.0,9.0,true,'CAPTURED','93000000-0000-4000-8000-000000000003');
insert into academic.subject_final_results(id,student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,raw_final_grade,rounded_final_grade,result_code,calculation_status,status,calculated_by_account_id)
values('97000000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','96920000-0000-4000-8000-000000000001','96600000-0000-4000-8000-000000000001',1,0,9.0,9.0,'AC','COMPLETE','CALCULATED','93000000-0000-4000-8000-000000000001');
insert into academic.semester_evaluation_summaries(id,student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id,confirmed_at,confirmed_by_account_id)
values('97010000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001',1,1,1,0,0,'CONFIRMED','MANUAL_REVIEW_REQUIRED','INSTITUTIONAL_REVIEW','93000000-0000-4000-8000-000000000001',now(),'93000000-0000-4000-8000-000000000001');
insert into academic.academic_progress_decisions(id,student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,idempotency_key,request_fingerprint,effective_from_period_id)
values('97020000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','REPEAT',1,'DRAFT','INSTITUTIONAL_VALIDATION_PENDING','93000000-0000-4000-8000-000000000001','P4C_DECISION',repeat('a',64),'95000000-0000-4000-8000-000000000001');
`);
  resetOperationalState();
});

after(() => {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.attendance_records where id='96960000-0000-4000-8000-000000000001';
delete from academic.attendance_sessions where id='96950000-0000-4000-8000-000000000001';
delete from academic.class_sessions where id in ('96940000-0000-4000-8000-000000000001','96940000-0000-4000-8000-000000000002');
delete from academic.academic_progress_decisions where id='97020000-0000-4000-8000-000000000001';
delete from academic.semester_evaluation_summaries where id='97010000-0000-4000-8000-000000000001';
delete from academic.subject_final_results where id='97000000-0000-4000-8000-000000000001';
delete from academic.student_unit_grades where id='96990000-0000-4000-8000-000000000001';
delete from academic.student_lateness_counters where id='96970000-0000-4000-8000-000000000001';
delete from academic.teaching_assignments where id='96930000-0000-4000-8000-000000000001';
delete from academic.student_offering_enrollments where id='96920000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where id='96910000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where id='96901000-0000-4000-8000-000000000001';
delete from academic.student_records where id='96900000-0000-4000-8000-000000000001';
delete from academic.group_schedules where id in ('96820000-0000-4000-8000-000000000001','96820000-0000-4000-8000-000000000002');
delete from academic.schedule_templates where id in ('96810000-0000-4000-8000-000000000001','96810000-0000-4000-8000-000000000002');
delete from academic.schedule_time_blocks where id in ('96710000-0000-4000-8000-000000000001','96710000-0000-4000-8000-000000000002');
delete from academic.academic_shifts where id='96700000-0000-4000-8000-000000000001';
delete from academic.academic_offerings where id='96600000-0000-4000-8000-000000000001';
delete from academic.groups where id in ('96500000-0000-4000-8000-000000000001','96500000-0000-4000-8000-000000000002');
delete from academic.academic_spaces where id='96830000-0000-4000-8000-000000000001';
delete from academic.subject_units where id='96410000-0000-4000-8000-000000000001';
delete from academic.curriculum_subjects where id='96400000-0000-4000-8000-000000000001';
delete from academic.subjects where id='96300000-0000-4000-8000-000000000001';
delete from academic.plan_semesters where id='96200000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='96100000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='96000000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='95000000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='94000000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');
delete from core.accounts where id in ('93000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000003');
delete from core.people where id in ('92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000003');
delete from auth.users where id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
set session_replication_role=origin;
`);
});

test("seis carreras del portal del alumno permanecen coherentes", async (t) => {
  await t.test("01 matricula: snapshot coherente anterior o posterior", async () => {
    resetOperationalState();
    const [readResult] = await runReadAndMutation(
      "select public.get_my_student_portal_overview('95000000-0000-4000-8000-000000000001')::text",
      "set session_replication_role=replica;update academic.period_enrollments set semester_number=2,group_id='96500000-0000-4000-8000-000000000002' where id='96910000-0000-4000-8000-000000000001';set session_replication_role=origin",
    );
    assert.equal(readResult.code, 0, readResult.stderr);
    const payload = readJson(readResult.stdout);
    const pair = `${payload.selectedPeriod.semesterNumber}:${payload.selectedPeriod.group.name}`;
    assert.ok(pair === "1:Grupo A" || pair === "2:Grupo B");
  });

  await t.test("02 publicacion de horario: nunca mezcla versiones", async () => {
    resetOperationalState();
    const [readResult] = await runReadAndMutation(
      "select public.get_my_student_portal_schedule('95000000-0000-4000-8000-000000000001')::text",
      "set session_replication_role=replica;update academic.group_schedules set status='APPROVED',published_at=null,published_by_account_id=null where id='96820000-0000-4000-8000-000000000001';update academic.group_schedules set status='PUBLISHED',published_at=now(),published_by_account_id='93000000-0000-4000-8000-000000000001' where id='96820000-0000-4000-8000-000000000002';set session_replication_role=origin",
    );
    assert.equal(readResult.code, 0, readResult.stderr);
    const payload = readJson(readResult.stdout);
    const blocks = payload.map((entry) => entry.timeBlock);
    assert.ok(
      (blocks.length === 1 && blocks[0] === "Bloque 1") ||
        (blocks.length === 1 && blocks[0] === "Bloque 2"),
    );
  });

  await t.test("03 cierre de asistencia: vacio previo o cierre completo", async () => {
    resetOperationalState();
    const [readResult] = await runReadAndMutation(
      "select public.get_my_student_portal_attendance('95000000-0000-4000-8000-000000000001')::text",
      "set session_replication_role=replica;update academic.attendance_sessions set status='CLOSED',closed_at=now(),closed_by_account_id='93000000-0000-4000-8000-000000000001' where id='96950000-0000-4000-8000-000000000001';insert into academic.attendance_records(id,attendance_session_id,student_record_id,period_enrollment_id,student_offering_enrollment_id,attendance_status,is_first_period,lateness_minutes,recorded_by_account_id,recorded_at) values('96960000-0000-4000-8000-000000000001','96950000-0000-4000-8000-000000000001','96900000-0000-4000-8000-000000000001','96910000-0000-4000-8000-000000000001','96920000-0000-4000-8000-000000000001','PRESENT',true,null,'93000000-0000-4000-8000-000000000001',now());set session_replication_role=origin",
    );
    assert.equal(readResult.code, 0, readResult.stderr);
    const payload = readJson(readResult.stdout);
    assert.ok(
      jsonArrayLength(payload.records) === 0 ||
        (jsonArrayLength(payload.records) === 1 &&
          payload.records[0].attendanceStatus === "PRESENT" &&
          payload.records[0].sessionStatus === "CLOSED"),
    );
  });

  await t.test("04 finalizacion de unidad: oculta o finalizada completa", async () => {
    resetOperationalState();
    const [readResult] = await runReadAndMutation(
      "select public.get_my_student_portal_grades('95000000-0000-4000-8000-000000000001')::text",
      "set session_replication_role=replica;update academic.student_unit_grades set status='FINALIZED',normalized_grade=9.0,finalized_at=now(),finalized_by_account_id='93000000-0000-4000-8000-000000000001' where id='96990000-0000-4000-8000-000000000001';update academic.subject_final_results set status='CONFIRMED',confirmed_at=now(),confirmed_by_account_id='93000000-0000-4000-8000-000000000001' where id='97000000-0000-4000-8000-000000000001';set session_replication_role=origin",
    );
    assert.equal(readResult.code, 0, readResult.stderr);
    const payload = readJson(readResult.stdout);
    assert.ok(
      jsonArrayLength(payload.unitGrades) === 0 ||
        (jsonArrayLength(payload.unitGrades) === 1 &&
          payload.unitGrades[0].status === "FINALIZED" &&
          Number(payload.unitGrades[0].normalizedGrade) === 9),
    );
  });

  await t.test(
    "05 revocacion de rol: consulta en curso coherente, posteriores denegadas",
    async () => {
      resetOperationalState();
      const [readResult] = await runReadAndMutation(
        "select public.get_my_student_portal_record()::text",
        "update core.account_roles set revoked_at=now(),revoked_by='93000000-0000-4000-8000-000000000001' where account_id='93000000-0000-4000-8000-000000000002' and role_id=(select id from core.roles where code='ALUMNO')",
      );
      assert.ok(
        readResult.code === 0 ||
          /STUDENT_ROLE_REQUIRED|APPLICATION_NOT_ALLOWED/.test(readResult.stderr),
      );
      const followUp = sqlFailure(
        `begin;${studentClaims}select public.get_my_student_portal_record();commit;`,
      );
      assert.notEqual(followUp.status, 0);
      assert.match(followUp.stderr, /STUDENT_ROLE_REQUIRED|APPLICATION_NOT_ALLOWED/);
    },
  );

  await t.test(
    "06 session_version: consulta en curso o denegada, posteriores invalidas",
    async () => {
      resetOperationalState();
      const [readResult] = await runReadAndMutation(
        "select public.get_my_student_portal_record()::text",
        "update core.accounts set session_version=2 where id='93000000-0000-4000-8000-000000000002'",
      );
      assert.ok(
        readResult.code === 0 ||
          /SESSION_VERSION_INVALID|APPLICATION_NOT_ALLOWED/.test(readResult.stderr),
      );
      const followUp = sqlFailure(
        `begin;${studentClaims}select public.get_my_student_portal_record();commit;`,
      );
      assert.notEqual(followUp.status, 0);
      assert.match(followUp.stderr, /SESSION_VERSION_INVALID|APPLICATION_NOT_ALLOWED/);
    },
  );
});
