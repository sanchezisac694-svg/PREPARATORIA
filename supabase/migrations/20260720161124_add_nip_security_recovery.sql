begin;

create type core.nip_recovery_status as enum (
  'REQUESTED',
  'APPROVED',
  'READY_FOR_RESET',
  'CONSUMED',
  'EXPIRED',
  'CANCELLED',
  'RETRYABLE_FAILURE',
  'TERMINAL_FAILURE',
  'RECONCILIATION_REQUIRED'
);

create type core.nip_security_event_type as enum (
  'AUTHENTICATED_NIP_CHANGE_REQUESTED',
  'AUTHENTICATED_NIP_CHANGED',
  'NIP_CHANGE_FAILED',
  'RECOVERY_REQUESTED',
  'RECOVERY_APPROVED',
  'RESET_AUTHORIZATION_ISSUED',
  'RESET_AUTHORIZATION_REVOKED',
  'RESET_AUTHORIZATION_EXPIRED',
  'RESET_ATTEMPTED',
  'RESET_COMPLETED',
  'RESET_FAILED',
  'SESSION_REVOCATION_REQUESTED',
  'SESSION_REVOCATION_COMPLETED',
  'SESSION_REVOCATION_FAILED',
  'RECONCILIATION_REQUIRED',
  'RECOVERY_CANCELLED'
);

create type core.nip_security_reason_code as enum (
  'USER_INITIATED_CHANGE',
  'VERIFIED_INSTITUTIONAL_RECOVERY',
  'ADMINISTRATIVE_RESET',
  'SUSPECTED_COMPROMISE',
  'USER_REQUEST',
  'CORRECTIVE_ACTION',
  'LOST_CREDENTIAL',
  'SECURITY_POLICY',
  'RECOVERY_CANCELLED',
  'AUTH_RESULT_UNKNOWN'
);

create type core.nip_security_error_code as enum (
  'INVALID_CURRENT_NIP',
  'INVALID_NEW_NIP',
  'NIP_CONFIRMATION_MISMATCH',
  'NIP_REUSE_NOT_ALLOWED',
  'ACCOUNT_NOT_ACTIVE',
  'RECOVERY_NOT_FOUND',
  'RECOVERY_NOT_APPROVED',
  'RESET_AUTHORIZATION_NOT_FOUND',
  'RESET_AUTHORIZATION_EXPIRED',
  'RESET_AUTHORIZATION_CONSUMED',
  'RESET_AUTHORIZATION_REVOKED',
  'TOO_MANY_ATTEMPTS',
  'INVALID_STATE_TRANSITION',
  'ACTOR_NOT_AUTHORIZED',
  'IDEMPOTENCY_CONFLICT',
  'AUTH_PROVIDER_RETRYABLE_FAILURE',
  'AUTH_PROVIDER_TERMINAL_FAILURE',
  'AUTH_RESULT_UNKNOWN',
  'SESSION_REVOCATION_FAILED',
  'RECONCILIATION_REQUIRED',
  'NIP_SECURITY_OPERATION_FAILED'
);

create unique index accounts_id_person_id_key on core.accounts (id, person_id);

create table core.nip_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  person_id uuid not null,
  status core.nip_recovery_status not null default 'REQUESTED',
  requested_by_account_id uuid,
  approved_by_account_id uuid,
  cancelled_by_account_id uuid,
  idempotency_key text not null unique,
  correlation_id uuid,
  attempt_count integer not null default 0,
  requested_at timestamptz not null default statement_timestamp(),
  approved_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  last_error_code core.nip_security_error_code,
  safe_reason_code core.nip_security_reason_code not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint nip_recovery_account_person_fkey
    foreign key (account_id, person_id) references core.accounts (id, person_id)
    on delete restrict,
  constraint nip_recovery_requested_by_fkey
    foreign key (requested_by_account_id) references core.accounts (id) on delete restrict,
  constraint nip_recovery_approved_by_fkey
    foreign key (approved_by_account_id) references core.accounts (id) on delete restrict,
  constraint nip_recovery_cancelled_by_fkey
    foreign key (cancelled_by_account_id) references core.accounts (id) on delete restrict,
  constraint nip_recovery_idempotency_key_check
    check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$'),
  constraint nip_recovery_attempt_count_check check (attempt_count between 0 and 5),
  constraint nip_recovery_timestamps_check check (
    requested_at >= created_at
    and updated_at >= created_at
    and (approved_at is null or approved_at >= requested_at)
    and (expires_at is null or (approved_at is not null and expires_at > approved_at))
  ),
  constraint nip_recovery_approved_state_check check (
    (approved_at is null) = (approved_by_account_id is null)
    and (
      status not in ('APPROVED', 'READY_FOR_RESET', 'CONSUMED', 'EXPIRED')
      or approved_at is not null
    )
  ),
  constraint nip_recovery_consumed_state_check
    check ((status = 'CONSUMED') = (consumed_at is not null)),
  constraint nip_recovery_cancelled_state_check
    check ((status = 'CANCELLED') = (cancelled_at is not null)),
  constraint nip_recovery_failed_state_check check (
    (status in ('RETRYABLE_FAILURE', 'TERMINAL_FAILURE', 'RECONCILIATION_REQUIRED'))
      = (failed_at is not null)
  )
);

