begin;

create type core.mfa_requirement as enum (
  'NOT_REQUIRED',
  'OPTIONAL',
  'RECOMMENDED',
  'REQUIRED'
);

create type core.mfa_compliance_status as enum (
  'NOT_APPLICABLE',
  'NOT_ENROLLED',
  'ENROLLMENT_PENDING',
  'COMPLIANT',
  'GRACE_PERIOD',
  'NON_COMPLIANT',
  'RECOVERY_REQUIRED',
  'ADMINISTRATIVE_REVIEW'
);

create type core.mfa_security_event_type as enum (
  'MFA_ENROLLMENT_STARTED',
  'MFA_ENROLLMENT_VERIFIED',
  'MFA_ENROLLMENT_FAILED',
  'MFA_CHALLENGE_STARTED',
  'MFA_CHALLENGE_VERIFIED',
  'MFA_CHALLENGE_FAILED',
  'MFA_FACTOR_UNENROLL_REQUESTED',
  'MFA_FACTOR_UNENROLLED',
  'MFA_FACTOR_UNENROLL_FAILED',
  'MFA_BACKUP_FACTOR_ENROLLED',
  'MFA_REQUIRED_BY_POLICY',
  'MFA_GRACE_PERIOD_STARTED',
  'MFA_COMPLIANCE_ACHIEVED',
  'MFA_COMPLIANCE_LOST',
  'MFA_RECOVERY_REQUESTED',
  'MFA_RECOVERY_APPROVED',
  'MFA_RECOVERY_COMPLETED',
  'MFA_STEP_UP_REQUIRED',
  'MFA_STEP_UP_COMPLETED',
  'MFA_ACCESS_REJECTED',
  'MFA_RECONCILIATION_REQUIRED'
);

create type core.mfa_security_reason_code as enum (
  'USER_ENROLLMENT',
  'POLICY_REQUIRED',
  'BACKUP_FACTOR',
  'USER_UNENROLLMENT',
  'LOST_FACTOR',
  'SUSPECTED_COMPROMISE',
  'ADMINISTRATIVE_RECOVERY',
  'STEP_UP_REQUIRED',
  'SECURITY_POLICY',
  'ACCOUNT_ROLE_CHANGED',
  'RECONCILIATION'
);

create table core.account_mfa_policies (
  role_id uuid primary key references core.roles(id) on delete restrict,
  requirement core.mfa_requirement not null,
  enrollment_required boolean not null,
  aal2_required_for_application boolean not null,
  grace_period_days integer not null default 0 check (grace_period_days >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint account_mfa_policies_timestamps_check check (updated_at >= created_at)
);

create table core.account_mfa_compliance (
  account_id uuid primary key references core.accounts(id) on delete restrict,
  requirement_level core.mfa_requirement not null default 'OPTIONAL',
  status core.mfa_compliance_status not null default 'NOT_ENROLLED',
  verified_factor_count integer not null default 0 check (verified_factor_count >= 0),
  achieved_at timestamptz,
  grace_period_ends_at timestamptz,
  recovery_requested_at timestamptz,
  enrollment_required_at timestamptz,
  enrollment_deadline_at timestamptz,
  last_aal2_verified_at timestamptz,
  last_factor_change_at timestamptz,
  last_policy_evaluated_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint account_mfa_compliance_achieved_check check (
    (status = 'COMPLIANT' and achieved_at is not null and verified_factor_count > 0)
    or (status <> 'COMPLIANT')
  ),
  constraint account_mfa_compliance_grace_check check (
    (status = 'GRACE_PERIOD' and grace_period_ends_at is not null)
    or (status <> 'GRACE_PERIOD' and grace_period_ends_at is null)
  ),
  constraint account_mfa_compliance_recovery_check check (
    (status = 'RECOVERY_REQUIRED' and recovery_requested_at is not null)
    or status <> 'RECOVERY_REQUIRED'
  )
);

create table core.account_mfa_security_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references core.accounts(id) on delete restrict,
  actor_account_id uuid references core.accounts(id) on delete restrict,
  event_type core.mfa_security_event_type not null,
  reason_code core.mfa_security_reason_code not null,
  correlation_id uuid not null,
  idempotency_key text not null,
  occurred_at timestamptz not null default statement_timestamp(),
  constraint account_mfa_security_events_idempotency_unique
    unique (account_id, idempotency_key),
  constraint account_mfa_security_events_idempotency_safe check (
    char_length(idempotency_key) between 8 and 128
    and idempotency_key !~* '(secret|token|cookie|password|nip|email|alias|factor|challenge|otpauth)'
  )
);

