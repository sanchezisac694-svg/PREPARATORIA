begin;

create type academic.guardian_relationship_type as enum (
  'MOTHER',
  'FATHER',
  'LEGAL_GUARDIAN',
  'AUTHORIZED_RESPONSIBLE',
  'OTHER_PENDING_VALIDATION'
);
create type academic.guardian_request_source as enum (
  'CONTROL_ESCOLAR',
  'ADMINISTRATIVE_REGISTRATION',
  'DATA_MIGRATION_REVIEWED'
);
create type academic.guardian_link_request_status as enum (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'LINKED',
  'CANCELLED',
  'EXPIRED'
);
create type academic.guardian_request_review_status as enum (
  'PENDING',
  'MANUAL_REVIEW_REQUIRED',
  'VERIFIED',
  'NOT_VERIFIED'
);
create type academic.guardian_link_status as enum (
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'REVOKED',
  'CANCELLED'
);
create type academic.guardian_scope_status as enum ('ACTIVE', 'RETIRED');
create type academic.guardian_link_change_type as enum (
  'REQUEST_CREATED',
  'REQUEST_SUBMITTED',
  'REVIEW_STARTED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'LINK_CREATED',
  'LINK_ACTIVATED',
  'LINK_SUSPENDED',
  'LINK_REACTIVATED',
  'LINK_REVOKED',
  'LINK_EXPIRED',
  'LINK_CANCELLED'
);
create type academic.guardian_request_reason_code as enum (
  'MANUAL_REVIEW_REQUIRED',
  'CONTROL_ESCOLAR_REQUEST',
  'ADMINISTRATIVE_REGISTRATION_REQUEST',
  'DATA_MIGRATION_REVIEWED',
  'DUPLICATE_OPERATION_REJECTED',
  'ROLE_NOT_ALLOWED',
  'ACCOUNT_NOT_ACTIVE',
  'STUDENT_RECORD_NOT_FOUND',
  'SELF_RELATIONSHIP_NOT_ALLOWED',
  'LINK_ALREADY_EXISTS',
  'INSTITUTIONAL_VALIDATION_PENDING',
  'REQUEST_CANCELLED',
  'REQUEST_REJECTED',
  'REQUEST_EXPIRED'
);
create type academic.guardian_link_reason_code as enum (
  'MANUAL_REVIEW_REQUIRED',
  'INITIAL_LINKAGE',
  'SUSPENDED_BY_INSTITUTION',
  'REACTIVATED_BY_INSTITUTION',
  'REVOKED_BY_INSTITUTION',
  'EXPIRED_BY_POLICY',
  'CANCELLED_BY_INSTITUTION',
  'SCOPE_UPDATED',
  'ACCESS_DENIED'
);
create type academic.guardian_portal_entity_type as enum (
  'GUARDIAN_LINK_REQUEST',
  'GUARDIAN_LINK',
  'GUARDIAN_SCOPE',
  'GUARDIAN_ACCESS'
);
create type academic.guardian_portal_event_type as enum (
  'GUARDIAN_LINK_REQUEST_CREATED',
  'GUARDIAN_LINK_REQUEST_SUBMITTED',
  'GUARDIAN_LINK_REVIEW_STARTED',
  'GUARDIAN_LINK_REQUEST_APPROVED',
  'GUARDIAN_LINK_REQUEST_REJECTED',
  'GUARDIAN_STUDENT_LINK_CREATED',
  'GUARDIAN_STUDENT_LINK_ACTIVATED',
  'GUARDIAN_STUDENT_LINK_SUSPENDED',
  'GUARDIAN_STUDENT_LINK_REACTIVATED',
  'GUARDIAN_STUDENT_LINK_REVOKED',
  'GUARDIAN_STUDENT_LINK_EXPIRED',
  'GUARDIAN_SCOPE_CHANGED',
  'GUARDIAN_ACCESS_DENIED',
  'OPERATION_REJECTED'
);
create type academic.guardian_portal_command_type as enum (
  'CREATE_LINK_REQUEST',
  'SUBMIT_LINK_REQUEST',
  'BEGIN_LINK_REVIEW',
  'APPROVE_LINK_REQUEST',
  'REJECT_LINK_REQUEST',
  'CANCEL_LINK_REQUEST',
  'EXPIRE_LINK_REQUEST',
  'CREATE_LINK',
  'ACTIVATE_LINK',
  'SUSPEND_LINK',
  'REACTIVATE_LINK',
  'REVOKE_LINK',
  'EXPIRE_LINK'
);
create type academic.guardian_portal_command_status as enum ('IN_PROGRESS', 'COMPLETED', 'FAILED');

