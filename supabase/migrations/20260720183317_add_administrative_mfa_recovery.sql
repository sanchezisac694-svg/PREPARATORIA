begin;

create type core.mfa_recovery_status as enum (
  'REQUESTED', 'PENDING_IDENTITY_VERIFICATION', 'IDENTITY_VERIFIED', 'APPROVED',
  'EXECUTION_PENDING', 'EXECUTION_IN_PROGRESS', 'REENROLLMENT_REQUIRED',
  'REENROLLMENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED',
  'RETRYABLE_FAILURE', 'TERMINAL_FAILURE', 'RECONCILIATION_REQUIRED'
);
create type core.mfa_recovery_reason_code as enum (
  'LOST_ALL_FACTORS', 'LOST_PRIMARY_DEVICE', 'COMPROMISED_AUTHENTICATOR',
  'DAMAGED_DEVICE', 'INACCESSIBLE_AUTHENTICATOR', 'INSTITUTIONAL_CORRECTIVE_ACTION',
  'SECURITY_INCIDENT', 'ACCOUNT_RECOVERY', 'FACTOR_RECONCILIATION', 'ADMINISTRATIVE_ERROR'
);
create type core.mfa_identity_verification_method as enum (
  'IN_PERSON_WITH_INSTITUTIONAL_RECORD', 'IN_PERSON_WITH_GOVERNMENT_ID',
  'VERIFIED_BY_CONTROL_ESCOLAR_RECORDS', 'VERIFIED_BY_AUTHORIZED_GUARDIAN',
  'OTHER_APPROVED_INSTITUTIONAL_PROCEDURE'
);
create type core.mfa_recovery_scope as enum (
  'DELETE_ALL_VERIFIED_TOTP_FACTORS', 'DELETE_SELECTED_COMPROMISED_FACTORS'
);
create type core.mfa_factor_snapshot_status as enum ('VERIFIED', 'UNVERIFIED');
create type core.mfa_factor_operation_status as enum (
  'PENDING', 'DELETE_IN_PROGRESS', 'DELETED', 'NOT_FOUND', 'RETRYABLE_FAILURE',
  'RESULT_UNKNOWN', 'TERMINAL_FAILURE'
);
create type core.mfa_recovery_error_code as enum (
  'MFA_RECOVERY_NOT_FOUND', 'MFA_RECOVERY_INVALID_STATE', 'MFA_RECOVERY_EXPIRED',
  'IDENTITY_VERIFICATION_REQUIRED', 'APPROVAL_REQUIRED', 'APPROVER_NOT_AUTHORIZED',
  'REQUESTER_APPROVER_CONFLICT', 'DUAL_CONTROL_REQUIRED', 'TARGET_ACCOUNT_NOT_ACTIVE',
  'TARGET_ACCOUNT_BLOCKED', 'TARGET_ACCOUNT_DISABLED', 'TARGET_ACCOUNT_NOT_MFA_REQUIRED',
  'NO_VERIFIED_FACTORS', 'FACTOR_LIST_FAILED', 'FACTOR_DELETE_FAILED',
  'FACTOR_DELETE_RESULT_UNKNOWN', 'FACTOR_COUNT_MISMATCH', 'AUTH_ADMIN_ADAPTER_UNAVAILABLE',
  'AUTH_ADMIN_CREDENTIAL_MISSING', 'SESSION_REVOCATION_FAILED',
  'SESSION_VERSION_INVALIDATION_FAILED', 'REENROLLMENT_REQUIRED',
  'REENROLLMENT_NOT_VERIFIED', 'IDEMPOTENCY_CONFLICT', 'CONCURRENT_OPERATION',
  'RECONCILIATION_REQUIRED', 'ACTOR_NOT_AUTHORIZED', 'MFA_RECOVERY_OPERATION_FAILED'
);
create type core.mfa_administrative_event_type as enum (
  'MFA_RECOVERY_REQUESTED', 'MFA_IDENTITY_VERIFICATION_PENDING',
  'MFA_IDENTITY_VERIFIED', 'MFA_RECOVERY_APPROVED',
  'MFA_RECOVERY_EXECUTION_STARTED', 'MFA_FACTOR_LIST_REQUESTED',
  'MFA_FACTOR_LIST_COMPLETED', 'MFA_FACTOR_DELETE_REQUESTED', 'MFA_FACTOR_DELETED',
  'MFA_FACTOR_DELETE_FAILED', 'MFA_SESSION_REVOCATION_REQUESTED',
  'MFA_SESSION_REVOCATION_COMPLETED', 'MFA_SESSION_REVOCATION_FAILED',
  'MFA_REENROLLMENT_REQUIRED', 'MFA_REENROLLMENT_STARTED',
  'MFA_REENROLLMENT_VERIFIED', 'MFA_RECOVERY_COMPLETED',
  'MFA_RECOVERY_CANCELLED', 'MFA_RECOVERY_EXPIRED',
  'MFA_RECOVERY_RETRYABLE_FAILURE', 'MFA_RECOVERY_TERMINAL_FAILURE',
  'MFA_RECOVERY_RECONCILIATION_REQUIRED', 'MFA_ADMIN_ACCESS_REJECTED'
);

