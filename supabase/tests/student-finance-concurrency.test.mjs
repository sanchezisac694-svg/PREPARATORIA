import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const claims = `select set_config('request.jwt.claims','{"sub":"c5100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function psqlArgs() {
  return [
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
}

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs(), { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlConnection(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs(), { shell: false });
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
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','c5100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','finance-admin-conc@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','c5100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','finance-student-conc@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('c5200000-0000-4000-8000-000000000001','ACTIVE'),
('c5200000-0000-4000-8000-000000000002','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('c5300000-0000-4000-8000-000000000001','c5200000-0000-4000-8000-000000000001','c5100000-0000-4000-8000-000000000001','ACTIVE',1),
('c5300000-0000-4000-8000-000000000002','c5200000-0000-4000-8000-000000000002','c5100000-0000-4000-8000-000000000002','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values ('c5300000-0000-4000-8000-000000000001','SUPERADMIN'),('c5300000-0000-4000-8000-000000000002','ALUMNO')) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
${claims}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('c5400000-0000-4000-8000-000000000001','FINC_CYCLE','Cycle conc','ACTIVE','2100-01-01','2100-12-31','c5300000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('c5410000-0000-4000-8000-000000000001','c5400000-0000-4000-8000-000000000001','FINC_P1','Periodo conc',1,'2100-01-01','2100-06-30','ACTIVE','c5300000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('c5420000-0000-4000-8000-000000000001','FINC_PLAN','Plan conc','V1','ACTIVE','2100-01-01','c5300000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('c5430000-0000-4000-8000-000000000001','FINC_GEN','Generación conc','c5400000-0000-4000-8000-000000000001','c5420000-0000-4000-8000-000000000001','ACTIVE','c5300000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('c5450000-0000-4000-8000-000000000001','c5200000-0000-4000-8000-000000000002','c5300000-0000-4000-8000-000000000002','c5420000-0000-4000-8000-000000000001','c5430000-0000-4000-8000-000000000001','FINC_ALU','ACTIVE',1,'c5300000-0000-4000-8000-000000000001','c5410000-0000-4000-8000-000000000001','c5410000-0000-4000-8000-000000000001');
select * from finance.open_student_account('c5450000-0000-4000-8000-000000000001','FINC_ACC_OPEN',null);
select * from finance.create_charge_concept('FINC_TUITION','Colegiatura técnica','Sin datos reales','TUITION','FINC_CONCEPT',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='FINC_TUITION';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='FINC_TUITION'),'c5410000-0000-4000-8000-000000000001','c5420000-0000-4000-8000-000000000001',1::smallint,null::uuid,800.00,statement_timestamp(),null::timestamptz,'FINC_RATE',null::uuid);
select * from finance.approve_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='FINC_TUITION')),'FINC_RATE_APPROVE',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='FINC_TUITION')),'FINC_RATE_ACTIVATE',null);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='c5450000-0000-4000-8000-000000000001'),(select id from finance.charge_concepts where code='FINC_TUITION'),(select id from finance.charge_rates where charge_concept_id=(select id from finance.charge_concepts where code='FINC_TUITION')),'c5410000-0000-4000-8000-000000000001',null,'Cargo concurrencia',800.00,'2100-02-01','MANUAL','REF-CONC-1234','FINC_CHARGE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='FINC_CHARGE'),'FINC_POST',null);
commit;
`);
}

test("concurrencia financiera: misma clave mismo pago y recibos distintos", async () => {
  setupFixture();

  const [sameA, sameB, receiptA, receiptB] = await Promise.all([
    sqlConnection(
      `begin;${claims}select * from finance.register_payment((select id from finance.student_accounts where student_record_id='c5450000-0000-4000-8000-000000000001'),400.00,'CASH','CONC1234','2100-01-15 12:00+00','FINC_PAY_IDEMP',null);commit;`,
    ),
    sqlConnection(
      `begin;${claims}select pg_sleep(0.05);select * from finance.register_payment((select id from finance.student_accounts where student_record_id='c5450000-0000-4000-8000-000000000001'),400.00,'CASH','CONC1234','2100-01-15 12:00+00','FINC_PAY_IDEMP',null);commit;`,
    ),
    sqlConnection(
      `begin;${claims}select * from finance.register_payment((select id from finance.student_accounts where student_record_id='c5450000-0000-4000-8000-000000000001'),200.00,'CASH','R-A-1234','2100-01-16 12:00+00','FINC_PAY_RA',null);commit;`,
    ),
    sqlConnection(
      `begin;${claims}select * from finance.register_payment((select id from finance.student_accounts where student_record_id='c5450000-0000-4000-8000-000000000001'),100.00,'CASH','R-B-1234','2100-01-16 12:01+00','FINC_PAY_RB',null);commit;`,
    ),
  ]);

  assert.equal(sameA.code, 0, sameA.stderr);
  assert.equal(sameB.code, 0, sameB.stderr);
  assert.equal(receiptA.code, 0, receiptA.stderr);
  assert.equal(receiptB.code, 0, receiptB.stderr);

  const state = sqlSync(`
select json_build_object(
  'idempotentPayments', (select count(*) from finance.payments where idempotency_key='FINC_PAY_IDEMP'),
  'receipts', (select json_agg(receipt_number order by receipt_number) from finance.payments where idempotency_key in ('FINC_PAY_RA','FINC_PAY_RB'))
)::text;
`);
  const parsed = JSON.parse(state);
  assert.equal(parsed.idempotentPayments, 1);
  assert.equal(parsed.receipts.length, 2);
  assert.notEqual(parsed.receipts[0], parsed.receipts[1]);
});