create table academic.guardian_access_scopes (
  id uuid primary key default gen_random_uuid(),
  code academic.normalized_code not null unique,
  name text not null check (char_length(btrim(name)) between 3 and 120),
  can_view_overview boolean not null default false,
  can_view_record boolean not null default false,
  can_view_subjects boolean not null default false,
  can_view_schedule boolean not null default false,
  can_view_attendance boolean not null default false,
  can_view_lateness boolean not null default false,
  can_view_permissions boolean not null default false,
  can_view_grades boolean not null default false,
  can_view_results boolean not null default false,
  can_view_progress boolean not null default false,
  can_view_history boolean not null default false,
  status academic.guardian_scope_status not null default 'ACTIVE',
  created_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic.guardian_student_link_requests (
  id uuid primary key default gen_random_uuid(),
  guardian_account_id uuid not null references core.accounts(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  relationship_type academic.guardian_relationship_type not null,
  request_source academic.guardian_request_source not null,
  status academic.guardian_link_request_status not null default 'DRAFT',
  review_status academic.guardian_request_review_status not null default 'PENDING',
  reason_code academic.guardian_request_reason_code not null default 'MANUAL_REVIEW_REQUIRED',
  requested_by_account_id uuid not null references core.accounts(id) on delete restrict,
  reviewed_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  rejected_by_account_id uuid references core.accounts(id) on delete restrict,
  idempotency_key academic.normalized_code not null,
  request_fingerprint text not null check(request_fingerprint ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requested_by_account_id, idempotency_key),
  check (guardian_account_id <> requested_by_account_id or request_source <> 'DATA_MIGRATION_REVIEWED')
);
create unique index guardian_link_request_one_operational
  on academic.guardian_student_link_requests(guardian_account_id, student_record_id)
  where status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED');

create table academic.guardian_student_links (
  id uuid primary key default gen_random_uuid(),
  guardian_account_id uuid not null references core.accounts(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  source_request_id uuid not null unique references academic.guardian_student_link_requests(id) on delete restrict,
  relationship_type academic.guardian_relationship_type not null,
  status academic.guardian_link_status not null default 'PENDING_ACTIVATION',
  access_scope_id uuid not null references academic.guardian_access_scopes(id) on delete restrict,
  is_primary boolean not null default false,
  valid_from timestamptz not null,
  valid_until timestamptz,
  activated_by_account_id uuid not null references core.accounts(id) on delete restrict,
  suspended_by_account_id uuid references core.accounts(id) on delete restrict,
  revoked_by_account_id uuid references core.accounts(id) on delete restrict,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until >= valid_from)
);
create unique index guardian_link_one_operational
  on academic.guardian_student_links(guardian_account_id, student_record_id)
  where status in ('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED');

create table academic.guardian_student_link_history (
  id uuid primary key default gen_random_uuid(),
  guardian_student_link_id uuid not null references academic.guardian_student_links(id) on delete restrict,
  previous_status academic.guardian_link_status,
  resulting_status academic.guardian_link_status not null,
  change_type academic.guardian_link_change_type not null,
  reason_code academic.guardian_link_reason_code not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table academic.guardian_portal_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key academic.normalized_code not null,
  command_type academic.guardian_portal_command_type not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  request_fingerprint text not null check(request_fingerprint ~ '^[0-9a-f]{64}$'),
  status academic.guardian_portal_command_status not null default 'IN_PROGRESS',
  result_entity_type academic.guardian_portal_entity_type,
  result_entity_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(actor_account_id, command_type, idempotency_key)
);

create table academic.guardian_portal_events (
  id uuid primary key default gen_random_uuid(),
  guardian_student_link_id uuid references academic.guardian_student_links(id) on delete restrict,
  guardian_account_id uuid references core.accounts(id) on delete restrict,
  student_record_id uuid references academic.student_records(id) on delete restrict,
  entity_type academic.guardian_portal_entity_type not null,
  entity_id uuid not null,
  event_type academic.guardian_portal_event_type not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  previous_status text,
  resulting_status text,
  reason_code academic.guardian_link_reason_code not null,
  idempotency_key academic.normalized_code not null,
  correlation_id uuid,
  occurred_at timestamptz not null default now(),
  unique(actor_account_id, event_type, idempotency_key)
);

create index guardian_links_guardian_idx on academic.guardian_student_links(guardian_account_id, status, valid_from desc);
create index guardian_links_student_idx on academic.guardian_student_links(student_record_id, status, valid_from desc);
create index guardian_link_history_link_idx on academic.guardian_student_link_history(guardian_student_link_id, effective_at desc);
create index guardian_events_guardian_idx on academic.guardian_portal_events(guardian_account_id, occurred_at desc);
create index guardian_events_student_idx on academic.guardian_portal_events(student_record_id, occurred_at desc);
create index guardian_commands_created_idx on academic.guardian_portal_commands(created_at);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'guardian_access_scopes',
    'guardian_student_link_requests',
    'guardian_student_links',
    'guardian_student_link_history',
    'guardian_portal_commands',
    'guardian_portal_events'
  ] loop
    execute format('alter table academic.%I enable row level security', table_name);
    execute format('revoke all on table academic.%I from public, anon, authenticated', table_name);
  end loop;
end$$;

create function academic.guardian_portal_fingerprint(payload jsonb)
returns text language sql immutable strict security invoker set search_path='' as
$$ select encode(extensions.digest(convert_to(payload::text, 'UTF8'), 'sha256'), 'hex') $$;

create function academic.valid_guardian_link_request_transition(
  old_status academic.guardian_link_request_status,
  new_status academic.guardian_link_request_status
) returns boolean language sql immutable security invoker set search_path='' as
$$ select (old_status, new_status) in (
  ('DRAFT','SUBMITTED'),
  ('SUBMITTED','UNDER_REVIEW'),
  ('UNDER_REVIEW','APPROVED'),
  ('UNDER_REVIEW','REJECTED'),
  ('APPROVED','LINKED'),
  ('DRAFT','CANCELLED'),
  ('SUBMITTED','CANCELLED'),
  ('SUBMITTED','EXPIRED'),
  ('UNDER_REVIEW','EXPIRED')
) $$;

create function academic.valid_guardian_link_transition(
  old_status academic.guardian_link_status,
  new_status academic.guardian_link_status
) returns boolean language sql immutable security invoker set search_path='' as
$$ select (old_status, new_status) in (
  ('PENDING_ACTIVATION','ACTIVE'),
  ('PENDING_ACTIVATION','CANCELLED'),
  ('ACTIVE','SUSPENDED'),
  ('SUSPENDED','ACTIVE'),
  ('ACTIVE','EXPIRED'),
  ('SUSPENDED','EXPIRED'),
  ('ACTIVE','REVOKED'),
  ('SUSPENDED','REVOKED')
) $$;

create function academic.require_guardian_admin_permission(permission_code text)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor core.accounts%rowtype;
  role_codes text[];
  allowed boolean := false;
begin
  if permission_code not in (
    'portal.guardian_links.read',
    'portal.guardian_links.manage',
    'portal.guardian_links.review',
    'portal.guardian_links.approve',
    'portal.guardian_links.revoke',
    'portal.guardian_scopes.manage'
  ) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if auth.uid() is null then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if not exists (
    select 1
    from core.get_current_identity_context() identity_context
    where identity_context.session_valid
      and identity_context.mfa_satisfied
      and 'SISTEMA_ADMINISTRATIVO' = any(identity_context.allowed_applications)
  ) then
    raise exception 'APPLICATION_NOT_ALLOWED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception 'SESSION_VERSION_INVALID';
  end if;
  if not core.is_current_aal2() or not core.is_current_mfa_policy_satisfied() then
    raise exception 'AAL2_REQUIRED';
  end if;
  select * into actor from core.accounts where auth_user_id = auth.uid();
  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  select coalesce(array_agg(r.code), array[]::text[]) into role_codes
  from core.account_roles ar
  join core.roles r on r.id = ar.role_id and r.is_active
  where ar.account_id = actor.id and ar.revoked_at is null;
  if role_codes && array['SUPERADMIN'] then
    allowed := true;
  elsif role_codes && array['ADMINISTRATIVO'] then
    allowed := permission_code in (
      'portal.guardian_links.read',
      'portal.guardian_links.manage',
      'portal.guardian_links.review',
      'portal.guardian_links.approve',
      'portal.guardian_links.revoke'
    );
  elsif role_codes && array['CONTROL_ESCOLAR'] then
    allowed := permission_code in (
      'portal.guardian_links.read',
      'portal.guardian_links.manage',
      'portal.guardian_links.review',
      'portal.guardian_links.approve',
      'portal.guardian_links.revoke'
    );
  end if;
  if not allowed then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  return actor.id;
end$$;

create function academic.begin_guardian_portal_command(
  actor uuid,
  kind academic.guardian_portal_command_type,
  operation_key text,
  payload jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  fingerprint text := academic.guardian_portal_fingerprint(payload);
  existing academic.guardian_portal_commands%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text || kind::text || operation_key, 0));
  select * into existing
  from academic.guardian_portal_commands
  where actor_account_id = actor
    and command_type = kind
    and idempotency_key = operation_key
  for update;
  if existing.id is not null then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    if existing.status = 'COMPLETED' then
      return existing.result_entity_id;
    end if;
    raise exception 'CONCURRENT_MODIFICATION';
  end if;
  insert into academic.guardian_portal_commands(idempotency_key, command_type, actor_account_id, request_fingerprint)
  values(operation_key, kind, actor, fingerprint);
  return null;
