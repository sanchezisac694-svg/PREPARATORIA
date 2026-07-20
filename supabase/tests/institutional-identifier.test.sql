begin;

select plan(16);
savepoint data_changes;

select is(
  (
    select array_agg(enumlabel::text order by enumsortorder)
    from pg_enum
    where enumtypid = 'core.institutional_identifier_type'::regtype
  ),
  array[
    'NUMERO_CONTROL',
    'MATRICULA',
    'EMPLOYEE_ID',
    'ADMINISTRATIVE_ID'
  ]::text[],
  'el catálogo de tipos de identificador es exacto'
);

select is(
  core.normalize_institutional_identifier('  ab-0012  '),
  'AB-0012',
  'normaliza trim externo y mayúsculas'
);

select is(
  core.normalize_institutional_identifier('000123'),
  '000123',
  'conserva ceros iniciales'
);

select ok(
  core.normalize_institutional_identifier('ABC') is null
  and core.normalize_institutional_identifier(repeat('A', 33)) is null
  and core.normalize_institutional_identifier('AB C1') is null
  and core.normalize_institutional_identifier('ÁBC1') is null
  and core.normalize_institutional_identifier('AB/C1') is null
  and core.normalize_institutional_identifier('AB.C1') is null
  and core.normalize_institutional_identifier('A@B.C') is null
  and core.normalize_institutional_identifier(E'AB\nC1') is null,
  'rechaza longitudes y caracteres no permitidos'
);

insert into core.people (id)
values
  ('61000000-0000-0000-0000-000000000001'),
  ('61000000-0000-0000-0000-000000000002'),
  ('61000000-0000-0000-0000-000000000003');

select lives_ok(
  $pgtap$
    insert into core.accounts (
      id,
      person_id,
      account_status,
      institutional_identifier_type,
      institutional_identifier,
      identifier_assigned_at,
      identifier_changed_at
    )
    values (
      '62000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000001',
      'ACTIVE',
      'NUMERO_CONTROL',
      'AB-0012',
      now(),
      now()
    )
  $pgtap$,
  'una cuenta institucional acepta un identificador canónico'
);

select throws_ok(
  $pgtap$
    insert into core.accounts (
      id,
      person_id,
      institutional_identifier_type,
      institutional_identifier,
      identifier_assigned_at,
      identifier_changed_at
    )
    values (
      '62000000-0000-0000-0000-000000000002',
      '61000000-0000-0000-0000-000000000002',
      'MATRICULA',
      'ab-0012',
      now(),
      now()
    )
  $pgtap$,
  '23514',
  null,
  'rechaza un identificador que no esté persistido en forma canónica'
);

select throws_ok(
  $pgtap$
    insert into core.accounts (
      id,
      person_id,
      institutional_identifier_type,
      institutional_identifier,
      identifier_assigned_at,
      identifier_changed_at
    )
    values (
      '62000000-0000-0000-0000-000000000002',
      '61000000-0000-0000-0000-000000000002',
      'MATRICULA',
      'AB-0012',
      now(),
      now()
    )
  $pgtap$,
  '23505',
  null,
  'rechaza colisiones del identificador normalizado aunque cambie el tipo'
);

select lives_ok(
  $pgtap$
    insert into core.accounts (id, person_id, account_status)
    values (
      '62000000-0000-0000-0000-000000000002',
      '61000000-0000-0000-0000-000000000002',
      'PENDING_INVITATION'
    );
    insert into core.account_roles (account_id, role_id)
    select '62000000-0000-0000-0000-000000000002', id
    from core.roles
    where code = 'ASPIRANTE'
  $pgtap$,
  'una cuenta en transición y un aspirante pueden carecer de identificador'
);

select throws_ok(
  $pgtap$
    insert into core.accounts (
      id,
      person_id,
      institutional_identifier_type,
      institutional_identifier,
      identifier_assigned_at,
      identifier_changed_at
    )
    values (
      '62000000-0000-0000-0000-000000000003',
      '61000000-0000-0000-0000-000000000003',
      'INVALID_TYPE',
      'VALID-01',
      now(),
      now()
    )
  $pgtap$,
  '22P02',
  null,
  'rechaza tipos de identificador fuera del enum'
);

