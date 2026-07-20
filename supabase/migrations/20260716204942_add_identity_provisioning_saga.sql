begin;

create type core.identity_provisioning_stage as enum (
  'PREPARED',
  'AUTH_PENDING',
  'AUTH_CREATED',
  'LINK_PENDING',
  'COMPLETED',
  'RETRYABLE_FAILURE',
  'TERMINAL_FAILURE',
  'COMPENSATION_PENDING',
  'COMPENSATED',
  'CANCELLED'
);

create type core.identity_provisioning_event_type as enum (
  'REQUEST_PREPARED',
  'AUTH_PENDING',
  'AUTH_CREATED',
  'LINK_PENDING',
  'COMPLETED',
  'RETRYABLE_FAILURE',
  'TERMINAL_FAILURE',
  'COMPENSATION_PENDING',
  'COMPENSATED',
  'CANCELLED'
);

create type core.identity_provisioning_delivery_mode as enum (
  'INVITE',
  'ADMIN_CREATED'
);

create type core.identity_provisioning_error_code as enum (
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_PERSON_MISMATCH',
  'AUTH_PROVIDER_RETRYABLE_FAILURE',
  'AUTH_PROVIDER_TERMINAL_FAILURE',
  'AUTH_RESULT_UNKNOWN',
  'AUTH_USER_ALREADY_LINKED',
  'COMPENSATION_FAILED',
  'COMPENSATION_REQUIRED',
  'FINALIZATION_FAILED',
  'IDEMPOTENCY_CONFLICT',
  'INVALID_INITIAL_ROLE',
  'INVALID_STAGE_TRANSITION',
  'PERSON_NOT_FOUND'
);

create table core.identity_provisioning_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  person_id uuid not null,
  account_id uuid not null,
  requested_account_status core.account_status not null,
  delivery_mode core.identity_provisioning_delivery_mode not null,
  current_stage core.identity_provisioning_stage not null default 'PREPARED',
  auth_user_id uuid,
  auth_user_created_by_request boolean,
  requested_by_account_id uuid,
  last_error_code core.identity_provisioning_error_code,
  last_error_summary text,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  constraint identity_provisioning_requests_idempotency_key_key
    unique (idempotency_key),
  constraint identity_provisioning_requests_person_fkey
    foreign key (person_id) references core.people (id) on delete restrict,
  constraint identity_provisioning_requests_account_fkey
    foreign key (account_id) references core.accounts (id) on delete restrict,
  constraint identity_provisioning_requests_requested_by_fkey
    foreign key (requested_by_account_id) references core.accounts (id) on delete restrict,
  constraint identity_provisioning_requests_attempt_count_check
    check (attempt_count >= 0),
  constraint identity_provisioning_requests_status_mode_check
    check (
      (
        delivery_mode = 'INVITE'
        and requested_account_status = 'PENDING_INVITATION'
      )
      or (
        delivery_mode = 'ADMIN_CREATED'
        and requested_account_status = 'PENDING_ACTIVATION'
      )
    ),
  constraint identity_provisioning_requests_auth_stage_check
    check (
      (
        current_stage in ('PREPARED', 'AUTH_PENDING')
        and auth_user_id is null
        and auth_user_created_by_request is null
      )
      or (
        current_stage in (
          'AUTH_CREATED',
          'LINK_PENDING',
          'COMPLETED',
          'COMPENSATED'
        )
        and auth_user_id is not null
        and auth_user_created_by_request is not null
      )
      or current_stage in (
        'RETRYABLE_FAILURE',
        'TERMINAL_FAILURE',
        'COMPENSATION_PENDING',
        'CANCELLED'
      )
    ),
  constraint identity_provisioning_requests_completed_at_check
    check ((current_stage = 'COMPLETED') = (completed_at is not null)),
  constraint identity_provisioning_requests_failed_at_check
    check (
      (current_stage in ('RETRYABLE_FAILURE', 'TERMINAL_FAILURE')) = (failed_at is not null)
    ),
  constraint identity_provisioning_requests_cancelled_at_check
    check ((current_stage = 'CANCELLED') = (cancelled_at is not null)),
  constraint identity_provisioning_requests_error_check
    check (
      (
        last_error_code is null
        and last_error_summary is null
      )
      or (
        last_error_code::text ~ '^[A-Z][A-Z0-9_]{2,63}$'
        and length(last_error_summary) between 1 and 300
        and last_error_summary !~ '@'
        and last_error_summary !~* '(password|token|secret|cookie|otp|stack)'
      )
    ),
  constraint identity_provisioning_requests_timestamps_check
    check (
      updated_at >= created_at
      and (completed_at is null or completed_at >= created_at)
      and (failed_at is null or failed_at >= created_at)
      and (cancelled_at is null or cancelled_at >= created_at)
    )
);

