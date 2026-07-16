begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  encrypted_password,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    '',
    'synthetic-one@example.invalid',
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '41000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    '',
    'synthetic-two@example.invalid',
    '{}',
    '{}',
    now(),
    now()
  );

insert into core.people (id)
values
  ('42000000-0000-0000-0000-000000000001'),
  ('42000000-0000-0000-0000-000000000002'),
  ('42000000-0000-0000-0000-000000000003');

insert into core.accounts (
  id,
  person_id,
  auth_user_id,
  account_status,
  disabled_at
)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '42000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'ACTIVE',
    null
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '42000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000002',
    'DISABLED',
    now()
  ),
  (
    '43000000-0000-0000-0000-000000000003',
    '42000000-0000-0000-0000-000000000003',
    null,
    'PENDING_INVITATION',
    null
  );

do $integrity$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_auth_user_id_fkey'
      and contype = 'f'
      and confdeltype = 'r'
  ) then
    raise exception 'FAIL auth.users FK with ON DELETE RESTRICT missing';
  end if;

  begin
    update core.accounts
    set auth_user_id = '41000000-0000-0000-0000-000000000099'
    where id = '43000000-0000-0000-0000-000000000003';
    raise exception 'FAIL nonexistent auth_user_id accepted';
  exception when foreign_key_violation then
    raise notice 'PASS nonexistent auth_user_id rejected';
  end;

  begin
    update core.accounts
    set auth_user_id = '41000000-0000-0000-0000-000000000001'
    where id = '43000000-0000-0000-0000-000000000003';
    raise exception 'FAIL duplicate auth_user_id accepted';
  exception when unique_violation then
    raise notice 'PASS duplicate auth_user_id rejected';
  end;

  begin
    delete from auth.users where id = '41000000-0000-0000-0000-000000000001';
    raise exception 'FAIL linked auth.users row deleted';
  exception when foreign_key_violation then
    raise notice 'PASS linked auth.users deletion rejected';
  end;

  if (
    select auth_user_id
    from core.accounts
    where id = '43000000-0000-0000-0000-000000000003'
  ) is not null then
    raise exception 'FAIL nullable auth_user_id';
  end if;

  raise notice 'PASS FK, uniqueness, deletion restriction and nullable link';
end;
$integrity$;

select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;

do $no_session$
begin
  if core.current_auth_user_id() is not null
    or core.current_account_id() is not null
    or core.current_person_id() is not null
    or core.current_account_status() is not null
    or core.current_role_codes() <> array[]::text[] then
    raise exception 'FAIL context without session';
  end if;
  raise notice 'PASS no-session context is null or empty';
end;
$no_session$;

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-0000-0000-000000000099',
  true
);

do $unlinked$
begin
  if core.current_auth_user_id() <> '41000000-0000-0000-0000-000000000099'
    or core.current_account_id() is not null
    or core.current_person_id() is not null
    or core.current_account_status() is not null
    or core.current_role_codes() <> array[]::text[] then
    raise exception 'FAIL context without linked account';
  end if;
  raise notice 'PASS unlinked session returns no institutional context';
end;
$unlinked$;

reset role;

insert into core.account_roles (account_id, role_id)
select
  '43000000-0000-0000-0000-000000000001',
  roles.id
from core.roles
where roles.code in ('ALUMNO', 'TUTOR');

insert into core.account_roles (account_id, role_id, revoked_at)
select
  '43000000-0000-0000-0000-000000000001',
  roles.id,
  now()
from core.roles
where roles.code = 'ALUMNO';

alter table core.roles disable trigger roles_protect_system_role;
update core.roles set is_active = false where code = 'TUTOR';
alter table core.roles enable trigger roles_protect_system_role;

select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

do $linked$
begin
  if core.current_auth_user_id() <> '41000000-0000-0000-0000-000000000001'
    or core.current_account_id() <> '43000000-0000-0000-0000-000000000001'
    or core.current_person_id() <> '42000000-0000-0000-0000-000000000001'
    or core.current_account_status() <> 'ACTIVE'::core.account_status
    or core.current_role_codes() <> array['ALUMNO']::text[] then
    raise exception 'FAIL linked identity context';
  end if;
  raise notice 'PASS linked account, person, status and active role filtering';
end;
$linked$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '41000000-0000-0000-0000-000000000002',
  true
);
set local role authenticated;

