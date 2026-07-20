import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  accountStatusValues,
  applicationRoleMap,
  applications,
  applicationValues,
  roleLabels,
  roleValues,
} from "../../packages/authz/dist/index.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../..");
const migrationsDirectory = join(repositoryRoot, "supabase", "migrations");
const configPath = join(repositoryRoot, "supabase", "config.toml");

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

assert.equal(migrationFiles.length, 8, "Fase 2 debe contener exactamente ocho migraciones SQL");

const initialMigration = await readFile(join(migrationsDirectory, migrationFiles[0]), "utf8");
const authContextMigration = await readFile(join(migrationsDirectory, migrationFiles[1]), "utf8");
const ownContextMigration = await readFile(join(migrationsDirectory, migrationFiles[2]), "utf8");
const provisioningMigration = await readFile(join(migrationsDirectory, migrationFiles[3]), "utf8");
const lifecycleMigration = await readFile(join(migrationsDirectory, migrationFiles[4]), "utf8");
const authGatewayMigration = await readFile(join(migrationsDirectory, migrationFiles[5]), "utf8");
const identifierMigration = await readFile(join(migrationsDirectory, migrationFiles[6]), "utf8");
const nipSecurityMigration = await readFile(join(migrationsDirectory, migrationFiles[7]), "utf8");
const institutionalAccessSource = await readFile(
  join(repositoryRoot, "packages", "supabase", "src", "institutional-access.ts"),
  "utf8",
);
const provisioningSource = await readFile(
  join(repositoryRoot, "packages", "supabase", "src", "provisioning.ts"),
  "utf8",
);
const lifecycleSource = await readFile(
  join(repositoryRoot, "packages", "supabase", "src", "account-lifecycle.ts"),
  "utf8",
);
const nipSecuritySource = await readFile(
  join(repositoryRoot, "packages", "supabase", "src", "nip-security.ts"),
  "utf8",
);
const config = await readFile(configPath, "utf8");

function valuesFromEnum(typeName) {
  const match = initialMigration.match(
    new RegExp(`create type core\\.${typeName} as enum \\(([\\s\\S]*?)\\);`, "i"),
  );

  assert.ok(match, `No se encontró el enum core.${typeName}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]);
}

function seededRoles() {
  const match = initialMigration.match(
    /insert into core\.roles[\s\S]*?values([\s\S]*?)on conflict \(code\) do nothing;/i,
  );

  assert.ok(match, "No se encontró la carga idempotente de roles");
  return [...match[1].matchAll(/\('([A-Z_]+)',\s*'([^']+)'/g)].map(([, code, displayName]) => ({
    code,
    displayName,
  }));
}

function rolesForApplication(application) {
  const mappings = [
    ...ownContextMigration.matchAll(
      /role_codes && array\[([\s\S]*?)\]::text\[\]\s+then '([A-Z_]+)'/gi,
    ),
  ];
  const match = mappings.find((mapping) => mapping[2] === application);

  assert.ok(match, `No se encontró el mapeo SQL para ${application}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]);
}

test("las ocho migraciones tienen nombres versionados y transacciones explícitas", () => {
  assert.match(migrationFiles[0], /^\d{14}_create_identity_and_roles\.sql$/);
  assert.match(migrationFiles[1], /^\d{14}_link_auth_and_identity_context\.sql$/);
  assert.match(migrationFiles[2], /^\d{14}_add_own_identity_context_access\.sql$/);
  assert.match(migrationFiles[3], /^\d{14}_add_identity_provisioning_saga\.sql$/);
  assert.match(migrationFiles[4], /^\d{14}_add_account_lifecycle_control\.sql$/);
  assert.match(migrationFiles[5], /^\d{14}_expose_authenticated_identity_context_rpc\.sql$/);
  assert.match(migrationFiles[6], /^\d{14}_add_institutional_identifier_access\.sql$/);
  assert.match(migrationFiles[7], /^\d{14}_add_nip_security_recovery\.sql$/);
  for (const migration of [
    initialMigration,
    authContextMigration,
    ownContextMigration,
    provisioningMigration,
    lifecycleMigration,
    authGatewayMigration,
    identifierMigration,
    nipSecurityMigration,
  ]) {
    assert.match(migration, /^begin;/i);
    assert.match(migration, /commit;\s*$/i);
  }
});

