import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
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
  "-At",
];
const claims = `select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',false);`;

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlAsync(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stderr, stdout }));
    child.stdin.end(`set statement_timeout='8s';${sql}`);
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function expectSingleWinner(results, failurePattern) {
  assert.equal(results.filter((result) => result.status === 0).length, 1, JSON.stringify(results));
  const failure = results.find((result) => result.status !== 0);
  assert.match(failure.stderr, failurePattern);
}

test("diez carreras reales conservan unicidad, capacidad, estados e idempotencia", async () => {
  sqlSync(`
set session_replication_role=replica;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','race-operator@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) select ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.person_status from generate_series(1,11)n;
insert into core.accounts(id,person_id,auth_user_id,account_status)
select ('d3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       case when n=1 then 'd1000000-0000-4000-8000-000000000001'::uuid else null end,
       'ACTIVE'::core.account_status from generate_series(1,11)n;
insert into core.account_roles(account_id,role_id)
select 'd3000000-0000-4000-8000-000000000001',id from core.roles where code='SUPERADMIN';
insert into core.account_roles(account_id,role_id)
select a.id,r.id from core.accounts a cross join core.roles r where a.id::text like 'd3000000%' and a.id<>'d3000000-0000-4000-8000-000000000001' and r.code='ALUMNO';
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
('d4000000-0000-4000-8000-000000000001','RACE_B2_C1','Race cycle one','ACTIVE','2091-01-01','2091-12-31','d3000000-0000-4000-8000-000000000001'),
('d4000000-0000-4000-8000-000000000002','RACE_B2_C2','Race cycle two','PLANNED','2094-01-01','2094-12-31','d3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','RACE_B2_P1','Race period one',1,'2091-01-01','2091-06-30','ACTIVE','d3000000-0000-4000-8000-000000000001'),
('d5000000-0000-4000-8000-000000000002','d4000000-0000-4000-8000-000000000001','RACE_B2_P2','Race period closing',2,'2091-07-01','2091-12-31','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('d6000000-0000-4000-8000-000000000001','RACE_B2_PLAN','Race plan','V1','ACTIVE','2091-01-01','d3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('d6100000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'Semester one',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id)
values('d6200000-0000-4000-8000-000000000001','RACE_B2_SUBJECT','Race subject','COMMON','d3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order)
values('d6300000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001','d6200000-0000-4000-8000-000000000001',1);
insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order) values
('d6300000-0000-4000-8000-000000000001',1,'Unit 1',1),
('d6300000-0000-4000-8000-000000000001',2,'Unit 2',2),
('d6300000-0000-4000-8000-000000000001',3,'Unit 3',3);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id) values
('d7000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'RACE_BASE','Base group','ACTIVE',null,'d3000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'RACE_CAP','Capacity group','ACTIVE',1,'d3000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000003','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'RACE_T1','Target one','ACTIVE',null,'d3000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000004','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'RACE_T2','Target two','ACTIVE',null,'d3000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000005','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'RACE_CLOSE_G','Closing group','ACTIVE',null,'d3000000-0000-4000-8000-000000000001'),
('d7000000-0000-4000-8000-000000000006','d5000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001',1,'RACE_CLOSE_P','Closing period group','ACTIVE',null,'d3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id)
select ('d8000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       case when n=6 then 'd5000000-0000-4000-8000-000000000002'::uuid else 'd5000000-0000-4000-8000-000000000001'::uuid end,
       ('d7000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       'd6300000-0000-4000-8000-000000000001','ACTIVE','d3000000-0000-4000-8000-000000000001' from generate_series(1,6)n;
insert into academic.student_generations(id,code,name,entry_school_cycle_id,expected_completion_cycle_id,study_plan_id,status,created_by_account_id)
values('d9000000-0000-4000-8000-000000000001','RACE_B2_GEN','Race generation','d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,activated_at)
select ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('d2000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
       ('d3000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
       'd6000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000001',
       'RACE'||lpad(n::text,4,'0'),'ACTIVE',1,'d3000000-0000-4000-8000-000000000001',now()
from generate_series(1,10)n;
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint,reviewed_by_account_id,approved_by_account_id,reviewed_at,approved_at)
values
('db000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'d7000000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','RACE_REQ_1A',repeat('a',64),'d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',now(),now()),
('db000000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'d7000000-0000-4000-8000-000000000001','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','RACE_REQ_1B',repeat('b',64),'d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',now(),now()),
('db000000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000002','d5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'d7000000-0000-4000-8000-000000000002','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','RACE_REQ_2',repeat('c',64),'d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',now(),now()),
('db000000-0000-4000-8000-000000000004','da000000-0000-4000-8000-000000000003','d5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'d7000000-0000-4000-8000-000000000002','APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','RACE_REQ_3',repeat('d',64),'d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',now(),now());
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,requested_group_id,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint,reviewed_by_account_id,approved_by_account_id,reviewed_at,approved_at)
select ('db000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
       ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       case when n=6 then 'd5000000-0000-4000-8000-000000000002'::uuid else 'd5000000-0000-4000-8000-000000000001'::uuid end,
       'INITIAL_ENROLLMENT',1,
       case n when 4 then 'd7000000-0000-4000-8000-000000000001'::uuid when 5 then 'd7000000-0000-4000-8000-000000000003'::uuid when 6 then 'd7000000-0000-4000-8000-000000000006'::uuid when 7 then 'd7000000-0000-4000-8000-000000000005'::uuid else 'd7000000-0000-4000-8000-000000000001'::uuid end,
       'ENROLLED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','RACE_DIRECT_'||n,repeat('e',64),'d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',now(),now()
from generate_series(4,10)n;
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrolled_by_account_id)
select ('dc000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('db000000-0000-4000-8000-'||lpad((n+1)::text,12,'0'))::uuid,
       case when n=6 then 'd5000000-0000-4000-8000-000000000002'::uuid else 'd5000000-0000-4000-8000-000000000001'::uuid end,
       'd6000000-0000-4000-8000-000000000001',1,
       case n when 5 then 'd7000000-0000-4000-8000-000000000003'::uuid when 6 then 'd7000000-0000-4000-8000-000000000006'::uuid when 7 then 'd7000000-0000-4000-8000-000000000005'::uuid else 'd7000000-0000-4000-8000-000000000001'::uuid end,
       case when n=9 then 'ACTIVE'::academic.period_enrollment_status else 'PLANNED'::academic.period_enrollment_status end,
       'd3000000-0000-4000-8000-000000000001' from generate_series(4,10)n;
insert into academic.student_group_assignments(id,period_enrollment_id,group_id,assignment_type,status,assigned_by_account_id,reason_code,idempotency_key)
select ('dd000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       ('dc000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
       case n when 5 then 'd7000000-0000-4000-8000-000000000003'::uuid when 6 then 'd7000000-0000-4000-8000-000000000006'::uuid when 7 then 'd7000000-0000-4000-8000-000000000005'::uuid else 'd7000000-0000-4000-8000-000000000001'::uuid end,
       'INITIAL','ACTIVE','d3000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT','RACE_ASSIGN_'||n
from generate_series(5,10)n;
insert into academic.academic_progress_decisions(id,student_record_id,source_academic_period_id,decision_type,resulting_semester_number,decision_status,reason_code,decided_by_account_id,idempotency_key,request_fingerprint)
values
('de000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000008','d5000000-0000-4000-8000-000000000001','REPEAT',1,'DRAFT','REPEAT_REQUIRED','d3000000-0000-4000-8000-000000000001','RACE_DECISION_A',repeat('1',64)),
('de000000-0000-4000-8000-000000000002','da000000-0000-4000-8000-000000000008','d5000000-0000-4000-8000-000000000001','REPEAT',1,'DRAFT','REPEAT_REQUIRED','d3000000-0000-4000-8000-000000000001','RACE_DECISION_B',repeat('2',64));
set session_replication_role=origin;
  `);

  try {
    const duplicateEnrollment = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.create_period_enrollment('db000000-0000-4000-8000-000000000001','RACE0001','RACE_ENROLL_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.create_period_enrollment('db000000-0000-4000-8000-000000000002','RACE0002','RACE_ENROLL_B');`,
      ),
    ]);
    expectSingleWinner(duplicateEnrollment, /one_operational_enrollment_per_period|duplicate key/i);

    const lastCapacity = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.create_period_enrollment('db000000-0000-4000-8000-000000000003','RACE0003','RACE_CAP_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.create_period_enrollment('db000000-0000-4000-8000-000000000004','RACE0004','RACE_CAP_B');`,
      ),
    ]);
    expectSingleWinner(lastCapacity, /GROUP_CAPACITY_REACHED/);

    const assignments = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.assign_student_group('dc000000-0000-4000-8000-000000000004','d7000000-0000-4000-8000-000000000001','INITIAL','INITIAL_ENROLLMENT','RACE_ASSIGN_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.assign_student_group('dc000000-0000-4000-8000-000000000004','d7000000-0000-4000-8000-000000000001','INITIAL','INITIAL_ENROLLMENT','RACE_ASSIGN_B');`,
      ),
    ]);
    expectSingleWinner(assignments, /one_active_group_assignment|duplicate key/i);

    const groupChanges = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.change_student_group('dc000000-0000-4000-8000-000000000005','d7000000-0000-4000-8000-000000000003','ADMINISTRATIVE_CHANGE','CORRECTIVE_ACTION','RACE_CHANGE_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.change_student_group('dc000000-0000-4000-8000-000000000005','d7000000-0000-4000-8000-000000000004','ADMINISTRATIVE_CHANGE','CORRECTIVE_ACTION','RACE_CHANGE_B');`,
      ),
    ]);
    assert.equal(
      groupChanges.every((result) => result.status === 0),
      true,
      JSON.stringify(groupChanges),
    );
    assert.equal(
      sqlSync(
        "select count(*) from academic.student_group_assignments where period_enrollment_id='dc000000-0000-4000-8000-000000000005' and status='ACTIVE'",
      ),
      "1",
    );

    const periodClosing = sqlAsync(
      `begin;${claims}select 1 from academic.academic_periods where id='d5000000-0000-4000-8000-000000000002' for update;select pg_sleep(0.2);select * from academic.begin_academic_period_closing('d5000000-0000-4000-8000-000000000002','RACE_PERIOD_CLOSE');commit;`,
    );
    await delay(40);
    const periodActivation = sqlAsync(
      `${claims}select * from academic.activate_period_enrollment('dc000000-0000-4000-8000-000000000006','RACE_ACTIVATE_PERIOD');`,
    );
    expectSingleWinner(
      await Promise.all([periodClosing, periodActivation]),
      /PERIOD_CLOSING|ACADEMIC_PERIOD_HAS_OPEN_OFFERINGS/,
    );

    const groupClosing = sqlAsync(
      `begin;${claims}select 1 from academic.academic_periods where id='d5000000-0000-4000-8000-000000000001' for update;select 1 from academic.groups where id='d7000000-0000-4000-8000-000000000005' for update;select pg_sleep(0.2);select * from academic.close_group('d7000000-0000-4000-8000-000000000005','RACE_GROUP_CLOSE');commit;`,
    );
    await delay(40);
    const groupActivation = sqlAsync(
      `${claims}select * from academic.activate_period_enrollment('dc000000-0000-4000-8000-000000000007','RACE_ACTIVATE_GROUP');`,
    );
    expectSingleWinner(
      await Promise.all([groupClosing, groupActivation]),
      /GROUP_NOT_AVAILABLE|ACADEMIC_GROUP_HAS_OPEN_OFFERINGS/,
    );

    const decisions = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.confirm_progress_decision('de000000-0000-4000-8000-000000000001','RACE_DECISION_CONFIRM_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.confirm_progress_decision('de000000-0000-4000-8000-000000000002','RACE_DECISION_CONFIRM_B');`,
      ),
    ]);
    expectSingleWinner(decisions, /one_confirmed_progress_decision|duplicate key/i);

    const generationReplay = await Promise.all([
      sqlAsync(
        `${claims}select entity_id from academic.create_student_generation('RACE_IDEMPOTENT','Race idempotent','d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001','RACE_SAME_KEY');`,
      ),
      sqlAsync(
        `${claims}select entity_id from academic.create_student_generation('RACE_IDEMPOTENT','Race idempotent','d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001','RACE_SAME_KEY');`,
      ),
    ]);
    assert.equal(
      generationReplay.every((result) => result.status === 0),
      true,
      JSON.stringify(generationReplay),
    );
    assert.equal(generationReplay[0].stdout.trim(), generationReplay[1].stdout.trim());

    const offeringRace = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.enroll_student_in_group_offerings('dc000000-0000-4000-8000-000000000009','RACE_OFFER_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.enroll_student_in_group_offerings('dc000000-0000-4000-8000-000000000009','RACE_OFFER_B');`,
      ),
    ]);
    assert.equal(
      offeringRace.every((result) => result.status === 0),
      true,
      JSON.stringify(offeringRace),
    );
    assert.equal(
      sqlSync(
        "select count(*) from academic.student_offering_enrollments where period_enrollment_id='dc000000-0000-4000-8000-000000000009'",
      ),
      "1",
    );

    const withdrawal = sqlAsync(
      `begin;${claims}select 1 from academic.student_records where id='da000000-0000-4000-8000-000000000010' for update;select pg_sleep(0.2);select * from academic.apply_temporary_withdrawal('da000000-0000-4000-8000-000000000010','RACE_WITHDRAW');commit;`,
    );
    await delay(40);
    const activation = sqlAsync(
      `${claims}select * from academic.activate_period_enrollment('dc000000-0000-4000-8000-000000000010','RACE_WITHDRAW_ACTIVATE');`,
    );
    expectSingleWinner(await Promise.all([withdrawal, activation]), /STUDENT_RECORD_NOT_ACTIVE/);
    assert.equal(
      sqlSync(
        "select (sr.status='TEMPORARILY_WITHDRAWN' and pe.status='PLANNED') from academic.student_records sr join academic.period_enrollments pe on pe.student_record_id=sr.id where sr.id='da000000-0000-4000-8000-000000000010'",
      ),
      "t",
    );

    assert.equal(
      sqlSync(
        "select count(*) from academic.period_enrollments where student_record_id='da000000-0000-4000-8000-000000000001' and academic_period_id='d5000000-0000-4000-8000-000000000001' and status in ('PLANNED','ACTIVE','TEMPORARILY_SUSPENDED')",
      ),
      "1",
    );
    assert.equal(
      sqlSync(
        "select count(*) from academic.period_enrollments where group_id='d7000000-0000-4000-8000-000000000002' and status in ('PLANNED','ACTIVE','TEMPORARILY_SUSPENDED')",
      ),
      "1",
    );
  } finally {
    sqlSync(`
set session_replication_role=replica;
delete from academic.student_academic_events where actor_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.enrollment_commands where actor_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.student_status_history where actor_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.student_offering_enrollments where enrolled_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.student_group_assignments where assigned_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.academic_progress_decisions where decided_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.period_enrollments where enrolled_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where requested_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.student_records where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.student_generations where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.academic_structure_events where actor_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.academic_commands where actor_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.academic_offerings where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.groups where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.subject_units where curriculum_subject_id='d6300000-0000-4000-8000-000000000001';
delete from academic.curriculum_subjects where study_plan_id='d6000000-0000-4000-8000-000000000001';
delete from academic.subjects where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.plan_semesters where study_plan_id='d6000000-0000-4000-8000-000000000001';
delete from academic.study_plans where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.academic_periods where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from academic.school_cycles where created_by_account_id='d3000000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id::text like 'd3000000%';
delete from core.accounts where id::text like 'd3000000%';
delete from core.people where id::text like 'd2000000%';
delete from auth.users where id='d1000000-0000-4000-8000-000000000001';
set session_replication_role=origin;
    `);
  }
});