end$$;

create function academic.complete_guardian_portal_command(
  actor uuid,
  kind academic.guardian_portal_command_type,
  operation_key text,
  entity_type academic.guardian_portal_entity_type,
  entity_id uuid
) returns void
language sql
security definer
set search_path=''
as $$
  update academic.guardian_portal_commands
  set status = 'COMPLETED',
      result_entity_type = entity_type,
      result_entity_id = entity_id,
      completed_at = statement_timestamp()
  where actor_account_id = actor
    and command_type = kind
    and idempotency_key = operation_key
$$;

create function academic.append_guardian_portal_event(
  link_id uuid,
  guardian_id uuid,
  student_id uuid,
  entity_type academic.guardian_portal_entity_type,
  entity_id uuid,
  event_type academic.guardian_portal_event_type,
  actor uuid,
  previous_status text,
  resulting_status text,
  reason academic.guardian_link_reason_code,
  operation_key text,
  correlation uuid default null
) returns void
language sql
security definer
set search_path=''
as $$
  insert into academic.guardian_portal_events(
    guardian_student_link_id,
    guardian_account_id,
    student_record_id,
    entity_type,
    entity_id,
    event_type,
    actor_account_id,
    previous_status,
    resulting_status,
    reason_code,
    idempotency_key,
    correlation_id
  )
  values(
    link_id,
    guardian_id,
    student_id,
    entity_type,
    entity_id,
    event_type,
    actor,
    previous_status,
    resulting_status,
    reason,
    operation_key,
    correlation
  )
  on conflict(actor_account_id, event_type, idempotency_key) do nothing
$$;

create function academic.guard_guardian_history()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if current_setting('academic.guardian_portal_controlled_mutation', true) = 'on' then
    return new;
  end if;
  if tg_table_name in ('guardian_student_link_history', 'guardian_portal_events') then
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if tg_table_name = 'guardian_portal_commands' then
    if old.status = 'COMPLETED' and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    return new;
  end if;
  if tg_table_name = 'guardian_access_scopes' and old.status = 'RETIRED' and new is distinct from old then
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if tg_table_name = 'guardian_student_link_requests' and old.status in ('LINKED','REJECTED','CANCELLED','EXPIRED') and new is distinct from old then
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if tg_table_name = 'guardian_student_links' then
    if old.status in ('REVOKED','EXPIRED','CANCELLED') and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    if (new.guardian_account_id, new.student_record_id, new.source_request_id, new.relationship_type)
      is distinct from
      (old.guardian_account_id, old.student_record_id, old.source_request_id, old.relationship_type) then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
  end if;
  return new;
end$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'guardian_access_scopes',
    'guardian_student_link_requests',
    'guardian_student_links',
    'guardian_student_link_history',
    'guardian_portal_commands',
    'guardian_portal_events'
  ] loop
    execute format('create trigger %I_guardian_history before update or delete on academic.%I for each row execute function academic.guard_guardian_history()', table_name, table_name);
  end loop;
end$$;

insert into academic.guardian_access_scopes(
  code,
  name,
  can_view_overview,
  can_view_record,
  can_view_subjects,
  can_view_schedule,
  can_view_attendance,
  can_view_lateness,
  can_view_permissions,
  can_view_grades,
  can_view_results,
  can_view_progress,
  can_view_history,
  created_by_account_id
)
values(
  'STANDARD_ACADEMIC_READ',
  'Scope técnico provisional pendiente de ratificación institucional',
  true, true, true, true, true, true, true, true, true, true, true,
  null
)
on conflict (code) do nothing;

create function academic.assert_guardian_request_preconditions(
  guardian_account uuid,
  student_record uuid
) returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  guardian core.accounts%rowtype;
  student academic.student_records%rowtype;
begin
  select * into guardian from core.accounts where id = guardian_account for update;
  if guardian.id is null or guardian.account_status <> 'ACTIVE' then
    raise exception 'ACCOUNT_NOT_ACTIVE';
  end if;
  if not exists (
    select 1
    from core.account_roles ar
    join core.roles r on r.id = ar.role_id and r.is_active
    where ar.account_id = guardian.id
      and ar.revoked_at is null
      and r.code = 'TUTOR'
  ) then
    raise exception 'GUARDIAN_ROLE_REQUIRED';
  end if;
  select * into student from academic.student_records where id = student_record for update;
  if student.id is null then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;
  if student.person_id = guardian.person_id then
    raise exception 'SELF_RELATIONSHIP_NOT_ALLOWED';
  end if;
end$$;

