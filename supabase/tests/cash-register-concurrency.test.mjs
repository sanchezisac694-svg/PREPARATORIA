import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

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
  "-Atq",
];

const superadminClaims = `select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const caja1Claims = `select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const caja2Claims = `select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const adminClaims = `select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","session_version":1}',true);`;
const caja1StaleClaims = `select set_config('request.jwt.claims','{"sub":"fc100000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);`;

function sqlSync(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlAsync(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(`set statement_timeout='8s';${sql}`);
  });
}

function resetCashState() {
  sqlSync(`
set session_replication_role=replica;
delete from finance.cash_reconciliations;
delete from finance.cash_counts;
delete from finance.cash_movements;
delete from finance.cash_session_payments;
delete from finance.cash_sessions;
delete from finance.cashier_assignments;
delete from finance.cash_registers;
delete from finance.financial_events where idempotency_key like 'CCX_%';
delete from finance.financial_commands where idempotency_key like 'CCX_%';
delete from finance.payments where idempotency_key like 'CCX_%' or idempotency_key like 'CCX_%_REVERSAL';
update core.accounts set session_version=1 where id in ('fc300000-0000-4000-8000-000000000002','fc300000-0000-4000-8000-000000000003');
set session_replication_role=origin;
`);
}

function bootstrapRegister(code, cashierAccountId) {
  sqlSync(`
begin;
${superadminClaims}
select * from finance.create_cash_register('${code}','${code}','Recepción','ACTIVE','CCX_${code}_REGISTER',null);
select * from finance.assign_cashier_to_register((select id from finance.cash_registers where code='${code}'),'${cashierAccountId}',statement_timestamp(),null,'CCX_${code}_ASSIGN',null);
commit;
`);
}

function openSession(code, claims, operationKey, amount = 100) {
  return sqlSync(`
begin;
${claims}
select entity_id || '|' || status
from public.open_cash_session((select id from finance.cash_registers where code='${code}'),'2099-04-01',${amount.toFixed(2)},'${operationKey}',null);
commit;
`);
}

before(() => {
  sqlSync(`
set session_replication_role=replica;
delete from finance.student_accounts where id='fc360000-0000-4000-8000-000000000001';
delete from academic.student_records where id='fc450000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='fc430000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='fc420000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='fc410000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='fc400000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('fc300000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000002','fc300000-0000-4000-8000-000000000003','fc300000-0000-4000-8000-000000000004','fc300000-0000-4000-8000-000000000005');
delete from core.accounts where id in ('fc300000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000002','fc300000-0000-4000-8000-000000000003','fc300000-0000-4000-8000-000000000004','fc300000-0000-4000-8000-000000000005');
delete from core.people where id in ('fc200000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000003','fc200000-0000-4000-8000-000000000004','fc200000-0000-4000-8000-000000000005');
delete from auth.users where id in ('fc100000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000003','fc100000-0000-4000-8000-000000000004','fc100000-0000-4000-8000-000000000005');
set session_replication_role=origin;

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','cash-race-superadmin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','cash-race-caja1@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','cash-race-caja2@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','cash-race-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','fc100000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','cash-race-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('fc200000-0000-4000-8000-000000000001','ACTIVE'),
('fc200000-0000-4000-8000-000000000002','ACTIVE'),
('fc200000-0000-4000-8000-000000000003','ACTIVE'),
('fc200000-0000-4000-8000-000000000004','ACTIVE'),
('fc200000-0000-4000-8000-000000000005','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('fc300000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000001','ACTIVE',1),
('fc300000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000002','ACTIVE',1),
('fc300000-0000-4000-8000-000000000003','fc200000-0000-4000-8000-000000000003','fc100000-0000-4000-8000-000000000003','ACTIVE',1),
('fc300000-0000-4000-8000-000000000004','fc200000-0000-4000-8000-000000000004','fc100000-0000-4000-8000-000000000004','ACTIVE',1),
('fc300000-0000-4000-8000-000000000005','fc200000-0000-4000-8000-000000000005','fc100000-0000-4000-8000-000000000005','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('fc300000-0000-4000-8000-000000000001','SUPERADMIN'),
('fc300000-0000-4000-8000-000000000002','CAJA'),
('fc300000-0000-4000-8000-000000000003','CAJA'),
('fc300000-0000-4000-8000-000000000004','ADMINISTRATIVO'),
('fc300000-0000-4000-8000-000000000005','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

${superadminClaims}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('fc400000-0000-4000-8000-000000000001','CCX_CYCLE','Cash race cycle','ACTIVE','2099-01-01','2099-12-31','fc300000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('fc410000-0000-4000-8000-000000000001','fc400000-0000-4000-8000-000000000001','CCX_P1','Cash race period',1,'2099-01-01','2099-06-30','ACTIVE','fc300000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('fc420000-0000-4000-8000-000000000001','CCX_PLAN','Cash race plan','V1','ACTIVE','2099-01-01','fc300000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('fc430000-0000-4000-8000-000000000001','CCX_GEN','Cash race generation','fc400000-0000-4000-8000-000000000001','fc420000-0000-4000-8000-000000000001','ACTIVE','fc300000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('fc450000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000005','fc300000-0000-4000-8000-000000000005','fc420000-0000-4000-8000-000000000001','fc430000-0000-4000-8000-000000000001','CCX_STUDENT','ACTIVE',1,'fc300000-0000-4000-8000-000000000001','fc410000-0000-4000-8000-000000000001','fc410000-0000-4000-8000-000000000001');
insert into finance.student_accounts(id,student_record_id,currency_code,status,opened_at,created_at,updated_at)
values('fc360000-0000-4000-8000-000000000001','fc450000-0000-4000-8000-000000000001','MXN','ACTIVE',statement_timestamp(),statement_timestamp(),statement_timestamp());
`);
});