insert into core.account_mfa_policies (
  role_id, requirement, enrollment_required, aal2_required_for_application
)
select id,
  case
    when code in ('SUPERADMIN', 'ADMINISTRATIVO', 'CONTROL_ESCOLAR', 'CAJA')
      then 'REQUIRED'::core.mfa_requirement
    when code = 'DOCENTE' then 'RECOMMENDED'::core.mfa_requirement
    else 'OPTIONAL'::core.mfa_requirement
  end,
  code in ('SUPERADMIN', 'ADMINISTRATIVO', 'CONTROL_ESCOLAR', 'CAJA'),
  code in ('SUPERADMIN', 'ADMINISTRATIVO', 'CONTROL_ESCOLAR', 'CAJA')
from core.roles
on conflict (role_id) do update
set requirement = excluded.requirement,
    enrollment_required = excluded.enrollment_required,
    aal2_required_for_application = excluded.aal2_required_for_application,
    updated_at = statement_timestamp();

insert into core.account_mfa_compliance (account_id, status)
select id, 'NOT_ENROLLED'
from core.accounts
on conflict (account_id) do nothing;

create function core.prevent_mfa_security_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'MFA_SECURITY_EVENT_APPEND_ONLY';
end;
$$;

create trigger account_mfa_security_events_append_only
before update or delete on core.account_mfa_security_events
for each row execute function core.prevent_mfa_security_event_mutation();

create function core.current_authenticator_assurance_level()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when nullif(current_setting('request.jwt.claims', true), '') is null then null
    when (current_setting('request.jwt.claims', true)::jsonb ->> 'aal') in ('aal1', 'aal2')
      then current_setting('request.jwt.claims', true)::jsonb ->> 'aal'
    else null
  end;
$$;

create function core.is_current_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(core.current_authenticator_assurance_level() = 'aal2', false);
$$;

create function core.current_mfa_requirement()
returns core.mfa_requirement
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select policies.requirement
      from core.accounts
      join core.account_roles assignments
        on assignments.account_id = accounts.id and assignments.revoked_at is null
      join core.roles on roles.id = assignments.role_id and roles.is_active
      join core.account_mfa_policies policies on policies.role_id = roles.id
      where accounts.auth_user_id = auth.uid()
      order by case policies.requirement
        when 'REQUIRED' then 4
        when 'RECOMMENDED' then 3
        when 'OPTIONAL' then 2
        else 1
      end desc
      limit 1
    ),
    'OPTIONAL'::core.mfa_requirement
  );
$$;

create function core.is_mfa_required_for_current_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select core.current_mfa_requirement() = 'REQUIRED'
    or exists (
      select 1
      from core.account_mfa_compliance compliance
      join core.accounts on accounts.id = compliance.account_id
      where accounts.auth_user_id = auth.uid()
        and compliance.status = 'COMPLIANT'
        and compliance.verified_factor_count > 0
    );
$$;

create function core.is_current_mfa_policy_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not core.is_mfa_required_for_current_account() or core.is_current_aal2();
$$;

create function core.require_current_mfa_policy()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not core.is_current_mfa_policy_satisfied() then
    raise exception using errcode = '42501', message = 'MFA_AAL2_REQUIRED';
  end if;
end;
$$;

create function core.record_current_mfa_state(
  requested_status core.mfa_compliance_status,
  requested_factor_count integer,
  requested_event core.mfa_security_event_type,
  requested_reason core.mfa_security_reason_code,
  requested_correlation_id uuid,
  requested_idempotency_key text
)
returns table (recorded boolean, session_version bigint)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_account core.accounts%rowtype;
  prior_event core.account_mfa_security_events%rowtype;