test("catálogos SQL y TypeScript de seguridad NIP permanecen sincronizados", () => {
  const mappings = [
    ["nip_recovery_status", "nipRecoveryStatuses"],
    ["nip_security_event_type", "nipSecurityEventTypes"],
    ["nip_security_reason_code", "nipSecurityReasonCodes"],
    ["nip_security_error_code", "nipSecurityErrorCodes"],
  ];
  for (const [sqlName, tsName] of mappings) {
    const sql = nipSecurityMigration.match(
      new RegExp(`create type core\\.${sqlName} as enum \\(([\\s\\S]*?)\\);`, "i"),
    );
    const ts = nipSecuritySource.match(
      new RegExp(`${tsName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\)`),
    );
    assert.ok(sql, `Falta ${sqlName}`);
    assert.ok(ts, `Falta ${tsName}`);
    assert.deepEqual(
      [...sql[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]),
      [...ts[1].matchAll(/"([A-Z_]+)"/g)].map((value) => value[1]),
    );
  }
  assert.doesNotMatch(nipSecurityMigration, /(insert|update|delete)[\s\S]*auth\.users/i);
  assert.doesNotMatch(nipSecurityMigration, /create\s+trigger[\s\S]*on\s+auth\.users/i);
});

test("catálogo y normalización institucional permanecen sincronizados", () => {
  const sqlEnum = identifierMigration.match(
    /create type core\.institutional_identifier_type as enum \(([\s\S]*?)\);/i,
  );
  const tsCatalog = institutionalAccessSource.match(
    /institutionalIdentifierTypes = Object\.freeze\(\[([\s\S]*?)\] as const\)/,
  );
  assert.ok(sqlEnum);
  assert.ok(tsCatalog);
  assert.deepEqual(
    [...sqlEnum[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]),
    [...tsCatalog[1].matchAll(/"([A-Z_]+)"/g)].map((value) => value[1]),
  );
  assert.match(identifierMigration, /\^\[A-Z0-9\]\[A-Z0-9-\]\{2,30\}\[A-Z0-9\]\$/);
  assert.match(institutionalAccessSource, /\^\[A-Z0-9\]\[A-Z0-9-\]\{2,30\}\[A-Z0-9\]\$/);
  assert.doesNotMatch(identifierMigration, /(insert|update|delete)[\s\S]*auth\.users/i);
  assert.doesNotMatch(identifierMigration, /create\s+trigger[\s\S]*on\s+auth\.users/i);
  assert.doesNotMatch(identifierMigration, /create\s+function\s+public\./i);
});

