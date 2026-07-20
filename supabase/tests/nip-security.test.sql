begin;
create extension if not exists pgtap with schema extensions;
select plan(43);

select has_table('core', 'nip_recovery_requests', 'recovery table exists');
select has_table('core', 'nip_reset_authorizations', 'authorization table exists');
select has_table('core', 'nip_security_events', 'security event table exists');

select is(
  (select array_agg(enumlabel::text order by enumsortorder)
    from pg_enum join pg_type on pg_type.oid = enumtypid
    join pg_namespace on pg_namespace.oid = pg_type.typnamespace
    where nspname = 'core' and typname = 'nip_recovery_status'),
  array['REQUESTED', 'APPROVED', 'READY_FOR_RESET', 'CONSUMED', 'EXPIRED',
    'CANCELLED', 'RETRYABLE_FAILURE', 'TERMINAL_FAILURE',
    'RECONCILIATION_REQUIRED']::text[],
  'recovery statuses are exact'
);
select is(
  (select count(*)::integer from pg_enum join pg_type on pg_type.oid = enumtypid
    where typname = 'nip_security_event_type'), 16, 'event catalog is exact'
);
select is(
  (select count(*)::integer from pg_enum join pg_type on pg_type.oid = enumtypid
    where typname = 'nip_security_reason_code'), 10, 'reason catalog is exact'
);
select is(
  (select count(*)::integer from pg_enum join pg_type on pg_type.oid = enumtypid
    where typname = 'nip_security_error_code'), 21, 'error catalog is exact'
);
select ok(
  (select bool_and(relrowsecurity) from pg_class join pg_namespace on pg_namespace.oid = relnamespace
    where nspname = 'core' and relname in (
      'nip_recovery_requests', 'nip_reset_authorizations', 'nip_security_events'
    )),
  'RLS is enabled on all three tables'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'core'
    and tablename like 'nip_%'), 0, 'there are no application policies'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
    where table_schema = 'core' and table_name like 'nip_%'
      and grantee in ('PUBLIC', 'anon', 'authenticated')), 0,
  'application roles have no table grants'
);
select ok(core.is_valid_nip_recovery_transition('REQUESTED', 'APPROVED'),
  'declared transition is accepted');
select ok(not core.is_valid_nip_recovery_transition('CONSUMED', 'READY_FOR_RESET'),
  'terminal state has no outgoing transition');

insert into core.people (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004');
insert into core.accounts (id, person_id, account_status) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'ACTIVE'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003', 'ACTIVE'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004', 'ACTIVE');
insert into core.account_roles (account_id, role_id)
select '20000000-0000-4000-8000-000000000001', id from core.roles where code = 'ADMINISTRATIVO';
insert into core.account_roles (account_id, role_id)
select '20000000-0000-4000-8000-000000000002', id from core.roles where code = 'ALUMNO';
insert into core.account_roles (account_id, role_id)
select '20000000-0000-4000-8000-000000000003', id from core.roles where code = 'CAJA';
insert into core.account_roles (account_id, role_id)
select '20000000-0000-4000-8000-000000000004', id from core.roles where code = 'CONTROL_ESCOLAR';

select lives_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'recovery:test:0001', '30000000-0000-4000-8000-000000000001',
    'VERIFIED_INSTITUTIONAL_RECOVERY')$$,
  'authorized recovery request succeeds'
);
select lives_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'recovery:test:0001', '30000000-0000-4000-8000-000000000001',
    'VERIFIED_INSTITUTIONAL_RECOVERY')$$,
  'request is idempotent'
);
select is((select count(*)::integer from core.nip_recovery_requests
  where idempotency_key = 'recovery:test:0001'), 1, 'idempotency creates one row');
