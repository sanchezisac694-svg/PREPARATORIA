import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  "-Atq",
];

function parseLines(stdout) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && !["BEGIN", "COMMIT", "ROLLBACK"].includes(line));
}

function sql(query) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: query, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function sqlScalar(query) {
  const value = parseLines(sql(query)).at(-1);
  assert.ok(value, "No scalar SQL value found");
  return value;
}

function sqlJson(query) {
  const line = parseLines(sql(query)).findLast(
    (value) => value.startsWith("{") || value.startsWith("["),
  );
  assert.ok(line, "No JSON SQL value found");
  return JSON.parse(line);
}

function sqlAsync(query) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stderr, stdout }));
    child.stdin.end(query);
  });
}

function makePrefix(tag) {
  return `${tag
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 6)}${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function claims(userId, { aal = "aal2", sessionVersion = 1 } = {}) {
  return `select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated","aal":"${aal}","session_version":${sessionVersion}}',true);`;
}

function txWithClaims(userId, statement, options) {
  return `begin;${claims(userId, options)}${statement}rollback;`;
}

function buildFixture(tag) {
  const prefix = makePrefix(tag);
  const ids = {
    adminAUser: randomUUID(),
    adminBUser: randomUUID(),
    cajaUser: randomUUID(),
    studentUser: randomUUID(),
    adminAPerson: randomUUID(),
    adminBPerson: randomUUID(),
    cajaPerson: randomUUID(),
    studentPerson: randomUUID(),
    adminAAccount: randomUUID(),
    adminBAccount: randomUUID(),
    cajaAccount: randomUUID(),
    studentCoreAccount: randomUUID(),
    cycle: randomUUID(),
    period: randomUUID(),
    secondPeriod: randomUUID(),
    plan: randomUUID(),
    generation: randomUUID(),
    group: randomUUID(),
    record: randomUUID(),
    request: randomUUID(),
    enrollment: randomUUID(),
  };

  const chargeConceptCode = `${prefix}TU`;
  const scholarshipCode = `${prefix}SC`;
  const cashRegisterCode = `${prefix}CJ`;
  const businessDate = "2026-08-10";
  const nextBusinessDate = "2026-08-11";
  const studentCode = `${prefix}ALU`;

  sql(`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','${ids.adminAUser}','authenticated','authenticated','synthetic','${prefix.toLowerCase()}-admin-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.adminBUser}','authenticated','authenticated','synthetic','${prefix.toLowerCase()}-admin-b@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.cajaUser}','authenticated','authenticated','synthetic','${prefix.toLowerCase()}-caja@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.studentUser}','authenticated','authenticated','synthetic','${prefix.toLowerCase()}-student@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('${ids.adminAPerson}','ACTIVE'),
('${ids.adminBPerson}','ACTIVE'),
('${ids.cajaPerson}','ACTIVE'),
('${ids.studentPerson}','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('${ids.adminAAccount}','${ids.adminAPerson}','${ids.adminAUser}','ACTIVE',1),
('${ids.adminBAccount}','${ids.adminBPerson}','${ids.adminBUser}','ACTIVE',1),
('${ids.cajaAccount}','${ids.cajaPerson}','${ids.cajaUser}','ACTIVE',1),
('${ids.studentCoreAccount}','${ids.studentPerson}','${ids.studentUser}','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('${ids.adminAAccount}','ADMINISTRATIVO'),
('${ids.adminBAccount}','SUPERADMIN'),
('${ids.cajaAccount}','CAJA'),
('${ids.studentCoreAccount}','ALUMNO')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

${claims(ids.adminAUser)}
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('${ids.cycle}','${prefix}CY','Cycle ${prefix}','ACTIVE','2026-01-01','2026-12-31','${ids.adminAAccount}');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('${ids.period}','${ids.cycle}','${prefix}P1','Periodo ${prefix}',1,'2026-01-01','2026-06-30','ACTIVE','${ids.adminAAccount}'),
('${ids.secondPeriod}','${ids.cycle}','${prefix}P2','Periodo ${prefix} B',2,'2026-07-01','2026-12-31','ACTIVE','${ids.adminAAccount}');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('${ids.plan}','${prefix}PL','Plan ${prefix}','V1','ACTIVE','2026-01-01','${ids.adminAAccount}');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('${ids.generation}','${prefix}GN','Generacion ${prefix}','${ids.cycle}','${ids.plan}','ACTIVE','${ids.adminAAccount}');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('${ids.group}','${ids.period}','${ids.plan}',1,'${prefix}G1','Grupo ${prefix}','ACTIVE',30,'${ids.adminAAccount}');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('${ids.record}','${ids.studentPerson}','${ids.studentCoreAccount}','${ids.plan}','${ids.generation}','${studentCode}','ACTIVE',1,'${ids.adminAAccount}','${ids.period}','${ids.period}');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('${ids.request}','${ids.record}','${ids.period}','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','${ids.adminAAccount}','${prefix}RQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('${ids.enrollment}','${ids.record}','${ids.request}','${ids.period}','${ids.plan}',1,'${ids.group}','ACTIVE','${prefix}EN','${ids.adminAAccount}');

select * from finance.open_student_account('${ids.record}','${prefix}AO',null);
select * from finance.create_charge_concept('${chargeConceptCode}','Colegiatura ${prefix}','Sin datos reales','TUITION','${prefix}CC',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='${chargeConceptCode}';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_charge_rate((select id from finance.charge_concepts where code='${chargeConceptCode}'),'${ids.period}','${ids.plan}',1::smallint,null::uuid,1000.00,statement_timestamp(),null::timestamptz,'${prefix}RC',null);
select * from finance.approve_charge_rate((select id from finance.charge_rates where created_by_account_id='${ids.adminAAccount}'),'${prefix}RA',null);
select * from finance.activate_charge_rate((select id from finance.charge_rates where created_by_account_id='${ids.adminAAccount}'),'${prefix}RV',null);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='${ids.record}'),(select id from finance.charge_concepts where code='${chargeConceptCode}'),(select id from finance.charge_rates where created_by_account_id='${ids.adminAAccount}'),'${ids.period}','${ids.enrollment}','Cargo ${prefix}',1000.00,'2026-08-05','MANUAL','${prefix}-CH','${prefix}CH',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='${prefix}CH'),'${prefix}CP',null);

select * from finance.create_scholarship_program('${scholarshipCode}','Beca ${prefix}','PERCENTAGE',25.00,null,200.00,'2026-01-01','2026-12-31','${prefix}PC',null);
select * from finance.submit_scholarship_program((select id from finance.scholarship_programs where code='${scholarshipCode}'),'${prefix}PS',null);
${claims(ids.adminBUser)}
select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='${scholarshipCode}'),'${prefix}PA',null);
select * from finance.activate_scholarship_program((select id from finance.scholarship_programs where code='${scholarshipCode}'),'${prefix}PX',null);

${claims(ids.adminAUser)}
select * from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='${scholarshipCode}'),'${ids.record}',(select id from finance.student_accounts where student_record_id='${ids.record}'),'${ids.period}',null,null,200.00,'2026-01-01','2026-12-31','PENDING_INSTITUTIONAL_VALIDATION','${prefix}SA',null);
select * from finance.submit_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}SS',null);
${claims(ids.adminBUser)}
select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}SP',null);
select * from finance.activate_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}SX',null);
select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),(select id from finance.student_charges where idempotency_key='${prefix}CH'),'${prefix}SY',null);

${claims(ids.adminAUser)}
select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}CH'),100.00,'Descuento ${prefix}','${prefix}DA',null);
select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='${prefix}CH'),50.00,'Waiver ${prefix}','${prefix}WC',null);
${claims(ids.adminBUser)}
select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='${prefix}WC'),'${prefix}WA',null);
select * from finance.apply_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='${prefix}WC'),'${prefix}WX',null);

${claims(ids.adminAUser)}
select * from finance.create_cash_register('${cashRegisterCode}','Caja ${prefix}','Recepcion','ACTIVE','${prefix}CR',null);
select * from finance.assign_cashier_to_register((select id from finance.cash_registers where code='${cashRegisterCode}'),'${ids.cajaAccount}',statement_timestamp(),null,'${prefix}CA',null);
${claims(ids.cajaUser)}
select * from public.open_cash_session((select id from finance.cash_registers where code='${cashRegisterCode}'),'${businessDate}',50.00,'${prefix}CO',null);
select * from public.register_cashier_payment((select id from finance.student_accounts where student_record_id='${ids.record}'),(select id from finance.cash_sessions where business_date='${businessDate}' and cash_register_id=(select id from finance.cash_registers where code='${cashRegisterCode}')),300.00,'CASH','${prefix}-PAY','${businessDate} 09:00+00','${prefix}PR','${prefix}PF',(select id from finance.student_charges where idempotency_key='${prefix}CH'),300.00,'${prefix}AL','${prefix}LK',null);

${claims(ids.adminAUser)}
select * from public.open_collection_case((select id from finance.student_accounts where student_record_id='${ids.record}'),'OVERDUE_BALANCE','NORMAL',null,'${prefix}OC',null);
select * from public.create_payment_commitment((select id from finance.collection_cases where opened_by_account_id='${ids.adminAAccount}'),(select id from finance.student_accounts where student_record_id='${ids.record}'),350.00,'2026-08-20','Compromiso ${prefix}','${prefix}CM',null);
select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id='${ids.record}'),(select id from finance.collection_cases where opened_by_account_id='${ids.adminAAccount}'),350.00,2,'${businessDate}','PENDING_INSTITUTIONAL_VALIDATION',array['2026-08-20'::date,'2026-08-30'::date],array[175.00,175.00],'Convenio ${prefix}','${prefix}AG',null);
${claims(ids.adminBUser)}
select * from public.approve_payment_agreement((select id from finance.payment_agreements where created_by_account_id='${ids.adminAAccount}'),'${prefix}AP',null);
commit;
`);

  return {
    businessDate,
    cashRegisterCode,
    chargeConceptCode,
    ids,
    nextBusinessDate,
    prefix,
    scholarshipCode,
    secondPeriod: ids.secondPeriod,
    studentCode,
  };
}

