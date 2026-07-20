import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";

import { applications } from "../../packages/authz/dist/index.js";
import { createAuthenticationService } from "../../packages/supabase/dist/auth-session.js";
import {
  createInMemoryAuthenticationAttemptGuard,
  deriveInstitutionalAuthAlias,
  signInAsApplicant,
  signInWithInstitutionalCredentials,
} from "../../packages/supabase/dist/institutional-access.js";

const apiUrl = process.env.LOCAL_SUPABASE_URL;
const publishableKey = process.env.LOCAL_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const databaseContainer = process.env.LOCAL_SUPABASE_DB_CONTAINER;
const aliasDomain = "identidad.sistema-preparatoria.invalid";
const attemptSalt = "synthetic-local-attempt-salt-with-at-least-32-characters";

if (!apiUrl || !publishableKey || !serviceKey || !databaseContainer) {
  throw new Error("Falta configuración sintética local para la prueba.");
}
const parsedApiUrl = new URL(apiUrl);
if (parsedApiUrl.hostname !== "localhost" || parsedApiUrl.port !== "54321") {
  throw new Error("La prueba solo admite Supabase local en localhost:54321.");
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
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  });
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

const fixtures = [
  {
    applications: [applications.PORTAL_ESCOLAR],
    identifierType: "NUMERO_CONTROL",
    key: "student",
    nip: `${"0".repeat(3)}${randomBytes(8).toString("hex")}`,
    roles: ["ALUMNO"],
    status: "ACTIVE",
  },
  {
    applications: [applications.PORTAL_ESCOLAR],
    identifierType: "EMPLOYEE_ID",
    key: "teacher",
    nip: randomBytes(12).toString("base64url"),
    roles: ["DOCENTE"],
    status: "ACTIVE",
  },
  {
    applications: [applications.SISTEMA_ADMINISTRATIVO],
    identifierType: "ADMINISTRATIVE_ID",
    key: "administrative",
    nip: randomBytes(12).toString("base64url"),
    roles: ["ADMINISTRATIVO"],
    status: "ACTIVE",
  },
  {
    applications: [applications.PORTAL_ESCOLAR, applications.SISTEMA_ADMINISTRATIVO],
    identifierType: "EMPLOYEE_ID",
    key: "dual",
    nip: randomBytes(12).toString("base64url"),
    roles: ["DOCENTE", "ADMINISTRATIVO"],
    status: "ACTIVE",
  },
  {
    applications: [],
    identifierType: "EMPLOYEE_ID",
    key: "suspended",
    nip: randomBytes(12).toString("base64url"),
    roles: ["DOCENTE"],
    status: "SUSPENDED",
  },
  {
    applications: [],
    identifierType: "ADMINISTRATIVE_ID",
    key: "blocked",
    nip: randomBytes(12).toString("base64url"),
    roles: ["CONTROL_ESCOLAR"],
    status: "BLOCKED",
  },
  {
    applications: [],
    identifierType: "NUMERO_CONTROL",
    key: "disabled",
    nip: randomBytes(12).toString("base64url"),
    roles: ["ALUMNO"],
    status: "DISABLED",
  },
].map((fixture, index) => ({
  ...fixture,
  accountId: randomUUID(),
  authUserId: null,
  identifier: `LOCAL-${String(index + 1).padStart(4, "0")}`,
  personId: randomUUID(),
}));

const applicant = {
  accountId: randomUUID(),
  authUserId: null,
  email: `applicant-${randomUUID()}@example.invalid`,
  password: randomBytes(12).toString("base64url"),
  personId: randomUUID(),
};

const createdAuthUserIds = [];
const attempts = createInMemoryAuthenticationAttemptGuard();

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

function statusColumns(status) {
  if (status === "SUSPENDED") return ", suspended_at";
  if (status === "BLOCKED") return ", blocked_at";
  if (status === "DISABLED") return ", disabled_at";
  return "";
}