create table core.mfa_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references core.accounts(id) on delete restrict,
  person_id uuid not null references core.people(id) on delete restrict,
  status core.mfa_recovery_status not null default 'REQUESTED',
  reason_code core.mfa_recovery_reason_code not null,
  deletion_scope core.mfa_recovery_scope not null default 'DELETE_ALL_VERIFIED_TOTP_FACTORS',
  requested_by_account_id uuid not null references core.accounts(id) on delete restrict,
  verified_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  executed_by_account_id uuid references core.accounts(id) on delete restrict,
  cancelled_by_account_id uuid references core.accounts(id) on delete restrict,
  reconciled_by_account_id uuid references core.accounts(id) on delete restrict,
  verification_method_code core.mfa_identity_verification_method,
  verification_result boolean,
  target_factor_count integer check (target_factor_count >= 0),
  removed_factor_count integer not null default 0 check (removed_factor_count >= 0),
  idempotency_key text not null unique,
  approval_idempotency_key text unique,
  execution_idempotency_key text unique,
  correlation_id uuid,
  requested_at timestamptz not null default statement_timestamp(),
  verified_at timestamptz,
  approved_at timestamptz,
  authorization_expires_at timestamptz,
  execution_started_at timestamptz,
  auth_operation_completed_at timestamptz,
  reenrollment_required_at timestamptz,
  reenrollment_completed_at timestamptz,
  cancelled_at timestamptz,
  failed_at timestamptz,
  reconciliation_required_at timestamptz,
  completed_at timestamptz,
  last_error_code core.mfa_recovery_error_code,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint mfa_recovery_request_ids_differ check (account_id <> requested_by_account_id),
  constraint mfa_recovery_request_safe_keys check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key !~* '(secret|token|cookie|password|nip|email|alias|factor|challenge|otpauth)'
  ),
  constraint mfa_recovery_request_counts check (
    target_factor_count is null or removed_factor_count <= target_factor_count
  ),
  constraint mfa_recovery_request_timestamps check (updated_at >= created_at)
);

create unique index mfa_recovery_one_active_per_account
on core.mfa_recovery_requests(account_id)
where status not in ('COMPLETED', 'CANCELLED', 'EXPIRED', 'TERMINAL_FAILURE');

create table core.mfa_recovery_factor_operations (
  id uuid primary key default gen_random_uuid(),
  recovery_request_id uuid not null references core.mfa_recovery_requests(id) on delete restrict,
  factor_reference_digest text not null,
  factor_status_snapshot core.mfa_factor_snapshot_status not null,
  operation_status core.mfa_factor_operation_status not null default 'PENDING',
  attempted_at timestamptz,
  completed_at timestamptz,
  last_error_code core.mfa_recovery_error_code,
  created_at timestamptz not null default statement_timestamp(),
  constraint mfa_recovery_factor_digest_unique unique (recovery_request_id, factor_reference_digest),
  constraint mfa_recovery_factor_digest_check check (
    factor_reference_digest ~ '^[0-9a-f]{64}$'
  )
);