select throws_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'recovery:test:0001', null, 'USER_REQUEST')$$,
  'P0001', 'IDEMPOTENCY_CONFLICT', 'idempotency conflict is rejected'
);
select throws_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    'recovery:test:0002', null, 'USER_REQUEST')$$,
  '23503', null, 'account and person mismatch is rejected'
);
select throws_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003',
    'recovery:test:0003', null, 'USER_REQUEST')$$,
  'P0001', 'ACTOR_NOT_AUTHORIZED', 'unauthorized actor is rejected'
);
select lives_ok(
  $$select core.request_nip_recovery(
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004',
    'recovery:test:0004', null, 'USER_REQUEST')$$,
  'CONTROL_ESCOLAR can request for ALUMNO'
);
select lives_ok(
  $$select core.approve_nip_recovery(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0001'),
    '20000000-0000-4000-8000-000000000001', 'approve:test:0001',
    statement_timestamp() + interval '15 minutes')$$,
  'authorized approval succeeds'
);
select is(
  (select status::text from core.nip_recovery_requests
    where idempotency_key = 'recovery:test:0001'), 'APPROVED', 'request is approved'
);
select lives_ok(
  $$select core.issue_nip_reset_authorization(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0001'),
    '20000000-0000-4000-8000-000000000001', 'issue:test:0001',
    repeat('a', 64), statement_timestamp() + interval '10 minutes')$$,
  'authorization issuance succeeds'
);
select is(
  (select status::text from core.nip_recovery_requests
    where idempotency_key = 'recovery:test:0001'), 'READY_FOR_RESET',
  'issuance advances state'
);
select is(
  (select token_digest from core.nip_reset_authorizations limit 1), repeat('a', 64),
  'only the supplied digest is persisted'
);
select is(
  (select count(*)::integer from information_schema.columns
    where table_schema = 'core' and table_name like 'nip_%'
      and column_name in ('token', 'nip', 'password', 'alias', 'email')), 0,
  'no plaintext secret columns exist'
);
select ok(
  (select expires_at > issued_at from core.nip_reset_authorizations limit 1),
  'authorization expiry follows issuance'
);
select lives_ok(
  $$select core.mark_nip_reset_attempt(repeat('a', 64))$$,
  'reset attempt locks and increments authorization'
);
select is(
  (select failed_attempt_count from core.nip_reset_authorizations limit 1), 1,
  'attempt counter increments'
);
select lives_ok(
  $$select core.complete_nip_reset(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0001'),
    repeat('a', 64), 'complete:test:0001')$$,
  'reset completion succeeds'
);
select is(
  (select status::text from core.nip_recovery_requests
    where idempotency_key = 'recovery:test:0001'), 'CONSUMED', 'request is consumed'
);
select ok(
  (select consumed_at is not null from core.nip_reset_authorizations limit 1),
  'authorization is consumed'
);
select throws_ok(
  $$select core.complete_nip_reset(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0001'),
    repeat('a', 64), 'complete:test:0002')$$,
  'P0001', 'RESET_AUTHORIZATION_CONSUMED', 'authorization cannot be reused'
);
select throws_ok(
  $$select core.cancel_nip_recovery(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0001'),
    '20000000-0000-4000-8000-000000000001', 'cancel:test:0001')$$,
  'P0001', 'INVALID_STATE_TRANSITION', 'terminal recovery cannot be cancelled'
);
select lives_ok(
  $$select core.cancel_nip_recovery(
    (select id from core.nip_recovery_requests where idempotency_key = 'recovery:test:0004'),
    '20000000-0000-4000-8000-000000000001', 'cancel:test:0002')$$,
  'requested recovery can be cancelled'
);
select is(
  (select status::text from core.nip_recovery_requests
    where idempotency_key = 'recovery:test:0004'), 'CANCELLED', 'cancellation is recorded'
);
select ok(
  (select count(*) >= 6 from core.nip_security_events),
  'state operations append audit events'
);
select throws_ok(
  $$update core.nip_security_events set created_at = created_at where id =
    (select id from core.nip_security_events limit 1)$$,
  'P0001', 'NIP_SECURITY_EVENT_APPEND_ONLY', 'audit UPDATE is rejected'
);
select throws_ok(
  $$delete from core.nip_security_events where id =
    (select id from core.nip_security_events limit 1)$$,
  'P0001', 'NIP_SECURITY_EVENT_APPEND_ONLY', 'audit DELETE is rejected'
);
select is(
  (select count(*)::integer from pg_constraint
    where connamespace = 'core'::regnamespace and confdeltype = 'c'
      and conrelid in (
        'core.nip_recovery_requests'::regclass,
        'core.nip_reset_authorizations'::regclass,
        'core.nip_security_events'::regclass
      )), 0, 'recovery model has no ON DELETE CASCADE'
);
select ok(
  not exists (
    select 1 from pg_proc join pg_namespace on pg_namespace.oid = pronamespace
    where nspname in ('core', 'public')
      and proname like '%nip%'
      and pg_get_functiondef(pg_proc.oid) ~* '(insert|update|delete).+auth[.]users'
  ),
  'NIP functions do not write auth.users'
);
select is(
  (select count(*)::integer from pg_trigger
    where tgrelid = 'auth.users'::regclass and not tgisinternal), 0,
  'no application trigger exists on auth.users'
);
select ok(
  (select count(*) = 10 from pg_proc join pg_namespace on pg_namespace.oid = pronamespace
    where nspname = 'core' and proname in (
      'request_nip_recovery', 'approve_nip_recovery', 'issue_nip_reset_authorization',
      'mark_nip_reset_attempt', 'complete_nip_reset', 'mark_nip_reset_failure',
      'expire_nip_reset_authorization', 'revoke_nip_reset_authorization',
      'cancel_nip_recovery', 'mark_nip_reconciliation_required'
    )),
  'all ten controlled functions exist'
);

drop table core.nip_security_events cascade;
drop table core.nip_reset_authorizations cascade;
drop table core.nip_recovery_requests cascade;
select hasnt_table('core', 'nip_recovery_requests', 'local reversal removes block table');

select * from finish();
rollback;
