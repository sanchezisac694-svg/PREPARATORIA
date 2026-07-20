begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

select has_column('core', 'accounts', 'session_version', '1 session_version existe');
select col_default_is('core', 'accounts', 'session_version', '1', '2 default uno');
select col_not_null('core', 'accounts', 'session_version', '3 no admite null');
select ok(
  exists (select 1 from pg_constraint where conname = 'accounts_session_version_positive'),
  '4 check positivo'
);
select ok(
  exists (select 1 from pg_constraint where conname = 'accounts_session_version_bounded'),
  '5 check de overflow'
);
select has_table('core', 'account_session_security_events', '6 tabla de eventos');
select has_pk('core', 'account_session_security_events', '7 eventos tienen PK');
select has_index(
  'core', 'account_session_security_events',
  'account_session_security_events_idempotency_key_key',
  '8 idempotencia es unica'
);
select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'core' and c.relname = 'account_session_security_events'),
  '9 RLS de eventos habilitada'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'core' and tablename = 'account_session_security_events'),
  0, '10 eventos sin policies'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema = 'core' and table_name = 'account_session_security_events'
     and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0, '11 eventos sin grants de aplicacion'
);
select enum_has_labels(
  'core', 'session_security_reason_code',
  array[
    'USER_LOGOUT','USER_LOGOUT_ALL','NIP_CHANGED','NIP_RESET',
    'ACCOUNT_SUSPENDED','ACCOUNT_BLOCKED','ACCOUNT_DISABLED',
    'SUSPECTED_COMPROMISE','ADMINISTRATIVE_REVOCATION','SECURITY_POLICY',
    'SESSION_RECONCILIATION','TOKEN_VERSION_MISMATCH'
  ], '12 razones exactas'
);
select enum_has_labels(
  'core', 'session_security_event_type',
  array[
    'SESSION_VERSION_INITIALIZED','SESSION_VERSION_INCREMENTED',
    'CURRENT_SESSION_SIGNED_OUT','OTHER_SESSIONS_REVOCATION_REQUESTED',
    'OTHER_SESSIONS_REVOCATION_COMPLETED','OTHER_SESSIONS_REVOCATION_FAILED',
    'GLOBAL_SESSION_REVOCATION_REQUESTED','GLOBAL_SESSION_REVOCATION_COMPLETED',
    'GLOBAL_SESSION_REVOCATION_FAILED','ACCESS_REJECTED_STALE_SESSION',
    'ACCESS_REJECTED_ACCOUNT_STATUS','PASSWORD_CHANGE_INVALIDATION',
    'PASSWORD_RESET_INVALIDATION','ACCOUNT_SUSPENSION_INVALIDATION',
    'ACCOUNT_BLOCK_INVALIDATION','ACCOUNT_DISABLE_INVALIDATION',
    'SECURITY_INCIDENT_INVALIDATION','RECONCILIATION_REQUIRED'
  ], '13 eventos exactos'
);
select has_function('core', 'current_token_session_version', array[]::text[], '14 lector claim');
select has_function('core', 'current_account_session_version', array[]::text[], '15 lector cuenta');
select has_function('core', 'is_current_session_version_valid', array[]::text[], '16 validador');
select has_function('core', 'require_current_session_version', array[]::text[], '17 guard');
select has_function('public', 'custom_access_token_hook', array['jsonb'], '18 hook');
select has_function('public', 'get_current_identity_context', array[]::text[], '19 gateway');
select function_privs_are(
  'public', 'custom_access_token_hook', array['jsonb'], 'supabase_auth_admin',
  array['EXECUTE'], '20 auth admin ejecuta hook'
);
select function_privs_are(
  'public', 'custom_access_token_hook', array['jsonb'], 'anon',
  array[]::text[], '21 anon no ejecuta hook'
);
select function_privs_are(
  'public', 'custom_access_token_hook', array['jsonb'], 'authenticated',
  array[]::text[], '22 authenticated no ejecuta hook'
);
select function_privs_are(
  'public', 'custom_access_token_hook', array['jsonb'], 'public',
  array[]::text[], '23 PUBLIC no ejecuta hook'
);
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'custom_access_token_hook'),
  true, '24 hook definer justificado'
);
select is(
  (select proconfig[1] from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'custom_access_token_hook'),
  'search_path=""', '25 hook search_path vacio'
);

insert into auth.users (
  instance_id, id, aud, role, encrypted_password, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'b1000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', '', 'synthetic-session@example.invalid',
  '{}', '{}', now(), now()
);
insert into core.people (id) values ('b2000000-0000-4000-8000-000000000001');
insert into core.accounts (id, person_id, auth_user_id, account_status)
values (
  'b3000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'ACTIVE'
);
insert into core.account_roles (account_id, role_id, assigned_by)
select
  'b3000000-0000-4000-8000-000000000001', id,
  'b3000000-0000-4000-8000-000000000001'
from core.roles where code = 'ALUMNO';

