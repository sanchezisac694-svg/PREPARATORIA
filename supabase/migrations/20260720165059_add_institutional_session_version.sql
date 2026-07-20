begin;

create type core.session_security_event_type as enum (
  'SESSION_VERSION_INITIALIZED',
  'SESSION_VERSION_INCREMENTED',
  'CURRENT_SESSION_SIGNED_OUT',
  'OTHER_SESSIONS_REVOCATION_REQUESTED',
  'OTHER_SESSIONS_REVOCATION_COMPLETED',
  'OTHER_SESSIONS_REVOCATION_FAILED',
  'GLOBAL_SESSION_REVOCATION_REQUESTED',
  'GLOBAL_SESSION_REVOCATION_COMPLETED',
  'GLOBAL_SESSION_REVOCATION_FAILED',
  'ACCESS_REJECTED_STALE_SESSION',
  'ACCESS_REJECTED_ACCOUNT_STATUS',
  'PASSWORD_CHANGE_INVALIDATION',
  'PASSWORD_RESET_INVALIDATION',
  'ACCOUNT_SUSPENSION_INVALIDATION',
  'ACCOUNT_BLOCK_INVALIDATION',
  'ACCOUNT_DISABLE_INVALIDATION',
  'SECURITY_INCIDENT_INVALIDATION',
  'RECONCILIATION_REQUIRED'
);

create type core.session_security_reason_code as enum (
  'USER_LOGOUT',
  'USER_LOGOUT_ALL',
  'NIP_CHANGED',
  'NIP_RESET',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BLOCKED',
  'ACCOUNT_DISABLED',
  'SUSPECTED_COMPROMISE',
  'ADMINISTRATIVE_REVOCATION',
  'SECURITY_POLICY',
  'SESSION_RECONCILIATION',
  'TOKEN_VERSION_MISMATCH'
);

alter table core.accounts
  add column session_version bigint not null default 1,
  add column session_invalidated_at timestamptz,
  add column session_invalidated_by uuid,
  add column session_invalidation_reason core.session_security_reason_code,
  add constraint accounts_session_version_positive check (session_version >= 1),
  add constraint accounts_session_version_bounded
    check (session_version < 9223372036854775807),
  add constraint accounts_session_invalidation_actor_fkey
    foreign key (session_invalidated_by) references core.accounts (id) on delete restrict,
  add constraint accounts_session_invalidation_metadata_check check (
    (session_invalidated_at is null
      and session_invalidated_by is null
      and session_invalidation_reason is null)
    or
    (session_invalidated_at is not null
      and session_invalidation_reason is not null)
  );

create table core.account_session_security_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  person_id uuid not null,
  previous_session_version bigint not null,
  resulting_session_version bigint not null,
  event_type core.session_security_event_type not null,
  reason_code core.session_security_reason_code not null,
  actor_account_id uuid,
  auth_session_id uuid,
  idempotency_key text not null,
  correlation_id uuid,
  created_at timestamptz not null default statement_timestamp(),
  constraint account_session_security_events_account_fkey
    foreign key (account_id) references core.accounts (id) on delete restrict,
  constraint account_session_security_events_person_fkey
    foreign key (person_id) references core.people (id) on delete restrict,
  constraint account_session_security_events_actor_fkey
    foreign key (actor_account_id) references core.accounts (id) on delete restrict,
  constraint account_session_security_events_idempotency_key_key unique (idempotency_key),
  constraint account_session_security_events_versions_check check (
    previous_session_version >= 1
    and resulting_session_version >= previous_session_version
    and resulting_session_version <= previous_session_version + 1
  ),
  constraint account_session_security_events_idempotency_check check (
    length(idempotency_key) between 8 and 200
    and idempotency_key = btrim(idempotency_key)
    and idempotency_key !~* '(token|cookie|password|nip|email|alias)'
  )
);

create index account_session_security_events_account_created_idx
  on core.account_session_security_events (account_id, created_at desc);

alter table core.account_session_security_events enable row level security;
revoke all on table core.account_session_security_events from public, anon, authenticated;

create or replace function core.prevent_session_security_event_mutation()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  raise exception 'SESSION_SECURITY_AUDIT_APPEND_ONLY';
end;
$$;

