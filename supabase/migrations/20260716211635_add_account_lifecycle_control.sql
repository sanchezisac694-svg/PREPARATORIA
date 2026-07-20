begin;

create type core.account_lifecycle_event_type as enum (
  'INVITATION_PREPARED',
  'INVITATION_ISSUED',
  'ACTIVATION_CONFIRMED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_REACTIVATED',
  'ACCOUNT_BLOCKED',
  'ACCOUNT_UNBLOCKED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_REENABLED',
  'ACTIVATION_CANCELLED',
  'INVITATION_EXPIRED'
);

create type core.account_lifecycle_reason_code as enum (
  'INITIAL_INVITATION',
  'INVITATION_CONFIRMED',
  'ACTIVATION_COMPLETED',
  'ADMINISTRATIVE_SUSPENSION',
  'SECURITY_REVIEW',
  'TOO_MANY_FAILED_ATTEMPTS',
  'INSTITUTIONAL_REQUEST',
  'USER_DEPARTURE',
  'RECORD_CORRECTION',
  'REACTIVATION_APPROVED',
  'INVITATION_EXPIRED',
  'ACTIVATION_CANCELLED'
);

create type core.account_lifecycle_error_code as enum (
  'ACCOUNT_NOT_FOUND',
  'PERSON_NOT_FOUND',
  'AUTH_USER_NOT_LINKED',
  'INVALID_ACCOUNT_TRANSITION',
  'IDEMPOTENCY_CONFLICT',
  'INVITATION_EXPIRED',
  'INVITATION_NOT_PREPARED',
  'ACCOUNT_ALREADY_ACTIVE',
  'ACCOUNT_ALREADY_DISABLED',
  'ACTOR_NOT_AUTHORIZED',
  'INVALID_REASON_CODE',
  'CONCURRENT_TRANSITION',
  'LIFECYCLE_OPERATION_FAILED'
);

alter table core.accounts
  add column activated_at timestamptz,
  add column suspended_at timestamptz,
  add column blocked_at timestamptz,
  add column invitation_prepared_at timestamptz,
  add column invitation_expires_at timestamptz,
  add column activation_cancelled_at timestamptz;

alter table core.accounts
  add constraint accounts_lifecycle_timestamps_check check (
    (activated_at is null or activated_at >= created_at)
    and (suspended_at is null or suspended_at >= created_at)
    and (blocked_at is null or blocked_at >= created_at)
    and (invitation_prepared_at is null or invitation_prepared_at >= created_at)
    and (
      invitation_expires_at is null
      or (
        invitation_prepared_at is not null
        and invitation_expires_at > invitation_prepared_at
      )
    )
    and (activation_cancelled_at is null or activation_cancelled_at >= created_at)
  ),
  add constraint accounts_suspended_at_consistent check (
    (account_status = 'SUSPENDED') = (suspended_at is not null)
  ),
  add constraint accounts_blocked_at_consistent check (
    (account_status = 'BLOCKED') = (blocked_at is not null)
  );

create table core.account_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  person_id uuid not null,
  previous_status core.account_status,
  resulting_status core.account_status not null,
  event_type core.account_lifecycle_event_type not null,
  reason_code core.account_lifecycle_reason_code not null,
  safe_reason_summary text,
  actor_account_id uuid not null,
  idempotency_key uuid not null,
  correlation_id uuid,
  invitation_expires_at timestamptz,
  created_at timestamptz not null default now(),
  effective_at timestamptz not null default now(),
  constraint account_lifecycle_events_account_fkey
    foreign key (account_id) references core.accounts (id) on delete restrict,
  constraint account_lifecycle_events_person_fkey
    foreign key (person_id) references core.people (id) on delete restrict,
  constraint account_lifecycle_events_actor_fkey
    foreign key (actor_account_id) references core.accounts (id) on delete restrict,
  constraint account_lifecycle_events_idempotency_key_key unique (idempotency_key),
  constraint account_lifecycle_events_status_change_check check (
    previous_status is not null
    and (
      previous_status <> resulting_status
      or event_type in ('INVITATION_PREPARED', 'INVITATION_EXPIRED')
    )
  ),
  constraint account_lifecycle_events_summary_check check (
    safe_reason_summary is null
    or (
      length(safe_reason_summary) between 1 and 300
      and safe_reason_summary = btrim(safe_reason_summary)
      and safe_reason_summary !~ '@'
      and safe_reason_summary !~* '(password|token|secret|cookie|otp|curp|email|correo|stack)'
    )
  ),
  constraint account_lifecycle_events_timestamps_check check (
    effective_at >= created_at - interval '5 minutes'
    and effective_at <= created_at + interval '366 days'
  )
);