select throws_ok(
  $pgtap$
    insert into core.accounts (
      id,
      person_id,
      institutional_identifier_type,
      institutional_identifier,
      identifier_assigned_at,
      identifier_changed_at
    )
    values (
      '62000000-0000-0000-0000-000000000003',
      '61000000-0000-0000-0000-000000000003',
      'EMPLOYEE_ID',
      'EMP-001',
      now(),
      now() - interval '1 day'
    )
  $pgtap$,
  '23514',
  null,
  'rechaza timestamps incoherentes'
);

select lives_ok(
  $pgtap$
do $metadata$
declare
  normalize_oid oid;
begin
  select p.oid into normalize_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'core'
    and p.proname = 'normalize_institutional_identifier'
    and p.pronargs = 1;

  if normalize_oid is null
    or (select prosecdef from pg_proc where oid = normalize_oid)
    or (select provolatile from pg_proc where oid = normalize_oid) <> 'i'
    or (select proowner from pg_proc where oid = normalize_oid)
      <> (select oid from pg_roles where rolname = 'postgres')
    or not (
      (select proconfig from pg_proc where oid = normalize_oid)
      @> array['search_path=""']
    )
    or has_function_privilege('public', normalize_oid, 'EXECUTE')
    or has_function_privilege('anon', normalize_oid, 'EXECUTE')
    or has_function_privilege('authenticated', normalize_oid, 'EXECUTE') then
    raise exception 'FAIL normalization function metadata';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'core'
      and tablename = 'accounts'
      and indexname = 'accounts_institutional_identifier_key'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ) then
    raise exception 'FAIL unique identifier index';
  end if;
end;
$metadata$;
  $pgtap$,
  'función e índice tienen metadatos seguros'
);

select lives_ok(
  $pgtap$
do $access$
begin
  if not (
    select relrowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core' and c.relname = 'accounts'
  ) then
    raise exception 'FAIL accounts RLS disabled';
  end if;
  if (
    select count(*)
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'core'
  ) <> 4 then
    raise exception 'FAIL unexpected policy count';
  end if;
  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'core'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    raise exception 'FAIL direct core grant';
  end if;
  if coalesce(current_setting('pgrst.db_schemas', true), '') ~ '(^|,)\s*core\s*(,|$)' then
    raise exception 'FAIL core exposed';
  end if;
end;
$access$;
  $pgtap$,
  'RLS, políticas, grants y Data API conservan el perímetro'
);

select lives_ok(
  $pgtap$
do $absence$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'core'
      and column_name ~* '(nip|password|credential|secret)'
  ) then
    raise exception 'FAIL credential column in core';
  end if;
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname ~* '(identifier|alias|resolve|lookup)'
  ) then
    raise exception 'FAIL public identifier resolver';
  end if;
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where n.nspname = 'auth'
      and c.relname = 'users'
      and pn.nspname = 'core'
      and not t.tgisinternal
  ) then
    raise exception 'FAIL new core trigger on auth.users';
  end if;
end;
$absence$;
  $pgtap$,
  'no existen NIP, resolvers públicos ni triggers Auth nuevos'
);

rollback to savepoint data_changes;

select ok(
  not exists (
    select 1
    from core.people
    where id::text like '61000000-0000-0000-0000-%'
  ),
  'los datos sintéticos se eliminan'
);

savepoint reversal;

drop index core.accounts_institutional_identifier_key;
alter table core.accounts
  drop constraint accounts_identifier_timestamps_check,
  drop constraint accounts_institutional_identifier_canonical,
  drop constraint accounts_institutional_identifier_complete,
  drop column identifier_changed_at,
  drop column identifier_assigned_at,
  drop column institutional_identifier,
  drop column institutional_identifier_type;
drop function core.normalize_institutional_identifier(text);
drop type core.institutional_identifier_type;

select lives_ok(
  $pgtap$
do $reversal$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'core'
      and table_name = 'accounts'
      and column_name = 'institutional_identifier'
  ) then
    raise exception 'FAIL reversal retained identifier';
  end if;
end;
$reversal$;
  $pgtap$,
  'la reversión local elimina únicamente el modelo del bloque'
);

rollback to savepoint reversal;

select ok(
  to_regtype('core.institutional_identifier_type') is not null
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'core'
      and table_name = 'accounts'
      and column_name = 'institutional_identifier'
  ),
  'el rollback de reversión restaura el bloque'
);

select * from finish();
rollback;