after(() => {
  resetCashState();
  sqlSync(`
set session_replication_role=replica;
delete from finance.student_accounts where id='fc360000-0000-4000-8000-000000000001';
delete from academic.student_records where id='fc450000-0000-4000-8000-000000000001';
delete from academic.student_generations where id='fc430000-0000-4000-8000-000000000001';
delete from academic.study_plans where id='fc420000-0000-4000-8000-000000000001';
delete from academic.academic_periods where id='fc410000-0000-4000-8000-000000000001';
delete from academic.school_cycles where id='fc400000-0000-4000-8000-000000000001';
delete from core.account_roles where account_id in ('fc300000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000002','fc300000-0000-4000-8000-000000000003','fc300000-0000-4000-8000-000000000004','fc300000-0000-4000-8000-000000000005');
delete from core.accounts where id in ('fc300000-0000-4000-8000-000000000001','fc300000-0000-4000-8000-000000000002','fc300000-0000-4000-8000-000000000003','fc300000-0000-4000-8000-000000000004','fc300000-0000-4000-8000-000000000005');
delete from core.people where id in ('fc200000-0000-4000-8000-000000000001','fc200000-0000-4000-8000-000000000002','fc200000-0000-4000-8000-000000000003','fc200000-0000-4000-8000-000000000004','fc200000-0000-4000-8000-000000000005');
delete from auth.users where id in ('fc100000-0000-4000-8000-000000000001','fc100000-0000-4000-8000-000000000002','fc100000-0000-4000-8000-000000000003','fc100000-0000-4000-8000-000000000004','fc100000-0000-4000-8000-000000000005');
set session_replication_role=origin;
`);
});