create trigger account_session_security_events_append_only
before update or delete on core.account_session_security_events
for each row execute function core.prevent_session_security_event_mutation();

create or replace function core.guard_account_session_version()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if new.session_version < old.session_version then
    raise exception 'SESSION_VERSION_DECREMENT_FORBIDDEN';
  end if;
  if new.session_version <> old.session_version
    and current_setting('core.session_version_change_allowed', true) <> 'on' then
    raise exception 'CONTROLLED_SESSION_VERSION_CHANGE_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger accounts_session_version_guard
before update of session_version on core.accounts
for each row execute function core.guard_account_session_version();

create or replace function core.current_token_session_version()
returns bigint
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  claims jsonb;
  raw_value jsonb;
  numeric_value numeric;
begin
  begin
    claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if claims is null then return null; end if;
  raw_value := claims -> 'session_version';
  if raw_value is null
    or jsonb_typeof(raw_value) <> 'number'
    or raw_value::text !~ '^[1-9][0-9]*$' then
    return null;
  end if;
  begin
    numeric_value := raw_value::text::numeric;
  exception when others then
    return null;
  end;
  if numeric_value > 9223372036854775807::numeric then return null; end if;
  return numeric_value::bigint;
end;
$$;

create or replace function core.current_account_session_version()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select accounts.session_version
  from core.accounts
  where accounts.auth_user_id = (select auth.uid());
$$;

create or replace function core.is_current_session_version_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      accounts.account_status = 'ACTIVE'::core.account_status
      and core.current_token_session_version() = accounts.session_version
    from core.accounts
    where accounts.auth_user_id = (select auth.uid())
  ), false);
$$;

create or replace function core.require_current_session_version()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not core.is_current_session_version_valid() then
    raise exception using
      errcode = 'P0001',
      message = 'SESSION_NOT_ACCEPTED';
  end if;
end;
$$;

