begin;

select plan(3);

insert into core.people (id)
values
  ('61000000-0000-0000-0000-000000000001'),
  ('61000000-0000-0000-0000-000000000002'),
  ('61000000-0000-0000-0000-000000000003');

insert into core.accounts (id, person_id)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002'),
  ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003');

select lives_ok(
  $pgtap$
do $test$
declare
  request_id uuid;
  repeated_id uuid;
begin
  request_id := core.prepare_identity_provisioning(
    '63000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    'PENDING_INVITATION',
    array['ALUMNO', 'TUTOR'],
    'INVITE'
  );
  repeated_id := core.prepare_identity_provisioning(
    '63000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    'PENDING_INVITATION',
    array['ALUMNO', 'TUTOR'],
    'INVITE'
  );
  if request_id <> repeated_id then raise exception 'FAIL exact idempotency'; end if;
  if (select count(*) from core.identity_provisioning_requested_roles
      where provisioning_request_id = request_id) <> 2 then
    raise exception 'FAIL requested roles';
  end if;

  begin
    perform core.prepare_identity_provisioning(
      '63000000-0000-0000-0000-000000000001',
      '61000000-0000-0000-0000-000000000001',
      '62000000-0000-0000-0000-000000000001',
      'PENDING_INVITATION',
      array['ASPIRANTE'],
      'INVITE'
    );
    raise exception 'FAIL incompatible idempotency accepted';
  exception when others then
    if sqlerrm not like '%IDEMPOTENCY_CONFLICT%' then raise; end if;
  end;

  begin
    perform core.prepare_identity_provisioning(
      gen_random_uuid(), gen_random_uuid(),
      '62000000-0000-0000-0000-000000000001',
      'PENDING_INVITATION', array['ALUMNO'], 'INVITE'
    );
    raise exception 'FAIL missing person accepted';
  exception when others then
    if sqlerrm not like '%PERSON_NOT_FOUND%' then raise; end if;
  end;

  begin
    perform core.prepare_identity_provisioning(
      gen_random_uuid(),
      '61000000-0000-0000-0000-000000000001',
      gen_random_uuid(), 'PENDING_INVITATION', array['ALUMNO'], 'INVITE'
    );
    raise exception 'FAIL missing account accepted';
  exception when others then
    if sqlerrm not like '%ACCOUNT_NOT_FOUND%' then raise; end if;
  end;

  begin
    perform core.prepare_identity_provisioning(
      gen_random_uuid(),
      '61000000-0000-0000-0000-000000000002',
      '62000000-0000-0000-0000-000000000003',
      'PENDING_INVITATION', array['ALUMNO'], 'INVITE'
    );
    raise exception 'FAIL account/person mismatch accepted';
  exception when others then
    if sqlerrm not like '%ACCOUNT_PERSON_MISMATCH%' then raise; end if;
  end;

  begin
    perform core.prepare_identity_provisioning(
      gen_random_uuid(),
      '61000000-0000-0000-0000-000000000002',
      '62000000-0000-0000-0000-000000000002',
      'PENDING_INVITATION', array['NO_EXISTE'], 'INVITE'
    );
    raise exception 'FAIL unknown role accepted';
  exception when others then
    if sqlerrm not like '%INVALID_INITIAL_ROLE%' then raise; end if;
  end;

  begin
    perform core.prepare_identity_provisioning(
      gen_random_uuid(),
      '61000000-0000-0000-0000-000000000002',
      '62000000-0000-0000-0000-000000000002',
      'PENDING_INVITATION', array['ALUMNO', 'ALUMNO'], 'INVITE'
    );
    raise exception 'FAIL duplicate role accepted';
  exception when others then
    if sqlerrm not like '%DUPLICATE_INITIAL_ROLE%' then raise; end if;
  end;

  perform core.mark_identity_auth_pending(request_id);
  if (select current_stage from core.identity_provisioning_requests where id = request_id)
      <> 'AUTH_PENDING' then raise exception 'FAIL AUTH_PENDING'; end if;

  begin
    update core.identity_provisioning_requests set current_stage = 'COMPLETED'
    where id = request_id;
    raise exception 'FAIL direct transition accepted';
  exception when others then
    if sqlerrm not like '%INVALID_STAGE_TRANSITION%' then raise; end if;
  end;

  perform core.record_identity_auth_created(
    request_id, '64000000-0000-0000-0000-000000000001', true
  );
  begin
    perform core.finalize_identity_provisioning(request_id);
    raise exception 'FAIL nonexistent Auth user accepted';
  exception when foreign_key_violation then null;
  end;

  insert into auth.users (
    instance_id, id, aud, role, encrypted_password, email,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    '64000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', '', 'synthetic-provisioning@example.invalid',
    '{}', '{}', now(), now()
  );
  perform core.finalize_identity_provisioning(request_id);
  perform core.finalize_identity_provisioning(request_id);
  if (select auth_user_id from core.accounts
      where id = '62000000-0000-0000-0000-000000000001')
      <> '64000000-0000-0000-0000-000000000001' then
    raise exception 'FAIL Auth link';
  end if;
  if (select count(*) from core.account_roles
      where account_id = '62000000-0000-0000-0000-000000000001'
        and revoked_at is null) <> 2 then raise exception 'FAIL role finalization'; end if;

  begin
    update core.identity_provisioning_events set safe_metadata = '{}' where true;
    raise exception 'FAIL audit UPDATE accepted';
  exception when others then
    if sqlerrm not like '%PROVISIONING_AUDIT_APPEND_ONLY%' then raise; end if;
  end;
  begin
    delete from core.identity_provisioning_events where true;
    raise exception 'FAIL audit DELETE accepted';
  exception when others then
    if sqlerrm not like '%PROVISIONING_AUDIT_APPEND_ONLY%' then raise; end if;
  end;
end;
$test$;
$pgtap$,
  'idempotencia, integridad, transición, vínculo, roles y auditoría'
);