test("quince escenarios de concurrencia de caja permanecen coherentes", async (t) => {
  await t.test("01 double open same register", async () => {
    resetCashState();
    bootstrapRegister("CCX_R01", "fc300000-0000-4000-8000-000000000002");
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R01'),'2099-04-01',100.00,'CCX_OPEN_SAME_A',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R01'),'2099-04-01',100.00,'CCX_OPEN_SAME_B',null);commit;`,
      ),
    ]);
    assert.equal([a, b].filter((result) => result.status === 0).length, 1);
    assert.ok([a, b].some((result) => /CASH_SESSION_ALREADY_OPEN|duplicate/i.test(result.stderr)));
  });

  await t.test("02 same cashier double session", async () => {
    resetCashState();
    bootstrapRegister("CCX_R02A", "fc300000-0000-4000-8000-000000000002");
    bootstrapRegister("CCX_R02B", "fc300000-0000-4000-8000-000000000002");
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R02A'),'2099-04-01',100.00,'CCX_OPEN_CASHIER_A',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R02B'),'2099-04-01',100.00,'CCX_OPEN_CASHIER_B',null);commit;`,
      ),
    ]);
    assert.equal([a, b].filter((result) => result.status === 0).length, 1);
  });

  await t.test("03 CASH payment vs close", async () => {
    resetCashState();
    bootstrapRegister("CCX_R03", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R03", caja1Claims, "CCX_OPEN_R03");
    const [payment, closing] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R03')),50.00,'CASH','CCX-R03-CASH','2099-04-01 10:00+00','CCX_PAY_R03_REG','CCX_PAY_R03_CONF',null,null,null,'CCX_PAY_R03_LINK',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R03')),'CCX_BEGIN_CLOSE_R03',null);commit;`,
      ),
    ]);
    assert.ok(payment.status === 0 || closing.status === 0);
  });

  await t.test("04 simultaneous payments same idempotency", async () => {
    resetCashState();
    bootstrapRegister("CCX_R04", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R04", caja1Claims, "CCX_OPEN_R04");
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R04')),25.00,'CASH','CCX-R04-CASH','2099-04-01 10:00+00','CCX_PAY_R04_REG','CCX_PAY_R04_CONF',null,null,null,'CCX_PAY_R04_LINK',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R04')),25.00,'CASH','CCX-R04-CASH','2099-04-01 10:00+00','CCX_PAY_R04_REG','CCX_PAY_R04_CONF',null,null,null,'CCX_PAY_R04_LINK',null);commit;`,
      ),
    ]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(
      sqlSync(`select count(*) from finance.payments where idempotency_key='CCX_PAY_R04_REG'`),
      "1",
    );
  });

  await t.test("05 withdrawal vs close", async () => {
    resetCashState();
    bootstrapRegister("CCX_R05", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R05", caja1Claims, "CCX_OPEN_R05");
    const [movement, close] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cash_movement((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R05')),'CASH_WITHDRAWAL',10.00,'SAFE_DROP','CCX move','2099-04-01 11:00+00','CCX_MOVE_R05',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R05')),'CCX_BEGIN_CLOSE_R05',null);commit;`,
      ),
    ]);
    assert.ok(movement.status === 0 || close.status === 0);
  });

  await t.test("06 count vs payment in closing", async () => {
    resetCashState();
    bootstrapRegister("CCX_R06", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R06", caja1Claims, "CCX_OPEN_R06");
    sqlSync(
      `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R06')),'CCX_BEGIN_CLOSE_R06',null);commit;`,
    );
    const [count, payment] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.record_cash_count((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R06')),100.00,'CCX_COUNT_R06',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R06')),10.00,'CASH','CCX-R06-CASH','2099-04-01 10:00+00','CCX_PAY_R06_REG','CCX_PAY_R06_CONF',null,null,null,'CCX_PAY_R06_LINK',null);commit;`,
      ),
    ]);
    assert.equal(count.status, 0, count.stderr);
    assert.notEqual(payment.status, 0);
  });

  await t.test("07 double close", async () => {
    resetCashState();
    bootstrapRegister("CCX_R07", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R07", caja1Claims, "CCX_OPEN_R07");
    sqlSync(
      `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R07')),'CCX_BEGIN_CLOSE_R07',null);select * from public.record_cash_count((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R07')),100.00,'CCX_COUNT_R07',null);commit;`,
    );
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.close_cash_session((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R07')),null,null,'CCX_CLOSE_R07A',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.close_cash_session((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R07')),null,null,'CCX_CLOSE_R07B',null);commit;`,
      ),
    ]);
    assert.ok([a, b].some((result) => result.status === 0));
  });

  await t.test("08 double difference approval", async () => {
    resetCashState();
    bootstrapRegister("CCX_R08", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R08", caja1Claims, "CCX_OPEN_R08");
    sqlSync(
      `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R08')),'CCX_BEGIN_CLOSE_R08',null);select * from public.record_cash_count((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R08')),95.00,'CCX_COUNT_R08',null);select * from public.close_cash_session((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R08')),'OTHER_MANUAL_REVIEW','CCX diff','CCX_CLOSE_R08',null);commit;`,
    );
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${adminClaims}select * from public.approve_cash_difference((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R08')),'CCX_APPROVE_R08A',null);commit;`,
      ),
      sqlAsync(
        `begin;${adminClaims}select * from public.approve_cash_difference((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R08')),'CCX_APPROVE_R08B',null);commit;`,
      ),
    ]);
    assert.ok([a, b].some((result) => result.status === 0));
    assert.ok(
      [a, b].some((result) => result.status !== 0 || /CLOSED|APPROVED/.test(result.stdout)),
    );
  });

  await t.test("09 payment reversal vs close", async () => {
    resetCashState();
    bootstrapRegister("CCX_R09", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R09", caja1Claims, "CCX_OPEN_R09");
    sqlSync(
      `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R09')),25.00,'BANK_TRANSFER','CCX-R09-TR','2099-04-01 10:00+00','CCX_PAY_R09_REG','CCX_PAY_R09_CONF',null,null,null,'CCX_PAY_R09_LINK',null);commit;`,
    );
    const [reversal, close] = await Promise.all([
      sqlAsync(
        `begin;${superadminClaims}select * from finance.reverse_payment((select id from finance.payments where idempotency_key='CCX_PAY_R09_REG'),'DUPLICATE_PAYMENT','CCX_REV_R09',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.begin_cash_session_close((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R09')),'CCX_BEGIN_CLOSE_R09',null);commit;`,
      ),
    ]);
    assert.ok(reversal.status === 0 || close.status === 0);
  });

  await t.test("10 session_version vs operation", async () => {
    resetCashState();
    bootstrapRegister("CCX_R10", "fc300000-0000-4000-8000-000000000002");
    sqlSync(
      `update core.accounts set session_version=2 where id='fc300000-0000-4000-8000-000000000002';`,
    );
    const result = await sqlAsync(
      `begin;${caja1StaleClaims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R10'),'2099-04-01',100.00,'CCX_OPEN_R10',null);commit;`,
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /SESSION_VERSION_INVALID|APPLICATION_NOT_ALLOWED/i);
  });

  await t.test("11 assignment revoke vs operation", async () => {
    resetCashState();
    bootstrapRegister("CCX_R11", "fc300000-0000-4000-8000-000000000002");
    const [revoke, open] = await Promise.all([
      sqlAsync(
        `begin;${superadminClaims}update finance.cashier_assignments set status='REVOKED', valid_until=statement_timestamp() where cash_register_id=(select id from finance.cash_registers where code='CCX_R11');commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R11'),'2099-04-01',100.00,'CCX_OPEN_R11',null);commit;`,
      ),
    ]);
    assert.ok(revoke.status === 0);
    assert.ok(open.status !== 0 || /OPEN/.test(open.stdout));
  });

  await t.test("12 same idempotency same fingerprint", async () => {
    resetCashState();
    bootstrapRegister("CCX_R12", "fc300000-0000-4000-8000-000000000002");
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R12'),'2099-04-01',100.00,'CCX_OPEN_R12',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R12'),'2099-04-01',100.00,'CCX_OPEN_R12',null);commit;`,
      ),
    ]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.equal(
      sqlSync(
        `select count(*) from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R12')`,
      ),
      "1",
    );
  });

  await t.test("13 same key different fingerprint", async () => {
    resetCashState();
    bootstrapRegister("CCX_R13", "fc300000-0000-4000-8000-000000000002");
    const ok = await sqlAsync(
      `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R13'),'2099-04-01',100.00,'CCX_OPEN_R13',null);commit;`,
    );
    const conflict = await sqlAsync(
      `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R13'),'2099-04-01',120.00,'CCX_OPEN_R13',null);commit;`,
    );
    assert.equal(ok.status, 0, ok.stderr);
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /IDEMPOTENCY_CONFLICT/i);
  });

  await t.test("14 independent registers", async () => {
    resetCashState();
    bootstrapRegister("CCX_R14A", "fc300000-0000-4000-8000-000000000002");
    bootstrapRegister("CCX_R14B", "fc300000-0000-4000-8000-000000000003");
    const [a, b] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R14A'),'2099-04-01',100.00,'CCX_OPEN_R14A',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja2Claims}select * from public.open_cash_session((select id from finance.cash_registers where code='CCX_R14B'),'2099-04-01',120.00,'CCX_OPEN_R14B',null);commit;`,
      ),
    ]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
  });

  await t.test("15 CASH payment vs withdrawal", async () => {
    resetCashState();
    bootstrapRegister("CCX_R15", "fc300000-0000-4000-8000-000000000002");
    openSession("CCX_R15", caja1Claims, "CCX_OPEN_R15");
    const [payment, withdrawal] = await Promise.all([
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='fc450000-0000-4000-8000-000000000001'),(select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R15')),40.00,'CASH','CCX-R15-CASH','2099-04-01 10:00+00','CCX_PAY_R15_REG','CCX_PAY_R15_CONF',null,null,null,'CCX_PAY_R15_LINK',null);commit;`,
      ),
      sqlAsync(
        `begin;${caja1Claims}select * from public.register_cash_movement((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R15')),'CASH_WITHDRAWAL',10.00,'SAFE_DROP','CCX move','2099-04-01 10:00+00','CCX_MOVE_R15',null);commit;`,
      ),
    ]);
    assert.equal(payment.status, 0, payment.stderr);
    assert.equal(withdrawal.status, 0, withdrawal.stderr);
    assert.equal(
      sqlSync(
        `select finance.calculate_expected_cash((select id from finance.cash_sessions where cash_register_id=(select id from finance.cash_registers where code='CCX_R15')))::text`,
      ),
      "130.00",
    );
  });
});
