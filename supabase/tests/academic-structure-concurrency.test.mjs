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
    child.stdin.end(`set statement_timeout='5s';${sql}`);
  });
}

const claims = `select set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',false);`;

function expectSingleWinner(results, expectedFailure) {
  assert.equal(results.filter((result) => result.status === 0).length, 1, JSON.stringify(results));
  const failure = results.find((result) => result.status !== 0);
  assert.match(failure.stderr, expectedFailure);
}

test("cinco carreras académicas preservan unicidad y estados fail-closed", async () => {
  sqlSync(`
    insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
    ('00000000-0000-0000-0000-000000000000','b1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','race-admin@example.invalid','{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','b1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','race-teacher1@example.invalid','{}','{}',now(),now()),
    ('00000000-0000-0000-0000-000000000000','b1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','race-teacher2@example.invalid','{}','{}',now(),now());
    insert into core.people(id,status) values ('b2000000-0000-4000-8000-000000000001','ACTIVE'),('b2000000-0000-4000-8000-000000000002','ACTIVE'),('b2000000-0000-4000-8000-000000000003','ACTIVE');
    insert into core.accounts(id,person_id,auth_user_id,account_status) values
    ('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','ACTIVE'),
    ('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','ACTIVE'),
    ('b3000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','ACTIVE');
    insert into core.account_roles(account_id,role_id) select 'b3000000-0000-4000-8000-000000000001',id from core.roles where code='SUPERADMIN';
    insert into core.account_roles(account_id,role_id) select a.id,r.id from core.accounts a cross join core.roles r where a.id in ('b3000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000003') and r.code='DOCENTE';
    insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
    ('b4000000-0000-4000-8000-000000000001','RACE_CYCLE_A','Race A','ACTIVE','2097-01-01','2097-12-31','b3000000-0000-4000-8000-000000000001'),
    ('b4000000-0000-4000-8000-000000000002','RACE_CYCLE_B','Race B','PLANNED','2098-01-01','2098-12-31','b3000000-0000-4000-8000-000000000001'),
    ('b4000000-0000-4000-8000-000000000003','RACE_CYCLE_C','Race C','ACTIVE','2099-01-01','2099-12-31','b3000000-0000-4000-8000-000000000001');
    insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
    ('b5000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','RACE_P1','Race period',1,'2097-01-01','2097-06-30','ACTIVE','b3000000-0000-4000-8000-000000000001'),
    ('b5000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','RACE_P2','Closing race',2,'2097-07-01','2097-12-31','ACTIVE','b3000000-0000-4000-8000-000000000001');
    insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('b6000000-0000-4000-8000-000000000001','RACE_PLAN','Race plan','V1','ACTIVE','2097-01-01','b3000000-0000-4000-8000-000000000001');
    insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values('b6100000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
    insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('b6200000-0000-4000-8000-000000000001','RACE_SUBJECT','Race subject','COMMON','b3000000-0000-4000-8000-000000000001');
    insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('b6300000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001','b6100000-0000-4000-8000-000000000001','b6200000-0000-4000-8000-000000000001',1);
    insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,created_by_account_id) values
    ('b7000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',1,'RACE_BASE','Race base','ACTIVE','b3000000-0000-4000-8000-000000000001'),
    ('b7000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000002','b6000000-0000-4000-8000-000000000001',1,'RACE_CLOSE','Race close','ACTIVE','b3000000-0000-4000-8000-000000000001');
    insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values
    ('b8000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','b7000000-0000-4000-8000-000000000001','b6300000-0000-4000-8000-000000000001','ACTIVE','b3000000-0000-4000-8000-000000000001'),
    ('b8000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000002','b7000000-0000-4000-8000-000000000002','b6300000-0000-4000-8000-000000000001','PLANNED','b3000000-0000-4000-8000-000000000001');
  `);

  try {
    const groupRace = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.create_group('b5000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',1::smallint,null,'RACE_DUP','Race duplicate','RACE_GROUP_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.create_group('b5000000-0000-4000-8000-000000000001','b6000000-0000-4000-8000-000000000001',1::smallint,null,'RACE_DUP','Race duplicate','RACE_GROUP_B');`,
      ),
    ]);
    expectSingleWinner(groupRace, /duplicate key|unique constraint/i);
    assert.equal(
      sqlSync(
        "select count(*) from academic.groups where academic_period_id='b5000000-0000-4000-8000-000000000001' and code='RACE_DUP'",
      ),
      "1",
    );
    assert.equal(
      sqlSync(
        "select count(*) from academic.academic_structure_events where event_type='GROUP_CREATED' and idempotency_key in ('RACE_GROUP_A','RACE_GROUP_B')",
      ),
      "1",
    );

    const primaryRace = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.assign_teacher('b8000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','PRIMARY','2097-01-01',null,'RACE_PRIMARY_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.assign_teacher('b8000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000003','PRIMARY','2097-01-01',null,'RACE_PRIMARY_B');`,
      ),
    ]);
    expectSingleWinner(primaryRace, /duplicate key|unique constraint/i);
    assert.equal(
      sqlSync(
        "select count(*) from academic.teaching_assignments where academic_offering_id='b8000000-0000-4000-8000-000000000001' and assignment_type='PRIMARY' and status in ('PLANNED','ACTIVE')",
      ),
      "1",
    );

    const cycleRace = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.activate_school_cycle('b4000000-0000-4000-8000-000000000002','RACE_CYCLE_ACTIVATE_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.activate_school_cycle('b4000000-0000-4000-8000-000000000002','RACE_CYCLE_ACTIVATE_B');`,
      ),
    ]);
    expectSingleWinner(cycleRace, /ACADEMIC_CYCLE_INVALID_STATE/);
    assert.equal(
      sqlSync(
        "select count(*) from academic.academic_structure_events where entity_id='b4000000-0000-4000-8000-000000000002' and event_type='SCHOOL_CYCLE_ACTIVATED'",
      ),
      "1",
    );

    const periodRace = await Promise.all([
      sqlAsync(
        `${claims}select * from academic.create_academic_period('b4000000-0000-4000-8000-000000000003','RACE_OVER_A','Overlap A',1::smallint,'2099-01-01','2099-06-30','RACE_PERIOD_A');`,
      ),
      sqlAsync(
        `${claims}select * from academic.create_academic_period('b4000000-0000-4000-8000-000000000003','RACE_OVER_B','Overlap B',2::smallint,'2099-03-01','2099-08-31','RACE_PERIOD_B');`,
      ),
    ]);
    expectSingleWinner(periodRace, /ACADEMIC_PERIOD_DATE_CONFLICT/);
    assert.equal(
      sqlSync(
        "select count(*) from academic.academic_periods where school_cycle_id='b4000000-0000-4000-8000-000000000003'",
      ),
      "1",
    );

    const closeRace = await Promise.all([
      sqlAsync(
        `begin;${claims}select 1 from academic.academic_periods where id='b5000000-0000-4000-8000-000000000002' for update;select pg_sleep(0.15);select * from academic.begin_academic_period_closing('b5000000-0000-4000-8000-000000000002','RACE_PERIOD_CLOSE');commit;`,
      ),
      sqlAsync(
        `${claims}select * from academic.activate_academic_offering('b8000000-0000-4000-8000-000000000002','RACE_OFFER_ACTIVATE');`,
      ),
    ]);
    expectSingleWinner(closeRace, /ACADEMIC_OFFERING_CONFLICT/);
    assert.equal(
      sqlSync(
        "select count(*) from academic.academic_offerings o join academic.academic_periods p on p.id=o.academic_period_id where p.status in ('CLOSING','CLOSED') and o.status='ACTIVE'",
      ),
      "0",
    );
  } finally {
    sqlSync(`
      set session_replication_role=replica;
      delete from academic.academic_structure_events where actor_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.academic_commands where actor_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.teaching_assignments where assigned_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.academic_offerings where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.groups where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.curriculum_subjects where study_plan_id='b6000000-0000-4000-8000-000000000001';
      delete from academic.plan_semesters where study_plan_id='b6000000-0000-4000-8000-000000000001';
      delete from academic.subjects where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.study_plans where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.academic_periods where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from academic.school_cycles where created_by_account_id='b3000000-0000-4000-8000-000000000001';
      delete from core.account_roles where account_id::text like 'b3000000%';
      delete from core.accounts where id::text like 'b3000000%';
      delete from core.people where id::text like 'b2000000%';
      delete from auth.users where id::text like 'b1000000%';
      set session_replication_role=origin;
    `);
  }
});
