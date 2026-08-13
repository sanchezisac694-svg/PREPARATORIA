import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deriveInstitutionalAuthAlias } from "../packages/supabase/dist/institutional-access.js";

/**
 * DEVELOPMENT ONLY.
 * NO USAR EN STAGING NI PRODUCCIÓN.
 *
 * Esta utilidad existe exclusivamente para reconciliar un usuario demo local
 * contra Supabase local en localhost/127.0.0.1:54321.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const adminEnvPath = path.join(repoRoot, "apps", "sistema-administrativo", ".env.local");
const adminDevelopmentEnvPath = path.join(
  repoRoot,
  "apps",
  "sistema-administrativo",
  ".env.development.local",
);
const rootEnvPath = path.join(repoRoot, ".env.local");

const DEMO_IDENTIFIER = "DEMO-ADMIN";
const DEMO_IDENTIFIER_TYPE = "ADMINISTRATIVE_ID";
const DEMO_NIP = "DemoAdmin2026!";
const DEMO_ROLE = "SUPERADMIN";
const LOCAL_DB_CONTAINER =
  process.env.LOCAL_SUPABASE_DB_CONTAINER ?? "supabase_db_sistema-preparatoria-local";

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, "utf8");
  const entries = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function resolveEnvValue(key) {
  if (typeof process.env[key] === "string" && process.env[key].length > 0) {
    return process.env[key];
  }

  const adminEnv = readEnvFile(adminEnvPath);
  if (typeof adminEnv[key] === "string" && adminEnv[key].length > 0) {
    return adminEnv[key];
  }

  const adminDevelopmentEnv = readEnvFile(adminDevelopmentEnvPath);
  if (typeof adminDevelopmentEnv[key] === "string" && adminDevelopmentEnv[key].length > 0) {
    return adminDevelopmentEnv[key];
  }

  const rootEnv = readEnvFile(rootEnvPath);
  if (typeof rootEnv[key] === "string" && rootEnv[key].length > 0) {
    return rootEnv[key];
  }

  return null;
}

function requireLocalSupabaseUrl(value) {
  if (!value) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_URL en process.env, apps/sistema-administrativo/.env.local o .env.local.",
    );
  }

  const url = new URL(value);
  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLoopback || url.port !== "54321") {
    throw new Error(
      "La utilidad solo puede ejecutarse contra Supabase local en localhost/127.0.0.1:54321.",
    );
  }

  return url.toString().replace(/\/$/u, "");
}

function requireNonEmptyEnv(key) {
  const value = resolveEnvValue(key);
  if (!value) {
    throw new Error(`Falta ${key}.`);
  }
  return value;
}

function requireServiceKey() {
  const value = process.env.LOCAL_SUPABASE_SERVICE_KEY;
  if (!value) {
    throw new Error("Falta LOCAL_SUPABASE_SERVICE_KEY en el entorno temporal de la sesión actual.");
  }
  return value;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function database(sql, capture = false) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      LOCAL_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
      ...(capture ? ["-At"] : []),
      "-c",
      sql,
    ],
    {
      encoding: capture ? "utf8" : undefined,
      stdio: capture ? "pipe" : "ignore",
    },
  );
}

async function authAdminRequest(apiUrl, serviceKey, pathname, init = {}) {
  const response = await fetch(`${apiUrl}/auth/v1/admin${pathname}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      `La API Admin local devolvió ${response.status} ${response.statusText}${
        message ? ` (${message.slice(0, 300)})` : ""
      }.`,
    );
  }

  return response;
}

function findExistingAuthUserIdByEmail(email) {
  const rows = database(
    `
      select id::text
      from auth.users
      where email = ${sqlLiteral(email)}
      order by created_at asc;
    `,
    true,
  )
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean);

  if (rows.length > 1) {
    throw new Error(
      "Existe más de un usuario Auth local con el alias institucional demo; se requiere limpieza manual.",
    );
  }

  return rows[0] ?? null;
}

async function createOrUpdateDemoAuthUser(apiUrl, serviceKey, aliasEmail) {
  const existingAuthUserId = findExistingAuthUserIdByEmail(aliasEmail);

  if (existingAuthUserId) {
    await authAdminRequest(apiUrl, serviceKey, `/users/${existingAuthUserId}`, {
      body: JSON.stringify({
        email: aliasEmail,
        email_confirm: true,
        password: DEMO_NIP,
      }),
      method: "PUT",
    });
    return { authUserId: existingAuthUserId, created: false };
  }

  const response = await authAdminRequest(apiUrl, serviceKey, "/users", {
    body: JSON.stringify({
      email: aliasEmail,
      email_confirm: true,
      password: DEMO_NIP,
    }),
    method: "POST",
  });
  const payload = await response.json();
  assert.equal(typeof payload?.id, "string", "La creación local debe devolver un auth user id.");
  return { authUserId: payload.id, created: true };
}

function reconcileLocalDemoIdentity(authUserId) {
  const existingByIdentifier = database(
    `
      select id
      from core.accounts
      where institutional_identifier_type = ${sqlLiteral(DEMO_IDENTIFIER_TYPE)}::core.institutional_identifier_type
        and institutional_identifier = ${sqlLiteral(DEMO_IDENTIFIER)}
      limit 1;
    `,
    true,
  ).trim();

  const existingByAuthUser = database(
    `
      select id
      from core.accounts
      where auth_user_id = ${sqlLiteral(authUserId)}::uuid
      limit 1;
    `,
    true,
  ).trim();

  if (
    existingByIdentifier.length > 0 &&
    existingByAuthUser.length > 0 &&
    existingByIdentifier !== existingByAuthUser
  ) {
    throw new Error(
      "Conflicto local: el identificador DEMO-ADMIN y el auth user local apuntan a cuentas distintas.",
    );
  }

  let targetAccountId = existingByIdentifier || existingByAuthUser;
  let targetPersonId = "";
  let accountDisposition = "reused";

  if (!targetAccountId) {
    targetPersonId = database(
      `
        insert into core.people (id)
        values (gen_random_uuid())
        returning id::text;
      `,
      true,
    ).trim();

    targetAccountId = database(
      `
        insert into core.accounts (
          person_id,
          auth_user_id,
          account_status,
          activated_at,
          status_changed_at,
          institutional_identifier_type,
          institutional_identifier,
          identifier_assigned_at,
          identifier_changed_at
        )
        values (
          ${sqlLiteral(targetPersonId)}::uuid,
          ${sqlLiteral(authUserId)}::uuid,
          'ACTIVE'::core.account_status,
          now(),
          now(),
          ${sqlLiteral(DEMO_IDENTIFIER_TYPE)}::core.institutional_identifier_type,
          ${sqlLiteral(DEMO_IDENTIFIER)},
          now(),
          now()
        )
        returning id::text;
      `,
      true,
    ).trim();

    accountDisposition = "created";
  } else {
    targetPersonId = database(
      `
        select person_id::text
        from core.accounts
        where id = ${sqlLiteral(targetAccountId)}::uuid;
      `,
      true,
    ).trim();

    database(
      `
        update core.accounts
        set
          auth_user_id = ${sqlLiteral(authUserId)}::uuid,
          account_status = 'ACTIVE'::core.account_status,
          activated_at = coalesce(activated_at, now()),
          suspended_at = null,
          blocked_at = null,
          disabled_at = null,
          status_changed_at = case
            when account_status = 'ACTIVE'::core.account_status then status_changed_at
            else now()
          end,
          institutional_identifier_type = ${sqlLiteral(DEMO_IDENTIFIER_TYPE)}::core.institutional_identifier_type,
          institutional_identifier = ${sqlLiteral(DEMO_IDENTIFIER)},
          identifier_assigned_at = coalesce(identifier_assigned_at, now()),
          identifier_changed_at = now()
        where id = ${sqlLiteral(targetAccountId)}::uuid;
      `,
    );
  }

  const hasActiveRole = database(
    `
      select count(*)
      from core.account_roles account_roles
      join core.roles roles on roles.id = account_roles.role_id
      where account_roles.account_id = ${sqlLiteral(targetAccountId)}::uuid
        and account_roles.revoked_at is null
        and roles.code = ${sqlLiteral(DEMO_ROLE)};
    `,
    true,
  ).trim();

  let roleDisposition = "role-present";
  if (hasActiveRole !== "1") {
    database(
      `
        insert into core.account_roles (account_id, role_id, reason)
        select
          ${sqlLiteral(targetAccountId)}::uuid,
          roles.id,
          'Local demo admin setup'
        from core.roles roles
        where roles.code = ${sqlLiteral(DEMO_ROLE)};
      `,
    );
    roleDisposition = "role-added";
  }

  const superadminRoleExists = database(
    `
      select count(*)
      from core.account_roles account_roles
      join core.roles roles on roles.id = account_roles.role_id
      where account_roles.account_id = ${sqlLiteral(targetAccountId)}::uuid
        and account_roles.revoked_at is null
        and roles.code = ${sqlLiteral(DEMO_ROLE)};
    `,
    true,
  ).trim();

  if (superadminRoleExists !== "1") {
    throw new Error("No fue posible reconciliar la identidad institucional demo local.");
  }

  return {
    accountDisposition,
    accountId: targetAccountId,
    personId: targetPersonId,
    roleDisposition,
  };
}

function verifyLocalDemoIdentity(authUserId) {
  const row = database(
    `
      select
        accounts.account_status::text || '|' ||
        coalesce(accounts.institutional_identifier_type::text, '') || '|' ||
        coalesce(accounts.institutional_identifier, '') || '|' ||
        roles.code
      from core.accounts accounts
      join core.account_roles account_roles
        on account_roles.account_id = accounts.id
       and account_roles.revoked_at is null
      join core.roles roles
        on roles.id = account_roles.role_id
      where accounts.auth_user_id = ${sqlLiteral(authUserId)}::uuid
        and roles.code = ${sqlLiteral(DEMO_ROLE)}
      limit 1;
    `,
    true,
  ).trim();

  if (!row) {
    throw new Error("La verificación local no encontró la cuenta demo con rol SUPERADMIN activo.");
  }

  const [status, identifierType, identifier, role] = row.split("|");
  assert.equal(status, "ACTIVE");
  assert.equal(identifierType, DEMO_IDENTIFIER_TYPE);
  assert.equal(identifier, DEMO_IDENTIFIER);
  assert.equal(role, DEMO_ROLE);
}

async function main() {
  const apiUrl = requireLocalSupabaseUrl(requireNonEmptyEnv("NEXT_PUBLIC_SUPABASE_URL"));
  const aliasDomain = requireNonEmptyEnv("INSTITUTIONAL_AUTH_ALIAS_DOMAIN");
  const serviceKey = requireServiceKey();

  const alias = deriveInstitutionalAuthAlias({
    domain: aliasDomain,
    identifierType: DEMO_IDENTIFIER_TYPE,
    normalizedIdentifier: DEMO_IDENTIFIER,
  });

  const authResult = await createOrUpdateDemoAuthUser(apiUrl, serviceKey, alias);
  reconcileLocalDemoIdentity(authResult.authUserId);
  verifyLocalDemoIdentity(authResult.authUserId);

  console.log("Usuario demo local listo.");
  console.log(`Identificador: ${DEMO_IDENTIFIER}`);
  console.log(`Tipo: ${DEMO_IDENTIFIER_TYPE}`);
  console.log(`Rol: ${DEMO_ROLE}`);
  console.log(`NIP local: ${DEMO_NIP}`);
}

await main();
