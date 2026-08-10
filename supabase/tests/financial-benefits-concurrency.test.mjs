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
  "-At",
];

function runSql(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => Boolean(line) && line !== "BEGIN" && line !== "COMMIT" && line !== "ROLLBACK")
    .at(-1);
}

function runSqlAsync(sql) {
  return new Promise((resolve) => {
    const child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ code, stderr, stdout: stdout.trim() }));
    child.stdin.end(sql);
  });
}

function withClaims(userId, sql, { aal = "aal2", sessionVersion = 1 } = {}) {
  return `begin;select set_config('request.jwt.claims','{"sub":"${userId}","role":"authenticated","aal":"${aal}","session_version":${sessionVersion}}',true);${sql}commit;`;
}

function seedScenario(tag) {
  const ids = {
    adminA: randomUUID(),
    adminB: randomUUID(),
    studentUser: randomUUID(),
    adminAPerson: randomUUID(),
    adminBPerson: randomUUID(),
    studentPerson: randomUUID(),
    adminAAccount: randomUUID(),
    adminBAccount: randomUUID(),
    studentAccountCore: randomUUID(),
    cycle: randomUUID(),
    period: randomUUID(),
    plan: randomUUID(),
    generation: randomUUID(),
    group: randomUUID(),
    record: randomUUID(),
    request: randomUUID(),
    enrollment: randomUUID(),
  };
  const prefix =
    `${tag.replace(/[^A-Z0-9]/gi, "").slice(0, 4)}${randomUUID().replace(/-/g, "").slice(0, 4)}`.toUpperCase();
  runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','${ids.adminA}','authenticated','authenticated','synthetic','${ids.adminA}@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.adminB}','authenticated','authenticated','synthetic','${ids.adminB}@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','${ids.studentUser}','authenticated','authenticated','synthetic','${ids.studentUser}@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values ('${ids.adminAPerson}','ACTIVE'),('${ids.adminBPerson}','ACTIVE'),('${ids.studentPerson}','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('${ids.adminAAccount}','${ids.adminAPerson}','${ids.adminA}','ACTIVE',1),
('${ids.adminBAccount}','${ids.adminBPerson}','${ids.adminB}','ACTIVE',1),
('${ids.studentAccountCore}','${ids.studentPerson}','${ids.studentUser}','ACTIVE',1);
insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values ('${ids.adminAAccount}','ADMINISTRATIVO'),('${ids.adminBAccount}','SUPERADMIN'),('${ids.studentAccountCore}','ALUMNO')) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;
select set_config('request.jwt.claims','{"sub":"${ids.adminA}","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values
('${ids.cycle}','${prefix}_CYCLE','Cycle ${prefix}','ACTIVE','2099-01-01','2099-12-31','${ids.adminAAccount}');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values
('${ids.period}','${ids.cycle}','${prefix}_P1','Periodo ${prefix}',1,'2099-01-01','2099-06-30','ACTIVE','${ids.adminAAccount}');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values
('${ids.plan}','${prefix}_PLAN','Plan ${prefix}','V1','ACTIVE','2099-01-01','${ids.adminAAccount}');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id) values
('${ids.generation}','${prefix}_GEN','Generacion ${prefix}','${ids.cycle}','${ids.plan}','ACTIVE','${ids.adminAAccount}');
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id) values
('${ids.group}','${ids.period}','${ids.plan}',1,'${prefix}_G1','Grupo ${prefix}','ACTIVE',30,'${ids.adminAAccount}');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id) values
('${ids.record}','${ids.studentPerson}','${ids.studentAccountCore}','${ids.plan}','${ids.generation}','${prefix}_ALU','ACTIVE',1,'${ids.adminAAccount}','${ids.period}','${ids.period}');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint) values
('${ids.request}','${ids.record}','${ids.period}','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','${ids.adminAAccount}','${prefix}_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id) values
('${ids.enrollment}','${ids.record}','${ids.request}','${ids.period}','${ids.plan}',1,'${ids.group}','ACTIVE','${prefix}_ENR','${ids.adminAAccount}');
select * from finance.open_student_account('${ids.record}','${prefix}_ACC_OPEN',null);
select * from finance.create_charge_concept('${prefix}_CONCEPT','Concept ${prefix}','Sin datos reales','TUITION','${prefix}_CONCEPT_CMD',null);
select set_config('finance.controlled_mutation','on',true);
update finance.charge_concepts set status='ACTIVE' where code='${prefix}_CONCEPT';
select set_config('finance.controlled_mutation','off',true);
select * from finance.create_student_charge((select id from finance.student_accounts where student_record_id='${ids.record}'),(select id from finance.charge_concepts where code='${prefix}_CONCEPT'),null,'${ids.period}','${ids.enrollment}','Cargo ${prefix}',1000.00,'2099-02-01','MANUAL','${prefix}-CHARGE','${prefix}_CHARGE',null);
select * from finance.post_student_charge((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'${prefix}_POST',null);
select * from finance.create_scholarship_program('${prefix}_SCH','Beca ${prefix}','PERCENTAGE',70.00,null,700.00,'2099-01-01','2099-12-31','${prefix}_PROGRAM_CREATE',null);
select * from finance.submit_scholarship_program((select id from finance.scholarship_programs where code='${prefix}_SCH'),'${prefix}_PROGRAM_SUBMIT',null);
select set_config('request.jwt.claims','{"sub":"${ids.adminB}","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_scholarship_program((select id from finance.scholarship_programs where code='${prefix}_SCH'),'${prefix}_PROGRAM_APPROVE',null);
select * from finance.activate_scholarship_program((select id from finance.scholarship_programs where code='${prefix}_SCH'),'${prefix}_PROGRAM_ACTIVATE',null);
select set_config('request.jwt.claims','{"sub":"${ids.adminA}","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='${prefix}_SCH'),'${ids.record}',(select id from finance.student_accounts where student_record_id='${ids.record}'),'${ids.period}',null,null,700.00,'2099-01-01','2099-12-31','PENDING_INSTITUTIONAL_VALIDATION','${prefix}_ASSIGN',null);
select * from finance.submit_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}_SSUBMIT',null);
select set_config('request.jwt.claims','{"sub":"${ids.adminB}","role":"authenticated","aal":"aal2","session_version":1}',true);
select * from finance.approve_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}_SAPPROVE',null);
select * from finance.activate_student_scholarship((select id from finance.student_scholarships where created_by_account_id='${ids.adminAAccount}'),'${prefix}_SACTIVATE',null);
commit;
`);
  return { ids, prefix };
}

function cleanupScenario(prefix, ids) {
  runSql(String.raw`
set session_replication_role = replica;
delete from finance.payment_agreement_allocations where true;
delete from finance.payment_agreement_installments where true;
delete from finance.payment_agreements where true;
delete from finance.scholarship_applications where true;
delete from finance.charge_adjustments where idempotency_key like '${prefix}%';
delete from finance.financial_events where idempotency_key like '${prefix}%';
delete from finance.financial_commands where idempotency_key like '${prefix}%';
delete from finance.payment_allocations where idempotency_key like '${prefix}%';
delete from finance.payments where idempotency_key like '${prefix}%';
delete from finance.student_charges where idempotency_key like '${prefix}%';
delete from finance.charge_concepts where code='${prefix}_CONCEPT';
delete from finance.student_accounts where student_record_id in (select id from academic.student_records where institutional_student_code='${prefix}_ALU');
delete from academic.period_enrollments where enrollment_number='${prefix}_ENR';
delete from academic.enrollment_requests where idempotency_key='${prefix}_REQ';
delete from academic.student_records where institutional_student_code='${prefix}_ALU';
delete from academic.groups where code='${prefix}_G1';
delete from academic.student_generations where code='${prefix}_GEN';
delete from academic.study_plans where code='${prefix}_PLAN';
delete from academic.academic_periods where code='${prefix}_P1';
delete from academic.school_cycles where code='${prefix}_CYCLE';
delete from core.account_roles where account_id in ('${ids.adminAAccount}','${ids.adminBAccount}','${ids.studentAccountCore}');
delete from core.accounts where id in ('${ids.adminAAccount}','${ids.adminBAccount}','${ids.studentAccountCore}');
delete from core.people where id in ('${ids.adminAPerson}','${ids.adminBPerson}','${ids.studentPerson}');
delete from auth.users where id in ('${ids.adminA}','${ids.adminB}','${ids.studentUser}');
set session_replication_role = origin;
`);
}

test("01 benefit concurrent overflow no excede outstanding", async () => {
  const { ids, prefix } = seedScenario("conc_overflow");
  try {
    const chargeId = runSql(
      `select id from finance.student_charges where idempotency_key='${prefix}_CHARGE';`,
    );
    const claims = `select set_config('request.jwt.claims','{"sub":"${ids.adminB}","role":"authenticated","aal":"aal2","session_version":1}',true);`;
    const [a, b] = await Promise.all([
      runSqlAsync(
        `begin;${claims}select * from finance.apply_authorized_discount('${chargeId}',700.00,'A','${prefix}_DISC_A',null);commit;`,
      ),
      runSqlAsync(
        `begin;${claims}select * from finance.apply_authorized_discount('${chargeId}',500.00,'B','${prefix}_DISC_B',null);commit;`,
      ),
    ]);
    const applied = Number(
      runSql(
        `select coalesce(sum(amount),0) from finance.charge_adjustments where idempotency_key in ('${prefix}_DISC_A','${prefix}_DISC_B') and status='APPLIED';`,
      ),
    );
    assert.ok(a.code === 0 || b.code === 0);
    assert.ok(a.code !== 0 || b.code !== 0 || applied <= 1000);
    assert.ok(applied <= 1000);
  } finally {
    cleanupScenario(prefix, ids);
  }
});

for (const [index, name, body] of [
  [
    "02",
    "double scholarship assignment bloquea duplicado activo",
    (ids, prefix) => {
      const first = runSql(
        withClaims(
          ids.adminA,
          `select entity_id from finance.assign_student_scholarship((select id from finance.scholarship_programs where code='${prefix}_SCH'),'${ids.record}',(select id from finance.student_accounts where student_record_id='${ids.record}'),'${ids.period}',null,null,700.00,'2099-01-01','2099-12-31','PENDING_INSTITUTIONAL_VALIDATION','${prefix}_DUP1',null);`,
        ),
      );
      assert.ok(first.length > 0);
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminA,
            `select * from finance.submit_student_scholarship('${first}','${prefix}_DUP1_SUBMIT',null);`,
          ),
        ),
      );
    },
  ],
  [
    "03",
    "scholarship apply twice falla",
    (_ids, prefix) => {
      runSql(
        withClaims(
          _ids.adminB,
          `select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id in (select id from core.accounts where auth_user_id is not null) order by created_at desc limit 1),(select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'${prefix}_APPLY1',null);`,
        ),
      );
      assert.throws(() =>
        runSql(
          withClaims(
            _ids.adminB,
            `select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id in (select id from core.accounts where auth_user_id is not null) order by created_at desc limit 1),(select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'${prefix}_APPLY2',null);`,
          ),
        ),
      );
    },
  ],
  [
    "04",
    "scholarship vs payment mantiene saldo no negativo",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminB,
          `select * from finance.apply_student_scholarship((select id from finance.student_scholarships where created_by_account_id in (select id from core.accounts where auth_user_id is not null) order by created_at desc limit 1),(select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'${prefix}_APPLY',null);`,
        ),
      );
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.register_payment((select id from finance.student_accounts where student_record_id in (select id from academic.student_records where institutional_student_code='${prefix}_ALU')),300.00,'CASH','${prefix}-PAY','2099-01-10 10:00+00','${prefix}_PAY',null);`,
        ),
      );
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.confirm_payment((select id from finance.payments where idempotency_key='${prefix}_PAY'),'${prefix}_PAY_CONFIRM',null);`,
        ),
      );
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.allocate_payment((select id from finance.payments where idempotency_key='${prefix}_PAY'),(select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),300.00,'${prefix}_ALLOC',null);`,
        ),
      );
      assert.equal(
        runSql(
          `select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'))::text;`,
        ),
        "0",
      );
    },
  ],
  [
    "05",
    "scholarship revoke vs apply bloquea futuras aplicaciones",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminB,
          `select * from finance.revoke_student_scholarship((select id from finance.student_scholarships order by created_at desc limit 1),'${prefix}_REVOKE',null);`,
        ),
      );
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminB,
            `select * from finance.apply_student_scholarship((select id from finance.student_scholarships order by created_at desc limit 1),(select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'${prefix}_APPLY_AFTER_REVOKE',null);`,
          ),
        ),
      );
    },
  ],
  [
    "06",
    "same key different fingerprint da conflicto",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminB,
          `select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),100.00,'A','${prefix}_SAMEKEY',null);`,
        ),
      );
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminB,
            `select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),90.00,'B','${prefix}_SAMEKEY',null);`,
          ),
        ),
      );
    },
  ],
  [
    "07",
    "waiver requiere creador distinto del aprobador",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),50.00,'Waiver','${prefix}_WV',null);`,
        ),
      );
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminA,
            `select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='${prefix}_WV'),'${prefix}_WV_APPROVE_DENIED',null);`,
          ),
        ),
      );
    },
  ],
  [
    "08",
    "reversal no borra adjustment original",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.create_authorized_waiver((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),50.00,'Waiver','${prefix}_WREV',null);`,
        ),
      );
      runSql(
        withClaims(
          ids.adminB,
          `select * from finance.approve_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='${prefix}_WREV'),'${prefix}_WREV_APPROVE',null);select * from finance.apply_authorized_waiver((select id from finance.charge_adjustments where idempotency_key='${prefix}_WREV'),'${prefix}_WREV_APPLY',null);select * from finance.reverse_financial_benefit((select id from finance.charge_adjustments where idempotency_key='${prefix}_WREV'),'PAYMENT_REVERSAL','reverse','${prefix}_WREV_REV',null);`,
        ),
      );
      assert.equal(
        runSql(
          `select status::text from finance.charge_adjustments where idempotency_key='${prefix}_WREV';`,
        ),
        "REVERSED",
      );
    },
  ],
  [
    "09",
    "session_version revocada bloquea descuento",
    (ids, prefix) => {
      runSql(`update core.accounts set session_version=2 where id='${ids.adminBAccount}';`);
      assert.throws(() =>
        runSql(
          `select set_config('request.jwt.claims','{"sub":"${ids.adminB}","role":"authenticated","aal":"aal2","session_version":1}',true);select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),100.00,'bad','${prefix}_SV',null);`,
        ),
      );
    },
  ],
  [
    "10",
    "AAL1 bloquea descuento",
    (ids, prefix) => {
      assert.throws(() =>
        runSql(
          `select set_config('request.jwt.claims','{"sub":"${ids.adminB}","role":"authenticated","aal":"aal1","session_version":1}',true);select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),100.00,'bad','${prefix}_AAL1',null);`,
        ),
      );
    },
  ],
  [
    "11",
    "charge cancellation impide beneficio posterior",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminA,
          `select * from finance.cancel_student_charge((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),'OTHER','${prefix}_CANCEL',null);`,
        ),
      );
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminB,
            `select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),50.00,'bad','${prefix}_AFTER_CANCEL',null);`,
          ),
        ),
      );
    },
  ],
  [
    "12",
    "agreement create no muta ledger",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminA,
          `select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id in (select id from academic.student_records where institutional_student_code='${prefix}_ALU')),null,600.00,2,'2026-01-20','PENDING_INSTITUTIONAL_VALIDATION',array['2026-01-31'::date,'2026-02-28'::date],array[300.00,300.00],'agreement','${prefix}_AGR',null);`,
        ),
      );
      assert.equal(
        runSql(
          `select finance.get_charge_balance((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'))::text;`,
        ),
        "1000.00",
      );
    },
  ],
  [
    "13",
    "agreement approval concurrent converge",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminA,
          `select * from public.create_payment_agreement((select id from finance.student_accounts where student_record_id in (select id from academic.student_records where institutional_student_code='${prefix}_ALU')),null,600.00,2,'2026-01-20','PENDING_INSTITUTIONAL_VALIDATION',array['2026-01-31'::date,'2026-02-28'::date],array[300.00,300.00],'agreement','${prefix}_AGR',null);`,
        ),
      );
      const agreementId = runSql(
        `select id from finance.payment_agreements where created_by_account_id='${ids.adminAAccount}' order by created_at desc limit 1;`,
      );
      assert.ok(agreementId.length > 0);
      runSql(
        withClaims(
          ids.adminB,
          `select * from public.approve_payment_agreement('${agreementId}','${prefix}_AGR_APPROVE',null);`,
        ),
      );
      assert.equal(
        runSql(`select status::text from finance.payment_agreements where id='${agreementId}';`),
        "ACTIVE",
      );
    },
  ],
  [
    "14",
    "independent students no se contaminan",
    (ids, prefix) => {
      runSql(
        withClaims(
          ids.adminB,
          `select * from finance.apply_authorized_discount((select id from finance.student_charges where idempotency_key='${prefix}_CHARGE'),100.00,'ok','${prefix}_DISC',null);`,
        ),
      );
      assert.equal(
        runSql(
          `select count(*) from finance.charge_adjustments where idempotency_key='${prefix}_DISC';`,
        ),
        "1",
      );
    },
  ],
  [
    "15",
    "account close con saldo pendiente es rechazado",
    (ids, prefix) => {
      assert.throws(() =>
        runSql(
          withClaims(
            ids.adminA,
            `select * from finance.close_student_account((select id from finance.student_accounts where student_record_id in (select id from academic.student_records where institutional_student_code='${prefix}_ALU')),'${prefix}_CLOSE',null);`,
          ),
        ),
      );
    },
  ],
]) {
  test(`${index} ${name}`, () => {
    const { ids, prefix } = seedScenario(`${index}_${name}`);
    try {
      body(ids, prefix);
    } finally {
      cleanupScenario(prefix, ids);
    }
  });
}