create unique index identity_provisioning_requests_auth_user_key
  on core.identity_provisioning_requests (auth_user_id)
  where auth_user_id is not null;

create unique index identity_provisioning_requests_active_account_key
  on core.identity_provisioning_requests (account_id)
  where current_stage not in ('COMPLETED', 'TERMINAL_FAILURE', 'COMPENSATED', 'CANCELLED');

create table core.identity_provisioning_requested_roles (
  id uuid primary key default gen_random_uuid(),
  provisioning_request_id uuid not null,
  role_id uuid not null,
  created_at timestamptz not null default now(),
  constraint identity_provisioning_requested_roles_request_fkey
    foreign key (provisioning_request_id)
    references core.identity_provisioning_requests (id)
    on delete restrict,
  constraint identity_provisioning_requested_roles_role_fkey
    foreign key (role_id) references core.roles (id) on delete restrict,
  constraint identity_provisioning_requested_roles_key
    unique (provisioning_request_id, role_id)
);

create table core.identity_provisioning_events (
  id uuid primary key default gen_random_uuid(),
  provisioning_request_id uuid not null,
  event_type core.identity_provisioning_event_type not null,
  previous_stage core.identity_provisioning_stage,
  resulting_stage core.identity_provisioning_stage not null,
  actor_account_id uuid,
  error_code core.identity_provisioning_error_code,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_provisioning_events_request_fkey
    foreign key (provisioning_request_id)
    references core.identity_provisioning_requests (id)
    on delete restrict,
  constraint identity_provisioning_events_actor_fkey
    foreign key (actor_account_id) references core.accounts (id) on delete restrict,
  constraint identity_provisioning_events_error_code_check
    check (error_code is null or error_code::text ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint identity_provisioning_events_metadata_check
    check (
      jsonb_typeof(safe_metadata) = 'object'
      and octet_length(safe_metadata::text) <= 2048
      and safe_metadata::text !~* '(password|token|secret|cookie|otp|email|correo|stack)'
      and safe_metadata
        - 'attempt'
        - 'auth_user_created_by_request'
        - 'compensation_succeeded'
        - 'reconciliation_required'
        = '{}'::jsonb
    )
);

create index identity_provisioning_events_request_created_idx
  on core.identity_provisioning_events (provisioning_request_id, created_at);

create or replace function core.is_valid_identity_provisioning_transition(
  from_stage core.identity_provisioning_stage,
  to_stage core.identity_provisioning_stage
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case from_stage
    when 'PREPARED' then to_stage in ('AUTH_PENDING', 'CANCELLED')
    when 'AUTH_PENDING' then to_stage in (
      'AUTH_CREATED',
      'RETRYABLE_FAILURE',
      'TERMINAL_FAILURE',
      'COMPENSATION_PENDING'
    )
    when 'AUTH_CREATED' then to_stage in (
      'LINK_PENDING',
      'RETRYABLE_FAILURE',
      'TERMINAL_FAILURE',
      'COMPENSATION_PENDING'
    )
    when 'LINK_PENDING' then to_stage in (
      'COMPLETED',
      'RETRYABLE_FAILURE',
      'TERMINAL_FAILURE',
      'COMPENSATION_PENDING'
    )
    when 'RETRYABLE_FAILURE' then to_stage in (
      'AUTH_PENDING',
      'LINK_PENDING',
      'CANCELLED',
      'COMPENSATION_PENDING'
    )
    when 'TERMINAL_FAILURE' then to_stage in ('CANCELLED', 'COMPENSATION_PENDING')
    when 'COMPENSATION_PENDING' then to_stage in (
      'COMPENSATED',
      'RETRYABLE_FAILURE',
      'TERMINAL_FAILURE'
    )
    else false
  end;
$$;

create or replace function core.guard_identity_provisioning_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.idempotency_key <> new.idempotency_key
    or old.person_id <> new.person_id
    or old.account_id <> new.account_id
    or old.requested_account_status <> new.requested_account_status
    or old.delivery_mode <> new.delivery_mode then
    raise exception 'IMMUTABLE_PROVISIONING_PAYLOAD';
  end if;

  if old.current_stage <> new.current_stage then
    if current_setting('core.provisioning_transition_allowed', true) <> 'on'
      or not core.is_valid_identity_provisioning_transition(
        old.current_stage,
        new.current_stage
      ) then
      raise exception 'INVALID_STAGE_TRANSITION';
    end if;
  end if;

  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger identity_provisioning_requests_guard
before update on core.identity_provisioning_requests
for each row execute function core.guard_identity_provisioning_request();

create or replace function core.prevent_identity_provisioning_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'PROVISIONING_AUDIT_APPEND_ONLY';
end;
$$;

create trigger identity_provisioning_events_append_only
before update or delete on core.identity_provisioning_events
for each row execute function core.prevent_identity_provisioning_audit_mutation();

create trigger identity_provisioning_requested_roles_append_only
before update or delete on core.identity_provisioning_requested_roles
for each row execute function core.prevent_identity_provisioning_audit_mutation();

create or replace function core.append_identity_provisioning_event(
  request_id uuid,
  event_code core.identity_provisioning_event_type,
  previous_value core.identity_provisioning_stage,
  resulting_value core.identity_provisioning_stage,
  actor_id uuid,
  safe_error_code core.identity_provisioning_error_code default null,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  insert into core.identity_provisioning_events (
    provisioning_request_id,
    event_type,
    previous_stage,
    resulting_stage,
    actor_account_id,
    error_code,
    safe_metadata
  )
  values (
    request_id,
    event_code,
    previous_value,
    resulting_value,
    actor_id,
    safe_error_code,
    metadata
  )
  returning id into event_id;
  return event_id;
end;
$$;

create or replace function core.prepare_identity_provisioning(
  operation_key uuid,
  target_person_id uuid,
  target_account_id uuid,
  target_status core.account_status,
  role_codes text[],
  requested_delivery_mode core.identity_provisioning_delivery_mode,
  actor_account_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing_request core.identity_provisioning_requests%rowtype;
  new_request_id uuid;
  requested_role_count integer;
begin
  if role_codes is null or cardinality(role_codes) = 0 then
    raise exception 'INVALID_INITIAL_ROLE';
  end if;
  if cardinality(role_codes) <> (
    select count(distinct role_code) from unnest(role_codes) as role_code
  ) then
    raise exception 'DUPLICATE_INITIAL_ROLE';
  end if;

  select *
  into existing_request
  from core.identity_provisioning_requests
  where idempotency_key = operation_key
  for update;

  if found then
    if existing_request.person_id <> target_person_id
      or existing_request.account_id <> target_account_id
      or existing_request.requested_account_status <> target_status
      or existing_request.delivery_mode <> requested_delivery_mode
      or existing_request.requested_by_account_id is distinct from actor_account_id
      or (
        select array_agg(roles.code order by roles.code)
        from core.identity_provisioning_requested_roles requested_roles
        join core.roles on roles.id = requested_roles.role_id
        where requested_roles.provisioning_request_id = existing_request.id
      ) is distinct from (
        select array_agg(role_code order by role_code)
        from unnest(role_codes) as role_code
      ) then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return existing_request.id;
  end if;

  if not exists (
    select 1 from core.people where id = target_person_id
  ) then
    raise exception 'PERSON_NOT_FOUND';
  end if;
  if not exists (
    select 1 from core.accounts where id = target_account_id
  ) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;
  if not exists (
    select 1
    from core.accounts
    where id = target_account_id and person_id = target_person_id
  ) then
    raise exception 'ACCOUNT_PERSON_MISMATCH';
  end if;

  select count(*)
  into requested_role_count
  from core.roles
  where code = any (role_codes) and is_active;
  if requested_role_count <> cardinality(role_codes) then
    raise exception 'INVALID_INITIAL_ROLE';
  end if;

  insert into core.identity_provisioning_requests (
    idempotency_key,
    person_id,
    account_id,
    requested_account_status,
    delivery_mode,
    requested_by_account_id
  )
  values (
    operation_key,
    target_person_id,
    target_account_id,
    target_status,
    requested_delivery_mode,
    actor_account_id
  )
  returning id into new_request_id;

  insert into core.identity_provisioning_requested_roles (
    provisioning_request_id,
    role_id
  )
  select new_request_id, roles.id
  from core.roles
  where roles.code = any (role_codes);

  perform core.append_identity_provisioning_event(
    new_request_id,
    'REQUEST_PREPARED',
    null,
    'PREPARED',
    actor_account_id
  );
  return new_request_id;
end;
$$;

create or replace function core.mark_identity_auth_pending(
  request_id uuid,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
  previous_stage core.identity_provisioning_stage;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  if request_record.current_stage = 'AUTH_PENDING' then return request_record.current_stage; end if;
  previous_stage := request_record.current_stage;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = 'AUTH_PENDING',
      attempt_count = attempt_count + 1,
      failed_at = null,
      last_error_code = null,
      last_error_summary = null
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, 'AUTH_PENDING', previous_stage, 'AUTH_PENDING', actor_account_id,
    null, jsonb_build_object('attempt', request_record.attempt_count)
  );
  return request_record.current_stage;
end;
$$;

create or replace function core.record_identity_auth_created(
  request_id uuid,
  created_auth_user_id uuid,
  created_by_request boolean,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  if request_record.current_stage = 'AUTH_CREATED'
    and request_record.auth_user_id = created_auth_user_id then
    return request_record.current_stage;
  end if;
  if request_record.current_stage <> 'AUTH_PENDING' then
    raise exception 'INVALID_STAGE_TRANSITION';
  end if;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = 'AUTH_CREATED',
      auth_user_id = created_auth_user_id,
      auth_user_created_by_request = created_by_request
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, 'AUTH_CREATED', 'AUTH_PENDING', 'AUTH_CREATED', actor_account_id,
    null, jsonb_build_object('auth_user_created_by_request', created_by_request)
  );
  return request_record.current_stage;
end;
$$;

create or replace function core.finalize_identity_provisioning(
  request_id uuid,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  if request_record.current_stage = 'COMPLETED' then return request_record.current_stage; end if;
  if request_record.current_stage <> 'AUTH_CREATED' then
    raise exception 'INVALID_STAGE_TRANSITION';
  end if;
  if exists (
    select 1 from core.accounts
    where auth_user_id = request_record.auth_user_id
      and id <> request_record.account_id
  ) then
    raise exception 'AUTH_USER_ALREADY_LINKED';
  end if;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = 'LINK_PENDING'
  where id = request_id;
  perform core.append_identity_provisioning_event(
    request_id, 'LINK_PENDING', 'AUTH_CREATED', 'LINK_PENDING', actor_account_id
  );

  update core.accounts
  set auth_user_id = request_record.auth_user_id,
      account_status = request_record.requested_account_status,
      status_changed_at = statement_timestamp(),
      status_changed_by = actor_account_id,
      disabled_at = null
  where id = request_record.account_id
    and (auth_user_id is null or auth_user_id = request_record.auth_user_id);
  if not found then raise exception 'FINALIZATION_FAILED'; end if;

  insert into core.account_roles (account_id, role_id, assigned_by)
  select request_record.account_id, requested_roles.role_id, actor_account_id
  from core.identity_provisioning_requested_roles requested_roles
  where requested_roles.provisioning_request_id = request_id
  on conflict (account_id, role_id) where revoked_at is null do nothing;

  update core.identity_provisioning_requests
  set current_stage = 'COMPLETED',
      completed_at = statement_timestamp(),
      failed_at = null,
      last_error_code = null,
      last_error_summary = null
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, 'COMPLETED', 'LINK_PENDING', 'COMPLETED', actor_account_id
  );
  return request_record.current_stage;
end;
$$;

create or replace function core.mark_identity_provisioning_failure(
  request_id uuid,
  retryable boolean,
  safe_error_code core.identity_provisioning_error_code,
  safe_error_summary text,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
  target_stage core.identity_provisioning_stage;
  event_code core.identity_provisioning_event_type;
  previous_stage core.identity_provisioning_stage;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  target_stage := case when retryable then 'RETRYABLE_FAILURE' else 'TERMINAL_FAILURE' end;
  event_code := target_stage::text::core.identity_provisioning_event_type;
  previous_stage := request_record.current_stage;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = target_stage,
      failed_at = statement_timestamp(),
      completed_at = null,
      cancelled_at = null,
      last_error_code = safe_error_code,
      last_error_summary = safe_error_summary
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, event_code, previous_stage, target_stage,
    actor_account_id, safe_error_code
  );
  return target_stage;
end;
$$;

create or replace function core.mark_identity_compensation(
  request_id uuid,
  compensation_succeeded boolean,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
  target_stage core.identity_provisioning_stage;
  event_code core.identity_provisioning_event_type;
  previous_stage core.identity_provisioning_stage;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  previous_stage := request_record.current_stage;

  if compensation_succeeded is null then
    target_stage := 'COMPENSATION_PENDING';
  elsif compensation_succeeded then
    if request_record.current_stage <> 'COMPENSATION_PENDING' then
      raise exception 'INVALID_STAGE_TRANSITION';
    end if;
    target_stage := 'COMPENSATED';
  else
    if request_record.current_stage <> 'COMPENSATION_PENDING' then
      raise exception 'INVALID_STAGE_TRANSITION';
    end if;
    target_stage := 'RETRYABLE_FAILURE';
  end if;
  event_code := target_stage::text::core.identity_provisioning_event_type;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = target_stage,
      failed_at = case
        when target_stage = 'RETRYABLE_FAILURE' then statement_timestamp()
        else null
      end
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, event_code, previous_stage, target_stage, actor_account_id,
    null,
    jsonb_build_object(
      'compensation_succeeded', compensation_succeeded,
      'reconciliation_required', compensation_succeeded is null
    )
  );
  return target_stage;
end;
$$;

create or replace function core.cancel_identity_provisioning(
  request_id uuid,
  actor_account_id uuid default null
)
returns core.identity_provisioning_stage
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_record core.identity_provisioning_requests%rowtype;
  previous_stage core.identity_provisioning_stage;
begin
  select * into request_record
  from core.identity_provisioning_requests
  where id = request_id for update;
  if not found then raise exception 'PROVISIONING_REQUEST_NOT_FOUND'; end if;
  if request_record.current_stage = 'CANCELLED' then return request_record.current_stage; end if;
  previous_stage := request_record.current_stage;

  perform set_config('core.provisioning_transition_allowed', 'on', true);
  update core.identity_provisioning_requests
  set current_stage = 'CANCELLED',
      cancelled_at = statement_timestamp(),
      failed_at = null
  where id = request_id
  returning * into request_record;
  perform set_config('core.provisioning_transition_allowed', 'off', true);

  perform core.append_identity_provisioning_event(
    request_id, 'CANCELLED', previous_stage, 'CANCELLED', actor_account_id
  );
  return request_record.current_stage;
end;
$$;

alter table core.identity_provisioning_requests enable row level security;
alter table core.identity_provisioning_requested_roles enable row level security;
alter table core.identity_provisioning_events enable row level security;

revoke all on core.identity_provisioning_requests from public, anon, authenticated;
revoke all on core.identity_provisioning_requested_roles from public, anon, authenticated;
revoke all on core.identity_provisioning_events from public, anon, authenticated;

revoke execute on all functions in schema core from public;
revoke execute on function core.prepare_identity_provisioning(
  uuid, uuid, uuid, core.account_status, text[],
  core.identity_provisioning_delivery_mode, uuid
) from anon, authenticated;
revoke execute on function core.mark_identity_auth_pending(uuid, uuid) from anon, authenticated;
revoke execute on function core.record_identity_auth_created(uuid, uuid, boolean, uuid)
  from anon, authenticated;
revoke execute on function core.finalize_identity_provisioning(uuid, uuid)
  from anon, authenticated;
revoke execute on function core.mark_identity_provisioning_failure(
  uuid, boolean, core.identity_provisioning_error_code, text, uuid
) from anon, authenticated;
revoke execute on function core.mark_identity_compensation(uuid, boolean, uuid)
  from anon, authenticated;
revoke execute on function core.cancel_identity_provisioning(uuid, uuid)
  from anon, authenticated;

commit;