begin
  select * into current_account
  from core.accounts
  where auth_user_id = auth.uid()
  for update;
  if current_account.id is null or current_account.account_status <> 'ACTIVE' then
    raise exception using errcode = '42501', message = 'MFA_ACCOUNT_NOT_ACTIVE';
  end if;
  select * into prior_event
  from core.account_mfa_security_events
  where account_id = current_account.id
    and idempotency_key = requested_idempotency_key;
  if prior_event.id is not null then
    if prior_event.event_type <> requested_event
      or prior_event.reason_code <> requested_reason
      or prior_event.correlation_id <> requested_correlation_id then
      raise exception using errcode = '23505', message = 'MFA_IDEMPOTENCY_CONFLICT';
    end if;
    return query select false, current_account.session_version;
    return;
  end if;

  if not core.is_current_session_version_valid() then
    raise exception using errcode = '42501', message = 'MFA_SESSION_VERSION_INVALID';
  end if;
  if requested_status = 'COMPLIANT' and not core.is_current_aal2() then
    raise exception using errcode = '42501', message = 'MFA_AAL2_REQUIRED';
  end if;
  if requested_factor_count < 0 then
    raise exception using errcode = '22023', message = 'MFA_FACTOR_COUNT_INVALID';
  end if;

  insert into core.account_mfa_compliance (
    account_id, requirement_level, status, verified_factor_count, achieved_at,
    grace_period_ends_at, recovery_requested_at, enrollment_required_at,
    enrollment_deadline_at, last_aal2_verified_at, last_factor_change_at,
    last_policy_evaluated_at, updated_at
  ) values (
    current_account.id,
    core.current_mfa_requirement(),
    requested_status,
    requested_factor_count,
    case when requested_status = 'COMPLIANT' then statement_timestamp() end,
    null,
    case when requested_status = 'RECOVERY_REQUIRED' then statement_timestamp() end,
    case when core.current_mfa_requirement() = 'REQUIRED' then statement_timestamp() end,
    null,
    case when core.is_current_aal2() then statement_timestamp() end,
    statement_timestamp(),
    statement_timestamp(),
    statement_timestamp()
  )
  on conflict (account_id) do update
  set status = excluded.status,
      requirement_level = excluded.requirement_level,
      verified_factor_count = excluded.verified_factor_count,
      achieved_at = excluded.achieved_at,
      grace_period_ends_at = excluded.grace_period_ends_at,
      recovery_requested_at = excluded.recovery_requested_at,
      enrollment_required_at = coalesce(
        account_mfa_compliance.enrollment_required_at, excluded.enrollment_required_at
      ),
      enrollment_deadline_at = excluded.enrollment_deadline_at,
      last_aal2_verified_at = excluded.last_aal2_verified_at,
      last_factor_change_at = excluded.last_factor_change_at,
      last_policy_evaluated_at = excluded.last_policy_evaluated_at,
      updated_at = statement_timestamp();

  insert into core.account_mfa_security_events (
    account_id, actor_account_id, event_type, reason_code,
    correlation_id, idempotency_key
  ) values (
    current_account.id, current_account.id, requested_event, requested_reason,
    requested_correlation_id, requested_idempotency_key
  );

  select invalidation.resulting_session_version
  into current_account.session_version
  from core.invalidate_account_sessions(
    current_account.id,
    current_account.id,
    'SECURITY_POLICY',
    requested_idempotency_key,
    requested_correlation_id,
    'SESSION_VERSION_INCREMENTED'
  ) invalidation;

  return query select true, current_account.session_version;
end;
$$;

create function public.record_current_mfa_state(
  requested_status core.mfa_compliance_status,
  requested_factor_count integer,
  requested_event core.mfa_security_event_type,
  requested_reason core.mfa_security_reason_code,
  requested_correlation_id uuid,
  requested_idempotency_key text
)
returns table (recorded boolean, session_version bigint)
language sql
volatile
security definer
set search_path = ''
as $$
  select * from core.record_current_mfa_state(
    requested_status, requested_factor_count, requested_event, requested_reason,
    requested_correlation_id, requested_idempotency_key
  );
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
  session_valid boolean,
  mfa_required boolean,
  mfa_satisfied boolean
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
    select
      coalesce(core.is_current_session_version_valid(), false) as session_valid,
      core.is_mfa_required_for_current_account() as mfa_required,
      core.is_current_mfa_policy_satisfied() as mfa_satisfied
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
    case when accepted.session_valid and accepted.mfa_satisfied then current_account.id end,
    case when accepted.session_valid and accepted.mfa_satisfied then current_account.person_id end,
    current_account.account_status,
    case when accepted.session_valid and accepted.mfa_satisfied
      then effective_roles.roles else array[]::text[] end,
    case when not accepted.session_valid then array[]::text[]
      else array_remove(array[
        case when effective_roles.roles && array['ASPIRANTE','ALUMNO','TUTOR','DOCENTE']
          then 'PORTAL_ESCOLAR' end,
        case when effective_roles.roles && array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR','CAJA']
          then 'SISTEMA_ADMINISTRATIVO' end
      ]::text[], null)
    end,
    accepted.session_valid,
    accepted.mfa_required,
    accepted.mfa_satisfied
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
  session_valid boolean,
  mfa_required boolean,
  mfa_satisfied boolean
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
  and core.is_current_mfa_policy_satisfied()
);
create policy people_select_own_active_context on core.people
for select to authenticated using (
  people.id = (select core.current_person_id())
  and core.is_current_session_version_valid()
  and core.is_current_mfa_policy_satisfied()
);
create policy account_roles_select_own_active_context on core.account_roles
for select to authenticated using (
  account_roles.account_id = (select core.current_account_id())
  and account_roles.revoked_at is null
  and core.is_current_session_version_valid()
  and core.is_current_mfa_policy_satisfied()
);
create policy roles_select_own_active_context on core.roles
for select to authenticated using (
  roles.is_active
  and roles.code = any (core.current_role_codes())
  and core.is_current_session_version_valid()
  and core.is_current_mfa_policy_satisfied()
);