create or replace function core.invalidate_account_sessions(
  target_account_id uuid,
  actor_id uuid,
  requested_reason core.session_security_reason_code,
  operation_key text,
  requested_correlation_id uuid default null,
  requested_event core.session_security_event_type default 'SESSION_VERSION_INCREMENTED'
)
returns table (
  invalidated boolean,
  resulting_session_version bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_record core.accounts%rowtype;
  existing_event core.account_session_security_events%rowtype;
  previous_version bigint;
begin
  if operation_key is null
    or length(operation_key) < 8
    or length(operation_key) > 200
    or operation_key <> btrim(operation_key) then
    raise exception 'SESSION_SECURITY_OPERATION_FAILED';
  end if;

  select * into account_record
  from core.accounts
  where id = target_account_id
  for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;

  select * into existing_event
  from core.account_session_security_events
  where idempotency_key = operation_key;
  if found then
    if existing_event.account_id <> target_account_id
      or existing_event.actor_account_id is distinct from actor_id
      or existing_event.reason_code <> requested_reason
      or existing_event.event_type <> requested_event
      or existing_event.correlation_id is distinct from requested_correlation_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return query select false, existing_event.resulting_session_version;
    return;
  end if;

  if actor_id is not null
    and not exists (select 1 from core.accounts where id = actor_id) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if actor_id is null and auth.uid() is not null then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if auth.uid() is not null
    and not exists (
      select 1 from core.accounts
      where id = actor_id and id = target_account_id and auth_user_id = auth.uid()
    ) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if account_record.session_version >= 9223372036854775806 then
    raise exception 'SESSION_VERSION_OVERFLOW';
  end if;

  previous_version := account_record.session_version;
  perform set_config('core.session_version_change_allowed', 'on', true);
  update core.accounts
  set session_version = session_version + 1,
      session_invalidated_at = statement_timestamp(),
      session_invalidated_by = actor_id,
      session_invalidation_reason = requested_reason
  where id = target_account_id
  returning * into account_record;
  perform set_config('core.session_version_change_allowed', 'off', true);

  insert into core.account_session_security_events (
    account_id, person_id, previous_session_version, resulting_session_version,
    event_type, reason_code, actor_account_id, idempotency_key, correlation_id
  ) values (
    account_record.id, account_record.person_id, previous_version,
    account_record.session_version, requested_event, requested_reason, actor_id,
    operation_key, requested_correlation_id
  );

  return query select true, account_record.session_version;
end;
$$;

create or replace function public.invalidate_own_sessions(
  requested_reason core.session_security_reason_code,
  requested_idempotency_key text,
  requested_correlation_id uuid default null,
  requested_event core.session_security_event_type default 'SESSION_VERSION_INCREMENTED'
)
returns table (invalidated boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  own_account_id uuid;
begin
  if requested_reason not in ('USER_LOGOUT_ALL', 'NIP_CHANGED', 'NIP_RESET') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  select accounts.id into own_account_id
  from core.accounts
  where accounts.auth_user_id = auth.uid()
  for update;
  if own_account_id is null then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  return query
    select result.invalidated
    from core.invalidate_account_sessions(
      own_account_id, own_account_id, requested_reason,
      requested_idempotency_key, requested_correlation_id, requested_event
    ) result;
end;
$$;

create or replace function core.invalidate_session_on_lifecycle_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reason core.session_security_reason_code;
  event core.session_security_event_type;
begin
  if new.account_status = old.account_status
    or new.account_status not in ('SUSPENDED', 'BLOCKED', 'DISABLED') then
    return new;
  end if;
  reason := case new.account_status
    when 'SUSPENDED' then 'ACCOUNT_SUSPENDED'::core.session_security_reason_code
    when 'BLOCKED' then 'ACCOUNT_BLOCKED'::core.session_security_reason_code
    else 'ACCOUNT_DISABLED'::core.session_security_reason_code
  end;
  event := case new.account_status
    when 'SUSPENDED' then 'ACCOUNT_SUSPENSION_INVALIDATION'::core.session_security_event_type
    when 'BLOCKED' then 'ACCOUNT_BLOCK_INVALIDATION'::core.session_security_event_type
    else 'ACCOUNT_DISABLE_INVALIDATION'::core.session_security_event_type
  end;
  perform core.invalidate_account_sessions(
    new.id,
    new.status_changed_by,
    reason,
    'lifecycle:' || new.id::text || ':' || new.status_changed_at::text || ':' || new.account_status::text,
    null,
    event
  );
  return new;
end;
$$;

create trigger accounts_session_lifecycle_invalidation
after update of account_status on core.accounts
for each row execute function core.invalidate_session_on_lifecycle_change();

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  institutional_version bigint;
  updated_claims jsonb;
begin
  if jsonb_typeof(event) <> 'object'
    or jsonb_typeof(event -> 'claims') <> 'object'
    or coalesce(event ->> 'user_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 400, 'message', 'Invalid hook input')
    );
  end if;
  select accounts.session_version into institutional_version
  from core.accounts
  where accounts.auth_user_id = (event ->> 'user_id')::uuid;
  updated_claims := event -> 'claims';
  if institutional_version is not null then
    updated_claims := jsonb_set(
      updated_claims, '{session_version}', to_jsonb(institutional_version), true
    );
  else
    updated_claims := updated_claims - 'session_version';
  end if;
  return jsonb_build_object('claims', updated_claims);
end;
$$;

drop function public.get_current_identity_context();
drop function core.get_current_identity_context();

create function core.get_current_identity_context()
returns table (
  auth_user_id uuid,
  account_id uuid,
  person_id uuid,
  account_status core.account_status,
  role_codes text[],
  allowed_applications text[],
  session_valid boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_account as (
    select accounts.*
    from core.accounts
    where accounts.auth_user_id = auth.uid()
  ),
  accepted as (
    select coalesce(core.is_current_session_version_valid(), false) as valid
  ),
  effective_roles as (
    select coalesce(array_agg(roles.code order by roles.code)
      filter (where assignments.revoked_at is null and roles.is_active), array[]::text[]) roles
    from current_account
    left join core.account_roles assignments on assignments.account_id = current_account.id
    left join core.roles on roles.id = assignments.role_id
  )
  select
    auth.uid(),
    case when accepted.valid then current_account.id end,
    case when accepted.valid then current_account.person_id end,
    current_account.account_status,
    case when accepted.valid then effective_roles.roles else array[]::text[] end,
    case when not accepted.valid then array[]::text[]
      else array_remove(array[
        case when effective_roles.roles && array['ASPIRANTE','ALUMNO','TUTOR','DOCENTE']
          then 'PORTAL_ESCOLAR' end,
        case when effective_roles.roles && array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR','CAJA']
          then 'SISTEMA_ADMINISTRATIVO' end
      ]::text[], null)
    end,
    accepted.valid
  from accepted
  left join current_account on true
  cross join effective_roles;
$$;

create function public.get_current_identity_context()
returns table (
  auth_user_id uuid,
  account_id uuid,
  person_id uuid,
  account_status core.account_status,
  role_codes text[],
  allowed_applications text[],
  session_valid boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from core.get_current_identity_context();
$$;

drop policy accounts_select_own_active_context on core.accounts;
drop policy people_select_own_active_context on core.people;
drop policy account_roles_select_own_active_context on core.account_roles;
drop policy roles_select_own_active_context on core.roles;

create policy accounts_select_own_active_context on core.accounts
for select to authenticated using (
  accounts.auth_user_id = (select auth.uid())
  and accounts.account_status = 'ACTIVE'
  and core.is_current_session_version_valid()
);
create policy people_select_own_active_context on core.people
for select to authenticated using (
  people.id = (select core.current_person_id())
  and core.is_current_session_version_valid()
);
create policy account_roles_select_own_active_context on core.account_roles
for select to authenticated using (
  account_roles.account_id = (select core.current_account_id())
  and account_roles.revoked_at is null
  and core.is_current_session_version_valid()
);
create policy roles_select_own_active_context on core.roles
for select to authenticated using (
  roles.is_active
  and roles.code = any (core.current_role_codes())
  and core.is_current_session_version_valid()
);

alter function core.prevent_session_security_event_mutation() owner to postgres;
alter function core.guard_account_session_version() owner to postgres;
alter function core.current_token_session_version() owner to postgres;
alter function core.current_account_session_version() owner to postgres;
alter function core.is_current_session_version_valid() owner to postgres;
alter function core.require_current_session_version() owner to postgres;
alter function core.invalidate_account_sessions(
  uuid, uuid, core.session_security_reason_code, text, uuid, core.session_security_event_type
) owner to postgres;
alter function public.invalidate_own_sessions(
  core.session_security_reason_code, text, uuid, core.session_security_event_type
) owner to postgres;
alter function core.invalidate_session_on_lifecycle_change() owner to postgres;
alter function public.custom_access_token_hook(jsonb) owner to postgres;
alter function core.get_current_identity_context() owner to postgres;
alter function public.get_current_identity_context() owner to postgres;

revoke execute on function core.prevent_session_security_event_mutation()
  from public, anon, authenticated;
revoke execute on function core.guard_account_session_version()
  from public, anon, authenticated;
revoke execute on function core.current_token_session_version()
  from public, anon, authenticated;
revoke execute on function core.current_account_session_version()
  from public, anon, authenticated;
revoke execute on function core.is_current_session_version_valid()
  from public, anon, authenticated;
revoke execute on function core.require_current_session_version()
  from public, anon, authenticated;
revoke execute on function core.invalidate_account_sessions(
  uuid, uuid, core.session_security_reason_code, text, uuid, core.session_security_event_type
) from public, anon, authenticated;
revoke execute on function core.invalidate_session_on_lifecycle_change()
  from public, anon, authenticated;
revoke execute on function core.get_current_identity_context()
  from public, anon, authenticated;
grant execute on function core.get_current_identity_context() to authenticated;
revoke execute on function public.invalidate_own_sessions(
  core.session_security_reason_code, text, uuid, core.session_security_event_type
) from public, anon;
grant execute on function public.invalidate_own_sessions(
  core.session_security_reason_code, text, uuid, core.session_security_event_type
) to authenticated;
revoke execute on function public.get_current_identity_context()
  from public, anon;
grant execute on function public.get_current_identity_context() to authenticated;
revoke execute on function public.custom_access_token_hook(jsonb)
  from public, anon, authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

commit;