test("01 reportes limitan page_size a 200", () => {
  const fixture = buildFixture("frc_pgsize");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.report_charges('${fixture.ids.period}',null,null,null,null,null,null,null,'${fixture.businessDate}',999,0)->>'pageSize');`,
      ),
    ),
    "200",
  );
});

test("02 reportes normalizan offset negativo a 0", () => {
  const fixture = buildFixture("frc_offset");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.report_payments(null,null,'${fixture.ids.period}',null,null,null,null,50,-10)->>'offset');`,
      ),
    ),
    "0",
  );
});

test("03 summary usa snapshot consistente con fórmula cerrada", () => {
  const fixture = buildFixture("frc_sum");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.get_financial_period_summary('${fixture.ids.period}','${fixture.businessDate}')->>'netCharges') || '|' || (public.get_financial_period_summary('${fixture.ids.period}','${fixture.businessDate}')->>'outstanding');`,
      ),
    ),
    "650.00|350.00",
  );
});

test("04 charge report no mezcla PII sensible", () => {
  const fixture = buildFixture("frc_privch");
  const row = sql(
    txWithClaims(
      fixture.ids.adminAUser,
      `select public.report_charges('${fixture.ids.period}','2026-08-01','2026-08-10',null,1,'${fixture.ids.group}',null,null,'${fixture.businessDate}',50,0)::text;`,
    ),
  );
  assert.match(row, /studentIdentifier|studentDisplayName/i);
  assert.doesNotMatch(row, /auth_user_id|person_id|account_id|email|phone|guardian/i);
});

test("05 payment report mantiene cash session resumida", () => {
  const fixture = buildFixture("frc_payrep");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.report_payments('2026-08-01','2026-08-10','${fixture.ids.period}','CASH',null,null,null,50,0)->'rows'->0->'cashSession'->>'cashRegisterCode');`,
      ),
    ),
    fixture.cashRegisterCode,
  );
});

