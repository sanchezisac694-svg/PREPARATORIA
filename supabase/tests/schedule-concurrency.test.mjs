import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const claims = String.raw`select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function sqlSync(sql) {
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
  return result.stdout.trim();
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn(
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
      { shell: false },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (value) => (stdout += value));
    child.stderr.setEncoding("utf8").on("data", (value) => (stderr += value));
    child.on("close", (code) => resolve({ code, stderr, stdout }));
    child.stdin.end(sql);
  });
}

function seedSession(
  id = "e9000000-0000-4000-8000-000000000001",
  schedule = "e8000000-0000-4000-8000-000000000001",
  block = "e6200000-0000-4000-8000-000000000001",
) {
  sqlSync(
    `insert into academic.class_sessions(id,group_schedule_id,academic_offering_id,teaching_assignment_id,academic_space_id,weekday,time_block_id,session_type,status,valid_from,valid_to,created_by_account_id) values('${id}','${schedule}','e5100000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',1,'${block}','REGULAR_CLASS','PLANNED','2095-01-01','2095-06-30','e3000000-0000-4000-8000-000000000001');`,
  );
}

function seedApprovedChange(id, type = "SESSION_MOVE") {
  sqlSync(
    `insert into academic.schedule_change_requests(id,group_schedule_id,request_type,status,reason_code,requested_by_account_id,reviewed_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint,reviewed_at,approved_at) values('${id}','e8000000-0000-4000-8000-000000000001','${type}','APPROVED','CORRECTIVE_CHANGE','e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','${id.slice(-4)}_KEY',repeat('a',64),now(),now());`,
  );
}

test("carrera 05 publicacion simultanea de versiones", async () => {
  clearOperationalData();
  seedSession();
  seedSession(
    "e9000000-0000-4000-8000-000000000003",
    "e8000000-0000-4000-8000-000000000003",
    "e6200000-0000-4000-8000-000000000002",
  );
  const result = await race(
    "select * from academic.publish_group_schedule('e8000000-0000-4000-8000-000000000001','B3C_PUBLISH_V1');",
    "select * from academic.publish_group_schedule('e8000000-0000-4000-8000-000000000003','B3C_PUBLISH_V2');",
  );
  assert.equal(result.filter((item) => item.code === 0).length, 1);
  assert.equal(
    sqlSync(
      "select count(*) from academic.group_schedules where group_id='e5000000-0000-4000-8000-000000000001' and status='PUBLISHED';",
    ),
    "1",
  );
});

test("carrera 06 movimiento simultaneo", async () => {
  clearOperationalData();
  seedSession();
  seedApprovedChange("e9100000-0000-4000-8000-000000000001");
  const prefix =
    "select * from academic.move_class_session('e9000000-0000-4000-8000-000000000001',1::smallint,'e6200000-0000-4000-8000-000000000002','e9100000-0000-4000-8000-000000000001','B3C_MOVE_";
  const result = await race(prefix + "A');", prefix + "B');");
  assert.equal(result.filter((item) => item.code === 0).length, 2);
  assert.equal(
    sqlSync(
      "select time_block_id from academic.class_sessions where id='e9000000-0000-4000-8000-000000000001';",
    ),
    "e6200000-0000-4000-8000-000000000002",
  );
});

test("carrera 07 cierre de periodo frente a creacion", async () => {
  clearOperationalData();
  const result = await race(
    "select * from academic.begin_academic_period_closing('e4100000-0000-4000-8000-000000000001','B3C_PERIOD_CLOSE');",
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000001",
      "B3C_PERIOD_SESSION",
    ),
  );
  assert.equal(result.filter((item) => item.code === 0).length, 1);
  assert.equal(
    sqlSync(
      "select status from academic.academic_periods where id='e4100000-0000-4000-8000-000000000001';",
    ),
    "ACTIVE",
  );
});

test("carrera 08 mantenimiento frente a activacion", async () => {
  clearOperationalData();
  seedSession();
  const result = await race(
    "select * from academic.mark_academic_space_maintenance('e7000000-0000-4000-8000-000000000001','B3C_SPACE_MAINT');",
    "select * from academic.activate_class_session('e9000000-0000-4000-8000-000000000001','B3C_SESSION_ACTIVATE');",
  );
  assert.ok(result.filter((item) => item.code === 0).length >= 1);
  assert.equal(
    sqlSync(
      "select status from academic.academic_spaces where id='e7000000-0000-4000-8000-000000000001';",
    ),
    "MAINTENANCE",
  );
});

test("carrera 09 fin de asignacion frente a activacion", async () => {
  clearOperationalData();
  seedSession();
  const result = await race(
    "select * from academic.end_teaching_assignment('e6000000-0000-4000-8000-000000000001','B3C_ASSIGNMENT_END');",
    "select * from academic.activate_class_session('e9000000-0000-4000-8000-000000000001','B3C_ASSIGNMENT_ACTIVATE');",
  );
  assert.equal(result.filter((item) => item.code === 0).length, 1);
  assert.equal(
    sqlSync(
      "select count(*) from academic.class_sessions cs join academic.teaching_assignments a on a.id=cs.teaching_assignment_id where cs.status='ACTIVE' and a.status<>'ACTIVE';",
    ),
    "0",
  );
});

test("carrera 10 misma idempotency_key", async () => {
  clearOperationalData();
  const command =
    "select * from academic.create_schedule_change_request('e8000000-0000-4000-8000-000000000001','SESSION_MOVE','CORRECTIVE_CHANGE','B3C_CHANGE_SAME');";
  const result = await race(command, command);
  assert.equal(result.filter((item) => item.code === 0).length, 2);
  assert.equal(
    sqlSync(
      "select count(*) from academic.schedule_change_requests where idempotency_key='B3C_CHANGE_SAME';",
    ),
    "1",
  );
});

test("carrera 11 cambio de salon simultaneo", async () => {
  clearOperationalData();
  seedSession();
  seedApprovedChange("e9100000-0000-4000-8000-000000000001", "SESSION_SPACE_CHANGE");
  seedApprovedChange("e9100000-0000-4000-8000-000000000002", "SESSION_SPACE_CHANGE");
  const result = await race(
    "select * from academic.change_class_session_space('e9000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000002','e9100000-0000-4000-8000-000000000001','B3C_SPACE_CHANGE_A');",
    "select * from academic.change_class_session_space('e9000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001','e9100000-0000-4000-8000-000000000002','B3C_SPACE_CHANGE_B');",
  );
  assert.equal(result.filter((item) => item.code === 0).length, 2);
  assert.match(
    sqlSync(
      "select academic_space_id from academic.class_sessions where id='e9000000-0000-4000-8000-000000000001';",
    ),
    /^e7000000-0000-4000-8000-00000000000[12]$/,
  );
});

test("carrera 12 publicacion frente a cierre", async () => {
  clearOperationalData();
  seedSession();
  const result = await race(
    "select * from academic.publish_group_schedule('e8000000-0000-4000-8000-000000000001','B3C_FINAL_PUBLISH');",
    "select * from academic.close_group_schedule('e8000000-0000-4000-8000-000000000001','B3C_FINAL_CLOSE');",
  );
  assert.ok(result.filter((item) => item.code === 0).length >= 1);
  assert.match(
    sqlSync(
      "select status from academic.group_schedules where id='e8000000-0000-4000-8000-000000000001';",
    ),
    /^(PUBLISHED|CLOSED)$/,
  );
});

async function race(left, right) {
  return Promise.all([
    sqlConnection(`begin; ${claims} select pg_sleep(0.15); ${left} commit;`),
    sqlConnection(`begin; ${claims} select pg_sleep(0.15); ${right} commit;`),
  ]);
}

function clearOperationalData() {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.academic_structure_events where actor_account_id='e3000000-0000-4000-8000-000000000001';
delete from academic.academic_commands where actor_account_id='e3000000-0000-4000-8000-000000000001';
delete from academic.schedule_events where actor_account_id='e3000000-0000-4000-8000-000000000001';
delete from academic.schedule_commands where actor_account_id='e3000000-0000-4000-8000-000000000001';
delete from academic.schedule_change_requests where requested_by_account_id='e3000000-0000-4000-8000-000000000001';
delete from academic.class_sessions where group_schedule_id in ('e8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000002','e8000000-0000-4000-8000-000000000003');
update academic.group_schedules set status='APPROVED',published_at=null,published_by_account_id=null,closed_at=null,closed_by_account_id=null where id in ('e8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000002','e8000000-0000-4000-8000-000000000003');
update academic.academic_spaces set status='ACTIVE' where id in ('e7000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000002');
update academic.teaching_assignments set status='ACTIVE',valid_to=null,ended_at=null,ended_by_account_id=null where id in ('e6000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000002');
set session_replication_role=origin;
`);
}