create function academic.create_guardian_link_request(
  guardian_account_id uuid,
  student_record_id uuid,
  relationship_type academic.guardian_relationship_type,
  request_source academic.guardian_request_source,
  review_status academic.guardian_request_review_status,
  reason_code academic.guardian_request_reason_code,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  created uuid;
begin
  actor := academic.require_guardian_admin_permission('portal.guardian_links.manage');
  prior := academic.begin_guardian_portal_command(
    actor,
    'CREATE_LINK_REQUEST',
    operation_key,
    jsonb_build_object(
      'guardian', guardian_account_id,
      'student', student_record_id,
      'relationship', relationship_type,
      'source', request_source,
      'review', review_status,
      'reason', reason_code
    )
  );
  if prior is not null then
    return query select prior, 'DRAFT';
    return;
  end if;
  perform academic.assert_guardian_request_preconditions(guardian_account_id, student_record_id);
  insert into academic.guardian_student_link_requests(
    guardian_account_id,
    student_record_id,
    relationship_type,
    request_source,
    review_status,
    reason_code,
    requested_by_account_id,
    idempotency_key,
    request_fingerprint
  )
  values(
    guardian_account_id,
    student_record_id,
    relationship_type,
    request_source,
    review_status,
    reason_code,
    actor,
    operation_key,
    academic.guardian_portal_fingerprint(jsonb_build_object(
      'guardian', guardian_account_id,
      'student', student_record_id,
      'relationship', relationship_type,
      'source', request_source,
      'review', review_status,
      'reason', reason_code
    ))
  )
  returning id into created;
  perform academic.complete_guardian_portal_command(actor, 'CREATE_LINK_REQUEST', operation_key, 'GUARDIAN_LINK_REQUEST', created);
  perform academic.append_guardian_portal_event(null, guardian_account_id, student_record_id, 'GUARDIAN_LINK_REQUEST', created, 'GUARDIAN_LINK_REQUEST_CREATED', actor, null, 'DRAFT', 'MANUAL_REVIEW_REQUIRED', operation_key, correlation);
  return query select created, 'DRAFT';
end$$;

create function academic.change_guardian_link_request_status(
  request_id uuid,
  target academic.guardian_link_request_status,
  kind academic.guardian_portal_command_type,
  event_kind academic.guardian_portal_event_type,
  permission_code text,
  target_reason_code academic.guardian_request_reason_code,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  request_row academic.guardian_student_link_requests%rowtype;
begin
  actor := academic.require_guardian_admin_permission(permission_code);
  prior := academic.begin_guardian_portal_command(actor, kind, operation_key, jsonb_build_object('request', request_id, 'target', target, 'reason', target_reason_code));
  if prior is not null then
    return query select prior, target::text;
    return;
  end if;
  select * into request_row from academic.guardian_student_link_requests where id = request_id for update;
  if request_row.id is null then
    raise exception 'GUARDIAN_LINK_REQUEST_NOT_FOUND';
  end if;
  if not academic.valid_guardian_link_request_transition(request_row.status, target) then
    raise exception 'GUARDIAN_LINK_REQUEST_INVALID_STATE';
  end if;
  perform set_config('academic.guardian_portal_controlled_mutation', 'on', true);
  update academic.guardian_student_link_requests
  set status = target,
      reason_code = coalesce(target_reason_code, request_row.reason_code),
      reviewed_by_account_id = case when target = 'UNDER_REVIEW' then actor else reviewed_by_account_id end,
      approved_by_account_id = case when target = 'APPROVED' then actor else approved_by_account_id end,
      rejected_by_account_id = case when target = 'REJECTED' then actor else rejected_by_account_id end,
      reviewed_at = case when target = 'UNDER_REVIEW' then statement_timestamp() else reviewed_at end,
      approved_at = case when target = 'APPROVED' then statement_timestamp() else approved_at end,
      rejected_at = case when target = 'REJECTED' then statement_timestamp() else rejected_at end,
      cancelled_at = case when target = 'CANCELLED' then statement_timestamp() else cancelled_at end,
      expires_at = case when target = 'EXPIRED' then statement_timestamp() else expires_at end,
      updated_at = statement_timestamp()
  where id = request_id;
  perform set_config('academic.guardian_portal_controlled_mutation', 'off', true);
  perform academic.complete_guardian_portal_command(actor, kind, operation_key, 'GUARDIAN_LINK_REQUEST', request_id);
  perform academic.append_guardian_portal_event(null, request_row.guardian_account_id, request_row.student_record_id, 'GUARDIAN_LINK_REQUEST', request_id, event_kind, actor, request_row.status::text, target::text, 'MANUAL_REVIEW_REQUIRED', operation_key, correlation);
  return query select request_id, target::text;
end$$;

create function academic.submit_guardian_link_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'SUBMITTED', 'SUBMIT_LINK_REQUEST', 'GUARDIAN_LINK_REQUEST_SUBMITTED', 'portal.guardian_links.manage', 'MANUAL_REVIEW_REQUIRED', operation_key, correlation) $$;
create function academic.begin_guardian_link_review(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'UNDER_REVIEW', 'BEGIN_LINK_REVIEW', 'GUARDIAN_LINK_REVIEW_STARTED', 'portal.guardian_links.review', 'MANUAL_REVIEW_REQUIRED', operation_key, correlation) $$;
create function academic.approve_guardian_link_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'APPROVED', 'APPROVE_LINK_REQUEST', 'GUARDIAN_LINK_REQUEST_APPROVED', 'portal.guardian_links.approve', 'MANUAL_REVIEW_REQUIRED', operation_key, correlation) $$;
create function academic.reject_guardian_link_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'REJECTED', 'REJECT_LINK_REQUEST', 'GUARDIAN_LINK_REQUEST_REJECTED', 'portal.guardian_links.approve', 'REQUEST_REJECTED', operation_key, correlation) $$;
create function academic.cancel_guardian_link_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'CANCELLED', 'CANCEL_LINK_REQUEST', 'OPERATION_REJECTED', 'portal.guardian_links.manage', 'REQUEST_CANCELLED', operation_key, correlation) $$;
create function academic.expire_guardian_link_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_link_request_status(request_id, 'EXPIRED', 'EXPIRE_LINK_REQUEST', 'OPERATION_REJECTED', 'portal.guardian_links.manage', 'REQUEST_EXPIRED', operation_key, correlation) $$;