test("06 debt report no expone ids internos", () => {
  const fixture = buildFixture("frc_debt");
  const row = sql(
    txWithClaims(
      fixture.ids.adminAUser,
      `select public.report_debt_summary('${fixture.ids.period}',1,'${fixture.ids.group}',null,null,null,'${fixture.studentCode}',50,0,'${fixture.businessDate}')::text;`,
    ),
  );
  assert.match(row, /PROMISE_PENDING/);
  assert.doesNotMatch(row, /student_record_id|account_id|auth_user_id|email|phone/i);
});

test("07 cash report coincide con expected cash heredado", () => {
  const fixture = buildFixture("frc_cash");
  const payload = sqlJson(
    txWithClaims(
      fixture.ids.adminAUser,
      `select public.report_cash_operations('${fixture.businessDate}',(select id from finance.cash_registers where code='${fixture.cashRegisterCode}'),null,null,50,0)::text;`,
    ),
  );
  assert.equal(payload.totalRows, 1);
  assert.equal(payload.rows[0].opening, "50.00");
  assert.equal(payload.rows[0].cashReceipts, "300.00");
  assert.equal(payload.rows[0].expected, null);
});

test("08 benefits distinguen scholarship vs authorized discount", () => {
  const fixture = buildFixture("frc_benef");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select array_to_string(array(select jsonb_array_elements(public.report_financial_benefits('${fixture.ids.period}','2026-08-01','2026-08-10',50,0)->'rows')->>'benefitType' order by 1),',');`,
      ),
    ),
    "AUTHORIZED_DISCOUNT,SCHOLARSHIP,WAIVER",
  );
});

test("09 agreements no suman como ingreso en summary", () => {
  const fixture = buildFixture("frc_agree");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.get_financial_period_summary('${fixture.ids.period}','${fixture.businessDate}')->>'netCollections');`,
      ),
    ),
    "300.00",
  );
});