before(() => {
  sqlSync(String.raw`
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','concurrency@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values('e2000000-0000-4000-8000-000000000001','ACTIVE'),('e2000000-0000-4000-8000-000000000002','ACTIVE'),('e2000000-0000-4000-8000-000000000003','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status) values('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','ACTIVE'),('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002',null,'ACTIVE'),('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003',null,'ACTIVE');
insert into core.account_roles(account_id,role_id) select v.a::uuid,r.id from (values('e3000000-0000-4000-8000-000000000001','SUPERADMIN'),('e3000000-0000-4000-8000-000000000002','DOCENTE'),('e3000000-0000-4000-8000-000000000003','DOCENTE'))v(a,code) join core.roles r on r.code=v.code;
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values('e4000000-0000-4000-8000-000000000001','B3C_CYCLE','Concurrency cycle','ACTIVE','2095-01-01','2095-12-31','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values('e4100000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001','B3C_PERIOD','Concurrency period',1,'2095-01-01','2095-06-30','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('e4200000-0000-4000-8000-000000000001','B3C_PLAN','Concurrency plan','V1','ACTIVE','2095-01-01','e3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values('e4300000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'Semester one',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('e4400000-0000-4000-8000-000000000001','B3C_SUBJECT','Concurrency subject','COMMON','e3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('e4500000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001','e4300000-0000-4000-8000-000000000001','e4400000-0000-4000-8000-000000000001',1);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,created_by_account_id) values('e5000000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'B3C_G1','Concurrency group one','ACTIVE','e3000000-0000-4000-8000-000000000001'),('e5000000-0000-4000-8000-000000000002','e4100000-0000-4000-8000-000000000001','e4200000-0000-4000-8000-000000000001',1,'B3C_G2','Concurrency group two','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values('e5100000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e4500000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001'),('e5100000-0000-4000-8000-000000000002','e4100000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000002','e4500000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id) values('e6000000-0000-4000-8000-000000000001','e5100000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000002','PRIMARY','ACTIVE','2095-01-01','e3000000-0000-4000-8000-000000000001'),('e6000000-0000-4000-8000-000000000002','e5100000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000003','PRIMARY','ACTIVE','2095-01-01','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_shifts(id,code,name,starts_at,ends_at,status,created_by_account_id) values('e6100000-0000-4000-8000-000000000001','B3C_SHIFT','Concurrency shift','07:00','13:00','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.schedule_time_blocks(id,shift_id,code,display_name,sequence_number,starts_at,ends_at,status,created_by_account_id) values('e6200000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','B3C_P1','Period one',1,'07:00','07:50','ACTIVE','e3000000-0000-4000-8000-000000000001'),('e6200000-0000-4000-8000-000000000002','e6100000-0000-4000-8000-000000000001','B3C_P2','Period two',2,'08:00','08:50','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.schedule_templates(id,code,name,shift_id,status,created_by_account_id) values('e6300000-0000-4000-8000-000000000001','B3C_TEMPLATE','Concurrency template','e6100000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.schedule_template_blocks(schedule_template_id,weekday,time_block_id) values('e6300000-0000-4000-8000-000000000001',1,'e6200000-0000-4000-8000-000000000001'),('e6300000-0000-4000-8000-000000000001',1,'e6200000-0000-4000-8000-000000000002');
insert into academic.academic_spaces(id,code,name,space_type,status,created_by_account_id) values('e7000000-0000-4000-8000-000000000001','B3C_ROOM1','Concurrency room one','CLASSROOM','ACTIVE','e3000000-0000-4000-8000-000000000001'),('e7000000-0000-4000-8000-000000000002','B3C_ROOM2','Concurrency room two','CLASSROOM','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,created_by_account_id) values('e8000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000001','APPROVED',1,'e3000000-0000-4000-8000-000000000001'),('e8000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000002','e4100000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000001','APPROVED',1,'e3000000-0000-4000-8000-000000000001');
insert into academic.group_schedules(id,group_id,academic_period_id,schedule_template_id,status,version_number,created_by_account_id) values('e8000000-0000-4000-8000-000000000003','e5000000-0000-4000-8000-000000000001','e4100000-0000-4000-8000-000000000001','e6300000-0000-4000-8000-000000000001','APPROVED',2,'e3000000-0000-4000-8000-000000000001');
`);
});

