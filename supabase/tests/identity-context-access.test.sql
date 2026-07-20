begin;

select plan(13);
savepoint data_changes;

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
select
  '00000000-0000-0000-0000-000000000000',
  format('51000000-0000-0000-0000-%s', lpad(value::text, 12, '0'))::uuid,
  'authenticated',
  'authenticated',
  '',
  format('synthetic-%s@example.invalid', value),
  '{}',
  '{}',
  now(),
  now()
from generate_series(1, 11) as value;

insert into core.people (id)
select format('52000000-0000-0000-0000-%s', lpad(value::text, 12, '0'))::uuid
from generate_series(1, 10) as value;

insert into core.accounts (
  id,
  person_id,
  auth_user_id,
  account_status,
  disabled_at
)
values
  (
    '53000000-0000-0000-0000-000000000001',
    '52000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    'PENDING_INVITATION',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000002',
    '52000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000002',
    'PENDING_ACTIVATION',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000003',
    '52000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000003',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000004',
    '52000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000004',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000005',
    '52000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000005',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000006',
    '52000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000006',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000007',
    '52000000-0000-0000-0000-000000000007',
    '51000000-0000-0000-0000-000000000007',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000008',
    '52000000-0000-0000-0000-000000000008',
    '51000000-0000-0000-0000-000000000008',
    'DISABLED',
    now()
  ),
  (
    '53000000-0000-0000-0000-000000000009',
    '52000000-0000-0000-0000-000000000009',
    '51000000-0000-0000-0000-000000000009',
    'ACTIVE',
    null
  ),
  (
    '53000000-0000-0000-0000-000000000010',
    '52000000-0000-0000-0000-000000000010',
    '51000000-0000-0000-0000-000000000010',
    'ACTIVE',
    null
  );

select set_config('core.account_lifecycle_transition_allowed', 'on', true);
update core.accounts
set account_status = 'SUSPENDED', suspended_at = now()
where id = '53000000-0000-0000-0000-000000000006';
update core.accounts
set account_status = 'BLOCKED', blocked_at = now()
where id = '53000000-0000-0000-0000-000000000007';
select set_config('core.account_lifecycle_transition_allowed', 'off', true);

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000003', id
from core.roles
where code = 'ALUMNO';

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000004', id
from core.roles
where code = 'CAJA';

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000005', id
from core.roles
where code in ('DOCENTE', 'SUPERADMIN');

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000006', id
from core.roles
where code = 'DOCENTE';

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000007', id
from core.roles
where code = 'CONTROL_ESCOLAR';

insert into core.account_roles (account_id, role_id, revoked_at)
select '53000000-0000-0000-0000-000000000009', id, now()
from core.roles
where code = 'TUTOR';

insert into core.account_roles (account_id, role_id, revoked_at)
select '53000000-0000-0000-0000-000000000005', id, now()
from core.roles
where code = 'DOCENTE';

alter table core.roles disable trigger roles_protect_system_role;
update core.roles set is_active = false where code = 'ASPIRANTE';
alter table core.roles enable trigger roles_protect_system_role;

insert into core.account_roles (account_id, role_id)
select '53000000-0000-0000-0000-000000000010', id
from core.roles
where code = 'ASPIRANTE';

set local role authenticated;

select set_config('request.jwt.claim.sub', '', true);

select lives_ok(
  $pgtap$
do $no_session$
declare
  context record;
begin
  select * into context from core.get_current_identity_context();
  if context.auth_user_id is not null
    or context.account_id is not null
    or context.person_id is not null
    or context.account_status is not null
    or context.role_codes <> array[]::text[]
    or context.allowed_applications <> array[]::text[] then
    raise exception 'FAIL no-session context';
  end if;
  raise notice 'PASS no-session context';
end;
$no_session$;
$pgtap$,
  'el contexto propio sin sesión es vacío'
);

select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000011',
  true
);

select lives_ok(
  $pgtap$
do $unlinked$
declare
  context record;
begin
  select * into context from core.get_current_identity_context();
  if context.auth_user_id <> '51000000-0000-0000-0000-000000000011'
    or context.account_id is not null
    or context.person_id is not null
    or context.account_status is not null
    or context.role_codes <> array[]::text[]
    or context.allowed_applications <> array[]::text[] then
    raise exception 'FAIL unlinked context';
  end if;
  raise notice 'PASS unlinked session context';
end;
$unlinked$;
$pgtap$,
  'una sesión sin vínculo no obtiene contexto propio'
);