create table core.nip_reset_authorizations (
  id uuid primary key default gen_random_uuid(),
  recovery_request_id uuid not null unique,
  token_digest text not null unique,
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  failed_attempt_count integer not null default 0,
  created_at timestamptz not null default statement_timestamp(),
  constraint nip_reset_authorization_recovery_fkey
    foreign key (recovery_request_id) references core.nip_recovery_requests (id)
    on delete restrict,
  constraint nip_reset_authorization_digest_check
    check (token_digest ~ '^[a-f0-9]{64}$'),
  constraint nip_reset_authorization_attempts_check
    check (failed_attempt_count between 0 and 5),
  constraint nip_reset_authorization_timestamps_check check (
    issued_at >= created_at
    and expires_at > issued_at
    and (consumed_at is null or (consumed_at >= issued_at and consumed_at <= expires_at))
    and (revoked_at is null or revoked_at >= issued_at)
    and not (consumed_at is not null and revoked_at is not null)
  )
);

create table core.nip_security_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  person_id uuid not null,
  recovery_request_id uuid,
  event_type core.nip_security_event_type not null,
  actor_account_id uuid,
  idempotency_key text not null unique,
  correlation_id uuid,
  safe_reason_code core.nip_security_reason_code,
  error_code core.nip_security_error_code,
  created_at timestamptz not null default statement_timestamp(),
  constraint nip_security_event_account_person_fkey
    foreign key (account_id, person_id) references core.accounts (id, person_id)
    on delete restrict,
  constraint nip_security_event_recovery_fkey
    foreign key (recovery_request_id) references core.nip_recovery_requests (id)
    on delete restrict,
  constraint nip_security_event_actor_fkey
    foreign key (actor_account_id) references core.accounts (id) on delete restrict,
  constraint nip_security_event_idempotency_check
    check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$')
);

create index nip_recovery_requests_account_created_idx
  on core.nip_recovery_requests (account_id, created_at desc);
create index nip_security_events_account_created_idx
  on core.nip_security_events (account_id, created_at desc);

create function core.is_valid_nip_recovery_transition(
  previous_status core.nip_recovery_status,
  next_status core.nip_recovery_status
)
returns boolean
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case previous_status
    when 'REQUESTED' then next_status in ('APPROVED', 'CANCELLED', 'TERMINAL_FAILURE')
    when 'APPROVED' then next_status in (
      'READY_FOR_RESET', 'CANCELLED', 'EXPIRED', 'RETRYABLE_FAILURE',
      'RECONCILIATION_REQUIRED'
    )
    when 'READY_FOR_RESET' then next_status in (
      'CONSUMED', 'EXPIRED', 'CANCELLED', 'RETRYABLE_FAILURE',
      'RECONCILIATION_REQUIRED'
    )
    when 'RETRYABLE_FAILURE' then next_status in (
      'READY_FOR_RESET', 'CANCELLED', 'TERMINAL_FAILURE', 'RECONCILIATION_REQUIRED'
    )
    when 'RECONCILIATION_REQUIRED' then next_status in (
      'READY_FOR_RESET', 'CONSUMED', 'CANCELLED', 'TERMINAL_FAILURE'
    )
    else false
  end;
$$;

create function core.nip_recovery_actor_is_allowed(
  actor_id uuid,
  target_account_id uuid,
  operation_name text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from core.accounts actor
    join core.account_roles actor_role on actor_role.account_id = actor.id
      and actor_role.revoked_at is null
    join core.roles role on role.id = actor_role.role_id and role.is_active
    where actor.id = actor_id
      and actor.account_status = 'ACTIVE'
      and (
        role.code in ('SUPERADMIN', 'ADMINISTRATIVO')
        or (
          role.code = 'CONTROL_ESCOLAR'
          and operation_name = 'REQUEST'
          and exists (
            select 1
            from core.account_roles target_role
            join core.roles target_catalog on target_catalog.id = target_role.role_id
            where target_role.account_id = target_account_id
              and target_role.revoked_at is null
              and target_catalog.code in ('ALUMNO', 'TUTOR', 'DOCENTE', 'ASPIRANTE')
          )
        )
      )
  );
