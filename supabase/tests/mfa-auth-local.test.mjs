import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";

import { createAuthenticationService } from "../../packages/supabase/dist/auth-session.js";
import { createLocalPrivilegedAuthMfaAdministrationAdapter } from "../../packages/supabase/dist/mfa-administration-local.js";

const rawApiUrl = process.env.LOCAL_SUPABASE_URL;
const apiUrl = rawApiUrl?.replace("127.0.0.1", "localhost");
const publishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const adminSecretKey = process.env.SUPABASE_AUTH_ADMIN_SECRET_KEY;
const databaseContainer = process.env.LOCAL_SUPABASE_DB_CONTAINER;
if (!apiUrl || !publishableKey || !adminSecretKey || !databaseContainer) {
  throw new Error("Falta configuración local sintética para MFA.");
}
const parsedUrl = new URL(apiUrl);
if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname) || parsedUrl.port !== "54321") {
  throw new Error("La prueba MFA solo admite Supabase local en loopback:54321.");
}

function database(sql, capture = false) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      databaseContainer,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      ...(capture ? ["-At"] : []),
      "-c",
      sql,
    ],
    { encoding: capture ? "utf8" : undefined, stdio: capture ? "pipe" : "ignore" },
  );
}

async function authAdmin(path, init = {}) {
  return fetch(`${apiUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: adminSecretKey,
      Authorization: `Bearer ${adminSecretKey}`,
      "Content-Type": "application/json",
    },
  });
}

function createSession() {
  const cookies = new Map();
  return createAuthenticationService(
    { publishableKey, url: apiUrl },
    {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (updates) => {
        for (const cookie of updates) {
          if (cookie.value === "" || (cookie.options?.maxAge ?? 1) <= 0) {
            cookies.delete(cookie.name);
          } else {
            cookies.set(cookie.name, cookie.value);
          }
        }
      },
    },
  );
}

function decodeBase32(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/u, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("TOTP fixture inválido.");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30_000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac("sha1", decodeBase32(secret)).update(message).digest();
  const offset = digest.at(-1) & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

const fixture = {
  accountId: randomUUID(),
  approverAccountId: randomUUID(),
  approverPersonId: randomUUID(),
  authUserId: null,
  email: `mfa-${randomUUID()}@example.invalid`,
  password: randomBytes(18).toString("base64url"),
  personId: randomUUID(),
  requesterAccountId: randomUUID(),
  requesterPersonId: randomUUID(),
};

try {
  const created = await authAdmin("/users", {
    body: JSON.stringify({
      email: fixture.email,
      email_confirm: true,
      password: fixture.password,
    }),
    method: "POST",
  });
  assert.equal(created.ok, true, "Auth local crea el usuario sintético.");
  fixture.authUserId = (await created.json()).id;
  database(`
    insert into core.people (id) values ('${fixture.personId}');
    insert into core.accounts (id,person_id,auth_user_id,account_status)
    values ('${fixture.accountId}','${fixture.personId}','${fixture.authUserId}','ACTIVE');
    insert into core.account_roles (account_id,role_id)
    select '${fixture.accountId}',id from core.roles where code='ADMINISTRATIVO';
    insert into core.people (id) values
      ('${fixture.requesterPersonId}'),('${fixture.approverPersonId}');
    insert into core.accounts (id,person_id,account_status) values
      ('${fixture.requesterAccountId}','${fixture.requesterPersonId}','ACTIVE'),
      ('${fixture.approverAccountId}','${fixture.approverPersonId}','ACTIVE');
    insert into core.account_roles (account_id,role_id)
    select '${fixture.requesterAccountId}'::uuid,id from core.roles where code='SUPERADMIN'
    union all
    select '${fixture.approverAccountId}'::uuid,id from core.roles where code='ADMINISTRATIVO';
  `);

  const firstSession = createSession();
  assert.equal(
    (
      await firstSession.signInWithAuthCredentials({
        email: fixture.email,
        password: fixture.password,
      })
    ).ok,
    true,
  );
  let assurance = await firstSession.getAuthenticatorAssuranceLevel();
  assert.equal(assurance.currentLevel, "aal1");
  assert.equal(assurance.nextLevel, "aal1");
  const blockedContext = await firstSession.getAuthenticatedIdentity();
  assert.equal(blockedContext.ok, true);
  assert.equal(blockedContext.identity.context.mfaRequired, true);
  assert.equal(blockedContext.identity.context.mfaSatisfied, false);
  assert.equal(blockedContext.identity.context.accountId, null);

  const enrollment = await firstSession.enrollTotp("Principal");
  assert.equal(enrollment.ok, true);
  const firstFactorId = enrollment.factorId;
  const firstCode = totp(enrollment.secret);
  assert.equal(
    (await firstSession.challengeAndVerify({ factorId: firstFactorId, code: firstCode })).ok,
    true,
  );
  assurance = await firstSession.getAuthenticatorAssuranceLevel();
  assert.equal(assurance.currentLevel, "aal2");
  assert.equal((await firstSession.listFactors()).factors.length, 1);

  const backup = await firstSession.enrollTotp("Respaldo");
  assert.equal(backup.ok, true);
  assert.equal(
    (
      await firstSession.challengeAndVerify({
        factorId: backup.factorId,
        code: totp(backup.secret),
      })
    ).ok,
    true,
  );
  assert.equal((await firstSession.listFactors()).factors.length, 2);
  const localAdministration = createLocalPrivilegedAuthMfaAdministrationAdapter({
    secretKey: adminSecretKey,
    url: apiUrl,
  });
  const privilegedSnapshot = await localAdministration.listUserFactors(fixture.authUserId);
  assert.equal(privilegedSnapshot.ok, true);
  assert.equal(privilegedSnapshot.factors.length, 2);
  assert.equal(
    (await localAdministration.deleteUserFactor(fixture.authUserId, backup.factorId)).outcome,
    "deleted",
  );
  assert.equal((await firstSession.listFactors()).factors.length, 1);

  const recorded = await firstSession.recordCurrentMfaState({
    correlationId: randomUUID(),
    eventType: "MFA_ENROLLMENT_VERIFIED",
    factorCount: 1,
    idempotencyKey: randomUUID(),
    reason: "USER_ENROLLMENT",
    status: "COMPLIANT",
  });
  assert.equal(recorded.ok, true, `RPC MFA local falló con ${recorded.errorCode ?? "UNKNOWN"}.`);
  assert.equal(
    Number(
      database(
        `select session_version from core.accounts where id='${fixture.accountId}'`,
        true,
      ).trim(),
    ),
    2,
  );
  assert.deepEqual(await firstSession.getAuthenticatedIdentity(), {
    error: "SESSION_VERSION_MISMATCH",
    ok: false,
  });

  const secondSession = createSession();
  assert.equal(
    (
      await secondSession.signInWithAuthCredentials({
        email: fixture.email,
        password: fixture.password,
      })
    ).ok,
    true,
  );
  assurance = await secondSession.getAuthenticatorAssuranceLevel();
  assert.equal(assurance.currentLevel, "aal1");
  assert.equal(assurance.nextLevel, "aal2");
  const verifiedFactors = (await secondSession.listFactors()).factors.filter(
    (factor) => factor.status === "verified",
  );
  assert.equal(verifiedFactors.length, 1);
  assert.equal(
    (
      await secondSession.challengeAndVerify({
        factorId: verifiedFactors[0].id,
        code: totp(enrollment.secret),
      })
    ).ok,
    true,
  );
  assert.equal((await secondSession.getAuthenticatorAssuranceLevel()).currentLevel, "aal2");
  assert.equal((await secondSession.getAuthenticatedIdentity()).ok, true);

  const requestKey = randomUUID();
  const approvalKey = randomUUID();
  const executionKey = randomUUID();
  const recoveryId = database(
    `select core.request_mfa_recovery(
      '${fixture.accountId}','${fixture.requesterAccountId}','LOST_ALL_FACTORS',
      '${requestKey}','${randomUUID()}','aal2')`,
    true,
  ).trim();
  database(`select core.record_mfa_identity_verification(
    '${recoveryId}','${fixture.requesterAccountId}','IN_PERSON_WITH_INSTITUTIONAL_RECORD',
    '${randomUUID()}','aal2')`);
  assert.throws(() =>
    database(`select core.approve_mfa_recovery(
      '${recoveryId}','${fixture.requesterAccountId}','${randomUUID()}',
      now()+interval '1 hour','aal2')`),
  );
  database(`select core.approve_mfa_recovery(
    '${recoveryId}','${fixture.approverAccountId}','${approvalKey}',
    now()+interval '1 hour','aal2')`);
  database(`select * from core.begin_mfa_recovery_execution(
    '${recoveryId}','${fixture.approverAccountId}','${executionKey}','aal2')`);
  assert.equal(
    Number(
      database(
        `select session_version from core.accounts where id='${fixture.accountId}'`,
        true,
      ).trim(),
    ),
    3,
  );
  assert.equal(
    (await localAdministration.deleteUserFactor(fixture.authUserId, verifiedFactors[0].id)).outcome,
    "deleted",
  );
  assert.deepEqual(await localAdministration.inspectUserMfaState(fixture.authUserId), {
    ok: true,
    verifiedTotpCount: 0,
  });
  database(`select core.mark_mfa_reenrollment_required(
    '${recoveryId}','${fixture.approverAccountId}',1,'${randomUUID()}')`);

  const recoverySession = createSession();
  assert.equal(
    (
      await recoverySession.signInWithAuthCredentials({
        email: fixture.email,
        password: fixture.password,
      })
    ).ok,
    true,
  );
  assert.equal((await recoverySession.getAuthenticatorAssuranceLevel()).currentLevel, "aal1");
  const replacement = await recoverySession.enrollTotp("Reenrolado");
  assert.equal(replacement.ok, true);
  assert.equal(
    (
      await recoverySession.challengeAndVerify({
        code: totp(replacement.secret),
        factorId: replacement.factorId,
      })
    ).ok,
    true,
  );
  database(`update core.mfa_recovery_requests set status='REENROLLMENT_IN_PROGRESS'
    where id='${recoveryId}'`);
  database(`select core.complete_mfa_recovery(
    '${recoveryId}','${fixture.approverAccountId}',1,'aal2','${randomUUID()}')`);
  assert.equal(
    database(`select status from core.mfa_recovery_requests where id='${recoveryId}'`, true).trim(),
    "COMPLETED",
  );
  assert.equal(
    (await localAdministration.deleteUserFactor(fixture.authUserId, replacement.factorId)).outcome,
    "deleted",
  );

  console.log(
    JSON.stringify(
      {
        aal1: "PASS",
        aal2: "PASS",
        backupFactor: "PASS",
        privilegedAdapter: "PASS",
        cleanup: "PENDING",
        factorCount: 0,
        enrollment: "PASS",
        staleSession: "PASS",
      },
      null,
      2,
    ),
  );
} finally {
  try {
    database(`
      set session_replication_role=replica;
      delete from core.mfa_administrative_security_events
        where account_id='${fixture.accountId}';
      delete from core.mfa_recovery_factor_operations where recovery_request_id in (
        select id from core.mfa_recovery_requests where account_id='${fixture.accountId}'
      );
      delete from core.mfa_recovery_requests where account_id='${fixture.accountId}';
      delete from core.account_mfa_security_events where account_id='${fixture.accountId}';
      delete from core.account_session_security_events where account_id='${fixture.accountId}';
      set session_replication_role=origin;
      delete from core.account_mfa_compliance where account_id='${fixture.accountId}';
      delete from core.account_roles where account_id='${fixture.accountId}';
      delete from core.accounts where id='${fixture.accountId}';
      delete from core.people where id='${fixture.personId}';
      delete from core.account_roles where account_id in
        ('${fixture.requesterAccountId}','${fixture.approverAccountId}');
      delete from core.accounts where id in
        ('${fixture.requesterAccountId}','${fixture.approverAccountId}');
      delete from core.people where id in
        ('${fixture.requesterPersonId}','${fixture.approverPersonId}');
    `);
  } catch {}
  if (fixture.authUserId) {
    try {
      await authAdmin(`/users/${fixture.authUserId}`, { method: "DELETE" });
    } catch {}
  }
  const remaining = Number(
    database(`select count(*) from core.accounts where id='${fixture.accountId}'`, true).trim(),
  );
  assert.equal(remaining, 0, "La prueba MFA elimina sus fixtures.");
  console.log("PASS: limpieza MFA local; no se imprimieron secretos, códigos, IDs ni sesiones.");
}