create table core.mfa_administrative_security_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references core.accounts(id) on delete restrict,
  person_id uuid not null references core.people(id) on delete restrict,
  actor_account_id uuid references core.accounts(id) on delete restrict,
  recovery_request_id uuid not null references core.mfa_recovery_requests(id) on delete restrict,
  event_type core.mfa_administrative_event_type not null,
  reason_code core.mfa_recovery_reason_code not null,
  previous_status core.mfa_recovery_status,
  resulting_status core.mfa_recovery_status not null,
  factor_reference_digest text,
  idempotency_key text not null,
  correlation_id uuid,
  error_code core.mfa_recovery_error_code,
  created_at timestamptz not null default statement_timestamp(),
  constraint mfa_admin_event_unique unique (recovery_request_id, event_type, idempotency_key),
  constraint mfa_admin_event_digest_check check (
    factor_reference_digest is null or factor_reference_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint mfa_admin_event_safe_key check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key !~* '(secret|token|cookie|password|nip|email|alias|factor|challenge|otpauth)'
  )
);

create function core.guard_mfa_administrative_event()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin raise exception 'MFA_ADMINISTRATIVE_EVENT_APPEND_ONLY'; end $$;
create trigger mfa_administrative_events_append_only
before update or delete on core.mfa_administrative_security_events
for each row execute function core.guard_mfa_administrative_event();

create function core.touch_mfa_recovery_request()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at := statement_timestamp(); return new; end $$;
create trigger mfa_recovery_requests_updated_at
before update on core.mfa_recovery_requests
for each row execute function core.touch_mfa_recovery_request();

create function core.mfa_recovery_transition_allowed(
  previous core.mfa_recovery_status, requested core.mfa_recovery_status
) returns boolean language sql immutable security invoker set search_path = ''
as $$
  select case previous
    when 'REQUESTED' then requested in ('PENDING_IDENTITY_VERIFICATION','CANCELLED')
    when 'PENDING_IDENTITY_VERIFICATION' then requested in ('IDENTITY_VERIFIED','CANCELLED','EXPIRED','TERMINAL_FAILURE')
    when 'IDENTITY_VERIFIED' then requested in ('APPROVED','CANCELLED','EXPIRED')
    when 'APPROVED' then requested in ('EXECUTION_PENDING','CANCELLED','EXPIRED')
    when 'EXECUTION_PENDING' then requested in ('EXECUTION_IN_PROGRESS','CANCELLED','EXPIRED')
    when 'EXECUTION_IN_PROGRESS' then requested in ('REENROLLMENT_REQUIRED','RETRYABLE_FAILURE','TERMINAL_FAILURE','RECONCILIATION_REQUIRED')
    when 'RETRYABLE_FAILURE' then requested in ('EXECUTION_PENDING','RECONCILIATION_REQUIRED','TERMINAL_FAILURE','CANCELLED')
    when 'RECONCILIATION_REQUIRED' then requested in ('EXECUTION_PENDING','REENROLLMENT_REQUIRED','COMPLETED','TERMINAL_FAILURE','CANCELLED')
    when 'REENROLLMENT_REQUIRED' then requested in ('REENROLLMENT_IN_PROGRESS','CANCELLED','EXPIRED')
    when 'REENROLLMENT_IN_PROGRESS' then requested in ('COMPLETED','REENROLLMENT_REQUIRED','RECONCILIATION_REQUIRED')
    else false end
$$;

create function core.require_mfa_recovery_actor(
  actor_id uuid, allowed_roles text[], actor_aal text
) returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if actor_aal <> 'aal2' or not exists (
    select 1 from core.accounts a
    join core.account_roles ar on ar.account_id = a.id and ar.revoked_at is null
    join core.roles r on r.id = ar.role_id and r.is_active
    where a.id = actor_id and a.account_status = 'ACTIVE' and r.code = any(allowed_roles)
  ) then raise exception 'ACTOR_NOT_AUTHORIZED'; end if;
end $$;