$$;

create function core.prevent_nip_security_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'NIP_SECURITY_EVENT_APPEND_ONLY';
end;
$$;

create trigger nip_security_events_append_only
before update or delete on core.nip_security_events
for each row execute function core.prevent_nip_security_event_mutation();

create function core.append_nip_security_event(
  target_account_id uuid,
  target_person_id uuid,
  request_id uuid,
  requested_event core.nip_security_event_type,
  actor_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_reason core.nip_security_reason_code,
  requested_error core.nip_security_error_code
)
returns core.nip_security_events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result core.nip_security_events;
begin
  insert into core.nip_security_events (
    account_id, person_id, recovery_request_id, event_type, actor_account_id,
    idempotency_key, correlation_id, safe_reason_code, error_code
  ) values (
    target_account_id, target_person_id, request_id, requested_event, actor_id,
    requested_idempotency_key, requested_correlation_id, requested_reason, requested_error
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into result;
  return result;
end;
$$;

create function core.request_nip_recovery(
  target_account_id uuid,
  target_person_id uuid,
  actor_id uuid,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_reason core.nip_security_reason_code
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  existing core.nip_recovery_requests;
  result core.nip_recovery_requests;
begin
  select * into existing from core.nip_recovery_requests
  where idempotency_key = requested_idempotency_key for update;
  if found then
    if existing.account_id <> target_account_id or existing.person_id <> target_person_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return existing;
  end if;
  if not core.nip_recovery_actor_is_allowed(actor_id, target_account_id, 'REQUEST') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  insert into core.nip_recovery_requests (
    account_id, person_id, requested_by_account_id, idempotency_key,
    correlation_id, safe_reason_code
  ) values (
    target_account_id, target_person_id, actor_id, requested_idempotency_key,
    requested_correlation_id, requested_reason
  ) returning * into result;
  perform core.append_nip_security_event(
    target_account_id, target_person_id, result.id, 'RECOVERY_REQUESTED', actor_id,
    requested_idempotency_key || ':event', requested_correlation_id, requested_reason, null
  );
  return result;
end;
$$;

create function core.approve_nip_recovery(
  request_id uuid,
  actor_id uuid,
  requested_idempotency_key text,
  requested_expires_at timestamptz
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare result core.nip_recovery_requests;
begin
  select * into result from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if result.status = 'APPROVED' then return result; end if;
  if not core.nip_recovery_actor_is_allowed(actor_id, result.account_id, 'APPROVE') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if not core.is_valid_nip_recovery_transition(result.status, 'APPROVED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  if requested_expires_at <= statement_timestamp() then raise exception 'INVALID_EXPIRY'; end if;
  update core.nip_recovery_requests set
    status = 'APPROVED', approved_by_account_id = actor_id,
    approved_at = statement_timestamp(), expires_at = requested_expires_at,
    updated_at = statement_timestamp()
  where id = request_id returning * into result;
  perform core.append_nip_security_event(
    result.account_id, result.person_id, result.id, 'RECOVERY_APPROVED', actor_id,
    requested_idempotency_key, result.correlation_id, result.safe_reason_code, null
  );
  return result;
end;
$$;

create function core.issue_nip_reset_authorization(
  request_id uuid,
  actor_id uuid,
  requested_idempotency_key text,
  requested_token_digest text,
  requested_expires_at timestamptz
)
returns core.nip_reset_authorizations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  recovery core.nip_recovery_requests;
  result core.nip_reset_authorizations;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if not core.nip_recovery_actor_is_allowed(actor_id, recovery.account_id, 'ISSUE') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if recovery.status <> 'APPROVED' then raise exception 'RECOVERY_NOT_APPROVED'; end if;
  if requested_expires_at > recovery.expires_at or requested_expires_at <= statement_timestamp() then
    raise exception 'INVALID_EXPIRY';
  end if;
  insert into core.nip_reset_authorizations (
    recovery_request_id, token_digest, expires_at
  ) values (request_id, requested_token_digest, requested_expires_at)
  returning * into result;
  update core.nip_recovery_requests
    set status = 'READY_FOR_RESET', updated_at = statement_timestamp()
    where id = request_id;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RESET_AUTHORIZATION_ISSUED',
    actor_id, requested_idempotency_key, recovery.correlation_id,
    recovery.safe_reason_code, null
  );
  return result;
end;
$$;

create function core.mark_nip_reset_attempt(requested_token_digest text)
returns core.nip_reset_authorizations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  result core.nip_reset_authorizations;
begin
  select * into result from core.nip_reset_authorizations
    where token_digest = requested_token_digest for update;
  if not found then raise exception 'RESET_AUTHORIZATION_NOT_FOUND'; end if;
  if result.consumed_at is not null then raise exception 'RESET_AUTHORIZATION_CONSUMED'; end if;
  if result.revoked_at is not null then raise exception 'RESET_AUTHORIZATION_REVOKED'; end if;
  if result.expires_at <= statement_timestamp() then raise exception 'RESET_AUTHORIZATION_EXPIRED'; end if;
  if result.failed_attempt_count >= 5 then raise exception 'TOO_MANY_ATTEMPTS'; end if;
  update core.nip_reset_authorizations
    set failed_attempt_count = failed_attempt_count + 1
    where id = result.id returning * into result;
  return result;
end;
$$;

create function core.complete_nip_reset(
  request_id uuid,
  requested_token_digest text,
  requested_idempotency_key text
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  auth_record core.nip_reset_authorizations;
  recovery core.nip_recovery_requests;
begin
  select * into auth_record from core.nip_reset_authorizations
    where recovery_request_id = request_id and token_digest = requested_token_digest for update;
  if not found then raise exception 'RESET_AUTHORIZATION_NOT_FOUND'; end if;
  if auth_record.consumed_at is not null then raise exception 'RESET_AUTHORIZATION_CONSUMED'; end if;
  if auth_record.revoked_at is not null then raise exception 'RESET_AUTHORIZATION_REVOKED'; end if;
  if auth_record.expires_at <= statement_timestamp() then raise exception 'RESET_AUTHORIZATION_EXPIRED'; end if;
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not core.is_valid_nip_recovery_transition(recovery.status, 'CONSUMED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update core.nip_reset_authorizations set consumed_at = statement_timestamp()
    where id = auth_record.id;
  update core.nip_recovery_requests set
    status = 'CONSUMED', consumed_at = statement_timestamp(),
    updated_at = statement_timestamp()
    where id = request_id returning * into recovery;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RESET_COMPLETED', null,
    requested_idempotency_key, recovery.correlation_id, recovery.safe_reason_code, null
  );
  return recovery;
end;
$$;

create function core.mark_nip_reset_failure(
  request_id uuid,
  requested_error core.nip_security_error_code,
  is_retryable boolean,
  requested_idempotency_key text
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  recovery core.nip_recovery_requests;
  next_status core.nip_recovery_status;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  next_status := case when is_retryable then 'RETRYABLE_FAILURE' else 'TERMINAL_FAILURE' end;
  if not core.is_valid_nip_recovery_transition(recovery.status, next_status) then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update core.nip_recovery_requests set
    status = next_status, failed_at = statement_timestamp(),
    last_error_code = requested_error, updated_at = statement_timestamp()
    where id = request_id returning * into recovery;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RESET_FAILED', null,
    requested_idempotency_key, recovery.correlation_id, recovery.safe_reason_code,
    requested_error
  );
  return recovery;
end;
$$;

create function core.expire_nip_reset_authorization(
  request_id uuid,
  requested_idempotency_key text
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare recovery core.nip_recovery_requests;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if recovery.expires_at > statement_timestamp() then raise exception 'RECOVERY_NOT_EXPIRED'; end if;
  if not core.is_valid_nip_recovery_transition(recovery.status, 'EXPIRED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update core.nip_recovery_requests set status = 'EXPIRED', updated_at = statement_timestamp()
    where id = request_id returning * into recovery;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RESET_AUTHORIZATION_EXPIRED',
    null, requested_idempotency_key, recovery.correlation_id, recovery.safe_reason_code, null
  );
  return recovery;
end;
$$;

create function core.revoke_nip_reset_authorization(
  request_id uuid,
  actor_id uuid,
  requested_idempotency_key text
)
returns core.nip_reset_authorizations
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  recovery core.nip_recovery_requests;
  result core.nip_reset_authorizations;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if not core.nip_recovery_actor_is_allowed(actor_id, recovery.account_id, 'REVOKE') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  update core.nip_reset_authorizations set revoked_at = statement_timestamp()
    where recovery_request_id = request_id and consumed_at is null and revoked_at is null
    returning * into result;
  if not found then raise exception 'RESET_AUTHORIZATION_NOT_FOUND'; end if;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RESET_AUTHORIZATION_REVOKED',
    actor_id, requested_idempotency_key, recovery.correlation_id,
    recovery.safe_reason_code, null
  );
  return result;
end;
$$;

create function core.cancel_nip_recovery(
  request_id uuid,
  actor_id uuid,
  requested_idempotency_key text
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare recovery core.nip_recovery_requests;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if not core.nip_recovery_actor_is_allowed(actor_id, recovery.account_id, 'CANCEL') then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if not core.is_valid_nip_recovery_transition(recovery.status, 'CANCELLED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update core.nip_reset_authorizations set revoked_at = statement_timestamp()
    where recovery_request_id = request_id and consumed_at is null and revoked_at is null;
  update core.nip_recovery_requests set
    status = 'CANCELLED', cancelled_by_account_id = actor_id,
    cancelled_at = statement_timestamp(), updated_at = statement_timestamp()
    where id = request_id returning * into recovery;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RECOVERY_CANCELLED',
    actor_id, requested_idempotency_key, recovery.correlation_id,
    'RECOVERY_CANCELLED', null
  );
  return recovery;
end;
$$;

create function core.mark_nip_reconciliation_required(
  request_id uuid,
  requested_idempotency_key text
)
returns core.nip_recovery_requests
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare recovery core.nip_recovery_requests;
begin
  select * into recovery from core.nip_recovery_requests where id = request_id for update;
  if not found then raise exception 'RECOVERY_NOT_FOUND'; end if;
  if not core.is_valid_nip_recovery_transition(recovery.status, 'RECONCILIATION_REQUIRED') then
    raise exception 'INVALID_STATE_TRANSITION';
  end if;
  update core.nip_recovery_requests set
    status = 'RECONCILIATION_REQUIRED', failed_at = statement_timestamp(),
    last_error_code = 'AUTH_RESULT_UNKNOWN', updated_at = statement_timestamp()
    where id = request_id returning * into recovery;
  perform core.append_nip_security_event(
    recovery.account_id, recovery.person_id, recovery.id, 'RECONCILIATION_REQUIRED',
    null, requested_idempotency_key, recovery.correlation_id,
    'AUTH_RESULT_UNKNOWN', 'AUTH_RESULT_UNKNOWN'
  );
  return recovery;
end;
$$;

create function public.record_own_nip_security_event(
  requested_event core.nip_security_event_type,
  requested_idempotency_key text,
  requested_correlation_id uuid,
  requested_error core.nip_security_error_code default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  own_account_id uuid;
  own_person_id uuid;
begin
  if auth.uid() is null then raise exception 'SESSION_REQUIRED'; end if;
  if requested_event not in (
    'AUTHENTICATED_NIP_CHANGE_REQUESTED',
    'AUTHENTICATED_NIP_CHANGED',
    'NIP_CHANGE_FAILED',
    'SESSION_REVOCATION_COMPLETED',
    'SESSION_REVOCATION_FAILED'
  ) then
    raise exception 'EVENT_NOT_ALLOWED';
  end if;
  select accounts.id, accounts.person_id into own_account_id, own_person_id
  from core.accounts
  where accounts.auth_user_id = auth.uid()
    and accounts.account_status = 'ACTIVE';
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  perform core.append_nip_security_event(
    own_account_id, own_person_id, null, requested_event, own_account_id,
    requested_idempotency_key, requested_correlation_id,
    'USER_INITIATED_CHANGE', requested_error
  );
end;
$$;

alter table core.nip_recovery_requests enable row level security;
alter table core.nip_reset_authorizations enable row level security;
alter table core.nip_security_events enable row level security;

revoke all on core.nip_recovery_requests from public, anon, authenticated;
revoke all on core.nip_reset_authorizations from public, anon, authenticated;
revoke all on core.nip_security_events from public, anon, authenticated;

revoke execute on all functions in schema core from public, anon, authenticated;
grant execute on function core.current_auth_user_id() to authenticated;
grant execute on function core.current_account_id() to authenticated;
grant execute on function core.current_person_id() to authenticated;
grant execute on function core.current_account_status() to authenticated;
grant execute on function core.current_role_codes() to authenticated;
grant execute on function core.get_current_identity_context() to authenticated;
revoke execute on function public.record_own_nip_security_event(
  core.nip_security_event_type, text, uuid, core.nip_security_error_code
) from public, anon;
grant execute on function public.record_own_nip_security_event(
  core.nip_security_event_type, text, uuid, core.nip_security_error_code
) to authenticated;
alter default privileges for role postgres in schema core revoke execute on functions from public;
alter default privileges for role postgres in schema core revoke all on tables from public, anon, authenticated;

commit;