create index account_lifecycle_events_account_created_idx
  on core.account_lifecycle_events (account_id, created_at desc);

create or replace function core.is_valid_account_lifecycle_transition(
  from_status core.account_status,
  to_status core.account_status
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $$
  select case from_status
    when 'PENDING_INVITATION' then to_status in ('PENDING_ACTIVATION', 'DISABLED')
    when 'PENDING_ACTIVATION' then to_status in ('ACTIVE', 'BLOCKED', 'DISABLED')
    when 'ACTIVE' then to_status in ('SUSPENDED', 'BLOCKED', 'DISABLED')
    when 'SUSPENDED' then to_status in ('ACTIVE', 'BLOCKED', 'DISABLED')
    when 'BLOCKED' then to_status in ('ACTIVE', 'SUSPENDED', 'DISABLED')
    when 'DISABLED' then to_status in ('PENDING_ACTIVATION', 'ACTIVE')
    else false
  end;
$$;

create or replace function core.prevent_account_lifecycle_event_mutation()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  raise exception 'ACCOUNT_LIFECYCLE_AUDIT_APPEND_ONLY';
end;
$$;

create trigger account_lifecycle_events_append_only
before update or delete on core.account_lifecycle_events
for each row execute function core.prevent_account_lifecycle_event_mutation();

create or replace function core.guard_account_status_change()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  if old.account_status <> new.account_status
    and current_setting('core.account_lifecycle_transition_allowed', true) <> 'on' then
    raise exception 'CONTROLLED_ACCOUNT_LIFECYCLE_TRANSITION_REQUIRED';
  end if;
  return new;
end;
$$;

create trigger accounts_lifecycle_guard
before update of account_status on core.accounts
for each row execute function core.guard_account_status_change();

create or replace function core.account_lifecycle_actor_is_allowed(
  actor_id uuid,
  target_account_id uuid,
  requested_event core.account_lifecycle_event_type
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with actor_roles as (
    select roles.code
    from core.accounts actor
    join core.account_roles assignments
      on assignments.account_id = actor.id
      and assignments.revoked_at is null
    join core.roles on roles.id = assignments.role_id and roles.is_active
    where actor.id = actor_id and actor.account_status = 'ACTIVE'
  ),
  target_roles as (
    select roles.code
    from core.account_roles assignments
    join core.roles on roles.id = assignments.role_id and roles.is_active
    where assignments.account_id = target_account_id
      and assignments.revoked_at is null
  )
  select
    exists (select 1 from actor_roles where code = 'SUPERADMIN')
    or (
      requested_event in (
        'INVITATION_PREPARED',
        'INVITATION_ISSUED',
        'ACTIVATION_CONFIRMED',
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_REACTIVATED',
        'ACCOUNT_REENABLED'
      )
      and exists (select 1 from actor_roles where code = 'ADMINISTRATIVO')
    )
    or (
      requested_event in (
        'INVITATION_PREPARED',
        'INVITATION_ISSUED',
        'ACTIVATION_CONFIRMED',
        'ACCOUNT_SUSPENDED',
        'ACCOUNT_REACTIVATED',
        'ACCOUNT_BLOCKED',
        'ACCOUNT_UNBLOCKED',
        'ACCOUNT_DISABLED',
        'ACCOUNT_REENABLED',
        'ACTIVATION_CANCELLED',
        'INVITATION_EXPIRED'
      )
      and exists (select 1 from actor_roles where code = 'CONTROL_ESCOLAR')
      and exists (
        select 1 from target_roles
        where code in ('ALUMNO', 'TUTOR', 'DOCENTE', 'ASPIRANTE')
      )
    );
$$;

create or replace function core.apply_account_lifecycle_operation(
  target_account_id uuid,
  requested_event core.account_lifecycle_event_type,
  requested_status core.account_status,
  requested_reason core.account_lifecycle_reason_code,
  operation_key uuid,
  actor_id uuid,
  safe_summary text default null,
  requested_correlation_id uuid default null,
  requested_effective_at timestamptz default statement_timestamp(),
  requested_invitation_expires_at timestamptz default null
)
returns core.accounts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  account_record core.accounts%rowtype;
  existing_event core.account_lifecycle_events%rowtype;
  previous_value core.account_status;
begin
  select * into account_record
  from core.accounts
  where id = target_account_id
  for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;

  select * into existing_event
  from core.account_lifecycle_events
  where idempotency_key = operation_key;
  if found then
    if existing_event.account_id <> target_account_id
      or existing_event.event_type <> requested_event
      or existing_event.resulting_status <> requested_status
      or existing_event.reason_code <> requested_reason
      or existing_event.actor_account_id <> actor_id
      or existing_event.correlation_id is distinct from requested_correlation_id
      or existing_event.safe_reason_summary is distinct from safe_summary
      or existing_event.invitation_expires_at
        is distinct from requested_invitation_expires_at then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return account_record;
  end if;

  if not exists (select 1 from core.accounts where id = actor_id) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if not core.account_lifecycle_actor_is_allowed(actor_id, target_account_id, requested_event) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  previous_value := account_record.account_status;

  if requested_event = 'INVITATION_PREPARED' then
    if previous_value <> 'PENDING_INVITATION'
      or requested_status <> previous_value
      or requested_invitation_expires_at is null
      or requested_invitation_expires_at <= requested_effective_at then
      raise exception 'INVALID_ACCOUNT_TRANSITION';
    end if;
  elsif requested_event = 'INVITATION_EXPIRED' then
    if previous_value <> 'PENDING_INVITATION'
      or requested_status <> previous_value
      or account_record.invitation_expires_at is null
      or account_record.invitation_expires_at > requested_effective_at then
      raise exception 'INVALID_ACCOUNT_TRANSITION';
    end if;
  elsif not core.is_valid_account_lifecycle_transition(previous_value, requested_status) then
    raise exception 'INVALID_ACCOUNT_TRANSITION';
  end if;

  if requested_event = 'ACTIVATION_CONFIRMED' then
    if previous_value <> 'PENDING_ACTIVATION' then
      raise exception 'INVALID_ACCOUNT_TRANSITION';
    end if;
    if account_record.auth_user_id is null then
      raise exception 'AUTH_USER_NOT_LINKED';
    end if;
    if account_record.invitation_expires_at is not null
      and account_record.invitation_expires_at <= requested_effective_at then
      raise exception 'INVITATION_EXPIRED';
    end if;
  end if;

  if requested_event = 'INVITATION_ISSUED'
    and (
      previous_value <> 'PENDING_INVITATION'
      or account_record.invitation_prepared_at is null
      or account_record.invitation_expires_at is null
      or account_record.invitation_expires_at <= requested_effective_at
    ) then
    raise exception 'INVITATION_NOT_PREPARED';
  end if;

  perform set_config('core.account_lifecycle_transition_allowed', 'on', true);
  update core.accounts
  set account_status = requested_status,
      status_changed_at = requested_effective_at,
      status_changed_by = actor_id,
      activated_at = case
        when requested_event in ('ACTIVATION_CONFIRMED', 'ACCOUNT_REACTIVATED')
          and requested_status = 'ACTIVE' then requested_effective_at
        else activated_at
      end,
      suspended_at = case
        when requested_status = 'SUSPENDED' then requested_effective_at
        else null
      end,
      blocked_at = case
        when requested_status = 'BLOCKED' then requested_effective_at
        else null
      end,
      disabled_at = case
        when requested_status = 'DISABLED' then requested_effective_at
        else null
      end,
      invitation_prepared_at = case
        when requested_event = 'INVITATION_PREPARED' then requested_effective_at
        when requested_event = 'ACCOUNT_REENABLED' then null
        else invitation_prepared_at
      end,
      invitation_expires_at = case
        when requested_event = 'INVITATION_PREPARED' then requested_invitation_expires_at
        when requested_event in (
          'INVITATION_EXPIRED',
          'ACTIVATION_CANCELLED',
          'ACCOUNT_REENABLED'
        ) then null
        else invitation_expires_at
      end,
      activation_cancelled_at = case
        when requested_event = 'ACTIVATION_CANCELLED' then requested_effective_at
        else activation_cancelled_at
      end
  where id = target_account_id
  returning * into account_record;
  perform set_config('core.account_lifecycle_transition_allowed', 'off', true);

  insert into core.account_lifecycle_events (
    account_id, person_id, previous_status, resulting_status, event_type,
    reason_code, safe_reason_summary, actor_account_id, idempotency_key,
    correlation_id, invitation_expires_at, effective_at
  ) values (
    account_record.id, account_record.person_id, previous_value, requested_status,
    requested_event, requested_reason, safe_summary, actor_id, operation_key,
    requested_correlation_id, requested_invitation_expires_at, requested_effective_at
  );
  return account_record;
end;
$$;

create or replace function core.prepare_account_invitation(
  target_account_id uuid, invitation_expires_at timestamptz, operation_key uuid,
  actor_account_id uuid, correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'INVITATION_PREPARED', 'PENDING_INVITATION',
    'INITIAL_INVITATION', operation_key, actor_account_id, null, correlation_id,
    statement_timestamp(), invitation_expires_at
  );
$$;

create or replace function core.mark_account_invitation_issued(
  target_account_id uuid, operation_key uuid, actor_account_id uuid,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'INVITATION_ISSUED', 'PENDING_ACTIVATION',
    'INVITATION_CONFIRMED', operation_key, actor_account_id, null, correlation_id
  );
$$;

create or replace function core.activate_account(
  target_account_id uuid, operation_key uuid, actor_account_id uuid,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACTIVATION_CONFIRMED', 'ACTIVE',
    'ACTIVATION_COMPLETED', operation_key, actor_account_id, null, correlation_id
  );
$$;

create or replace function core.suspend_account(
  target_account_id uuid, reason core.account_lifecycle_reason_code,
  operation_key uuid, actor_account_id uuid, safe_summary text default null,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACCOUNT_SUSPENDED', 'SUSPENDED', reason,
    operation_key, actor_account_id, safe_summary, correlation_id
  );
$$;

create or replace function core.block_account(
  target_account_id uuid, reason core.account_lifecycle_reason_code,
  operation_key uuid, actor_account_id uuid, safe_summary text default null,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACCOUNT_BLOCKED', 'BLOCKED', reason,
    operation_key, actor_account_id, safe_summary, correlation_id
  );
$$;

create or replace function core.unblock_account(
  target_account_id uuid, resulting_status core.account_status,
  operation_key uuid, actor_account_id uuid, correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACCOUNT_UNBLOCKED', resulting_status,
    'RECORD_CORRECTION', operation_key, actor_account_id, null, correlation_id
  );
$$;

create or replace function core.disable_account(
  target_account_id uuid, reason core.account_lifecycle_reason_code,
  operation_key uuid, actor_account_id uuid, safe_summary text default null,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACCOUNT_DISABLED', 'DISABLED', reason,
    operation_key, actor_account_id, safe_summary, correlation_id
  );
$$;

create or replace function core.reactivate_account(
  target_account_id uuid, resulting_status core.account_status,
  operation_key uuid, actor_account_id uuid, correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id,
    case when resulting_status = 'PENDING_ACTIVATION'
      then 'ACCOUNT_REENABLED'::core.account_lifecycle_event_type
      else 'ACCOUNT_REACTIVATED'::core.account_lifecycle_event_type end,
    resulting_status, 'REACTIVATION_APPROVED', operation_key,
    actor_account_id, null, correlation_id
  );
$$;

create or replace function core.cancel_account_activation(
  target_account_id uuid, operation_key uuid, actor_account_id uuid,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'ACTIVATION_CANCELLED', 'DISABLED',
    'ACTIVATION_CANCELLED', operation_key, actor_account_id, null, correlation_id
  );
$$;

create or replace function core.expire_account_invitation(
  target_account_id uuid, operation_key uuid, actor_account_id uuid,
  correlation_id uuid default null
) returns core.accounts language sql volatile security definer set search_path = '' as $$
  select core.apply_account_lifecycle_operation(
    target_account_id, 'INVITATION_EXPIRED', 'PENDING_INVITATION',
    'INVITATION_EXPIRED', operation_key, actor_account_id, null, correlation_id
  );
$$;

alter table core.account_lifecycle_events enable row level security;
revoke all on core.account_lifecycle_events from public, anon, authenticated;
revoke execute on all functions in schema core from public;

revoke execute on function core.apply_account_lifecycle_operation(
  uuid, core.account_lifecycle_event_type, core.account_status,
  core.account_lifecycle_reason_code, uuid, uuid, text, uuid, timestamptz, timestamptz
) from anon, authenticated;
revoke execute on function core.prepare_account_invitation(uuid, timestamptz, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.mark_account_invitation_issued(uuid, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.activate_account(uuid, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.suspend_account(
  uuid, core.account_lifecycle_reason_code, uuid, uuid, text, uuid
) from anon, authenticated;
revoke execute on function core.block_account(
  uuid, core.account_lifecycle_reason_code, uuid, uuid, text, uuid
) from anon, authenticated;
revoke execute on function core.unblock_account(uuid, core.account_status, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.disable_account(
  uuid, core.account_lifecycle_reason_code, uuid, uuid, text, uuid
) from anon, authenticated;
revoke execute on function core.reactivate_account(uuid, core.account_status, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.cancel_account_activation(uuid, uuid, uuid, uuid)
  from anon, authenticated;
revoke execute on function core.expire_account_invitation(uuid, uuid, uuid, uuid)
  from anon, authenticated;

commit;