test("10 caja puede leer cash report pero no create period close", () => {
  const fixture = buildFixture("frc_caja");
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.cajaUser,
        `select (public.report_cash_operations('${fixture.businessDate}',(select id from finance.cash_registers where code='${fixture.cashRegisterCode}'),null,null,50,0)->>'totalRows');`,
      ),
    ),
    "1",
  );
  const denied = spawnSync("docker", psqlArgs, {
    encoding: "utf8",
    input: txWithClaims(
      fixture.ids.cajaUser,
      `select * from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}CL',null);`,
    ),
    shell: false,
  });
  assert.notEqual(denied.status, 0);
  assert.doesNotMatch(`${denied.stderr}${denied.stdout}`, /APPLICATION_NOT_ALLOWED/);
  assert.match(`${denied.stderr}${denied.stdout}`, /ACTOR_NOT_AUTHORIZED/);
});

test("11 no permite doble cierre activo equivalente", async () => {
  const fixture = buildFixture("frc_dupcl");
  const [a, b] = await Promise.all([
    sqlAsync(
      `begin;${claims(fixture.ids.adminAUser)}select * from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}C1',null);commit;`,
    ),
    sqlAsync(
      `begin;${claims(fixture.ids.adminAUser)}select * from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}C2',null);commit;`,
    ),
  ]);
  assert.ok([a.code, b.code].includes(0));
  assert.ok([a.code, b.code].includes(3));
  assert.equal(
    sqlScalar(
      `select count(*) from finance.financial_period_closures where academic_period_id='${fixture.ids.period}' and business_date='${fixture.businessDate}' and status in ('DRAFT','UNDER_REVIEW','APPROVED');`,
    ),
    "1",
  );
});

test("12 approved close requiere actor distinto", () => {
  const fixture = buildFixture("frc_appr");
  const closeId = sqlScalar(
    `begin;${claims(fixture.ids.adminAUser)}select entity_id from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}CC',null);commit;`,
  );
  const denied = spawnSync("docker", psqlArgs, {
    encoding: "utf8",
    input: txWithClaims(
      fixture.ids.adminAUser,
      `select * from public.approve_financial_period_close('${closeId}','${fixture.prefix}AD',null);`,
    ),
    shell: false,
  });
  assert.notEqual(denied.status, 0);
  assert.doesNotMatch(`${denied.stderr}${denied.stdout}`, /APPLICATION_NOT_ALLOWED/);
  assert.match(`${denied.stderr}${denied.stdout}`, /ACTOR_NOT_AUTHORIZED/);
  assert.equal(
    sqlScalar(
      `begin;${claims(fixture.ids.adminBUser)}select status from public.approve_financial_period_close('${closeId}','${fixture.prefix}AO',null);commit;`,
    ),
    "APPROVED",
  );
});