function valuesFromProvisioningEnum(typeName) {
  const match = provisioningMigration.match(
    new RegExp(`create type core\\.${typeName} as enum \\(([\\s\\S]*?)\\);`, "i"),
  );
  assert.ok(match, `No se encontró el enum core.${typeName}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]);
}

function valuesFromLifecycleEnum(typeName) {
  const match = lifecycleMigration.match(
    new RegExp(`create type core\\.${typeName} as enum \\(([\\s\\S]*?)\\);`, "i"),
  );
  assert.ok(match, `No se encontró el enum core.${typeName}`);
  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]);
}

function lifecycleArray(constantName) {
  const match = lifecycleSource.match(
    new RegExp(`${constantName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\)`),
  );
  assert.ok(match, `No se encontró ${constantName}`);
  return [...match[1].matchAll(/"([A-Z_]+)"/g)].map((value) => value[1]);
}

test("catálogos SQL y TypeScript de ciclo de vida permanecen sincronizados", () => {
  assert.deepEqual(
    valuesFromLifecycleEnum("account_lifecycle_event_type"),
    lifecycleArray("accountLifecycleEventTypes"),
  );
  assert.deepEqual(
    valuesFromLifecycleEnum("account_lifecycle_reason_code"),
    lifecycleArray("accountLifecycleReasonCodes"),
  );
  assert.deepEqual(
    valuesFromLifecycleEnum("account_lifecycle_error_code"),
    lifecycleArray("accountLifecycleErrorCodes"),
  );
  assert.deepEqual(valuesFromEnum("account_status").sort(), [...accountStatusValues].sort());
});

function valuesFromReadonlyArray(constantName) {
  const match = provisioningSource.match(
    new RegExp(`${constantName} = Object\\.freeze\\(\\[([\\s\\S]*?)\\] as const\\)`),
  );
  assert.ok(match, `No se encontró ${constantName}`);
  return [...match[1].matchAll(/"([A-Z_]+)"/g)].map((value) => value[1]);
}

test("catálogos SQL y TypeScript de aprovisionamiento permanecen sincronizados", () => {
  assert.deepEqual(
    valuesFromProvisioningEnum("identity_provisioning_stage"),
    valuesFromReadonlyArray("provisioningStages"),
  );
  assert.deepEqual(
    valuesFromProvisioningEnum("identity_provisioning_delivery_mode"),
    valuesFromReadonlyArray("provisioningDeliveryModes"),
  );
  const errorObject = provisioningSource.match(
    /provisioningErrorCodes = Object\.freeze\(\{([\s\S]*?)\} as const\)/,
  );
  assert.ok(errorObject, "No se encontró provisioningErrorCodes");
  assert.deepEqual(
    valuesFromProvisioningEnum("identity_provisioning_error_code"),
    [...errorObject[1].matchAll(/:\s*"([A-Z_]+)"/g)].map((value) => value[1]),
  );
});

test("la saga crea exactamente sus tres tablas y evita Auth SQL productivo", () => {
  assert.deepEqual(
    [...provisioningMigration.matchAll(/create table core\.([a-z_]+)/gi)].map((match) => match[1]),
    [
      "identity_provisioning_requests",
      "identity_provisioning_requested_roles",
      "identity_provisioning_events",
    ],
  );
  assert.doesNotMatch(
    provisioningMigration,
    /(insert|update|delete)\s+(into|from)?\s*auth\.users/i,
  );
  assert.doesNotMatch(provisioningMigration, /create\s+trigger[\s\S]*on\s+auth\.users/i);
});

test("las migraciones previas conservan tablas, catálogos, FK y funciones", () => {
  const tables = [...initialMigration.matchAll(/create table core\.([a-z_]+)/gi)].map(
    (match) => match[1],
  );
  assert.deepEqual(tables, ["people", "accounts", "roles", "account_roles"]);
  assert.deepEqual(valuesFromEnum("account_status").sort(), [...accountStatusValues].sort());
  assert.deepEqual(valuesFromEnum("person_status"), ["ACTIVE", "INACTIVE", "ARCHIVED"]);
  assert.deepEqual(
    seededRoles()
      .map(({ code }) => code)
      .sort(),
    [...roleValues].sort(),
  );
  assert.deepEqual(
    Object.fromEntries(seededRoles().map(({ code, displayName }) => [code, displayName])),
    roleLabels,
  );
  assert.match(
    authContextMigration,
    /foreign key \(auth_user_id\)[\s\S]*references auth\.users \(id\)[\s\S]*on delete restrict;/i,
  );
  assert.equal(
    [
      ...authContextMigration.matchAll(
        /create or replace function core\.([a-z_]+)\(\)[\s\S]*?\$\$;/gi,
      ),
    ].length,
    5,
  );
});

test("la tercera migración crea una función de retorno mínimo", () => {
  assert.match(
    ownContextMigration,
    /create or replace function core\.get_current_identity_context\(\)/i,
  );
  for (const field of [
    "auth_user_id uuid",
    "account_id uuid",
    "person_id uuid",
    "account_status core.account_status",
    "role_codes text[]",
    "allowed_applications text[]",
  ]) {
    assert.match(ownContextMigration, new RegExp(field.replace("[]", String.raw`\[\]`), "i"));
  }
  assert.match(ownContextMigration, /\bstable\b/i);
  assert.match(ownContextMigration, /security definer/i);
  assert.match(ownContextMigration, /set search_path = ''/i);
  assert.doesNotMatch(ownContextMigration, /execute\s+format|dynamic/i);
});

test("el comportamiento SQL por estado es explícito", () => {
  assert.match(
    ownContextMigration,
    /when identity\.account_status = 'ACTIVE'::core\.account_status[\s\S]*then core\.current_role_codes\(\)[\s\S]*else array\[\]::text\[\]/i,
  );
  assert.match(
    ownContextMigration,
    /when effective_roles\.account_status <> 'ACTIVE'::core\.account_status[\s\S]*then array\[\]::text\[\]/i,
  );
  assert.doesNotMatch(ownContextMigration, /user_metadata|raw_user_meta_data/i);
});

test("roles, aplicaciones y reglas SQL coinciden con packages/authz", () => {
  assert.deepEqual(applicationValues, [
    applications.PORTAL_ESCOLAR,
    applications.SISTEMA_ADMINISTRATIVO,
  ]);
  for (const application of applicationValues) {
    assert.deepEqual(rolesForApplication(application), applicationRoleMap[application]);
  }
  assert.deepEqual(valuesFromEnum("account_status").sort(), [...accountStatusValues].sort());
});

test("crea exactamente cuatro políticas SELECT propias", () => {
  const policies = [
    ...ownContextMigration.matchAll(
      /create policy ([a-z_]+)[\s\S]*?on core\.([a-z_]+)[\s\S]*?for (select|insert|update|delete)[\s\S]*?to authenticated[\s\S]*?using \(([\s\S]*?)\);/gi,
    ),
  ];

  assert.deepEqual(
    policies.map((match) => [match[1], match[2], match[3].toUpperCase()]),
    [
      ["accounts_select_own_active_context", "accounts", "SELECT"],
      ["people_select_own_active_context", "people", "SELECT"],
      ["account_roles_select_own_active_context", "account_roles", "SELECT"],
      ["roles_select_own_active_context", "roles", "SELECT"],
    ],
  );
  assert.doesNotMatch(ownContextMigration, /for\s+(insert|update|delete)/i);
  assert.doesNotMatch(ownContextMigration, /with\s+check/i);
});

test("no concede acceso directo a tablas y limita EXECUTE", () => {
  assert.match(
    ownContextMigration,
    /revoke execute on function core\.get_current_identity_context\(\)[\s\S]*from public, anon, authenticated;/i,
  );
  assert.match(
    ownContextMigration,
    /grant execute on function core\.get_current_identity_context\(\)[\s\S]*to authenticated;/i,
  );
  assert.doesNotMatch(
    ownContextMigration,
    /grant\s+(select|insert|update|delete|all)\s+on\s+(?:table\s+)?core\./i,
  );
  assert.doesNotMatch(ownContextMigration, /grant execute[\s\S]*to anon/i);
});

test("mantiene core fuera de Data API y no contiene datos prohibidos", () => {
  const combined = `${initialMigration}\n${authContextMigration}\n${ownContextMigration}\n${provisioningMigration}\n${lifecycleMigration}\n${authGatewayMigration}\n${config}`;

  assert.match(config, /schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"core"/i);
  assert.doesNotMatch(config, /^\s*project_ref\s*=/im);
  assert.doesNotMatch(combined, /service_role|secret_key|supabase_secret_key|sb_secret_/i);
  assert.doesNotMatch(combined, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(
    ownContextMigration,
    /\b(email|name|curp|phone|address|document|assigned_by|revoked_by|reason)\b/i,
  );
});