select lives_ok(
  $pgtap$
do $states_and_access$
declare
  context record;
  test_case record;
begin
  for test_case in
    select *
    from (
      values
        (
          '51000000-0000-0000-0000-000000000001'::text,
          'PENDING_INVITATION'::text,
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000002',
          'PENDING_ACTIVATION',
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000003',
          'ACTIVE',
          array['ALUMNO']::text[],
          array['PORTAL_ESCOLAR']::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000004',
          'ACTIVE',
          array['CAJA']::text[],
          array['SISTEMA_ADMINISTRATIVO']::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000005',
          'ACTIVE',
          array['DOCENTE', 'SUPERADMIN']::text[],
          array['PORTAL_ESCOLAR', 'SISTEMA_ADMINISTRATIVO']::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000006',
          'SUSPENDED',
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000007',
          'BLOCKED',
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000008',
          'DISABLED',
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000009',
          'ACTIVE',
          array[]::text[],
          array[]::text[]
        ),
        (
          '51000000-0000-0000-0000-000000000010',
          'ACTIVE',
          array[]::text[],
          array[]::text[]
        )
    ) as cases(auth_id, expected_status, expected_roles, expected_applications)
  loop
    perform set_config('request.jwt.claim.sub', test_case.auth_id, true);
    perform set_config(
      'request.jwt.claims',
      jsonb_build_object(
        'sub', test_case.auth_id,
        'role', 'authenticated',
        'session_version', 1
      )::text,
      true
    );
    select * into context from core.get_current_identity_context();

    if context.auth_user_id <> test_case.auth_id::uuid
      or context.account_status::text <> test_case.expected_status
      or context.role_codes <> test_case.expected_roles
      or context.allowed_applications <> test_case.expected_applications then
      raise exception
        'FAIL context for %: status %, roles %, applications %',
        test_case.auth_id,
        context.account_status,
        context.role_codes,
        context.allowed_applications;
    end if;

    if test_case.expected_status = 'DISABLED'
      and (context.account_id is not null or context.person_id is not null) then
      raise exception 'FAIL DISABLED institutional identifiers';
    end if;
  end loop;

  raise notice 'PASS all account states, roles and application unions';
end;
$states_and_access$;
$pgtap$,
  'estados, roles activos y aplicaciones permitidas coinciden'
);

select set_config(
  'request.jwt.claim.sub',
  '51000000-0000-0000-0000-000000000003',
  true
);

select lives_ok(
  $pgtap$
do $isolation$
declare
  context record;
begin
  select * into context from core.get_current_identity_context();
  if context.account_id <> '53000000-0000-0000-0000-000000000003'
    or context.person_id <> '52000000-0000-0000-0000-000000000003'
    or context.account_id = '53000000-0000-0000-0000-000000000004'
    or context.person_id = '52000000-0000-0000-0000-000000000004' then
    raise exception 'FAIL user isolation';
  end if;
  raise notice 'PASS user A cannot obtain user B context';
end;
$isolation$;
$pgtap$,
  'un usuario no puede obtener el contexto de otro'
);

select lives_ok(
  $pgtap$
do $gateway_isolation$
declare
  context record;
begin
  select * into context from public.get_current_identity_context();
  if context.auth_user_id <> '51000000-0000-0000-0000-000000000003'
    or context.account_id <> '53000000-0000-0000-0000-000000000003'
    or context.person_id <> '52000000-0000-0000-0000-000000000003'
    or context.account_id = '53000000-0000-0000-0000-000000000004' then
    raise exception 'FAIL public gateway isolation';
  end if;
  raise notice 'PASS public gateway returns only auth.uid context';
end;
$gateway_isolation$;
$pgtap$,
  'el gateway público devuelve únicamente el contexto de auth.uid()'
);

select lives_ok(
  $pgtap$
do $direct_access$
begin
  begin
    perform 1 from core.people;
    raise exception 'FAIL direct people SELECT allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from core.accounts;
    raise exception 'FAIL direct accounts SELECT allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from core.roles;
    raise exception 'FAIL direct roles SELECT allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from core.account_roles;
    raise exception 'FAIL direct account_roles SELECT allowed';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS authenticated direct table SELECT denied';
end;
$direct_access$;
$pgtap$,
  'authenticated no obtiene SELECT directo sobre tablas core'
);

reset role;
set local role anon;

select throws_ok(
  'select * from public.get_current_identity_context()',
  '42501',
  null,
  'anon no puede ejecutar el gateway público'
);

select lives_ok(
  $pgtap$
do $anon_denied$
begin
  begin
    perform * from core.get_current_identity_context();
    raise exception 'FAIL anon executed context function';
  exception when insufficient_privilege then
    raise notice 'PASS anon execution denied';
  end;
end;
$anon_denied$;
$pgtap$,
  'anon no puede ejecutar la función de contexto propio'
);

