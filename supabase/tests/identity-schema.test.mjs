import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { accountStatusValues, roleLabels, roleValues } from "../../packages/authz/dist/index.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../..");
const migrationsDirectory = join(repositoryRoot, "supabase", "migrations");
const configPath = join(repositoryRoot, "supabase", "config.toml");

const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

assert.equal(migrationFiles.length, 2, "Fase 2 debe contener exactamente dos migraciones SQL");

const initialMigration = await readFile(join(migrationsDirectory, migrationFiles[0]), "utf8");
const authContextMigration = await readFile(join(migrationsDirectory, migrationFiles[1]), "utf8");
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

test("las dos migraciones tienen nombres versionados y transacciones explícitas", () => {
  assert.match(migrationFiles[0], /^\d{14}_create_identity_and_roles\.sql$/);
  assert.match(migrationFiles[1], /^\d{14}_link_auth_and_identity_context\.sql$/);
  for (const migration of [initialMigration, authContextMigration]) {
    assert.match(migration, /^begin;/i);
    assert.match(migration, /commit;\s*$/i);
  }
});

test("la primera migración crea únicamente las cuatro tablas autorizadas", () => {
  assert.match(initialMigration, /create schema if not exists core;/i);
  const tables = [...initialMigration.matchAll(/create table core\.([a-z_]+)/gi)].map(
    (match) => match[1],
  );

  assert.deepEqual(tables, ["people", "accounts", "roles", "account_roles"]);
});

test("los catálogos SQL coinciden con packages/authz", () => {
  assert.deepEqual(valuesFromEnum("account_status").sort(), [...accountStatusValues].sort());
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
  assert.deepEqual(valuesFromEnum("person_status"), ["ACTIVE", "INACTIVE", "ARCHIVED"]);
});

test("la primera migración conserva integridad, triggers y RLS deny-by-default", () => {
  assert.match(initialMigration, /unique \(person_id\)/i);
  assert.match(
    initialMigration,
    /unique index accounts_auth_user_id_active_key[\s\S]*where auth_user_id is not null;/i,
  );
  assert.match(
    initialMigration,
    /unique index account_roles_active_assignment_key[\s\S]*where revoked_at is null;/i,
  );
  const foreignKeys = [
    ...initialMigration.matchAll(/foreign key \([^)]+\)[\s\S]*?on delete (\w+)/gi),
  ];
  assert.equal(foreignKeys.length, 6);
  assert.ok(foreignKeys.every((match) => match[1].toUpperCase() === "RESTRICT"));

  for (const table of ["people", "accounts", "roles", "account_roles"]) {
    assert.match(
      initialMigration,
      new RegExp(`alter table core\\.${table} enable row level security;`, "i"),
    );
  }
  assert.doesNotMatch(initialMigration, /create\s+policy/i);
});

test("la segunda migración agrega la FK Auth sin modificar auth.users", () => {
  assert.match(
    authContextMigration,
    /foreign key \(auth_user_id\)[\s\S]*references auth\.users \(id\)[\s\S]*on delete restrict;/i,
  );
  assert.doesNotMatch(authContextMigration, /insert into auth\.users/i);
  assert.doesNotMatch(authContextMigration, /create trigger[\s\S]*auth\.users/i);
  assert.doesNotMatch(authContextMigration, /create table/i);
});

test("crea cinco funciones de contexto STABLE con search_path vacío", () => {
  const expectedFunctions = [
    "current_auth_user_id",
    "current_account_id",
    "current_person_id",
    "current_account_status",
    "current_role_codes",
  ];
  const definitions = [
    ...authContextMigration.matchAll(
      /create or replace function core\.([a-z_]+)\(\)[\s\S]*?\$\$;/gi,
    ),
  ];

  assert.deepEqual(
    definitions.map((match) => match[1]),
    expectedFunctions,
  );
  for (const definition of definitions) {
    assert.match(definition[0], /\bstable\b/i);
    assert.match(definition[0], /set search_path = ''/i);
    assert.doesNotMatch(definition[0], /execute\s+format|dynamic/i);
  }
  assert.match(definitions[0][0], /security invoker/i);
  for (const definition of definitions.slice(1)) {
    assert.match(definition[0], /security definer/i);
  }
});

test("las funciones limitan columnas, estados y roles", () => {
  assert.match(authContextMigration, /select auth\.uid\(\)/i);
  assert.match(authContextMigration, /account_status <> 'DISABLED'::core\.account_status/i);
  assert.match(authContextMigration, /account_roles\.revoked_at is null/i);
  assert.match(authContextMigration, /roles\.is_active/i);
  assert.match(authContextMigration, /array_agg\(distinct roles\.code order by roles\.code\)/i);
  assert.doesNotMatch(
    authContextMigration,
    /\b(email|phone|curp|address|document_name|raw_user_meta_data)\b/i,
  );
});

test("los privilegios de contexto se limitan a authenticated", () => {
  assert.match(authContextMigration, /grant usage on schema core to authenticated;/i);
  assert.doesNotMatch(authContextMigration, /grant usage on schema core to anon/i);

  for (const functionName of [
    "current_auth_user_id",
    "current_account_id",
    "current_person_id",
    "current_account_status",
    "current_role_codes",
  ]) {
    assert.match(
      authContextMigration,
      new RegExp(
        `revoke execute on function core\\.${functionName}\\(\\) from public, anon, authenticated;`,
        "i",
      ),
    );
    assert.match(
      authContextMigration,
      new RegExp(`grant execute on function core\\.${functionName}\\(\\) to authenticated;`, "i"),
    );
  }
});

test("mantiene cero políticas funcionales y core fuera de Data API", () => {
  assert.doesNotMatch(authContextMigration, /create\s+policy/i);
  assert.match(config, /schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"core"/i);
  assert.doesNotMatch(config, /^\s*project_ref\s*=/im);
});

test("no contiene secretos, datos personales, módulos escolares ni conexión remota", () => {
  const combined = `${initialMigration}\n${authContextMigration}\n${config}`;

  assert.doesNotMatch(combined, /service_role|secret_key|supabase_secret_key|sb_secret_/i);
  assert.doesNotMatch(combined, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(
    initialMigration,
    /create table (?:core\.)?(?:students?|alumnos?|payments?|pagos?|grades?|calificaciones?|attendance|asistencia|schedules?|horarios?|groups?|grupos?|subjects?|materias?)\b/i,
  );
});
