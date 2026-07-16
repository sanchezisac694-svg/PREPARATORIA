begin;

create schema if not exists core;

revoke all on schema core from public;
revoke all on schema core from anon;
revoke all on schema core from authenticated;

alter default privileges in schema core revoke all on tables from public;
alter default privileges in schema core revoke all on tables from anon;
alter default privileges in schema core revoke all on tables from authenticated;
alter default privileges in schema core revoke all on sequences from public;
alter default privileges in schema core revoke all on sequences from anon;
alter default privileges in schema core revoke all on sequences from authenticated;
alter default privileges in schema core revoke execute on functions from public;
alter default privileges in schema core revoke execute on functions from anon;
alter default privileges in schema core revoke execute on functions from authenticated;

create type core.person_status as enum ('ACTIVE', 'INACTIVE', 'ARCHIVED');

create type core.account_status as enum (
  'PENDING_INVITATION',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'BLOCKED',
  'DISABLED'
);

create table core.people (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status core.person_status not null default 'ACTIVE',
  deleted_at timestamptz,
  constraint people_timestamps_ordered check (updated_at >= created_at),
  constraint people_deleted_at_consistent check (
    deleted_at is null
    or (status = 'ARCHIVED' and deleted_at >= created_at)
  )
);

create table core.accounts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  auth_user_id uuid,
  account_status core.account_status not null default 'PENDING_INVITATION',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  status_changed_at timestamptz not null default now(),
  status_changed_by uuid,
  constraint accounts_person_id_key unique (person_id),
  constraint accounts_person_id_fkey
    foreign key (person_id)
    references core.people (id)
    on delete restrict,
  constraint accounts_status_changed_by_fkey
    foreign key (status_changed_by)
    references core.accounts (id)
    on delete restrict,
  constraint accounts_timestamps_ordered check (
    updated_at >= created_at
    and status_changed_at >= created_at
  ),
  constraint accounts_disabled_at_consistent check (
    (account_status = 'DISABLED' and disabled_at is not null and disabled_at >= created_at)
    or (account_status <> 'DISABLED' and disabled_at is null)
  )
);

create unique index accounts_auth_user_id_active_key
  on core.accounts (auth_user_id)
  where auth_user_id is not null;

create table core.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint roles_code_key unique (code),
  constraint roles_code_not_blank check (code = btrim(code) and length(code) > 0),
  constraint roles_display_name_not_blank check (
    display_name = btrim(display_name)
    and length(display_name) > 0
  ),
  constraint roles_code_allowed check (
    code in (
      'SUPERADMIN',
      'ADMINISTRATIVO',
      'CONTROL_ESCOLAR',
      'CAJA',
      'DOCENTE',
      'TUTOR',
      'ALUMNO',
      'ASPIRANTE'
    )
  ),
  constraint roles_must_be_system check (is_system)
);

create table core.account_roles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  role_id uuid not null,
  assigned_at timestamptz not null default now(),
  assigned_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  reason text,
  constraint account_roles_account_id_fkey
    foreign key (account_id)
    references core.accounts (id)
    on delete restrict,
  constraint account_roles_role_id_fkey
    foreign key (role_id)
    references core.roles (id)
    on delete restrict,
  constraint account_roles_assigned_by_fkey
    foreign key (assigned_by)
    references core.accounts (id)
    on delete restrict,
  constraint account_roles_revoked_by_fkey
    foreign key (revoked_by)
    references core.accounts (id)
    on delete restrict,
  constraint account_roles_revocation_ordered check (
    revoked_at is null
    or revoked_at >= assigned_at
  ),
  constraint account_roles_revocation_actor_consistent check (
    revoked_at is not null
    or revoked_by is null
  ),
  constraint account_roles_reason_not_blank check (
    reason is null
    or (reason = btrim(reason) and length(reason) > 0)
  )
);

create unique index account_roles_active_assignment_key
  on core.account_roles (account_id, role_id)
  where revoked_at is null;

create index account_roles_account_history_idx
  on core.account_roles (account_id, assigned_at desc);

create index account_roles_role_history_idx
  on core.account_roles (role_id, assigned_at desc);

create or replace function core.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger people_set_updated_at
before update on core.people
for each row
execute function core.set_updated_at();

create trigger accounts_set_updated_at
before update on core.accounts
for each row
execute function core.set_updated_at();

create or replace function core.protect_system_role()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.is_system then
    raise exception 'system roles cannot be updated or deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger roles_protect_system_role
before update or delete on core.roles
for each row
execute function core.protect_system_role();

create or replace function core.prevent_revoked_account_role_reactivation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.revoked_at is not null and new.revoked_at is null then
    raise exception 'revoked account role assignments cannot be reactivated directly';
  end if;

  return new;
end;
$$;

create trigger account_roles_prevent_direct_reactivation
before update on core.account_roles
for each row
execute function core.prevent_revoked_account_role_reactivation();

insert into core.roles (code, display_name, is_system, is_active)
values
  ('SUPERADMIN', 'Superadministrador', true, true),
  ('ADMINISTRATIVO', 'Administrativo', true, true),
  ('CONTROL_ESCOLAR', 'Control escolar', true, true),
  ('CAJA', 'Caja', true, true),
  ('DOCENTE', 'Docente', true, true),
  ('TUTOR', 'Tutor', true, true),
  ('ALUMNO', 'Alumno', true, true),
  ('ASPIRANTE', 'Aspirante', true, true)
on conflict (code) do nothing;

alter table core.people enable row level security;
alter table core.accounts enable row level security;
alter table core.roles enable row level security;
alter table core.account_roles enable row level security;

revoke all on all tables in schema core from public;
revoke all on all tables in schema core from anon;
revoke all on all tables in schema core from authenticated;
revoke all on all sequences in schema core from public;
revoke all on all sequences in schema core from anon;
revoke all on all sequences in schema core from authenticated;
revoke execute on all functions in schema core from public;
revoke execute on all functions in schema core from anon;
revoke execute on all functions in schema core from authenticated;

comment on column core.accounts.auth_user_id is
  'Future Supabase Auth identifier. A foreign key to auth.users is intentionally deferred.';

commit;
