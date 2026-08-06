import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { beforeEach, test } from "node:test";

const adminClaims = String.raw`select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function resolveDbContainer() {
  const result = spawnSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const container = result.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.startsWith("supabase_db_"));
  assert.ok(container, "No se encontró un contenedor local supabase_db_* en ejecución.");
  return container;
}

function createPsqlArgs() {
  return [
    "exec",
    "-i",
    resolveDbContainer(),
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-Atq",
  ];
}

function sqlSync(sql) {
  let result = spawnSync("docker", createPsqlArgs(), {
    encoding: "utf8",
    input: sql,
    shell: false,
  });
  if (result.status !== 0 && /unable to upgrade to tcp, received 409/i.test(result.stderr)) {
    result = spawnSync("docker", createPsqlArgs(), {
      encoding: "utf8",
      input: sql,
      shell: false,
    });
  }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", createPsqlArgs(), { shell: false });
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

function setupFixture() {
  sqlSync(String.raw`
set session_replication_role=replica;
delete from academic.document_events where student_record_id='f6900000-0000-4000-8000-000000000001';
delete from academic.document_commands where actor_account_id='f3000000-0000-4000-8000-000000000001';
delete from academic.document_verification_codes where document_issuance_id in ('f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000003');
delete from academic.document_files where document_issuance_id in ('f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000003');
delete from academic.document_snapshots where document_issuance_id in ('f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000003');
delete from academic.document_issuances where id in ('f8000000-0000-4000-8000-000000000001','f8000000-0000-4000-8000-000000000002','f8000000-0000-4000-8000-000000000003');
delete from academic.document_requests where id in ('f7900000-0000-4000-8000-000000000001','f7900000-0000-4000-8000-000000000002','f7900000-0000-4000-8000-000000000003');
delete from academic.period_enrollments where id='f6920000-0000-4000-8000-000000000001';
delete from academic.enrollment_requests where id='f6910000-0000-4000-8000-000000000001';
delete from academic.student_records where id='f6900000-0000-4000-8000-000000000001';
delete from academic.groups where id='f6500000-0000-4000-8000-000000000001';
delete from academic.plan_semesters where id='f6200000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='f6100000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='f6000000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='f5000000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='f4000000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002');
delete from core.accounts where id in ('f3000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000002');
delete from core.people where id in ('f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002');
delete from auth.users where id in ('f1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002');
set session_replication_role=origin;

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','docs-admin-concurrency@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','docs-student-concurrency@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('f2000000-0000-4000-8000-000000000001','ACTIVE'),
('f2000000-0000-4000-8000-000000000002','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('f3000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','ACTIVE',1),
('f3000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('f3000000-0000-4000-8000-000000000001','SUPERADMIN'),
('f3000000-0000-4000-8000-000000000002','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('f4000000-0000-4000-8000-000000000001','DOCS_CONC_CYCLE','Cycle docs concurrency','ACTIVE','2100-01-01','2100-12-31','f3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('f5000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001','DOCS_CONC_P1','Periodo docs concurrency',1,'2100-01-01','2100-06-30','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('f6000000-0000-4000-8000-000000000001','DOCS_CONC_PLAN','Plan docs concurrency','V1','ACTIVE','2100-01-01','f3000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('f6100000-0000-4000-8000-000000000001','DOCS_CONC_GEN','Generación docs concurrency','f4000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001','ACTIVE','f3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('f6200000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('f6500000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001',1,'DOCS_CONC_G1','Grupo docs concurrency','ACTIVE',10,'f3000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('f6900000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000002','f6000000-0000-4000-8000-000000000001','f6100000-0000-4000-8000-000000000001','DOCS_CONC_ALU_001','ACTIVE',1,'f3000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('f6910000-0000-4000-8000-000000000001','f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','f3000000-0000-4000-8000-000000000001','DOCS_CONC_ENROLL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('f6920000-0000-4000-8000-000000000001','f6900000-0000-4000-8000-000000000001','f6910000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001',1,'f6500000-0000-4000-8000-000000000001','ACTIVE','DOCS_CONC_ENR_001','f3000000-0000-4000-8000-000000000001');

insert into academic.document_requests(id,document_type_id,student_record_id,requested_period_id,requested_by_account_id,request_source,status,reason_code,idempotency_key,request_fingerprint,requested_at,created_at,updated_at)
values
('f7900000-0000-4000-8000-000000000001',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','APPROVED','INSTITUTIONAL_VALIDATION_PENDING','DOCS_CONC_REQ_A',repeat('b',64),now(),now(),now()),
('f7900000-0000-4000-8000-000000000002',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','APPROVED','INSTITUTIONAL_VALIDATION_PENDING','DOCS_CONC_REQ_B',repeat('c',64),now(),now(),now()),
('f7900000-0000-4000-8000-000000000003',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','APPROVED','INSTITUTIONAL_VALIDATION_PENDING','DOCS_CONC_REQ_C',repeat('d',64),now(),now(),now());
insert into academic.document_issuances(id,document_request_id,document_type_id,template_version_id,student_record_id,requested_period_id,status,issued_by_account_id,issued_at,content_hash,snapshot_hash,created_at)
values
('f8000000-0000-4000-8000-000000000001','f7900000-0000-4000-8000-000000000001',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),(select active_version_id from academic.document_templates where code='SYS_ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','PREPARING','f3000000-0000-4000-8000-000000000001',now(),repeat('0',64),repeat('0',64),now()),
('f8000000-0000-4000-8000-000000000002','f7900000-0000-4000-8000-000000000002',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),(select active_version_id from academic.document_templates where code='SYS_ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','PREPARING','f3000000-0000-4000-8000-000000000001',now(),repeat('0',64),repeat('0',64),now()),
('f8000000-0000-4000-8000-000000000003','f7900000-0000-4000-8000-000000000003',(select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),(select active_version_id from academic.document_templates where code='SYS_ENROLLMENT_CERTIFICATE'),'f6900000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','PREPARING','f3000000-0000-4000-8000-000000000001',now(),repeat('0',64),repeat('0',64),now());
`);
}

beforeEach(setupFixture);

test("folios concurrentes no se duplican", async () => {
  const [left, right] = await Promise.all([
    sqlConnection(
      `begin;${adminClaims}select pg_sleep(0.05);select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000001','DOCS_CONC_FOLIO_A',null);commit;`,
    ),
    sqlConnection(
      `begin;${adminClaims}select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000002','DOCS_CONC_FOLIO_B',null);commit;`,
    ),
  ]);

  assert.equal(left.code, 0, left.stderr);
  assert.equal(right.code, 0, right.stderr);

  const folios = [left.stdout, right.stdout]
    .flatMap((value) => value.split(/\r?\n/))
    .filter((value) => /^DOC-ECT-\d{4}-\d{6}$/.test(value));

  assert.equal(folios.length, 2);
  assert.notEqual(folios[0], folios[1]);
  assert.equal(new Set(folios).size, 2);
});

test("idempotencia de folio reutiliza resultado previo", () => {
  const baseline = JSON.parse(
    sqlSync(`
select json_build_object(
  'sequence', coalesce((
    select last_value
    from academic.document_folio_sequences
    where document_type_code = 'ENROLLMENT_CERTIFICATE'
      and issue_year = extract(year from statement_timestamp())::integer
  ), 0),
  'events', (
    select count(*)
    from academic.document_events
    where event_type = 'DOCUMENT_FOLIO_ASSIGNED'
      and idempotency_key = 'DOCS_CONC_IDEMP'
  )
)::text;
`),
  );
  const first = sqlSync(
    `begin;${adminClaims}select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000003','DOCS_CONC_IDEMP',null);commit;`,
  );
  const second = sqlSync(
    `begin;${adminClaims}select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000003','DOCS_CONC_IDEMP',null);commit;`,
  );
  const state = sqlSync(`
select json_build_object(
  'sequence', (
    select last_value
    from academic.document_folio_sequences
    where document_type_code = 'ENROLLMENT_CERTIFICATE'
      and issue_year = extract(year from statement_timestamp())::integer
  ),
  'events', (
    select count(*)
    from academic.document_events
    where event_type = 'DOCUMENT_FOLIO_ASSIGNED'
      and idempotency_key = 'DOCS_CONC_IDEMP'
  ),
  'commands', (
    select count(*)
    from academic.document_commands
    where actor_account_id = 'f3000000-0000-4000-8000-000000000001'
      and command_type = 'ASSIGN_DOCUMENT_FOLIO'
      and idempotency_key = 'DOCS_CONC_IDEMP'
      and status = 'COMPLETED'
  )
)::text;
`);
  const folios = [first, second]
    .flatMap((value) => value.split(/\r?\n/))
    .filter((value) => /^DOC-ECT-\d{4}-\d{6}$/.test(value));
  const parsedState = JSON.parse(state);
  assert.equal(folios.length, 2);
  assert.equal(folios[0], folios[1]);
  assert.equal(parsedState.events - baseline.events, 1);
  assert.equal(parsedState.commands, 1);
  assert.equal(parsedState.sequence - baseline.sequence, 1);
});

test("misma clave con emisión distinta conserva conflicto de huella", () => {
  const success = spawnSync("docker", createPsqlArgs(), {
    encoding: "utf8",
    input: `begin;${adminClaims}select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000003','DOCS_CONC_IDEMP',null);commit;`,
    shell: false,
  });
  assert.equal(success.status, 0, success.stderr);

  const result = spawnSync("docker", createPsqlArgs(), {
    encoding: "utf8",
    input: `begin;${adminClaims}select institutional_folio from academic.assign_document_folio('f8000000-0000-4000-8000-000000000002','DOCS_CONC_IDEMP',null);commit;`,
    shell: false,
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /IDEMPOTENCY_CONFLICT/);
  assert.doesNotMatch(result.stderr, /CONCURRENT_MODIFICATION/);

  const state = sqlSync(`
select json_build_object(
  'folio', (
    select institutional_folio
    from academic.document_issuances
    where id = 'f8000000-0000-4000-8000-000000000002'
  ),
  'events', (
    select count(*)
    from academic.document_events
    where event_type = 'DOCUMENT_FOLIO_ASSIGNED'
      and idempotency_key = 'DOCS_CONC_IDEMP'
  )
)::text;
`);
  const parsedState = JSON.parse(state);
  assert.equal(parsedState.folio, null);
  assert.equal(parsedState.events, 1);
});