create function core.append_mfa_administrative_event(
  request_record core.mfa_recovery_requests,
  actor_id uuid,
  requested_event core.mfa_administrative_event_type,
  previous core.mfa_recovery_status,
  operation_key text,
  requested_error core.mfa_recovery_error_code default null,
  requested_digest text default null
) returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  insert into core.mfa_administrative_security_events (
    account_id, person_id, actor_account_id, recovery_request_id, event_type,
    reason_code, previous_status, resulting_status, factor_reference_digest,
    idempotency_key, correlation_id, error_code
  ) values (
    request_record.account_id, request_record.person_id, actor_id, request_record.id,
    requested_event, request_record.reason_code, previous, request_record.status,
    requested_digest, operation_key, request_record.correlation_id, requested_error
  ) on conflict do nothing;
end $$;

create function core.request_mfa_recovery(
  target_account_id uuid, actor_id uuid, requested_reason core.mfa_recovery_reason_code,
  operation_key text, requested_correlation_id uuid default null, actor_aal text default 'aal2'
) returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare target core.accounts%rowtype; existing core.mfa_recovery_requests%rowtype;
  created core.mfa_recovery_requests%rowtype;
begin
  perform core.require_mfa_recovery_actor(actor_id, array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR'], actor_aal);
  select * into target from core.accounts where id = target_account_id for update;
  if not found then raise exception 'MFA_RECOVERY_NOT_FOUND'; end if;
  if target.account_status <> 'ACTIVE' then raise exception 'TARGET_ACCOUNT_NOT_ACTIVE'; end if;
  if target.id = actor_id then raise exception 'ACTOR_NOT_AUTHORIZED'; end if;
  select * into existing from core.mfa_recovery_requests where idempotency_key = operation_key;
  if found then
    if existing.account_id <> target_account_id or existing.requested_by_account_id <> actor_id
      or existing.reason_code <> requested_reason or existing.correlation_id is distinct from requested_correlation_id
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return existing.id;
  end if;
  if not exists (
    select 1 from core.account_mfa_compliance
    where account_id = target.id and requirement_level = 'REQUIRED'
  ) then raise exception 'TARGET_ACCOUNT_NOT_MFA_REQUIRED'; end if;
  insert into core.mfa_recovery_requests (
    account_id, person_id, reason_code, requested_by_account_id, idempotency_key, correlation_id
  ) values (
    target.id, target.person_id, requested_reason, actor_id, operation_key, requested_correlation_id
  ) returning * into created;
  perform core.append_mfa_administrative_event(created, actor_id, 'MFA_RECOVERY_REQUESTED', null, operation_key);
  update core.mfa_recovery_requests set status='PENDING_IDENTITY_VERIFICATION' where id=created.id returning * into created;
  perform core.append_mfa_administrative_event(created, actor_id, 'MFA_IDENTITY_VERIFICATION_PENDING', 'REQUESTED', operation_key);
  return created.id;
end $$;

create function core.record_mfa_identity_verification(
  recovery_id uuid, actor_id uuid, method core.mfa_identity_verification_method,
  operation_key text, actor_aal text default 'aal2'
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype;
begin
  perform core.require_mfa_recovery_actor(actor_id, array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR'], actor_aal);
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if not found then raise exception 'MFA_RECOVERY_NOT_FOUND'; end if;
  if request_record.status <> 'PENDING_IDENTITY_VERIFICATION' then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  update core.mfa_recovery_requests set status='IDENTITY_VERIFIED', verified_by_account_id=actor_id,
    verification_method_code=method, verification_result=true, verified_at=statement_timestamp()
  where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record, actor_id, 'MFA_IDENTITY_VERIFIED',
    'PENDING_IDENTITY_VERIFICATION', operation_key);
  return request_record.status;
end $$;

create function core.approve_mfa_recovery(
  recovery_id uuid, actor_id uuid, operation_key text,
  expires_at timestamptz, actor_aal text default 'aal2'
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype;
begin
  perform core.require_mfa_recovery_actor(actor_id, array['SUPERADMIN','ADMINISTRATIVO'], actor_aal);
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if not found then raise exception 'MFA_RECOVERY_NOT_FOUND'; end if;
  if request_record.approval_idempotency_key = operation_key then return request_record.status; end if;
  if request_record.approval_idempotency_key is not null then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if request_record.status <> 'IDENTITY_VERIFIED' then raise exception 'IDENTITY_VERIFICATION_REQUIRED'; end if;
  if actor_id in (request_record.account_id, request_record.requested_by_account_id)
    then raise exception 'REQUESTER_APPROVER_CONFLICT'; end if;
  if expires_at <= statement_timestamp() then raise exception 'MFA_RECOVERY_EXPIRED'; end if;
  update core.mfa_recovery_requests set status='APPROVED', approved_by_account_id=actor_id,
    approval_idempotency_key=operation_key, approved_at=statement_timestamp(), authorization_expires_at=expires_at
  where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record, actor_id, 'MFA_RECOVERY_APPROVED',
    'IDENTITY_VERIFIED', operation_key);
  return request_record.status;
end $$;

create function core.begin_mfa_recovery_execution(
  recovery_id uuid, actor_id uuid, operation_key text, actor_aal text default 'aal2'
) returns table (account_id uuid, auth_user_id uuid, session_version bigint)
language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype; target core.accounts%rowtype;
  invalidation record;
begin
  perform core.require_mfa_recovery_actor(actor_id, array['SUPERADMIN','ADMINISTRATIVO'], actor_aal);
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if not found then raise exception 'MFA_RECOVERY_NOT_FOUND'; end if;
  if request_record.execution_idempotency_key = operation_key then
    select * into target from core.accounts where id=request_record.account_id;
    return query select target.id, target.auth_user_id, target.session_version; return;
  end if;
  if request_record.execution_idempotency_key is not null then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if request_record.status not in ('APPROVED','EXECUTION_PENDING') then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  if request_record.authorization_expires_at <= statement_timestamp() then raise exception 'MFA_RECOVERY_EXPIRED'; end if;
  if actor_id = request_record.account_id then raise exception 'ACTOR_NOT_AUTHORIZED'; end if;
  select * into target from core.accounts where id=request_record.account_id for update;
  if target.account_status <> 'ACTIVE' then raise exception 'TARGET_ACCOUNT_NOT_ACTIVE'; end if;
  update core.mfa_recovery_requests set status='EXECUTION_IN_PROGRESS',
    executed_by_account_id=actor_id, execution_idempotency_key=operation_key,
    execution_started_at=statement_timestamp()
  where id=recovery_id returning * into request_record;
  select * into invalidation from core.invalidate_account_sessions(
    target.id, actor_id, 'ADMINISTRATIVE_REVOCATION', 'mfa-recovery:' || operation_key,
    request_record.correlation_id, 'SESSION_VERSION_INCREMENTED'
  );
  update core.account_mfa_compliance set status='RECOVERY_REQUIRED',
    recovery_requested_at=statement_timestamp(), enrollment_required_at=statement_timestamp(),
    verified_factor_count=0, achieved_at=null, last_factor_change_at=statement_timestamp(),
    updated_at=statement_timestamp() where account_mfa_compliance.account_id=target.id;
  perform core.append_mfa_administrative_event(request_record, actor_id,
    'MFA_RECOVERY_EXECUTION_STARTED', 'APPROVED', operation_key);
  return query select target.id, target.auth_user_id, invalidation.resulting_session_version;
end $$;

create function core.record_mfa_factor_operation(
  recovery_id uuid, actor_id uuid, digest text, snapshot core.mfa_factor_snapshot_status,
  operation_key text
) returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype; operation_id uuid;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if request_record.status <> 'EXECUTION_IN_PROGRESS' then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  insert into core.mfa_recovery_factor_operations (
    recovery_request_id, factor_reference_digest, factor_status_snapshot
  ) values (recovery_id,digest,snapshot)
  on conflict (recovery_request_id,factor_reference_digest)
  do update set factor_reference_digest=excluded.factor_reference_digest
  returning id into operation_id;
  return operation_id;
end $$;

create function core.complete_mfa_factor_operation(
  recovery_id uuid, operation_id uuid, actor_id uuid,
  result core.mfa_factor_operation_status, requested_error core.mfa_recovery_error_code,
  operation_key text
) returns void language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype; changed integer;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  update core.mfa_recovery_factor_operations set operation_status=result,
    attempted_at=coalesce(attempted_at,statement_timestamp()),
    completed_at=case when result in ('DELETED','NOT_FOUND') then statement_timestamp() else null end,
    last_error_code=requested_error
  where id=operation_id and recovery_request_id=recovery_id
  and operation_status not in ('DELETED','NOT_FOUND');
  get diagnostics changed = row_count;
  if changed > 0 and result in ('DELETED','NOT_FOUND') then
    update core.mfa_recovery_requests set removed_factor_count=removed_factor_count+1
    where id=recovery_id returning * into request_record;
  end if;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    case when result in ('DELETED','NOT_FOUND') then 'MFA_FACTOR_DELETED'::core.mfa_administrative_event_type
      else 'MFA_FACTOR_DELETE_FAILED'::core.mfa_administrative_event_type end,
    request_record.status, operation_key, requested_error,
    (select factor_reference_digest from core.mfa_recovery_factor_operations where id=operation_id));
end $$;

create function core.mark_mfa_reenrollment_required(
  recovery_id uuid, actor_id uuid, factor_count integer, operation_key text
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if request_record.status not in ('EXECUTION_IN_PROGRESS','RECONCILIATION_REQUIRED')
    then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  update core.mfa_recovery_requests set status='REENROLLMENT_REQUIRED',
    target_factor_count=factor_count, auth_operation_completed_at=statement_timestamp(),
    reenrollment_required_at=statement_timestamp()
  where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    'MFA_REENROLLMENT_REQUIRED','EXECUTION_IN_PROGRESS',operation_key);
  return request_record.status;
end $$;

create function core.complete_mfa_recovery(
  recovery_id uuid, actor_id uuid, verified_factor_count integer,
  current_aal text, operation_key text
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if request_record.status='COMPLETED' then return request_record.status; end if;
  if request_record.status not in ('REENROLLMENT_REQUIRED','REENROLLMENT_IN_PROGRESS')
    then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  if current_aal <> 'aal2' or verified_factor_count < 1 then raise exception 'REENROLLMENT_NOT_VERIFIED'; end if;
  update core.account_mfa_compliance set status='COMPLIANT',
    verified_factor_count=complete_mfa_recovery.verified_factor_count,
    achieved_at=statement_timestamp(), recovery_requested_at=null,
    enrollment_required_at=null, enrollment_deadline_at=null,
    last_aal2_verified_at=statement_timestamp(), last_factor_change_at=statement_timestamp(),
    updated_at=statement_timestamp() where account_id=request_record.account_id;
  update core.mfa_recovery_requests set status='COMPLETED',
    reenrollment_completed_at=statement_timestamp(), completed_at=statement_timestamp()
  where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    'MFA_RECOVERY_COMPLETED','REENROLLMENT_IN_PROGRESS',operation_key);
  return request_record.status;
end $$;

create function core.mark_mfa_recovery_failure(
  recovery_id uuid, actor_id uuid, requested_error core.mfa_recovery_error_code,
  retryable boolean, operation_key text
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype; next_status core.mfa_recovery_status;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  next_status := case when retryable then 'RETRYABLE_FAILURE' else 'TERMINAL_FAILURE' end;
  if not core.mfa_recovery_transition_allowed(request_record.status,next_status)
    then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  update core.mfa_recovery_requests set status=next_status, failed_at=statement_timestamp(),
    last_error_code=requested_error where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    case when retryable then 'MFA_RECOVERY_RETRYABLE_FAILURE'::core.mfa_administrative_event_type
      else 'MFA_RECOVERY_TERMINAL_FAILURE'::core.mfa_administrative_event_type end,
    'EXECUTION_IN_PROGRESS',operation_key,requested_error);
  return request_record.status;
end $$;

create function core.mark_mfa_recovery_reconciliation_required(
  recovery_id uuid, actor_id uuid, requested_error core.mfa_recovery_error_code,
  operation_key text
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype;
begin
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if request_record.status not in ('EXECUTION_IN_PROGRESS','RETRYABLE_FAILURE','REENROLLMENT_IN_PROGRESS')
    then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  update core.mfa_recovery_requests set status='RECONCILIATION_REQUIRED',
    reconciliation_required_at=statement_timestamp(), last_error_code=requested_error,
    reconciled_by_account_id=actor_id where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    'MFA_RECOVERY_RECONCILIATION_REQUIRED',null,operation_key,requested_error);
  return request_record.status;
end $$;

create function core.cancel_mfa_recovery(
  recovery_id uuid, actor_id uuid, operation_key text, actor_aal text default 'aal2'
) returns core.mfa_recovery_status language plpgsql volatile security definer set search_path = ''
as $$
declare request_record core.mfa_recovery_requests%rowtype; previous core.mfa_recovery_status;
begin
  perform core.require_mfa_recovery_actor(actor_id,array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR'],actor_aal);
  select * into request_record from core.mfa_recovery_requests where id=recovery_id for update;
  if not found then raise exception 'MFA_RECOVERY_NOT_FOUND'; end if;
  previous:=request_record.status;
  if not core.mfa_recovery_transition_allowed(previous,'CANCELLED')
    then raise exception 'MFA_RECOVERY_INVALID_STATE'; end if;
  update core.mfa_recovery_requests set status='CANCELLED',
    cancelled_by_account_id=actor_id,cancelled_at=statement_timestamp()
  where id=recovery_id returning * into request_record;
  perform core.append_mfa_administrative_event(request_record,actor_id,
    'MFA_RECOVERY_CANCELLED',previous,operation_key);
  return request_record.status;
end $$;

alter table core.mfa_recovery_requests enable row level security;
alter table core.mfa_recovery_factor_operations enable row level security;
alter table core.mfa_administrative_security_events enable row level security;
revoke all on core.mfa_recovery_requests from public, anon, authenticated;
revoke all on core.mfa_recovery_factor_operations from public, anon, authenticated;
revoke all on core.mfa_administrative_security_events from public, anon, authenticated;

revoke execute on function core.guard_mfa_administrative_event()
  from public, anon, authenticated;
revoke execute on function core.touch_mfa_recovery_request()
  from public, anon, authenticated;
revoke execute on function core.mfa_recovery_transition_allowed(
  core.mfa_recovery_status, core.mfa_recovery_status
) from public, anon, authenticated;
revoke execute on function core.require_mfa_recovery_actor(uuid, text[], text)
  from public, anon, authenticated;
revoke execute on function core.append_mfa_administrative_event(
  core.mfa_recovery_requests, uuid, core.mfa_administrative_event_type,
  core.mfa_recovery_status, text, core.mfa_recovery_error_code, text
) from public, anon, authenticated;
revoke execute on function core.request_mfa_recovery(
  uuid, uuid, core.mfa_recovery_reason_code, text, uuid, text
) from public, anon, authenticated;
revoke execute on function core.record_mfa_identity_verification(
  uuid, uuid, core.mfa_identity_verification_method, text, text
) from public, anon, authenticated;
revoke execute on function core.approve_mfa_recovery(
  uuid, uuid, text, timestamptz, text
) from public, anon, authenticated;
revoke execute on function core.begin_mfa_recovery_execution(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke execute on function core.record_mfa_factor_operation(
  uuid, uuid, text, core.mfa_factor_snapshot_status, text
) from public, anon, authenticated;
revoke execute on function core.complete_mfa_factor_operation(
  uuid, uuid, uuid, core.mfa_factor_operation_status, core.mfa_recovery_error_code, text
) from public, anon, authenticated;
revoke execute on function core.mark_mfa_reenrollment_required(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke execute on function core.complete_mfa_recovery(uuid, uuid, integer, text, text)
  from public, anon, authenticated;
revoke execute on function core.mark_mfa_recovery_failure(
  uuid, uuid, core.mfa_recovery_error_code, boolean, text
) from public, anon, authenticated;
revoke execute on function core.mark_mfa_recovery_reconciliation_required(
  uuid, uuid, core.mfa_recovery_error_code, text
) from public, anon, authenticated;
revoke execute on function core.cancel_mfa_recovery(uuid, uuid, text, text)
  from public, anon, authenticated;

alter default privileges for role postgres in schema core revoke execute on functions from public;
alter default privileges for role postgres in schema core revoke all on tables from public, anon, authenticated;

commit;