select is(
  (select session_version from core.accounts
   where id = 'b3000000-0000-4000-8000-000000000001'), 1::bigint,
  '26 cuenta inicia en uno'
);
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id','b1000000-0000-4000-8000-000000000001',
    'claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000001')
  )) #>> '{claims,session_version}',
  '1', '27 hook agrega claim'
);
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id','b1000000-0000-4000-8000-000000000099',
    'claims',jsonb_build_object('sub','b1000000-0000-4000-8000-000000000099')
  )) #> '{claims,session_version}',
  null, '28 hook omite claim sin vinculo'
);
select set_config('request.jwt.claims', '{}', true);
select is(core.current_token_session_version(), null, '29 claim ausente');
select set_config('request.jwt.claims', '{"session_version":"1"}', true);
select is(core.current_token_session_version(), null, '30 texto invalido');
select set_config('request.jwt.claims', '{"session_version":0}', true);
select is(core.current_token_session_version(), null, '31 cero invalido');
select set_config('request.jwt.claims', '{"session_version":-1}', true);
select is(core.current_token_session_version(), null, '32 negativo invalido');
select set_config('request.jwt.claims', '{"session_version":1.5}', true);
select is(core.current_token_session_version(), null, '33 decimal invalido');
select set_config('request.jwt.claims', '{"session_version":1}', true);
select is(core.current_token_session_version(), 1::bigint, '34 claim valida');
select set_config(
  'request.jwt.claims',
  '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","session_version":1}',
  true
);
select is(core.current_account_session_version(), 1::bigint, '35 version de cuenta');
select ok(core.is_current_session_version_valid(), '36 version coincide y cuenta activa');
select lives_ok('select core.require_current_session_version()', '37 guard permite vigente');
set local role authenticated;
select is(
  (select session_valid from public.get_current_identity_context()),
  true, '38 gateway vigente'
);
select is(
  (select account_id from public.get_current_identity_context()),
  'b3000000-0000-4000-8000-000000000001'::uuid, '39 gateway retorna cuenta propia'
);
reset role;

select is(
  (select resulting_session_version from core.invalidate_account_sessions(
    'b3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'ADMINISTRATIVE_REVOCATION',
    'session:synthetic:sql:0001',
    'b4000000-0000-4000-8000-000000000001',
    'SESSION_VERSION_INCREMENTED'
  )), 2::bigint, '40 incremento controlado'
);
select is(
  (select resulting_session_version from core.invalidate_account_sessions(
    'b3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'ADMINISTRATIVE_REVOCATION',
    'session:synthetic:sql:0001',
    'b4000000-0000-4000-8000-000000000001',
    'SESSION_VERSION_INCREMENTED'
  )), 2::bigint, '41 reintento no incrementa'
);
select throws_ok(
  $$select * from core.invalidate_account_sessions(
    'b3000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'NIP_CHANGED','session:synthetic:sql:0001',
    'b4000000-0000-4000-8000-000000000001',
    'PASSWORD_CHANGE_INVALIDATION')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', '42 conflicto de payload'
);
select throws_ok(
  $$update core.accounts set session_version = 1
    where id = 'b3000000-0000-4000-8000-000000000001'$$,
  'P0001', 'SESSION_VERSION_DECREMENT_FORBIDDEN', '43 decremento rechazado'
);
select throws_ok(
  $$update core.accounts set session_version = 3
    where id = 'b3000000-0000-4000-8000-000000000001'$$,
  'P0001', 'CONTROLLED_SESSION_VERSION_CHANGE_REQUIRED', '44 cambio directo rechazado'
);
select ok(not core.is_current_session_version_valid(), '45 token anterior obsoleto');
select throws_ok(
  'select core.require_current_session_version()',
  'P0001', 'SESSION_NOT_ACCEPTED', '46 guard rechaza obsoleto'
);
set local role authenticated;
select is(
  (select session_valid from public.get_current_identity_context()),
  false, '47 gateway marca invalida'
);
select is(
  (select account_id from public.get_current_identity_context()),
  null, '48 gateway vacia cuenta'
);
select is(
  (select cardinality(role_codes) from public.get_current_identity_context()),
  0, '49 gateway vacia roles'
);
select is(
  (select cardinality(allowed_applications) from public.get_current_identity_context()),
  0, '50 gateway vacia aplicaciones'
);
reset role;
select throws_ok(
  $$update core.account_session_security_events set correlation_id = null
    where idempotency_key = 'session:synthetic:sql:0001'$$,
  'P0001', 'SESSION_SECURITY_AUDIT_APPEND_ONLY', '51 eventos no actualizables'
);
select throws_ok(
  $$delete from core.account_session_security_events
    where idempotency_key = 'session:synthetic:sql:0001'$$,
  'P0001', 'SESSION_SECURITY_AUDIT_APPEND_ONLY', '52 eventos no eliminables'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'core' and tablename in ('accounts','people','roles','account_roles')
     and qual like '%is_current_session_version_valid%'),
  4, '53 las cuatro policies exigen version'
);
select ok(
  not ('core' = any (
    string_to_array(coalesce(current_setting('pgrst.db_schemas', true), 'public'), ',')
  )),
  '54 core fuera de Data API'
);
select is(
  (select count(*)::integer from pg_trigger t
   join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal),
  0, '55 no hay triggers productivos en auth.users'
);

select * from finish();
rollback;