reset role;

select lives_ok(
  $pgtap$
do $gateway_metadata$
declare
  function_oid oid;
begin
  select p.oid
  into function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_current_identity_context'
    and p.pronargs = 0;

  if function_oid is null
    or has_function_privilege('public', function_oid, 'EXECUTE')
    or has_function_privilege('anon', function_oid, 'EXECUTE')
    or not has_function_privilege('authenticated', function_oid, 'EXECUTE') then
    raise exception 'FAIL public gateway grants or signature';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = function_oid
      and not p.prosecdef
      and p.provolatile = 's'
      and p.proowner = (select oid from pg_roles where rolname = 'postgres')
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'FAIL public gateway security metadata';
  end if;

  raise notice 'PASS gateway has zero arguments, SECURITY INVOKER and minimal grants';
end;
$gateway_metadata$;
$pgtap$,
  'el gateway tiene firma sin parámetros, SECURITY INVOKER y grants mínimos'
);

select lives_ok(
  $pgtap$
do $metadata$
declare
  function_oid oid;
begin
  select p.oid
  into function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'core'
    and p.proname = 'get_current_identity_context';

  if function_oid is null
    or not has_function_privilege('authenticated', function_oid, 'EXECUTE')
    or has_function_privilege('anon', function_oid, 'EXECUTE')
    or has_function_privilege('public', function_oid, 'EXECUTE') then
    raise exception 'FAIL function grants';
  end if;

  if not exists (
    select 1
    from pg_proc p
    where p.oid = function_oid
      and p.prosecdef
      and p.provolatile = 's'
      and p.proowner = (select oid from pg_roles where rolname = 'postgres')
      and p.proconfig @> array['search_path=""']
  ) then
    raise exception 'FAIL function security metadata';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'core'
      and grantee in ('anon', 'authenticated')
  ) then
    raise exception 'FAIL direct table grants';
  end if;

  if (
    select count(*)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
      and p.polcmd = 'r'
      and p.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]
  ) <> 4 then
    raise exception 'FAIL SELECT policy count';
  end if;

  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
      and p.polcmd in ('a', 'w', 'd')
  ) then
    raise exception 'FAIL write policy found';
  end if;

  if coalesce(current_setting('pgrst.db_schemas', true), '') ~ '(^|,)\s*core\s*(,|$)' then
    raise exception 'FAIL core exposed by Data API';
  end if;

  raise notice 'PASS grants, policies, SECURITY DEFINER and search_path';
end;
$metadata$;
$pgtap$,
  'grants, políticas, SECURITY DEFINER y search_path son correctos'
);

rollback to savepoint data_changes;

select lives_ok(
  $pgtap$
do $cleanup$
begin
  if exists (
    select 1
    from auth.users
    where id::text like '51000000-0000-0000-0000-%'
  ) then
    raise exception 'FAIL synthetic data remained';
  end if;
  raise notice 'PASS synthetic identities and claims rolled back';
end;
$cleanup$;
$pgtap$,
  'identidades y claims sintéticos se revierten'
);

savepoint reversal;

drop function public.get_current_identity_context();
revoke execute on function core.get_current_identity_context() from authenticated;
drop function core.get_current_identity_context();
drop policy accounts_select_own_active_context on core.accounts;
drop policy people_select_own_active_context on core.people;
drop policy account_roles_select_own_active_context on core.account_roles;
drop policy roles_select_own_active_context on core.roles;

select lives_ok(
  $pgtap$
do $reversal$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core'
      and p.proname = 'get_current_identity_context'
  ) then
    raise exception 'FAIL reversal retained function';
  end if;

  if exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
  ) then
    raise exception 'FAIL reversal retained policies';
  end if;

  if (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
      and c.relkind = 'r'
  ) <> 12 then
    raise exception 'FAIL reversal changed tables';
  end if;

  if (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core'
      and p.proname in (
        'current_auth_user_id', 'current_account_id', 'current_person_id',
        'current_account_status', 'current_role_codes'
      )
  ) <> 5 then
    raise exception 'FAIL reversal changed Block 4 functions';
  end if;

  raise notice 'PASS local reversal returns to Block 4';
end;
$reversal$;
$pgtap$,
  'la reversión local vuelve al Bloque 4'
);

rollback to savepoint reversal;

select lives_ok(
  $pgtap$
do $reversal_restored$
begin
  if (
    select count(*)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
  ) <> 4 then
    raise exception 'FAIL rollback did not restore policies';
  end if;
  raise notice 'PASS rollback restores Block 5';
end;
$reversal_restored$;
$pgtap$,
  'el rollback restaura el Bloque 5'
);

select * from finish();
rollback;