alter table core.account_mfa_policies enable row level security;
alter table core.account_mfa_compliance enable row level security;
alter table core.account_mfa_security_events enable row level security;

alter function core.prevent_mfa_security_event_mutation() owner to postgres;
alter function core.current_authenticator_assurance_level() owner to postgres;
alter function core.is_current_aal2() owner to postgres;
alter function core.current_mfa_requirement() owner to postgres;
alter function core.is_mfa_required_for_current_account() owner to postgres;
alter function core.is_current_mfa_policy_satisfied() owner to postgres;
alter function core.require_current_mfa_policy() owner to postgres;
alter function core.record_current_mfa_state(
  core.mfa_compliance_status, integer, core.mfa_security_event_type,
  core.mfa_security_reason_code, uuid, text
) owner to postgres;
alter function public.record_current_mfa_state(
  core.mfa_compliance_status, integer, core.mfa_security_event_type,
  core.mfa_security_reason_code, uuid, text
) owner to postgres;
alter function core.get_current_identity_context() owner to postgres;
alter function public.get_current_identity_context() owner to postgres;

revoke all on core.account_mfa_policies from public, anon, authenticated;
revoke all on core.account_mfa_compliance from public, anon, authenticated;
revoke all on core.account_mfa_security_events from public, anon, authenticated;
revoke execute on function core.prevent_mfa_security_event_mutation()
  from public, anon, authenticated;
revoke execute on function core.current_authenticator_assurance_level()
  from public, anon, authenticated;
revoke execute on function core.is_current_aal2() from public, anon, authenticated;
revoke execute on function core.current_mfa_requirement() from public, anon, authenticated;
revoke execute on function core.is_mfa_required_for_current_account()
  from public, anon, authenticated;
revoke execute on function core.is_current_mfa_policy_satisfied()
  from public, anon, authenticated;
revoke execute on function core.require_current_mfa_policy()
  from public, anon, authenticated;
revoke execute on function core.record_current_mfa_state(
  core.mfa_compliance_status, integer, core.mfa_security_event_type,
  core.mfa_security_reason_code, uuid, text
) from public, anon, authenticated;
revoke execute on function public.record_current_mfa_state(
  core.mfa_compliance_status, integer, core.mfa_security_event_type,
  core.mfa_security_reason_code, uuid, text
) from public, anon;
grant execute on function public.record_current_mfa_state(
  core.mfa_compliance_status, integer, core.mfa_security_event_type,
  core.mfa_security_reason_code, uuid, text
) to authenticated;
revoke execute on function core.get_current_identity_context()
  from public, anon, authenticated;
grant execute on function core.get_current_identity_context() to authenticated;
revoke execute on function public.get_current_identity_context()
  from public, anon;
grant execute on function public.get_current_identity_context() to authenticated;

revoke all on type core.mfa_requirement from public, anon, authenticated;
revoke all on type core.mfa_compliance_status from public, anon, authenticated;
revoke all on type core.mfa_security_event_type from public, anon, authenticated;
revoke all on type core.mfa_security_reason_code from public, anon, authenticated;
grant usage on type core.mfa_compliance_status to authenticated;
grant usage on type core.mfa_security_event_type to authenticated;
grant usage on type core.mfa_security_reason_code to authenticated;

commit;
