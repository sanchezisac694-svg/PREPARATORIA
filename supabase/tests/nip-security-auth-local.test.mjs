import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

import { applications } from "../../packages/authz/dist/index.js";
import { createAuthenticationService } from "../../packages/supabase/dist/auth-session.js";
import {
  createInMemoryAuthenticationAttemptGuard,
  deriveInstitutionalAuthAlias,
  signInWithInstitutionalCredentials,
} from "../../packages/supabase/dist/institutional-access.js";
import {
  changeAuthenticatedNip,
  digestNipResetToken,
  generateNipResetToken,
  resetNipWithAuthorization,
} from "../../packages/supabase/dist/nip-security.js";

const apiUrl = process.env.LOCAL_SUPABASE_URL;
const publishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const databaseContainer = process.env.LOCAL_SUPABASE_DB_CONTAINER;

if (!apiUrl || !publishableKey || !serviceKey || !databaseContainer) {
  throw new Error("Falta configuración sintética local para la prueba.");
}
const parsedApiUrl = new URL(apiUrl);
if (parsedApiUrl.hostname !== "localhost" || parsedApiUrl.port !== "54321") {
  throw new Error("La prueba solo admite Supabase local en localhost:54321.");
}

const aliasDomain = "identidad.sistema-preparatoria.invalid";
const attemptSalt = "synthetic-local-attempt-salt-with-at-least-32-characters";
const tokenSecret = "synthetic-local-reset-secret-with-at-least-32-characters";
const fixture = {
  accountId: randomUUID(),
  authUserId: null,
  currentNip: `00${randomBytes(8).toString("hex")}`,
  identifier: `SEC-${randomBytes(5).toString("hex").toUpperCase()}`,
  identifierType: "NUMERO_CONTROL",
  personId: randomUUID(),
};
const actor = {
  accountId: randomUUID(),
  authUserId: null,
  personId: randomUUID(),
};
const createdAuthUserIds = [];

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
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
}

async function createAuthUser(email, password) {
  const response = await authAdmin("/users", {
    body: JSON.stringify({ email, email_confirm: true, password }),
    method: "POST",
  });
  assert.equal(response.ok, true, "Auth local debe crear el fixture.");
  const user = await response.json();
  createdAuthUserIds.push(user.id);
  return user.id;
}

function createSessionAuthentication() {
  const cookies = new Map();
  return createAuthenticationService(
    { publishableKey, url: apiUrl },
    {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (updates) => {
        for (const cookie of updates) {
          if (cookie.value === "" || (cookie.options?.maxAge ?? 1) <= 0)
            cookies.delete(cookie.name);
          else cookies.set(cookie.name, cookie.value);
        }
      },
    },
  );
}

function sqlRecord(query) {
  const value = database(`select row_to_json(result) from (${query}) result;`, true).trim();
  return value ? JSON.parse(value) : null;
}

const persistence = {
  async completeReset(input) {
    const row = sqlRecord(
      `select id, account_id, person_id, status from core.complete_nip_reset(
        '${input.recoveryRequestId}', '${input.tokenDigest}', '${input.idempotencyKey}')`,
    );
    return {
      accountId: row.account_id,
      id: row.id,
      personId: row.person_id,
      status: row.status,
    };
  },
  async markReconciliationRequired(input) {
    const row = sqlRecord(
      `select id, account_id, person_id, status from core.mark_nip_reconciliation_required(
        '${input.recoveryRequestId}', '${input.idempotencyKey}')`,
    );
    return {
      accountId: row.account_id,
      id: row.id,
      personId: row.person_id,
      status: row.status,
    };
  },
  async markResetAttempt(tokenDigest) {
    const row = sqlRecord(
      `select id, recovery_request_id, expires_at
        from core.mark_nip_reset_attempt('${tokenDigest}')`,
    );
    return {
      expiresAt: row.expires_at,
      id: row.id,
      recoveryRequestId: row.recovery_request_id,
    };
  },
  async markResetFailure(input) {
    const row = sqlRecord(
      `select id, account_id, person_id, status from core.mark_nip_reset_failure(
        '${input.recoveryRequestId}', '${input.errorCode}', ${input.retryable},
        '${input.idempotencyKey}')`,
    );
    return {
      accountId: row.account_id,
      id: row.id,
      personId: row.person_id,
      status: row.status,
    };
  },
  async resolveAuthorization(tokenDigest) {
    const row = sqlRecord(
      `select recovery.id as recovery_id, recovery.account_id, recovery.person_id,
        recovery.status, authz.id as authorization_id,
        authz.recovery_request_id, authz.expires_at
      from core.nip_reset_authorizations authz
      join core.nip_recovery_requests recovery on recovery.id = authz.recovery_request_id
      where authz.token_digest = '${tokenDigest}'
        and authz.consumed_at is null and authz.revoked_at is null
        and authz.expires_at > statement_timestamp()`,
    );
    if (!row) return null;
    return {
      accountId: row.account_id,
      authorization: {
        expiresAt: row.expires_at,
        id: row.authorization_id,
        recoveryRequestId: row.recovery_request_id,
      },
      personId: row.person_id,
      recovery: {
        accountId: row.account_id,
        id: row.recovery_id,
        personId: row.person_id,
        status: row.status,
      },
    };
  },
};