test("13 supersede preserva historial sin delete", () => {
  const fixture = buildFixture("frc_super");
  const closeId = sqlScalar(
    `begin;${claims(fixture.ids.adminAUser)}select entity_id from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}CC',null);commit;`,
  );
  sql(
    `begin;${claims(fixture.ids.adminBUser)}select * from public.approve_financial_period_close('${closeId}','${fixture.prefix}AO',null);commit;`,
  );
  sql(
    `begin;${claims(fixture.ids.adminBUser)}select * from public.supersede_financial_period_close('${closeId}','${fixture.nextBusinessDate}','${fixture.prefix}SU',null);commit;`,
  );
  assert.equal(
    sqlScalar(
      `select (select count(*) from finance.financial_period_closures where academic_period_id='${fixture.ids.period}') || '|' || (select status::text from finance.financial_period_closures where academic_period_id='${fixture.ids.period}' and version=1) || '|' || (select status::text from finance.financial_period_closures where academic_period_id='${fixture.ids.period}' and version=2);`,
    ),
    "2|SUPERSEDED|UNDER_REVIEW",
  );
});

test("14 late payment cambia live report pero no closure histórico", () => {
  const fixture = buildFixture("frc_late");
  const closeId = sqlScalar(
    `begin;${claims(fixture.ids.adminAUser)}select entity_id from public.create_financial_period_close('${fixture.ids.period}','${fixture.businessDate}','${fixture.prefix}CC',null);commit;`,
  );
  sql(
    `begin;${claims(fixture.ids.adminBUser)}select * from public.approve_financial_period_close('${closeId}','${fixture.prefix}AO',null);commit;`,
  );
  sql(
    `begin;${claims(fixture.ids.adminAUser)}select * from finance.register_payment((select id from finance.student_accounts where student_record_id='${fixture.ids.record}'),100.00,'BANK_TRANSFER','${fixture.prefix}-P2','${fixture.nextBusinessDate} 09:00+00','${fixture.prefix}P2R',null);select * from finance.confirm_payment((select id from finance.payments where idempotency_key='${fixture.prefix}P2R'),'${fixture.prefix}P2C',null);select * from finance.allocate_payment((select id from finance.payments where idempotency_key='${fixture.prefix}P2R'),(select id from finance.student_charges where idempotency_key='${fixture.prefix}CH'),100.00,'${fixture.prefix}P2A',null);select * from finance.reverse_payment_allocation((select id from finance.payment_allocations where idempotency_key='${fixture.prefix}P2A'),'${fixture.prefix}P2X',null);select * from finance.reverse_payment((select id from finance.payments where idempotency_key='${fixture.prefix}P2R'),'DUPLICATE_PAYMENT','${fixture.prefix}P2V',null);select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${fixture.prefix}CH'),25.00,'Descuento posterior','${fixture.prefix}D2',null);commit;`,
  );
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminBUser,
        `select (public.get_financial_period_summary('${fixture.ids.period}','${fixture.nextBusinessDate}')->>'outstanding') || '|' || (public.get_financial_period_close('${closeId}')->>'outstanding');`,
      ),
    ),
    "325.00|350.00",
  );
});

test("15 periodos independientes no se mezclan", () => {
  const fixture = buildFixture("frc_period");
  sql(
    `begin;${claims(fixture.ids.adminAUser)}select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='${fixture.ids.record}'),(select id from finance.charge_concepts where code='${fixture.chargeConceptCode}'),(select id from finance.charge_rates where created_by_account_id='${fixture.ids.adminAAccount}'),'${fixture.secondPeriod}',null,'Cargo extra ${fixture.prefix}',1000.00,'2026-09-05','MANUAL','${fixture.prefix}-CH2','${fixture.prefix}C2',null);select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='${fixture.prefix}C2'),'${fixture.prefix}C2P',null);commit;`,
  );
  assert.equal(
    sqlScalar(
      txWithClaims(
        fixture.ids.adminAUser,
        `select (public.get_financial_period_summary('${fixture.ids.period}','${fixture.businessDate}')->>'grossCharges') || '|' || (public.get_financial_period_summary('${fixture.secondPeriod}','2026-09-10')->>'grossCharges');`,
      ),
    ),
    "1000.00|1000.00",
  );
});