select lives_ok(
  $pgtap$
do $states$
declare
  retry_id uuid;
  terminal_id uuid;
begin
  retry_id := core.prepare_identity_provisioning(
    '63000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    'PENDING_ACTIVATION', array['DOCENTE'], 'ADMIN_CREATED'
  );
  perform core.mark_identity_auth_pending(retry_id);
  perform core.mark_identity_provisioning_failure(
    retry_id, true, 'AUTH_PROVIDER_RETRYABLE_FAILURE', 'Proveedor no disponible'
  );
  perform core.mark_identity_auth_pending(retry_id);
  perform core.mark_identity_provisioning_failure(
    retry_id, false, 'AUTH_PROVIDER_TERMINAL_FAILURE', 'Operación rechazada'
  );
  if (select current_stage from core.identity_provisioning_requests where id = retry_id)
      <> 'TERMINAL_FAILURE' then raise exception 'FAIL terminal failure'; end if;

  terminal_id := core.prepare_identity_provisioning(
    '63000000-0000-0000-0000-000000000003',
    '61000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000003',
    'PENDING_INVITATION', array['ASPIRANTE'], 'INVITE'
  );
  perform core.cancel_identity_provisioning(terminal_id);
  perform core.cancel_identity_provisioning(terminal_id);
  begin
    perform core.mark_identity_auth_pending(terminal_id);
    raise exception 'FAIL invalid cancellation transition';
  exception when others then
    if sqlerrm not like '%INVALID_STAGE_TRANSITION%' then raise; end if;
  end;
end;
$states$;
$pgtap$,
  'fallos, reintento, estados terminales y cancelación'
);

select lives_ok(
  $pgtap$
do $security$
declare
  provisioning_table_name text;
begin
  foreach provisioning_table_name in array array[
    'identity_provisioning_requests',
    'identity_provisioning_requested_roles',
    'identity_provisioning_events'
  ] loop
    if not (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'core' and c.relname = provisioning_table_name) then
      raise exception 'FAIL RLS disabled on %', provisioning_table_name;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'core'
      and tablename like 'identity_provisioning_%') then
    raise exception 'FAIL provisioning policies exist';
  end if;
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'core'
      and table_name like 'identity_provisioning_%'
      and grantee in ('anon', 'authenticated', 'PUBLIC')
  ) then raise exception 'FAIL application table grants'; end if;
  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'core'
      and p.proname like '%identity_provisioning%'
      and (
        has_function_privilege('anon', p.oid, 'EXECUTE')
        or has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or exists (
          select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        )
      )
  ) then raise exception 'FAIL application function execute'; end if;
end;
$security$;
$pgtap$,
  'RLS, políticas, grants y ejecución de funciones'
);

savepoint reversal;
drop table core.identity_provisioning_events;
drop table core.identity_provisioning_requested_roles;
drop table core.identity_provisioning_requests;
rollback to savepoint reversal;

select * from finish();
rollback;