after(() => {
  sqlSync(
    String.raw`set session_replication_role=replica; delete from academic.academic_structure_events where actor_account_id='e3000000-0000-4000-8000-000000000001'; delete from academic.academic_commands where actor_account_id='e3000000-0000-4000-8000-000000000001'; delete from academic.schedule_events where actor_account_id='e3000000-0000-4000-8000-000000000001'; delete from academic.schedule_commands where actor_account_id='e3000000-0000-4000-8000-000000000001'; delete from academic.schedule_change_requests where requested_by_account_id='e3000000-0000-4000-8000-000000000001'; delete from academic.class_sessions where group_schedule_id in ('e8000000-0000-4000-8000-000000000001','e8000000-0000-4000-8000-000000000002','e8000000-0000-4000-8000-000000000003'); delete from academic.group_schedules where id::text like 'e800%'; delete from academic.schedule_template_blocks where schedule_template_id='e6300000-0000-4000-8000-000000000001'; delete from academic.schedule_templates where id='e6300000-0000-4000-8000-000000000001'; delete from academic.schedule_time_blocks where shift_id='e6100000-0000-4000-8000-000000000001'; delete from academic.academic_spaces where id::text like 'e700%'; delete from academic.academic_shifts where id='e6100000-0000-4000-8000-000000000001'; delete from academic.teaching_assignments where id::text like 'e600%'; delete from academic.academic_offerings where id::text like 'e510%'; delete from academic.groups where id::text like 'e500%'; delete from academic.curriculum_subjects where id='e4500000-0000-4000-8000-000000000001'; delete from academic.subjects where id='e4400000-0000-4000-8000-000000000001'; delete from academic.plan_semesters where id='e4300000-0000-4000-8000-000000000001'; delete from academic.study_plans where id='e4200000-0000-4000-8000-000000000001'; delete from academic.academic_periods where id='e4100000-0000-4000-8000-000000000001'; delete from academic.school_cycles where id='e4000000-0000-4000-8000-000000000001'; delete from core.account_roles where account_id::text like 'e300%'; delete from core.accounts where id::text like 'e300%'; delete from core.people where id::text like 'e200%'; delete from auth.users where id='e1000000-0000-4000-8000-000000000001'; set session_replication_role=origin;`,
  );
});