async function login(nip, authentication = createSessionAuthentication()) {
  return {
    authentication,
    result: await signInWithInstitutionalCredentials(
      {
        aliasDomain,
        application: applications.PORTAL_ESCOLAR,
        attemptSalt,
        identifier: fixture.identifier,
        identifierType: fixture.identifierType,
        ipAddress: "127.0.0.10",
        nip,
      },
      {
        attempts: createInMemoryAuthenticationAttemptGuard(),
        authentication,
      },
    ),
  };
}

try {
  const alias = deriveInstitutionalAuthAlias({
    domain: aliasDomain,
    identifierType: fixture.identifierType,
    normalizedIdentifier: fixture.identifier,
  });
  fixture.authUserId = await createAuthUser(alias, fixture.currentNip);
  actor.authUserId = await createAuthUser(
    `administrator-${randomUUID()}@example.invalid`,
    randomBytes(16).toString("base64url"),
  );
  database(`
    insert into core.people (id) values ('${fixture.personId}'), ('${actor.personId}');
    insert into core.accounts (
      id, person_id, auth_user_id, account_status,
      institutional_identifier_type, institutional_identifier,
      identifier_assigned_at, identifier_changed_at
    ) values (
      '${fixture.accountId}', '${fixture.personId}', '${fixture.authUserId}', 'ACTIVE',
      '${fixture.identifierType}', '${fixture.identifier}', now(), now()
    );
    insert into core.accounts (id, person_id, auth_user_id, account_status)
    values ('${actor.accountId}', '${actor.personId}', '${actor.authUserId}', 'ACTIVE');
    insert into core.account_roles (account_id, role_id)
    select '${fixture.accountId}', id from core.roles where code = 'ALUMNO';
    insert into core.account_roles (account_id, role_id)
    select '${actor.accountId}', id from core.roles where code = 'ADMINISTRATIVO';
  `);

  const primary = await login(fixture.currentNip);
  const secondary = await login(fixture.currentNip);
  assert.equal(primary.result.ok, true);
  assert.equal(secondary.result.ok, true);
  const newNip = `00${randomBytes(8).toString("hex")}`;
  const changed = await changeAuthenticatedNip(
    {
      application: applications.PORTAL_ESCOLAR,
      confirmation: newNip,
      correlationId: randomUUID(),
      currentNip: fixture.currentNip,
      idempotencyKey: `change:${randomUUID()}`,
      newNip,
    },
    {
      audit: {
        async record(event) {
          const result = await primary.authentication.recordOwnNipSecurityEvent({
            correlationId: event.correlationId,
            ...(event.errorCode ? { errorCode: event.errorCode } : {}),
            eventType: event.eventType,
            idempotencyKey: event.idempotencyKey,
          });
          assert.equal(result.ok, true);
        },
      },
      auth: primary.authentication,
      getIdentity: primary.authentication.getAuthenticatedIdentity,
    },
  );
  assert.equal(changed.changed, true);
  assert.equal((await login(fixture.currentNip)).result.ok, false);
  assert.equal((await login(newNip)).result.ok, true);
  await assert.rejects(
    changeAuthenticatedNip(
      {
        application: applications.PORTAL_ESCOLAR,
        confirmation: "001122",
        correlationId: randomUUID(),
        currentNip: fixture.currentNip,
        idempotencyKey: `change:${randomUUID()}`,
        newNip: "001122",
      },
      {
        audit: { record: async () => undefined },
        auth: primary.authentication,
        getIdentity: primary.authentication.getAuthenticatedIdentity,
      },
    ),
  );
  await assert.rejects(
    changeAuthenticatedNip(
      {
        application: applications.PORTAL_ESCOLAR,
        confirmation: "001122",
        correlationId: randomUUID(),
        currentNip: newNip,
        idempotencyKey: `change:${randomUUID()}`,
        newNip: "009900",
      },
      {
        audit: { record: async () => undefined },
        auth: primary.authentication,
        getIdentity: primary.authentication.getAuthenticatedIdentity,
      },
    ),
  );

  const recoveryId = database(
    `select id from core.request_nip_recovery(
      '${fixture.accountId}', '${fixture.personId}', '${actor.accountId}',
      'recovery:${randomUUID()}', '${randomUUID()}', 'VERIFIED_INSTITUTIONAL_RECOVERY');`,
    true,
  ).trim();
  database(`
    select core.approve_nip_recovery(
      '${recoveryId}', '${actor.accountId}', 'approve:${randomUUID()}',
      statement_timestamp() + interval '15 minutes');
  `);
  const token = generateNipResetToken();
  const tokenDigest = digestNipResetToken(token, tokenSecret);
  database(`
    select core.issue_nip_reset_authorization(
      '${recoveryId}', '${actor.accountId}', 'issue:${randomUUID()}',
      '${tokenDigest}', statement_timestamp() + interval '10 minutes');
  `);
  const resetNip = `00${randomBytes(8).toString("hex")}`;
  const reset = await resetNipWithAuthorization(
    {
      confirmation: resetNip,
      idempotencyKey: `reset:${randomUUID()}`,
      newNip: resetNip,
      token,
      tokenSecret,
    },
    {
      attempts: createInMemoryAuthenticationAttemptGuard(),
      auth: {
        async revokeAllSessions() {
          return { confirmed: false };
        },
        async updatePasswordForAccount() {
          const response = await authAdmin(`/users/${fixture.authUserId}`, {
            body: JSON.stringify({ password: resetNip }),
            method: "PUT",
          });
          return { outcome: response.ok ? "SUCCESS" : "TERMINAL_FAILURE" };
        },
      },
      persistence,
    },
  );
  assert.equal(reset.reset, true);
  assert.equal(reset.sessionsRevoked, false);
  assert.equal((await login(newNip)).result.ok, false);
  assert.equal((await login(resetNip)).result.ok, true);
  await assert.rejects(
    resetNipWithAuthorization(
      {
        confirmation: "001234",
        idempotencyKey: `reset:${randomUUID()}`,
        newNip: "001234",
        token,
        tokenSecret,
      },
      {
        attempts: createInMemoryAuthenticationAttemptGuard(),
        auth: {
          revokeAllSessions: async () => ({ confirmed: false }),
          updatePasswordForAccount: async () => ({ outcome: "SUCCESS" }),
        },
        persistence,
      },
    ),
  );
  assert.deepEqual(await primary.authentication.signOutCurrentSession(), { ok: true });
  assert.ok(
    Number(
      database(
        `select count(*) from core.nip_security_events where account_id = '${fixture.accountId}';`,
        true,
      ).trim(),
    ) >= 5,
  );
  console.log(
    JSON.stringify({
      authenticatedChange: "PASS",
      authorizationSingleUse: "PASS",
      cleanup: "PENDING",
      currentNipVerification: "PASS",
      institutionalRecovery: "PASS",
      leadingZeroNip: "PASS",
      oldNipRejected: "PASS",
      reset: "PASS",
      sessionRevocation: "PARTIAL_AS_DOCUMENTED",
    }),
  );
} finally {
  try {
    database(`
      delete from core.nip_security_events where account_id = '${fixture.accountId}';
    `);
  } catch {}
  try {
    database(`
      alter table core.nip_security_events disable trigger nip_security_events_append_only;
      delete from core.nip_security_events
        where account_id in ('${fixture.accountId}', '${actor.accountId}');
      alter table core.nip_security_events enable trigger nip_security_events_append_only;
      delete from core.nip_reset_authorizations where recovery_request_id in (
        select id from core.nip_recovery_requests
        where account_id in ('${fixture.accountId}', '${actor.accountId}')
      );
      delete from core.nip_recovery_requests
        where account_id in ('${fixture.accountId}', '${actor.accountId}');
      delete from core.account_roles
        where account_id in ('${fixture.accountId}', '${actor.accountId}');
      delete from core.accounts where id in ('${fixture.accountId}', '${actor.accountId}');
      delete from core.people where id in ('${fixture.personId}', '${actor.personId}');
    `);
  } catch {}
  for (const authUserId of createdAuthUserIds) {
    try {
      await authAdmin(`/users/${authUserId}`, { method: "DELETE" });
    } catch {}
  }
  const remaining = Number(
    database(
      `select count(*) from core.accounts
        where id in ('${fixture.accountId}', '${actor.accountId}');`,
      true,
    ).trim(),
  );
  assert.equal(remaining, 0);
  console.log("PASS: limpieza total sin imprimir NIP, token, digest, alias, sesión o cookie.");
}
