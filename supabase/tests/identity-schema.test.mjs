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

const migrationFiles = (await readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql"));

assert.equal(migrationFiles.length, 1, "Bloque 3 debe contener exactamente una migración SQL");

const migrationPath = join(migrationsDirectory, migrationFiles[0]);
const migration = await readFile(migrationPath, "utf8");
const config = await readFile(configPath, "utf8");

function valuesFromEnum(typeName) {
  const expression = new RegExp(`create type core\\.${typeName} as enum \\(([\\s\\S]*?)\\);`, "i");
  const match = migration.match(expression);

  assert.ok(match, `No se encontró el enum core.${typeName}`);

  return [...match[1].matchAll(/'([A-Z_]+)'/g)].map((value) => value[1]);
}

function seededRoles() {
  const match = migration.match(
    /insert into core\.roles[\s\S]*?values([\s\S]*?)on conflict \(code\) do nothing;/i,
  );

  assert.ok(match, "No se encontró la carga idempotente de roles");

  return [...match[1].matchAll(/\('([A-Z_]+)',\s*'([^']+)'/g)].map(([, code, displayName]) => ({
    code,
    displayName,
  }));
}

test("la migración tiene nombre versionado y transacción explícita", () => {
  assert.match(migrationFiles[0], /^\d{14}_create_identity_and_roles\.sql$/);
  assert.match(migration, /^begin;/i);
  assert.match(migration, /commit;\s*$/i);
});

test("crea únicamente el esquema y las cuatro tablas autorizadas", () => {
  assert.match(migration, /create schema if not exists core;/i);
  const tables = [...migration.matchAll(/create table core\.([a-z_]+)/gi)].map((match) => match[1]);

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
  assert.match(migration, /constraint roles_code_allowed check/i);
  assert.match(migration, /constraint roles_must_be_system check \(is_system\)/i);
});

test("el estado de persona es exacto y cerrado", () => {
  assert.deepEqual(valuesFromEnum("person_status"), ["ACTIVE", "INACTIVE", "ARCHIVED"]);
});

test("aplica claves, unicidad parcial e historial de asignaciones", () => {
  assert.match(migration, /primary key default gen_random_uuid\(\)/i);
  assert.match(migration, /unique \(person_id\)/i);
  assert.match(
    migration,
    /unique index accounts_auth_user_id_active_key[\s\S]*where auth_user_id is not null;/i,
  );
  assert.match(
    migration,
    /unique index account_roles_active_assignment_key[\s\S]*where revoked_at is null;/i,
  );
  assert.match(migration, /revoked_at timestamptz/i);
  assert.match(migration, /reason text/i);
});

test("todas las relaciones persistentes usan ON DELETE RESTRICT", () => {
  const foreignKeys = [...migration.matchAll(/foreign key \([^)]+\)[\s\S]*?on delete (\w+)/gi)];

  assert.equal(foreignKeys.length, 6);
  assert.ok(foreignKeys.every((match) => match[1].toUpperCase() === "RESTRICT"));
  assert.doesNotMatch(migration, /on delete cascade/i);
});

test("los triggers técnicos tienen search_path fijo y no son SECURITY DEFINER", () => {
  const functions = [...migration.matchAll(/create or replace function[\s\S]*?\$\$;/gi)];

  assert.equal(functions.length, 3);
  for (const definition of functions) {
    assert.match(definition[0], /set search_path = pg_catalog/i);
    assert.doesNotMatch(definition[0], /security definer/i);
  }

  assert.match(migration, /trigger people_set_updated_at/i);
  assert.match(migration, /trigger accounts_set_updated_at/i);
  assert.match(migration, /trigger roles_protect_system_role/i);
  assert.match(migration, /trigger account_roles_prevent_direct_reactivation/i);
});

test("bloquea la reactivación directa y protege los roles del sistema", () => {
  assert.match(
    migration,
    /old\.revoked_at is not null and new\.revoked_at is null[\s\S]*raise exception/i,
  );
  assert.match(migration, /if old\.is_system then[\s\S]*raise exception/i);
});

test("habilita RLS sin crear políticas funcionales", () => {
  for (const table of ["people", "accounts", "roles", "account_roles"]) {
    assert.match(
      migration,
      new RegExp(`alter table core\\.${table} enable row level security;`, "i"),
    );
  }

  assert.doesNotMatch(migration, /create\s+policy/i);
});

test("revoca acceso de PUBLIC, anon y authenticated", () => {
  for (const role of ["public", "anon", "authenticated"]) {
    assert.match(migration, new RegExp(`revoke all on schema core from ${role};`, "i"));
    assert.match(
      migration,
      new RegExp(`revoke all on all tables in schema core from ${role};`, "i"),
    );
  }

  assert.doesNotMatch(migration, /\bgrant\b/i);
});

test("la configuración es local, no expone core y desactiva servicios no autorizados", () => {
  assert.match(config, /project_id = "sistema-preparatoria-local"/);
  assert.doesNotMatch(config, /^\s*project_ref\s*=/im);
  assert.match(config, /schemas = \["public", "graphql_public"\]/);
  assert.doesNotMatch(config, /schemas\s*=\s*\[[^\]]*"core"/i);
  assert.match(config, /\[storage\]\s+enabled = false/i);
  assert.match(config, /\[auth\]\s+enabled = false/i);
  assert.match(config, /\[edge_runtime\]\s+enabled = false/i);
});

test("no contiene datos personales, secretos, módulos escolares ni conexión remota", () => {
  const combined = `${migration}\n${config}`;

  assert.doesNotMatch(
    combined,
    /\b(curp|email|correo|phone|telefono|teléfono|address|domicilio|document_name)\b/i,
  );
  assert.doesNotMatch(
    migration,
    /create table (?:core\.)?(?:students?|alumnos?|aspirantes?|tutores?|teachers?|docentes?|maestros?|payments?|pagos?|grades?|calificaciones?|attendance|asistencia|schedules?|horarios?|groups?|grupos?|subjects?|materias?)\b/i,
  );
  assert.doesNotMatch(combined, /service_role|secret_key|supabase_secret_key/i);
  assert.doesNotMatch(combined, /https:\/\/[a-z0-9-]+\.supabase\.co/i);
  assert.doesNotMatch(migration, /references\s+auth\.users/i);
});