const createSession = (schedule, offering, assignment, space, key) =>
  `select * from academic.create_class_session('${schedule}','${offering}','${assignment}','${space}',1::smallint,'e6200000-0000-4000-8000-000000000001','REGULAR_CLASS','2095-01-01','2095-06-30','${key}');`;

for (const scenario of [
  [
    "01 grupo",
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000001",
      "B3C_GROUP_A",
    ),
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000002",
      "B3C_GROUP_B",
    ),
  ],
  [
    "02 docente",
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000001",
      "B3C_TEACHER_A",
    ),
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000002",
      "B3C_TEACHER_B",
    ),
  ],
  [
    "03 salón",
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000001",
      "B3C_SPACE_A",
    ),
    createSession(
      "e8000000-0000-4000-8000-000000000002",
      "e5100000-0000-4000-8000-000000000002",
      "e6000000-0000-4000-8000-000000000002",
      "e7000000-0000-4000-8000-000000000001",
      "B3C_SPACE_B",
    ),
  ],
  [
    "04 ocupación exclusiva",
    createSession(
      "e8000000-0000-4000-8000-000000000001",
      "e5100000-0000-4000-8000-000000000001",
      "e6000000-0000-4000-8000-000000000001",
      "e7000000-0000-4000-8000-000000000002",
      "B3C_OCCUPY_A",
    ),
    createSession(
      "e8000000-0000-4000-8000-000000000002",
      "e5100000-0000-4000-8000-000000000002",
      "e6000000-0000-4000-8000-000000000002",
      "e7000000-0000-4000-8000-000000000002",
      "B3C_OCCUPY_B",
    ),
  ],
]) {
  test(`carrera ${scenario[0]}`, async () => {
    clearOperationalData();
    const result = await race(scenario[1], scenario[2]);
    assert.equal(result.filter((item) => item.code === 0).length, 1, JSON.stringify(result));
    assert.equal(
      sqlSync("select count(*) from academic.class_sessions where status in ('PLANNED','ACTIVE');"),
      "1",
    );
  });
}