function statusValues(status) {
  return status === "ACTIVE" ? "" : ", now()";
}

async function institutionalLogin(
  fixture,
  application,
  identifier = fixture.identifier,
  nip = fixture.nip,
) {
  return signInWithInstitutionalCredentials(
    {
      aliasDomain,
      application,
      attemptSalt,
      identifier,
      identifierType: fixture.identifierType,
      ipAddress: "127.0.0.1",
      nip,
    },
    {
      attempts,
      authentication: createSessionAuthentication(),
    },
  );
}

try {
  for (const fixture of fixtures) {
    const alias = deriveInstitutionalAuthAlias({
      domain: aliasDomain,
      identifierType: fixture.identifierType,
      normalizedIdentifier: fixture.identifier,
    });
    fixture.authUserId = await createAuthUser(alias, fixture.nip);
    database(`
      insert into core.people (id) values ('${fixture.personId}');
      insert into core.accounts (
        id, person_id, auth_user_id, account_status,
        institutional_identifier_type, institutional_identifier,
        identifier_assigned_at, identifier_changed_at${statusColumns(fixture.status)}
      ) values (
        '${fixture.accountId}', '${fixture.personId}', '${fixture.authUserId}', '${fixture.status}',
        '${fixture.identifierType}', '${fixture.identifier}', now(), now()${statusValues(fixture.status)}
      );
      insert into core.account_roles (account_id, role_id)
      select '${fixture.accountId}', id from core.roles
      where code = any (array[${fixture.roles.map((role) => `'${role}'`).join(",")}]);
    `);
  }

  applicant.authUserId = await createAuthUser(applicant.email, applicant.password);
  database(`
    insert into core.people (id) values ('${applicant.personId}');
    insert into core.accounts (id, person_id, auth_user_id, account_status)
    values ('${applicant.accountId}', '${applicant.personId}', '${applicant.authUserId}', 'ACTIVE');
    insert into core.account_roles (account_id, role_id)
    select '${applicant.accountId}', id from core.roles where code = 'ASPIRANTE';
  `);

  const student = fixtures.find((fixture) => fixture.key === "student");
  const teacher = fixtures.find((fixture) => fixture.key === "teacher");
  const administrative = fixtures.find((fixture) => fixture.key === "administrative");
  const dual = fixtures.find((fixture) => fixture.key === "dual");
  const suspended = fixtures.find((fixture) => fixture.key === "suspended");
  const blocked = fixtures.find((fixture) => fixture.key === "blocked");
  const disabled = fixtures.find((fixture) => fixture.key === "disabled");

  assert.equal((await institutionalLogin(student, applications.PORTAL_ESCOLAR)).ok, true);
  assert.deepEqual(await institutionalLogin(student, applications.SISTEMA_ADMINISTRATIVO), {
    error: "APPLICATION_NOT_ALLOWED",
    ok: false,
  });
  assert.equal((await institutionalLogin(teacher, applications.PORTAL_ESCOLAR)).ok, true);
  assert.equal(
    (await institutionalLogin(administrative, applications.SISTEMA_ADMINISTRATIVO)).ok,
    true,
  );
  assert.deepEqual(await institutionalLogin(administrative, applications.PORTAL_ESCOLAR), {
    error: "APPLICATION_NOT_ALLOWED",
    ok: false,
  });
  assert.equal((await institutionalLogin(dual, applications.PORTAL_ESCOLAR)).ok, true);
  assert.equal((await institutionalLogin(dual, applications.SISTEMA_ADMINISTRATIVO)).ok, true);

  assert.equal(
    (
      await signInAsApplicant(
        {
          application: applications.PORTAL_ESCOLAR,
          email: applicant.email,
          password: applicant.password,
        },
        createSessionAuthentication(),
      )
    ).ok,
    true,
  );

  assert.equal(
    (
      await institutionalLogin(
        { ...student, identifier: "LOCAL-9999" },
        applications.PORTAL_ESCOLAR,
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await institutionalLogin(
        student,
        applications.PORTAL_ESCOLAR,
        student.identifier,
        "wrong-value",
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await institutionalLogin(
        student,
        applications.PORTAL_ESCOLAR,
        student.identifier.toLowerCase(),
      )
    ).ok,
    true,
  );
  assert.equal(
    (await institutionalLogin(student, applications.PORTAL_ESCOLAR, `  ${student.identifier}  `))
      .ok,
    true,
  );
  assert.deepEqual(
    await institutionalLogin(student, applications.PORTAL_ESCOLAR, "INVALID IDENTIFIER"),
    { error: "INVALID_IDENTIFIER_FORMAT", ok: false },
  );
  for (const fixture of [suspended, blocked, disabled]) {
    assert.deepEqual(await institutionalLogin(fixture, applications.PORTAL_ESCOLAR), {
      error: "ACCOUNT_NOT_ACTIVE",
      ok: false,
    });
  }

  const unknown = { ...student, identifier: "LOCAL-8888" };
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal((await institutionalLogin(unknown, applications.PORTAL_ESCOLAR)).ok, false);
  }
  assert.deepEqual(await institutionalLogin(unknown, applications.PORTAL_ESCOLAR), {
    error: "TOO_MANY_ATTEMPTS",
    ok: false,
  });

  const sessionAuthentication = createSessionAuthentication();
  const sessionLogin = await signInWithInstitutionalCredentials(
    {
      aliasDomain,
      application: applications.PORTAL_ESCOLAR,
      attemptSalt,
      identifier: student.identifier,
      identifierType: student.identifierType,
      ipAddress: "127.0.0.2",
      nip: student.nip,
    },
    { attempts, authentication: sessionAuthentication },
  );
  assert.equal(sessionLogin.ok, true);
  assert.deepEqual(await sessionAuthentication.refreshSession(), { authenticated: true });
  assert.deepEqual(await sessionAuthentication.signOutCurrentSession(), { ok: true });
  assert.deepEqual(await sessionAuthentication.getAuthenticatedIdentity(), {
    error: "SESSION_EXPIRED",
    ok: false,
  });

  console.log(
    JSON.stringify(
      {
        applicantLogin: "PASS",
        applicationAccess: "PASS",
        blockedStates: "PASS",
        cleanup: "PENDING",
        enumerationResistance: "PASS",
        identifierNormalization: "PASS",
        institutionalLogin: "PASS",
        leadingZeroNip: "PASS",
        logout: "PASS",
        refresh: "PASS",
        repeatedAttempts: "PASS",
      },
      null,
      2,
    ),
  );
} finally {
  const accountIds = [...fixtures.map((fixture) => fixture.accountId), applicant.accountId];
  const personIds = [...fixtures.map((fixture) => fixture.personId), applicant.personId];
  try {
    database(`
      delete from core.account_roles where account_id = any (array[
        ${accountIds.map((id) => `'${id}'::uuid`).join(",")}
      ]);
      delete from core.accounts where id = any (array[
        ${accountIds.map((id) => `'${id}'::uuid`).join(",")}
      ]);
      delete from core.people where id = any (array[
        ${personIds.map((id) => `'${id}'::uuid`).join(",")}
      ]);
    `);
  } catch {}
  for (const authUserId of createdAuthUserIds) {
    try {
      await authAdmin(`/users/${authUserId}`, { method: "DELETE" });
    } catch {}
  }
  const remaining = Number(
    database(
      `select count(*) from core.accounts where id = any (array[
        ${accountIds.map((id) => `'${id}'::uuid`).join(",")}
      ]);`,
      true,
    ).trim(),
  );
  assert.equal(remaining, 0, "Todos los fixtures institucionales deben eliminarse.");
  console.log("PASS: limpieza total; no se imprimieron credenciales, alias, tokens ni cookies.");
}