create function academic.create_guardian_student_link(
  request_id uuid,
  scope_code text default 'STANDARD_ACADEMIC_READ',
  valid_from timestamptz default statement_timestamp(),
  valid_until timestamptz default null,
  is_primary boolean default false,
  operation_key text default 'AUTO',
  correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  request_row academic.guardian_student_link_requests%rowtype;
  created uuid;
  scope_id uuid;
begin
  actor := academic.require_guardian_admin_permission('portal.guardian_links.manage');
  prior := academic.begin_guardian_portal_command(actor, 'CREATE_LINK', operation_key, jsonb_build_object('request', request_id, 'scope', upper(btrim(scope_code)), 'from', valid_from, 'until', valid_until, 'primary', is_primary));
  if prior is not null then
    return query select prior, 'PENDING_ACTIVATION';
    return;
  end if;
  select * into request_row from academic.guardian_student_link_requests where id = request_id for update;
  if request_row.id is null or request_row.status <> 'APPROVED' then
    raise exception 'GUARDIAN_LINK_REQUEST_INVALID_STATE';
  end if;
  select scopes.id
  into scope_id
  from academic.guardian_access_scopes scopes
  where scopes.code = upper(btrim(scope_code))
    and scopes.status = 'ACTIVE';
  if scope_id is null then
    raise exception 'GUARDIAN_SCOPE_DENIED';
  end if;
  insert into academic.guardian_student_links(
    guardian_account_id,
    student_record_id,
    source_request_id,
    relationship_type,
    status,
    access_scope_id,
    is_primary,
    valid_from,
    valid_until,
    activated_by_account_id
  )
  values(
    request_row.guardian_account_id,
    request_row.student_record_id,
    request_row.id,
    request_row.relationship_type,
    'PENDING_ACTIVATION',
    scope_id,
    is_primary,
    valid_from,
    valid_until,
    actor
  )
  returning id into created;
  perform set_config('academic.guardian_portal_controlled_mutation', 'on', true);
  update academic.guardian_student_link_requests
  set status = 'LINKED',
      updated_at = statement_timestamp()
  where id = request_row.id;
  insert into academic.guardian_student_link_history(
    guardian_student_link_id,
    previous_status,
    resulting_status,
    change_type,
    reason_code,
    actor_account_id
  )
  values(created, null, 'PENDING_ACTIVATION', 'LINK_CREATED', 'INITIAL_LINKAGE', actor);
  perform set_config('academic.guardian_portal_controlled_mutation', 'off', true);
  perform academic.complete_guardian_portal_command(actor, 'CREATE_LINK', operation_key, 'GUARDIAN_LINK', created);
  perform academic.append_guardian_portal_event(created, request_row.guardian_account_id, request_row.student_record_id, 'GUARDIAN_LINK', created, 'GUARDIAN_STUDENT_LINK_CREATED', actor, null, 'PENDING_ACTIVATION', 'INITIAL_LINKAGE', operation_key, correlation);
  return query select created, 'PENDING_ACTIVATION';
end$$;

create function academic.change_guardian_student_link_status(
  link_id uuid,
  target academic.guardian_link_status,
  kind academic.guardian_portal_command_type,
  event_kind academic.guardian_portal_event_type,
  permission_code text,
  reason academic.guardian_link_reason_code,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  current_link academic.guardian_student_links%rowtype;
begin
  actor := academic.require_guardian_admin_permission(permission_code);
  prior := academic.begin_guardian_portal_command(actor, kind, operation_key, jsonb_build_object('link', link_id, 'target', target, 'reason', reason));
  if prior is not null then
    return query select prior, target::text;
    return;
  end if;
  select * into current_link from academic.guardian_student_links where id = link_id for update;
  if current_link.id is null then
    raise exception 'GUARDIAN_LINK_NOT_FOUND';
  end if;
  if not academic.valid_guardian_link_transition(current_link.status, target) then
    raise exception 'GUARDIAN_LINK_CONFLICT';
  end if;
  perform set_config('academic.guardian_portal_controlled_mutation', 'on', true);
  update academic.guardian_student_links
  set status = target,
      activated_at = case when target = 'ACTIVE' and activated_at is null then statement_timestamp() else activated_at end,
      suspended_by_account_id = case when target = 'SUSPENDED' then actor else suspended_by_account_id end,
      revoked_by_account_id = case when target = 'REVOKED' then actor else revoked_by_account_id end,
      suspended_at = case when target = 'SUSPENDED' then statement_timestamp() when target = 'ACTIVE' then null else suspended_at end,
      revoked_at = case when target = 'REVOKED' then statement_timestamp() else revoked_at end,
      updated_at = statement_timestamp()
  where id = current_link.id;
  insert into academic.guardian_student_link_history(
    guardian_student_link_id,
    previous_status,
    resulting_status,
    change_type,
    reason_code,
    actor_account_id
  )
  values(
    current_link.id,
    current_link.status,
    target,
    case
      when target = 'ACTIVE' and current_link.status = 'PENDING_ACTIVATION' then 'LINK_ACTIVATED'::academic.guardian_link_change_type
      when target = 'ACTIVE' then 'LINK_REACTIVATED'::academic.guardian_link_change_type
      when target = 'SUSPENDED' then 'LINK_SUSPENDED'::academic.guardian_link_change_type
      when target = 'REVOKED' then 'LINK_REVOKED'::academic.guardian_link_change_type
      when target = 'EXPIRED' then 'LINK_EXPIRED'::academic.guardian_link_change_type
      else 'LINK_CANCELLED'::academic.guardian_link_change_type
    end,
    reason,
    actor
  );
  perform set_config('academic.guardian_portal_controlled_mutation', 'off', true);
  perform academic.complete_guardian_portal_command(actor, kind, operation_key, 'GUARDIAN_LINK', current_link.id);
  perform academic.append_guardian_portal_event(current_link.id, current_link.guardian_account_id, current_link.student_record_id, 'GUARDIAN_LINK', current_link.id, event_kind, actor, current_link.status::text, target::text, reason, operation_key, correlation);
  return query select current_link.id, target::text;
end$$;

create function academic.activate_guardian_student_link(link_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_student_link_status(link_id, 'ACTIVE', 'ACTIVATE_LINK', 'GUARDIAN_STUDENT_LINK_ACTIVATED', 'portal.guardian_links.manage', 'INITIAL_LINKAGE', operation_key, correlation) $$;
create function academic.suspend_guardian_student_link(link_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_student_link_status(link_id, 'SUSPENDED', 'SUSPEND_LINK', 'GUARDIAN_STUDENT_LINK_SUSPENDED', 'portal.guardian_links.revoke', 'SUSPENDED_BY_INSTITUTION', operation_key, correlation) $$;
create function academic.reactivate_guardian_student_link(link_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_student_link_status(link_id, 'ACTIVE', 'REACTIVATE_LINK', 'GUARDIAN_STUDENT_LINK_REACTIVATED', 'portal.guardian_links.manage', 'REACTIVATED_BY_INSTITUTION', operation_key, correlation) $$;
create function academic.revoke_guardian_student_link(link_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_student_link_status(link_id, 'REVOKED', 'REVOKE_LINK', 'GUARDIAN_STUDENT_LINK_REVOKED', 'portal.guardian_links.revoke', 'REVOKED_BY_INSTITUTION', operation_key, correlation) $$;
create function academic.expire_guardian_student_link(link_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text) language sql security definer set search_path='' as
$$ select * from academic.change_guardian_student_link_status(link_id, 'EXPIRED', 'EXPIRE_LINK', 'GUARDIAN_STUDENT_LINK_EXPIRED', 'portal.guardian_links.manage', 'EXPIRED_BY_POLICY', operation_key, correlation) $$;

create function academic.require_guardian_portal_context(
  requested_link_id uuid,
  requested_period_id uuid default null
) returns table(
  guardian_account_id uuid,
  student_record_id uuid,
  selected_period_enrollment_id uuid,
  selected_academic_period_id uuid,
  access_scope_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_account core.accounts%rowtype;
  current_link academic.guardian_student_links%rowtype;
  current_enrollment academic.period_enrollments%rowtype;
  current_scope academic.guardian_access_scopes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  if not exists (
    select 1
    from core.get_current_identity_context() identity_context
    where identity_context.session_valid
      and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
  ) then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  select * into current_account from core.accounts where auth_user_id = auth.uid();
  if current_account.id is null or current_account.account_status <> 'ACTIVE' then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  if not exists (
    select 1
    from core.account_roles assignments
    join core.roles roles on roles.id = assignments.role_id
    where assignments.account_id = current_account.id
      and assignments.revoked_at is null
      and roles.is_active
      and roles.code = 'TUTOR'
  ) then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  select *
  into current_link
  from academic.guardian_student_links links
  where links.id = requested_link_id
    and links.guardian_account_id = current_account.id
    and links.status = 'ACTIVE'
    and links.valid_from <= statement_timestamp()
    and (links.valid_until is null or links.valid_until >= statement_timestamp());
  if current_link.id is null then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  select * into current_scope
  from academic.guardian_access_scopes
  where id = current_link.access_scope_id
    and status = 'ACTIVE';
  if current_scope.id is null then
    raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
  end if;
  if requested_period_id is null then
    select pe.*
    into current_enrollment
    from academic.period_enrollments pe
    join academic.academic_periods ap on ap.id = pe.academic_period_id
    where pe.student_record_id = current_link.student_record_id
      and pe.status <> 'CANCELLED'
    order by ap.starts_on desc, pe.enrolled_at desc
    limit 1;
  else
    select pe.*
    into current_enrollment
    from academic.period_enrollments pe
    where pe.student_record_id = current_link.student_record_id
      and pe.academic_period_id = requested_period_id
      and pe.status <> 'CANCELLED'
    limit 1;
    if current_enrollment.id is null then
      raise exception 'GUARDIAN_PORTAL_ACCESS_DENIED';
    end if;
  end if;
  return query select current_account.id, current_link.student_record_id, current_enrollment.id, current_enrollment.academic_period_id, current_scope.id;
end$$;

create function academic.get_guardian_scope(scope_id uuid)
returns academic.guardian_access_scopes
language sql stable security definer set search_path='' as
$$ select * from academic.guardian_access_scopes where id = scope_id $$;

create function academic.get_my_linked_students()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with base as (
  select *
  from core.get_current_identity_context() identity_context
  where identity_context.session_valid
    and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
),
guardian as (
  select a.id as account_id
  from base
  join core.accounts a on a.auth_user_id = auth.uid()
  where a.account_status = 'ACTIVE'
    and exists (
      select 1 from core.account_roles ar
      join core.roles r on r.id = ar.role_id and r.is_active
      where ar.account_id = a.id and ar.revoked_at is null and r.code = 'TUTOR'
    )
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'linkId', links.id,
      'linkStatus', links.status,
      'relationshipType', links.relationship_type,
      'isPrimary', links.is_primary,
      'validFrom', links.valid_from,
      'validUntil', links.valid_until,
      'studentStatus', records.status,
      'institutionalStudentCode', records.institutional_student_code,
      'currentSemesterNumber', records.current_semester_number,
      'scopeCode', scopes.code
    )
    order by records.institutional_student_code nulls last, links.created_at desc
  ),
  '[]'::jsonb
)
from guardian
join academic.guardian_student_links links on links.guardian_account_id = guardian.account_id
join academic.student_records records on records.id = links.student_record_id
join academic.guardian_access_scopes scopes on scopes.id = links.access_scope_id and scopes.status = 'ACTIVE'
where links.status in ('ACTIVE', 'SUSPENDED', 'PENDING_ACTIVATION', 'EXPIRED', 'REVOKED')
$$;

create function academic.get_my_guardian_portal_overview()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
select jsonb_build_object(
  'linkedStudents', academic.get_my_linked_students(),
  'totalLinkedStudents', jsonb_array_length(academic.get_my_linked_students())
)
$$;

create function academic.get_my_guardian_student_record(link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from academic.require_guardian_portal_context(link_id, null)
),
scope_data as (
  select * from academic.get_guardian_scope((select access_scope_id from context))
)
select case
  when not (select can_view_record from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
  else jsonb_build_object(
    'studentStatus', records.status,
    'institutionalStudentCode', records.institutional_student_code,
    'currentSemesterNumber', records.current_semester_number,
    'studyPlan', jsonb_build_object('code', plans.code, 'name', plans.name, 'version', plans.version, 'status', plans.status),
    'generation', jsonb_build_object('code', generations.code, 'name', generations.name, 'status', generations.status),
    'trainingArea', case when areas.id is null then null else jsonb_build_object('code', areas.code, 'name', areas.name) end
  )
end
from context
join academic.student_records records on records.id = context.student_record_id
join academic.study_plans plans on plans.id = records.study_plan_id
join academic.student_generations generations on generations.id = records.generation_id
left join academic.training_areas areas on areas.id = records.current_training_area_id;
$$;

create function academic.get_my_guardian_student_overview(link_id uuid, requested_period_id uuid default null)
returns jsonb
language sql stable security definer set search_path='' as
$$
with context as (
  select * from academic.require_guardian_portal_context(link_id, requested_period_id)
),
scope_data as (
  select * from academic.get_guardian_scope((select access_scope_id from context))
),
period_data as (
  select pe.id as period_enrollment_id, pe.status as enrollment_status, pe.semester_number, ap.id as academic_period_id, ap.code as academic_period_code, ap.name as academic_period_name, ap.starts_on, ap.ends_on, g.code as group_code, g.display_name as group_name
  from context
  left join academic.period_enrollments pe on pe.id = context.selected_period_enrollment_id
  left join academic.academic_periods ap on ap.id = pe.academic_period_id
  left join academic.groups g on g.id = pe.group_id
),
subject_counts as (
  select count(*)::integer as total_subjects
  from context
  join academic.student_offering_enrollments soe on soe.period_enrollment_id = context.selected_period_enrollment_id and soe.status in ('ACTIVE','COMPLETED')
),
attendance_data as (
  select
    count(*)::integer as total_sessions,
    count(*) filter (where records.attendance_status = 'PRESENT')::integer as present_count,
    count(*) filter (where records.attendance_status = 'ABSENT')::integer as absent_count,
    count(*) filter (where records.attendance_status = 'LATE')::integer as late_count,
    count(*) filter (where records.attendance_status = 'EXCUSED')::integer as excused_count
  from context
  join academic.attendance_records records on records.student_record_id = context.student_record_id
  join academic.attendance_sessions sessions on sessions.id = records.attendance_session_id
  where context.selected_academic_period_id is not null
    and sessions.academic_period_id = context.selected_academic_period_id
    and sessions.status in ('CLOSED', 'LOCKED')
),
summary_data as (
  select *
  from academic.semester_evaluation_summaries
  where period_enrollment_id = (select selected_period_enrollment_id from context)
    and evaluation_status = 'CONFIRMED'
)
select case
  when not (select can_view_overview from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
  else jsonb_build_object(
    'student', academic.get_my_guardian_student_record(link_id),
    'selectedPeriod', case when period_data.academic_period_id is null then null else jsonb_build_object(
      'id', period_data.academic_period_id,
      'code', period_data.academic_period_code,
      'name', period_data.academic_period_name,
      'startsOn', period_data.starts_on,
      'endsOn', period_data.ends_on,
      'semesterNumber', period_data.semester_number,
      'enrollmentStatus', period_data.enrollment_status,
      'group', case when period_data.group_code is null then null else jsonb_build_object('code', period_data.group_code, 'name', period_data.group_name) end
    ) end,
    'metrics', jsonb_build_object(
      'totalSubjects', coalesce((select total_subjects from subject_counts), 0),
      'attendanceSessions', coalesce((select total_sessions from attendance_data), 0)
    ),
    'attendance', jsonb_build_object(
      'presentCount', coalesce((select present_count from attendance_data), 0),
      'absentCount', coalesce((select absent_count from attendance_data), 0),
      'lateCount', coalesce((select late_count from attendance_data), 0),
      'excusedCount', coalesce((select excused_count from attendance_data), 0)
    ),
    'summary', (
      select case when summary_data.id is null then null else jsonb_build_object(
        'evaluationStatus', summary_data.evaluation_status,
        'proposedProgressDecision', summary_data.proposed_progress_decision,
        'proposalReasonCode', summary_data.proposal_reason_code,
        'totalSubjectCount', summary_data.total_subject_count,
        'accreditedSubjectCount', summary_data.accredited_subject_count,
        'nonAccreditedSubjectCount', summary_data.non_accredited_subject_count,
        'pendingSubjectCount', summary_data.pending_subject_count
      ) end
      from summary_data
      limit 1
    )
  )
end
from period_data;
$$;

create function academic.get_my_guardian_student_subjects(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, requested_period_id)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
 when not (select can_view_subjects from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else coalesce((
  select jsonb_agg(jsonb_build_object(
    'subjectCode', subjects.code,
    'subjectName', subjects.name,
    'groupCode', groups.code,
    'groupName', groups.display_name,
    'teacherName', 'Docente pendiente de asignación',
    'teacherAssignmentStatus', assignments.status,
    'result', case when results.id is null then null else jsonb_build_object('resultCode', results.result_code, 'roundedFinalGrade', results.rounded_final_grade, 'status', results.status) end
  ) order by subjects.name)
  from academic.student_offering_enrollments enrollments
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.groups groups on groups.id = offerings.group_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  left join academic.teaching_assignments assignments on assignments.academic_offering_id = offerings.id and assignments.assignment_type = 'PRIMARY' and assignments.status = 'ACTIVE'
  left join academic.subject_final_results results on results.student_offering_enrollment_id = enrollments.id and results.status = 'CONFIRMED'
  where enrollments.period_enrollment_id = (select selected_period_enrollment_id from context)
    and enrollments.status in ('ACTIVE', 'COMPLETED')
 ), '[]'::jsonb)
end;
$$;

create function academic.get_my_guardian_student_schedule(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, requested_period_id)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
 when not (select can_view_schedule from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else coalesce((
   select jsonb_agg(jsonb_build_object(
    'weekday', sessions.weekday,
    'timeBlock', blocks.display_name,
    'startsAt', blocks.starts_at,
    'endsAt', blocks.ends_at,
    'subjectCode', subjects.code,
    'subjectName', subjects.name,
    'groupCode', groups.code,
    'groupName', groups.display_name,
    'teacherName', 'Docente pendiente de asignación',
    'spaceName', spaces.name,
    'spaceCode', spaces.code,
    'sessionType', sessions.session_type
   ) order by sessions.weekday, blocks.sequence_number, subjects.name)
   from academic.student_offering_enrollments enrollments
   join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
   join academic.class_sessions sessions on sessions.academic_offering_id = offerings.id and sessions.status = 'ACTIVE'
   join academic.group_schedules schedules on schedules.id = sessions.group_schedule_id and schedules.status = 'PUBLISHED'
   join academic.schedule_time_blocks blocks on blocks.id = sessions.time_block_id
   join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
   join academic.subjects subjects on subjects.id = curriculum.subject_id
   join academic.groups groups on groups.id = offerings.group_id
   join academic.academic_spaces spaces on spaces.id = sessions.academic_space_id
   where enrollments.period_enrollment_id = (select selected_period_enrollment_id from context)
     and enrollments.status in ('ACTIVE','COMPLETED')
 ), '[]'::jsonb)
end;
$$;

create function academic.get_my_guardian_student_attendance(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, requested_period_id)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context))),
records as (
  select sessions.session_date, sessions.status as session_status, attendance.attendance_status, attendance.lateness_minutes,
         subjects.code as subject_code, subjects.name as subject_name, blocks.display_name as time_block_name, blocks.starts_at, blocks.ends_at
  from context
  join academic.attendance_records attendance on attendance.student_record_id = context.student_record_id
  join academic.attendance_sessions sessions on sessions.id = attendance.attendance_session_id
  join academic.student_offering_enrollments enrollments on enrollments.id = attendance.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  join academic.class_sessions class_sessions on class_sessions.id = sessions.class_session_id
  join academic.schedule_time_blocks blocks on blocks.id = class_sessions.time_block_id
  where sessions.academic_period_id = (select selected_academic_period_id from context)
    and sessions.status in ('CLOSED','LOCKED')
),
lateness as (
  select coalesce(counters.current_count,0) as current_count,
         coalesce(counters.lifetime_count,0) as lifetime_count,
         coalesce(counters.alert_sequence,0) as alert_sequence,
         coalesce((select count(*)::integer from academic.lateness_alerts alerts where alerts.student_record_id = (select student_record_id from context) and alerts.academic_period_id = (select selected_academic_period_id from context) and alerts.status in ('PENDING_NOTIFICATION','NOTIFICATION_RECORDED','ACKNOWLEDGED')),0) as visible_alert_count
  from context
  left join academic.student_lateness_counters counters
    on counters.student_record_id = context.student_record_id
   and counters.academic_period_id = context.selected_academic_period_id
   and counters.counter_type = 'FIRST_PERIOD_VALIDATED'
)
select case
 when not (select can_view_attendance from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else jsonb_build_object(
   'records', coalesce((select jsonb_agg(jsonb_build_object(
      'sessionDate', records.session_date,
      'sessionStatus', records.session_status,
      'attendanceStatus', records.attendance_status,
      'latenessMinutes', records.lateness_minutes,
      'subjectCode', records.subject_code,
      'subjectName', records.subject_name,
      'timeBlockName', records.time_block_name,
      'startsAt', records.starts_at,
      'endsAt', records.ends_at
   ) order by records.session_date desc, records.starts_at asc, records.subject_name) from records), '[]'::jsonb),
   'lateness', jsonb_build_object(
      'currentCount', (select current_count from lateness),
      'lifetimeCount', (select lifetime_count from lateness),
      'alertSequence', (select alert_sequence from lateness),
      'visibleAlertCount', (select visible_alert_count from lateness)
   )
 )
end;
$$;

create function academic.get_my_guardian_student_permissions(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, requested_period_id)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
 when not (select can_view_permissions from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else coalesce((
   select jsonb_agg(jsonb_build_object(
      'permissionType', permissions.permission_type,
      'status', permissions.status,
      'reasonCode', permissions.reason_code,
      'appliesToDate', permissions.applies_to_date,
      'startsAt', permissions.starts_at,
      'endsAt', permissions.ends_at,
      'visibleValidationStatus', (
        select validations.validation_status
        from academic.permission_validations validations
        where validations.permission_id = permissions.id
          and validations.validation_status in ('APPROVED','REJECTED','REVOKED')
        order by validations.validated_at desc
        limit 1
      )
   ) order by permissions.applies_to_date desc, permissions.created_at desc)
   from academic.student_permissions permissions
   where permissions.student_record_id = (select student_record_id from context)
     and permissions.academic_period_id = (select selected_academic_period_id from context)
     and permissions.status in ('APPROVED','APPLIED')
 ), '[]'::jsonb)
end;
$$;

create function academic.get_my_guardian_student_grades(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, requested_period_id)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context))),
unit_rows as (
  select subjects.code as subject_code, subjects.name as subject_name, grades.unit_number, grades.normalized_grade, grades.is_accredited, grades.status
  from context
  join academic.student_unit_grades grades on grades.student_record_id = context.student_record_id
  join academic.student_offering_enrollments enrollments on enrollments.id = grades.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  where grades.period_enrollment_id = context.selected_period_enrollment_id
    and grades.status in ('FINALIZED','CORRECTED')
),
result_rows as (
  select subjects.code as subject_code, subjects.name as subject_name, results.result_code, results.rounded_final_grade, results.calculation_status, results.status
  from context
  join academic.subject_final_results results on results.student_record_id = context.student_record_id
  join academic.student_offering_enrollments enrollments on enrollments.id = results.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  where results.period_enrollment_id = context.selected_period_enrollment_id
    and results.status = 'CONFIRMED'
),
summary_row as (
  select * from academic.semester_evaluation_summaries
  where period_enrollment_id = (select selected_period_enrollment_id from context)
    and evaluation_status = 'CONFIRMED'
)
select case
 when not (select can_view_grades from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else jsonb_build_object(
   'unitGrades', coalesce((select jsonb_agg(jsonb_build_object(
      'subjectCode', unit_rows.subject_code,
      'subjectName', unit_rows.subject_name,
      'unitNumber', unit_rows.unit_number,
      'normalizedGrade', unit_rows.normalized_grade,
      'isAccredited', unit_rows.is_accredited,
      'status', unit_rows.status
   ) order by unit_rows.subject_name, unit_rows.unit_number) from unit_rows), '[]'::jsonb),
   'subjectResults', case when not (select can_view_results from scope_data) then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
      'subjectCode', result_rows.subject_code,
      'subjectName', result_rows.subject_name,
      'resultCode', result_rows.result_code,
      'roundedFinalGrade', result_rows.rounded_final_grade,
      'calculationStatus', result_rows.calculation_status,
      'status', result_rows.status
   ) order by result_rows.subject_name) from result_rows), '[]'::jsonb) end,
   'summary', (select case when summary_row.id is null then null else jsonb_build_object(
      'evaluationStatus', summary_row.evaluation_status,
      'proposedProgressDecision', summary_row.proposed_progress_decision,
      'proposalReasonCode', summary_row.proposal_reason_code,
      'totalSubjectCount', summary_row.total_subject_count,
      'accreditedSubjectCount', summary_row.accredited_subject_count,
      'nonAccreditedSubjectCount', summary_row.non_accredited_subject_count,
      'pendingSubjectCount', summary_row.pending_subject_count
   ) end from summary_row limit 1)
 )
end;
$$;

create function academic.get_my_guardian_student_results(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$
select coalesce((academic.get_my_guardian_student_grades(link_id, requested_period_id)->'subjectResults'), '[]'::jsonb)
$$;

create function academic.get_my_guardian_student_progress(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, null)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
 when not (select can_view_progress from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else coalesce((
   select jsonb_agg(jsonb_build_object(
      'sourceAcademicPeriodId', periods.id,
      'sourceAcademicPeriodCode', periods.code,
      'sourceAcademicPeriodName', periods.name,
      'decisionType', decisions.decision_type,
      'decisionStatus', decisions.decision_status,
      'resultingSemesterNumber', decisions.resulting_semester_number,
      'reasonCode', decisions.reason_code
   ) order by periods.starts_on desc, decisions.created_at desc)
   from academic.academic_progress_decisions decisions
   join academic.academic_periods periods on periods.id = decisions.source_academic_period_id
   where decisions.student_record_id = (select student_record_id from context)
     and decisions.decision_status = 'CONFIRMED'
 ), '[]'::jsonb)
end;
$$;

create function academic.get_my_guardian_student_history(link_id uuid, limit_count int default 20, offset_count int default 0)
returns jsonb language sql stable security definer set search_path='' as
$$
with context as (select * from academic.require_guardian_portal_context(link_id, null)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
 when not (select can_view_history from scope_data) then jsonb_build_object('error', 'GUARDIAN_PORTAL_ACCESS_DENIED')
 else coalesce((
   select jsonb_agg(jsonb_build_object(
      'academicPeriodId', periods.id,
      'academicPeriodCode', periods.code,
      'academicPeriodName', periods.name,
      'semesterNumber', enrollments.semester_number,
      'enrollmentStatus', enrollments.status,
      'groupCode', groups.code,
      'groupName', groups.display_name,
      'startedOn', periods.starts_on,
      'endedOn', periods.ends_on
   ) order by periods.starts_on desc)
   from (
     select *
     from academic.period_enrollments
     where student_record_id = (select student_record_id from context)
       and status <> 'CANCELLED'
     order by academic_period_id desc
     limit greatest(limit_count, 0)
     offset greatest(offset_count, 0)
   ) enrollments
   join academic.academic_periods periods on periods.id = enrollments.academic_period_id
   left join academic.groups groups on groups.id = enrollments.group_id
 ), '[]'::jsonb)
end;
$$;

create or replace function public.get_my_guardian_portal_overview()
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_portal_overview(); $$;
create or replace function public.get_my_linked_students()
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_linked_students(); $$;
create or replace function public.get_my_guardian_student_overview(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_overview(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_record(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_record(link_id); $$;
create or replace function public.get_my_guardian_student_subjects(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_subjects(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_schedule(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_schedule(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_attendance(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_attendance(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_permissions(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_permissions(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_grades(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_grades(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_results(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_results(link_id, requested_period_id); $$;
create or replace function public.get_my_guardian_student_progress(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_progress(link_id); $$;
create or replace function public.get_my_guardian_student_history(link_id uuid, limit_count int default 20, offset_count int default 0)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_history(link_id, limit_count, offset_count); $$;

revoke execute on function academic.require_guardian_admin_permission(text) from public, anon, authenticated;
revoke execute on function academic.begin_guardian_portal_command(uuid, academic.guardian_portal_command_type, text, jsonb) from public, anon, authenticated;
revoke execute on function academic.complete_guardian_portal_command(uuid, academic.guardian_portal_command_type, text, academic.guardian_portal_entity_type, uuid) from public, anon, authenticated;
revoke execute on function academic.append_guardian_portal_event(uuid, uuid, uuid, academic.guardian_portal_entity_type, uuid, academic.guardian_portal_event_type, uuid, text, text, academic.guardian_link_reason_code, text, uuid) from public, anon, authenticated;
revoke execute on function academic.create_guardian_student_link(uuid, text, timestamptz, timestamptz, boolean, text, uuid) from public, anon, authenticated;
revoke execute on function academic.change_guardian_student_link_status(uuid, academic.guardian_link_status, academic.guardian_portal_command_type, academic.guardian_portal_event_type, text, academic.guardian_link_reason_code, text, uuid) from public, anon, authenticated;
revoke execute on function academic.activate_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function academic.suspend_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function academic.reactivate_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function academic.revoke_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function academic.expire_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function academic.require_guardian_portal_context(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_portal_overview() from public, anon, authenticated;
revoke execute on function academic.get_my_linked_students() from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_overview(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_record(uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_subjects(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_schedule(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_attendance(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_permissions(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_grades(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_results(uuid, uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_progress(uuid) from public, anon, authenticated;
revoke execute on function academic.get_my_guardian_student_history(uuid, int, int) from public, anon, authenticated;

revoke execute on function public.get_my_guardian_portal_overview() from public, anon;
revoke execute on function public.get_my_linked_students() from public, anon;
revoke execute on function public.get_my_guardian_student_overview(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_record(uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_subjects(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_schedule(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_attendance(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_permissions(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_grades(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_results(uuid, uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_progress(uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_history(uuid, int, int) from public, anon;

grant execute on function public.get_my_guardian_portal_overview() to authenticated;
grant execute on function public.get_my_linked_students() to authenticated;
grant execute on function public.get_my_guardian_student_overview(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_record(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_subjects(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_schedule(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_attendance(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_permissions(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_grades(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_results(uuid, uuid) to authenticated;
grant execute on function public.get_my_guardian_student_progress(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_history(uuid, int, int) to authenticated;

commit;