do $disabled$
begin
  if core.current_auth_user_id() <> '41000000-0000-0000-0000-000000000002'
    or core.current_account_id() is not null
    or core.current_person_id() is not null
    or core.current_account_status() <> 'DISABLED'::core.account_status
    or core.current_role_codes() <> array[]::text[] then
    raise exception 'FAIL DISABLED account context';
  end if;
  raise notice 'PASS DISABLED account excluded while status remains observable';
end;
$disabled$;

reset role;
select set_config('request.jwt.claim.sub', '', true);

do $security$
declare
  core_oid oid;
begin
  select oid into core_oid from pg_namespace where nspname = 'core';

  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relnamespace = core_oid
  ) then
    raise exception 'FAIL new RLS policies found';
  end if;

  if (
    select count(*)
    from pg_class
    where relnamespace = core_oid
      and relkind = 'r'
      and relrowsecurity
  ) <> 4 then
    raise exception 'FAIL RLS changed';
  end if;

  if exists (
    select 1
    from pg_proc
    where pronamespace = core_oid
      and proname like 'current_%'
      and (
        proowner <> (select oid from pg_roles where rolname = 'postgres')
        or provolatile <> 's'
        or not proconfig @> array['search_path=""']
      )
  ) then
    raise exception 'FAIL function owner, stability or search_path';
  end if;

  if (
    select count(*)
    from pg_proc
    where pronamespace = core_oid
      and proname like 'current_%'
      and prosecdef
  ) <> 4 then
    raise exception 'FAIL SECURITY DEFINER count';
  end if;

  if exists (
    select 1
    from pg_proc
    where pronamespace = core_oid
      and proname like 'current_%'
      and (
        has_function_privilege('public', oid, 'EXECUTE')
        or has_function_privilege('anon', oid, 'EXECUTE')
        or not has_function_privilege('authenticated', oid, 'EXECUTE')
      )
  ) then
    raise exception 'FAIL function EXECUTE grants';
  end if;

  if not has_schema_privilege('authenticated', 'core', 'USAGE')
    or has_schema_privilege('anon', 'core', 'USAGE') then
    raise exception 'FAIL schema USAGE grants';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'core'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'FAIL direct table grants';
  end if;

  if coalesce(current_setting('pgrst.db_schemas', true), '') ~ '(^|,)\s*core\s*(,|$)' then
    raise exception 'FAIL core exposed by Data API';
  end if;

  raise notice 'PASS owners, security modes, search_path, grants, RLS and Data API isolation';
end;
$security$;

rollback;

do $cleanup$
begin
  if exists (
    select 1
    from auth.users
    where id in (
      '41000000-0000-0000-0000-000000000001',
      '41000000-0000-0000-0000-000000000002'
    )
  ) then
    raise exception 'FAIL synthetic Auth users were not rolled back';
  end if;
  raise notice 'PASS synthetic users, claims and institutional data rolled back';
end;
$cleanup$;

begin;

revoke execute on function core.current_auth_user_id() from authenticated;
revoke execute on function core.current_account_id() from authenticated;
revoke execute on function core.current_person_id() from authenticated;
revoke execute on function core.current_account_status() from authenticated;
revoke execute on function core.current_role_codes() from authenticated;
revoke usage on schema core from authenticated;

drop function core.current_person_id();
drop function core.current_role_codes();
drop function core.current_account_id();
drop function core.current_account_status();
drop function core.current_auth_user_id();

alter table core.accounts
drop constraint accounts_auth_user_id_fkey;

do $reversal$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'accounts_auth_user_id_fkey'
  ) then
    raise exception 'FAIL reversal retained Auth FK';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'core'
      and table_name = 'accounts'
      and column_name = 'auth_user_id'
  ) then
    raise exception 'FAIL reversal removed auth_user_id column';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core'
      and p.proname like 'current_%'
  ) then
    raise exception 'FAIL reversal retained context functions';
  end if;

  raise notice 'PASS local reversal returns to the Block 3 structure';
end;
$reversal$;

rollback;

do $reversal_restored$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_auth_user_id_fkey'
  ) then
    raise exception 'FAIL reversal rollback did not restore Auth FK';
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core'
      and p.proname like 'current_%'
  ) <> 5 then
    raise exception 'FAIL reversal rollback did not restore functions';
  end if;

  raise notice 'PASS rollback restores the Block 4 migration';
end;
$reversal_restored$;
