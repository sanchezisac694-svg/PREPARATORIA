begin;

create schema if not exists finance;

revoke all on schema finance from public, anon, authenticated;

create type finance.charge_concept_category as enum (
  'ENROLLMENT',
  'REENROLLMENT',
  'TUITION',
  'DOCUMENT',
  'EXAM',
  'MATERIAL',
  'OTHER'
);

create type finance.charge_concept_status as enum (
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
  'PENDING_INSTITUTIONAL_VALIDATION'
);

create type finance.charge_rate_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED'
);

create type finance.student_account_status as enum ('ACTIVE', 'SUSPENDED', 'CLOSED');

create type finance.student_charge_status as enum (
  'DRAFT',
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'CANCELLED',
  'REVERSED',
  'MANUAL_REVIEW_REQUIRED'
);

create type finance.student_charge_source as enum (
  'MANUAL',
  'ENROLLMENT',
  'REENROLLMENT',
  'PERIODIC',
  'DOCUMENT_REQUEST',
  'ADJUSTMENT'
);

create type finance.charge_adjustment_type as enum (
  'DISCOUNT',
  'DEBIT_ADJUSTMENT',
  'CREDIT_ADJUSTMENT',
  'WAIVER',
  'REVERSAL'
);

create type finance.charge_adjustment_status as enum (
  'DRAFT',
  'APPROVED',
  'APPLIED',
  'REVERSED',
  'REJECTED'
);

create type finance.charge_adjustment_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'DATA_ENTRY_ERROR',
  'AUTHORIZED_DISCOUNT',
  'AUTHORIZED_WAIVER',
  'CHARGE_REVERSAL',
  'PAYMENT_REVERSAL',
  'OTHER'
);

create type finance.charge_cancellation_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'DUPLICATE_CHARGE',
  'INVALID_CHARGE',
  'AUTHORIZED_CANCELLATION',
  'OTHER'
);

create type finance.payment_method as enum (
  'CASH',
  'BANK_TRANSFER',
  'BANK_DEPOSIT',
  'CARD_TERMINAL',
  'OTHER'
);

create type finance.payment_status as enum (
  'PENDING',
  'CONFIRMED',
  'PARTIALLY_APPLIED',
  'APPLIED',
  'REVERSED',
  'CANCELLED',
  'MANUAL_REVIEW_REQUIRED'
);

create type finance.payment_reversal_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'DUPLICATE_PAYMENT',
  'INVALID_PAYMENT',
  'AUTHORIZED_REVERSAL',
  'OTHER'
);

create type finance.payment_allocation_status as enum ('APPLIED', 'REVERSED');

create type finance.financial_command_status as enum ('IN_PROGRESS', 'COMPLETED', 'FAILED');

create type finance.financial_command_type as enum (
  'CREATE_CHARGE_CONCEPT',
  'CREATE_CHARGE_RATE',
  'APPROVE_CHARGE_RATE',
  'ACTIVATE_CHARGE_RATE',
  'OPEN_STUDENT_ACCOUNT',
  'CREATE_STUDENT_CHARGE',
  'POST_STUDENT_CHARGE',
  'CANCEL_STUDENT_CHARGE',
  'CREATE_CHARGE_ADJUSTMENT',
  'APPROVE_CHARGE_ADJUSTMENT',
  'APPLY_CHARGE_ADJUSTMENT',
  'REGISTER_PAYMENT',
  'CONFIRM_PAYMENT',
  'ALLOCATE_PAYMENT',
  'REVERSE_PAYMENT_ALLOCATION',
  'REVERSE_PAYMENT',
  'CLOSE_STUDENT_ACCOUNT'
);

create type finance.financial_event_type as enum (
  'CHARGE_CONCEPT_CREATED',
  'CHARGE_RATE_CREATED',
  'CHARGE_RATE_APPROVED',
  'CHARGE_RATE_ACTIVATED',
  'STUDENT_ACCOUNT_OPENED',
  'STUDENT_CHARGE_CREATED',
  'STUDENT_CHARGE_POSTED',
  'STUDENT_CHARGE_CANCELLED',
  'CHARGE_ADJUSTMENT_CREATED',
  'CHARGE_ADJUSTMENT_APPROVED',
  'CHARGE_ADJUSTMENT_APPLIED',
  'PAYMENT_REGISTERED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_ALLOCATED',
  'PAYMENT_ALLOCATION_REVERSED',
  'PAYMENT_REVERSED',
  'RECEIPT_ASSIGNED',
  'STUDENT_ACCOUNT_CLOSED',
  'FINANCIAL_READ_AUTHORIZED',
  'FINANCIAL_READ_DENIED'
);

create table finance.charge_concepts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  category finance.charge_concept_category not null,
  currency_code char(3) not null default 'MXN',
  status finance.charge_concept_status not null,
  is_system_concept boolean not null default false,
  created_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (currency_code = 'MXN'),
  check (
    (is_system_concept and created_by_account_id is null)
    or
    (not is_system_concept and created_by_account_id is not null)
  )
);

create table finance.charge_rates (
  id uuid primary key default gen_random_uuid(),
  charge_concept_id uuid not null references finance.charge_concepts(id) on delete restrict,
  academic_period_id uuid references academic.academic_periods(id) on delete restrict,
  academic_plan_id uuid references academic.study_plans(id) on delete restrict,
  semester_number smallint,
  area_id uuid references academic.training_areas(id) on delete restrict,
  amount numeric(12,2) not null,
  currency_code char(3) not null default 'MXN',
  status finance.charge_rate_status not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (amount >= 0),
  check (currency_code = 'MXN'),
  check (semester_number is null or semester_number between 1 and 12),
  check (valid_until is null or valid_until > valid_from),
  check (
    (approved_by_account_id is null and approved_at is null)
    or
    (approved_by_account_id is not null and approved_at is not null)
  )
);

create unique index charge_rates_active_unique_combination
  on finance.charge_rates (
    charge_concept_id,
    coalesce(academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(academic_plan_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(semester_number, 0),
    coalesce(area_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status = 'ACTIVE';

create table finance.student_accounts (
  id uuid primary key default gen_random_uuid(),
  student_record_id uuid not null unique references academic.student_records(id) on delete restrict,
  currency_code char(3) not null default 'MXN',
  status finance.student_account_status not null,
  opened_at timestamptz not null default statement_timestamp(),
  closed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (currency_code = 'MXN'),
  check ((status <> 'CLOSED' and closed_at is null) or (status = 'CLOSED' and closed_at is not null))
);

create table finance.student_charges (
  id uuid primary key default gen_random_uuid(),
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  charge_concept_id uuid not null references finance.charge_concepts(id) on delete restrict,
  charge_rate_id uuid references finance.charge_rates(id) on delete restrict,
  academic_period_id uuid references academic.academic_periods(id) on delete restrict,
  enrollment_id uuid references academic.period_enrollments(id) on delete restrict,
  description text not null,
  original_amount numeric(12,2) not null,
  currency_code char(3) not null default 'MXN',
  due_date date,
  status finance.student_charge_status not null,
  source finance.student_charge_source not null,
  external_reference text,
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  posted_by_account_id uuid references core.accounts(id) on delete restrict,
  posted_at timestamptz,
  cancelled_by_account_id uuid references core.accounts(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason_code finance.charge_cancellation_reason_code,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (original_amount >= 0),
  check (currency_code = 'MXN'),
  check (
    (status <> 'DRAFT' and status <> 'POSTED')
    or
    (status = 'DRAFT' and posted_at is null and posted_by_account_id is null)
    or
    (status = 'POSTED' and posted_at is not null and posted_by_account_id is not null)
  ),
  check (
    (cancelled_at is null and cancelled_by_account_id is null and cancellation_reason_code is null)
    or
    (cancelled_at is not null and cancelled_by_account_id is not null and cancellation_reason_code is not null)
  ),
  unique (created_by_account_id, idempotency_key)
);

create unique index student_charges_equivalent_posted_unique
  on finance.student_charges (
    student_account_id,
    charge_concept_id,
    coalesce(academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid),
    source
  )
  where status in ('POSTED', 'PARTIALLY_PAID', 'PAID');

create table finance.charge_adjustments (
  id uuid primary key default gen_random_uuid(),
  student_charge_id uuid not null references finance.student_charges(id) on delete restrict,
  adjustment_type finance.charge_adjustment_type not null,
  amount numeric(12,2) not null,
  reason_code finance.charge_adjustment_reason_code not null,
  description text,
  status finance.charge_adjustment_status not null,
  effective_at timestamptz,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  reversed_by_adjustment_id uuid references finance.charge_adjustments(id) on delete restrict,
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (amount > 0),
  unique (created_by_account_id, idempotency_key)
);

create table finance.payments (
  id uuid primary key default gen_random_uuid(),
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  receipt_number text not null unique,
  amount numeric(12,2) not null,
  currency_code char(3) not null default 'MXN',
  payment_method finance.payment_method not null,
  payment_reference text,
  paid_at timestamptz not null,
  received_by_account_id uuid not null references core.accounts(id) on delete restrict,
  status finance.payment_status not null,
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  reversed_by_payment_id uuid references finance.payments(id) on delete restrict,
  reversal_reason_code finance.payment_reversal_reason_code,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (amount > 0),
  check (currency_code = 'MXN'),
  unique (received_by_account_id, idempotency_key)
);

create table finance.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references finance.payments(id) on delete restrict,
  student_charge_id uuid not null references finance.student_charges(id) on delete restrict,
  amount numeric(12,2) not null,
  status finance.payment_allocation_status not null,
  applied_by_account_id uuid not null references core.accounts(id) on delete restrict,
  applied_at timestamptz not null,
  reversed_by_allocation_id uuid references finance.payment_allocations(id) on delete restrict,
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (amount > 0),
  unique (applied_by_account_id, idempotency_key)
);

create table finance.financial_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  command_type finance.financial_command_type not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  status finance.financial_command_status not null default 'IN_PROGRESS',
  result_entity_type text,
  result_entity_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (actor_account_id, command_type, idempotency_key)
);

create table finance.financial_events (
  id uuid primary key default gen_random_uuid(),
  student_account_id uuid references finance.student_accounts(id) on delete restrict,
  student_charge_id uuid references finance.student_charges(id) on delete restrict,
  charge_adjustment_id uuid references finance.charge_adjustments(id) on delete restrict,
  payment_id uuid references finance.payments(id) on delete restrict,
  payment_allocation_id uuid references finance.payment_allocations(id) on delete restrict,
  event_type finance.financial_event_type not null,
  actor_account_id uuid references core.accounts(id) on delete restrict,
  idempotency_key text not null,
  correlation_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  unique (event_type, idempotency_key)
);

create table finance.receipt_sequences (
  receipt_year integer primary key,
  last_value bigint not null check (last_value >= 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

alter table academic.guardian_access_scopes
  add column if not exists can_view_financial_account boolean not null default false;

update academic.guardian_access_scopes
set can_view_financial_account = false
where code = 'STANDARD_ACADEMIC_READ';

create function finance.financial_fingerprint(payload jsonb)
returns text
language sql
immutable
security definer
set search_path=''
as $$
  select md5(coalesce(payload, '{}'::jsonb)::text)
$$;

create function finance.mask_payment_reference(reference text)
returns text
language plpgsql
immutable
security definer
set search_path=''
as $$
begin
  if reference is null or btrim(reference) = '' then
    return null;
  end if;
  if length(reference) <= 4 then
    return repeat('*', length(reference));
  end if;
  return repeat('*', greatest(length(reference) - 4, 0)) || right(reference, 4);
end;
$$;

create function finance.format_money(value numeric)
returns text
language sql
immutable
security definer
set search_path=''
as $$
  select trim(to_char(coalesce(value, 0)::numeric, 'FM999999999990.00'))
$$;

create function finance.require_finance_permission(permission_code text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor core.accounts%rowtype;
  role_codes text[];
  identity_context record;
  allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  select * into identity_context
  from core.get_current_identity_context()
  where session_valid
    and mfa_satisfied
    and 'SISTEMA_ADMINISTRATIVO' = any(allowed_applications);

  if identity_context.auth_user_id is null then
    raise exception 'APPLICATION_NOT_ALLOWED';
  end if;

  if not core.is_current_session_version_valid() then
    raise exception 'SESSION_VERSION_INVALID';
  end if;

  if not core.is_current_aal2() then
    raise exception 'AAL2_REQUIRED';
  end if;

  select * into actor
  from core.accounts
  where auth_user_id = auth.uid();

  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  select coalesce(array_agg(roles.code order by roles.code), array[]::text[])
  into role_codes
  from core.account_roles assignments
  join core.roles roles on roles.id = assignments.role_id
  where assignments.account_id = actor.id
    and assignments.revoked_at is null
    and roles.is_active;

  if role_codes && array['SUPERADMIN'] then
    allowed := permission_code like 'finance.%';
  elsif role_codes && array['ADMINISTRATIVO'] then
    allowed := permission_code in (
      'finance.concepts.manage',
      'finance.rates.manage',
      'finance.accounts.open',
      'finance.accounts.close',
      'finance.charges.create',
      'finance.charges.post',
      'finance.charges.cancel',
      'finance.adjustments.create',
      'finance.adjustments.approve',
      'finance.payments.register',
      'finance.payments.confirm',
      'finance.payments.allocate',
      'finance.payments.reverse',
      'finance.statements.read',
      'finance.receipts.read'
    );
  elsif role_codes && array['CONTROL_ESCOLAR'] then
    allowed := permission_code in (
      'finance.accounts.open',
      'finance.charges.create',
      'finance.charges.post',
      'finance.charges.cancel',
      'finance.adjustments.create',
      'finance.statements.read',
      'finance.receipts.read'
    );
  elsif role_codes && array['CAJA'] then
    allowed := permission_code in (
      'finance.payments.register',
      'finance.payments.confirm',
      'finance.payments.allocate',
      'finance.payments.reverse',
      'finance.statements.read',
      'finance.receipts.read'
    );
  end if;

  if not allowed then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  return actor.id;
end;
$$;

create function finance.begin_financial_command(
  actor uuid,
  kind finance.financial_command_type,
  operation_key text,
  payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  fingerprint text := finance.financial_fingerprint(payload);
  existing finance.financial_commands%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text || kind::text || operation_key, 0));
  select * into existing
  from finance.financial_commands
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

  insert into finance.financial_commands(idempotency_key, command_type, actor_account_id, request_fingerprint)
  values (operation_key, kind, actor, fingerprint);

  return null;
end;
$$;

create function finance.complete_financial_command(
  actor_id uuid,
  command_kind finance.financial_command_type,
  operation_key text,
  result_type text,
  result_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.financial_commands
  set status = 'COMPLETED',
      result_entity_type = result_type,
      result_entity_id = result_id,
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where actor_account_id = actor_id
    and command_type = command_kind
    and idempotency_key = operation_key;
  perform set_config('finance.controlled_mutation', 'off', true);
end;
$$;

create function finance.append_financial_event(
  event_name finance.financial_event_type,
  actor uuid,
  operation_key text,
  account_id uuid default null,
  charge_id uuid default null,
  adjustment_id uuid default null,
  payment_id uuid default null,
  allocation_id uuid default null,
  details jsonb default '{}'::jsonb,
  correlation uuid default null
)
returns void
language sql
security definer
set search_path=''
as $$
  insert into finance.financial_events(
    student_account_id,
    student_charge_id,
    charge_adjustment_id,
    payment_id,
    payment_allocation_id,
    event_type,
    actor_account_id,
    idempotency_key,
    correlation_id,
    details
  )
  values (
    account_id,
    charge_id,
    adjustment_id,
    payment_id,
    allocation_id,
    event_name,
    actor,
    operation_key,
    correlation,
    coalesce(details, '{}'::jsonb)
  )
  on conflict(event_type, idempotency_key) do nothing
$$;

create function finance.guard_financial_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;

  if current_setting('finance.controlled_mutation', true) = 'on' then
    return new;
  end if;

  raise exception 'FINANCE_OPERATION_FAILED';
end;
$$;

create function finance.guard_receipt_sequence_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'charge_concepts',
    'charge_rates',
    'student_accounts',
    'student_charges',
    'charge_adjustments',
    'payments',
    'payment_allocations',
    'financial_events'
  ] loop
    execute format(
      'create trigger %I_guard before update or delete on finance.%I for each row execute function finance.guard_financial_immutable()',
      table_name,
      table_name
    );
  end loop;
end$$;

create trigger receipt_sequences_guard
before update or delete on finance.receipt_sequences
for each row execute function finance.guard_receipt_sequence_mutation();

create function finance.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'charge_concepts',
    'charge_rates',
    'student_accounts',
    'student_charges',
    'charge_adjustments',
    'payments',
    'payment_allocations',
    'financial_commands'
  ] loop
    execute format(
      'create trigger %I_touch before update on finance.%I for each row execute function finance.touch_updated_at()',
      table_name,
      table_name
    );
  end loop;
end$$;

create function finance.rate_scope_key(
  concept_id uuid,
  period_id uuid,
  plan_id uuid,
  semester smallint,
  training_area uuid
)
returns text
language sql
immutable
security definer
set search_path=''
as $$
  select concat_ws(
    ':',
    concept_id::text,
    coalesce(period_id::text, '0'),
    coalesce(plan_id::text, '0'),
    coalesce(semester::text, '0'),
    coalesce(training_area::text, '0')
  )
$$;

create function finance.assert_charge_rate_activation_allowed(rate_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  candidate finance.charge_rates%rowtype;
begin
  select * into candidate from finance.charge_rates where id = rate_id;
  if candidate.id is null then
    raise exception 'CHARGE_RATE_NOT_ACTIVE';
  end if;
  if candidate.status <> 'APPROVED' then
    raise exception 'CHARGE_RATE_NOT_ACTIVE';
  end if;
  if exists (
    select 1
    from finance.charge_rates other
    where other.id <> candidate.id
      and other.status = 'ACTIVE'
      and finance.rate_scope_key(
        other.charge_concept_id,
        other.academic_period_id,
        other.academic_plan_id,
        other.semester_number,
        other.area_id
      ) = finance.rate_scope_key(
        candidate.charge_concept_id,
        candidate.academic_period_id,
        candidate.academic_plan_id,
        candidate.semester_number,
        candidate.area_id
      )
      and tstzrange(other.valid_from, coalesce(other.valid_until, 'infinity'::timestamptz), '[)')
          && tstzrange(candidate.valid_from, coalesce(candidate.valid_until, 'infinity'::timestamptz), '[)')
  ) then
    raise exception 'CHARGE_RATE_NOT_ACTIVE';
  end if;
end;
$$;

create function finance.charge_adjustment_effect(adjustment_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select case
    when adjustments.status <> 'APPLIED' then 0::numeric
    when adjustments.adjustment_type in ('DISCOUNT', 'CREDIT_ADJUSTMENT', 'WAIVER') then adjustments.amount * -1
    when adjustments.adjustment_type = 'DEBIT_ADJUSTMENT' then adjustments.amount
    else 0::numeric
  end
  from finance.charge_adjustments adjustments
  where adjustments.id = adjustment_id
$$;

create function finance.charge_applied_adjustments(charge_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(finance.charge_adjustment_effect(adjustments.id)), 0::numeric)
  from finance.charge_adjustments adjustments
  where adjustments.student_charge_id = charge_id
$$;

create function finance.charge_applied_allocations(charge_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(case when allocations.status = 'APPLIED' then allocations.amount else allocations.amount * -1 end), 0::numeric)
  from finance.payment_allocations allocations
  where allocations.student_charge_id = charge_id
$$;

create function finance.payment_applied_allocations(payment_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(case when allocations.status = 'APPLIED' then allocations.amount else allocations.amount * -1 end), 0::numeric)
  from finance.payment_allocations allocations
  where allocations.payment_id = payment_id
$$;

create function finance.get_charge_balance(charge_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select greatest(
    0::numeric,
    charges.original_amount
      + finance.charge_applied_adjustments(charges.id)
      - finance.charge_applied_allocations(charges.id)
  )
  from finance.student_charges charges
  where charges.id = charge_id
$$;

create function finance.get_payment_available_amount(payment_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select greatest(0::numeric, payments.amount - finance.payment_applied_allocations(payments.id))
  from finance.payments payments
  where payments.id = payment_id
$$;

create function finance.get_student_account_balance(account_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(sum(finance.get_charge_balance(charges.id)), 0::numeric)
  from finance.student_charges charges
  where charges.student_account_id = account_id
    and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID')
$$;

create function finance.recompute_charge_status(charge_id uuid)
returns finance.student_charge_status
language plpgsql
security definer
set search_path=''
as $$
declare
  current_charge finance.student_charges%rowtype;
  next_status finance.student_charge_status;
  balance numeric;
begin
  select * into current_charge from finance.student_charges where id = charge_id for update;
  if current_charge.id is null then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if current_charge.status in ('DRAFT', 'CANCELLED', 'REVERSED') then
    return current_charge.status;
  end if;
  balance := finance.get_charge_balance(charge_id);
  if balance = 0 then
    next_status := 'PAID';
  elsif balance < current_charge.original_amount + finance.charge_applied_adjustments(charge_id) then
    next_status := 'PARTIALLY_PAID';
  else
    next_status := 'POSTED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_charges set status = next_status where id = charge_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  return next_status;
end;
$$;

create function finance.recompute_payment_status(payment_id uuid)
returns finance.payment_status
language plpgsql
security definer
set search_path=''
as $$
declare
  current_payment finance.payments%rowtype;
  available numeric;
  next_status finance.payment_status;
begin
  select * into current_payment from finance.payments where id = payment_id for update;
  if current_payment.id is null then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  if current_payment.status in ('PENDING', 'REVERSED', 'CANCELLED', 'MANUAL_REVIEW_REQUIRED') then
    return current_payment.status;
  end if;
  available := finance.get_payment_available_amount(payment_id);
  if available = 0 then
    next_status := 'APPLIED';
  elsif available < current_payment.amount then
    next_status := 'PARTIALLY_APPLIED';
  else
    next_status := 'CONFIRMED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payments set status = next_status where id = payment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  return next_status;
end;
$$;

create function finance.next_receipt_number()
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  year_value integer := extract(year from statement_timestamp())::integer;
  next_value bigint;
begin
  perform set_config('finance.controlled_mutation', 'on', true);
  insert into finance.receipt_sequences(receipt_year, last_value)
  values (year_value, 0)
  on conflict(receipt_year) do nothing;

  update finance.receipt_sequences
  set last_value = last_value + 1,
      updated_at = statement_timestamp()
  where receipt_year = year_value
  returning last_value into next_value;
  perform set_config('finance.controlled_mutation', 'off', true);

  return format('REC-%s-%s', year_value, lpad(next_value::text, 6, '0'));
end;
$$;

create function finance.open_student_account(student_record_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  existing finance.student_accounts%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.accounts.open');
  prior := finance.begin_financial_command(actor, 'OPEN_STUDENT_ACCOUNT', operation_key, jsonb_build_object('studentRecord', student_record_id));
  if prior is not null then
    return query select prior, (select accounts.status::text from finance.student_accounts accounts where accounts.id = prior);
    return;
  end if;

  select * into existing from finance.student_accounts where finance.student_accounts.student_record_id = open_student_account.student_record_id for update;
  if existing.id is not null then
    perform finance.complete_financial_command(actor, 'OPEN_STUDENT_ACCOUNT', operation_key, 'STUDENT_ACCOUNT', existing.id);
    return query select existing.id, existing.status::text;
    return;
  end if;

  insert into finance.student_accounts(student_record_id, status)
  values (student_record_id, 'ACTIVE')
  returning id into created;

  perform finance.append_financial_event('STUDENT_ACCOUNT_OPENED', actor, operation_key, created, null, null, null, null, jsonb_build_object('studentRecordId', student_record_id), correlation);
  perform finance.complete_financial_command(actor, 'OPEN_STUDENT_ACCOUNT', operation_key, 'STUDENT_ACCOUNT', created);
  return query select created, 'ACTIVE';
end;
$$;

create function finance.create_charge_concept(
  concept_code text,
  concept_name text,
  concept_description text,
  concept_category finance.charge_concept_category,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.concepts.manage');
  prior := finance.begin_financial_command(actor, 'CREATE_CHARGE_CONCEPT', operation_key, jsonb_build_object('code', upper(btrim(concept_code)), 'name', concept_name, 'category', concept_category));
  if prior is not null then
    return query select prior, (select concepts.status::text from finance.charge_concepts concepts where concepts.id = prior);
    return;
  end if;

  insert into finance.charge_concepts(code, name, description, category, status, is_system_concept, created_by_account_id)
  values (upper(btrim(concept_code)), concept_name, concept_description, concept_category, 'DRAFT', false, actor)
  returning id into created;

  perform finance.append_financial_event('CHARGE_CONCEPT_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('chargeConceptId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_CONCEPT', operation_key, 'CHARGE_CONCEPT', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.create_charge_rate(
  concept_id uuid,
  requested_period_id uuid,
  requested_plan_id uuid,
  requested_semester_number smallint,
  requested_area_id uuid,
  requested_amount numeric,
  requested_valid_from timestamptz,
  requested_valid_until timestamptz,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  concept_row finance.charge_concepts%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.rates.manage');
  if requested_amount < 0 then
    raise exception 'CHARGE_AMOUNT_INVALID';
  end if;
  if requested_valid_until is not null and requested_valid_until <= requested_valid_from then
    raise exception 'CHARGE_RATE_NOT_ACTIVE';
  end if;

  prior := finance.begin_financial_command(actor, 'CREATE_CHARGE_RATE', operation_key, jsonb_build_object(
    'concept', concept_id,
    'period', requested_period_id,
    'plan', requested_plan_id,
    'semester', requested_semester_number,
    'area', requested_area_id,
    'amount', requested_amount,
    'validFrom', requested_valid_from,
    'validUntil', requested_valid_until
  ));
  if prior is not null then
    return query select prior, (select rates.status::text from finance.charge_rates rates where rates.id = prior);
    return;
  end if;

  select * into concept_row from finance.charge_concepts where id = concept_id;
  if concept_row.id is null or concept_row.currency_code <> 'MXN' then
    raise exception 'CHARGE_CONCEPT_NOT_ACTIVE';
  end if;

  insert into finance.charge_rates(
    charge_concept_id, academic_period_id, academic_plan_id, semester_number, area_id,
    amount, currency_code, status, valid_from, valid_until, created_by_account_id
  ) values (
    concept_id, requested_period_id, requested_plan_id, requested_semester_number, requested_area_id,
    requested_amount, 'MXN', 'DRAFT', requested_valid_from, requested_valid_until, actor
  ) returning id into created;

  perform finance.append_financial_event('CHARGE_RATE_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('chargeRateId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_RATE', operation_key, 'CHARGE_RATE', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.approve_charge_rate(rate_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  rate_row finance.charge_rates%rowtype;
begin
  actor := finance.require_finance_permission('finance.rates.manage');
  prior := finance.begin_financial_command(actor, 'APPROVE_CHARGE_RATE', operation_key, jsonb_build_object('rate', rate_id));
  if prior is not null then
    return query select prior, (select rates.status::text from finance.charge_rates rates where rates.id = prior);
    return;
  end if;

  select * into rate_row from finance.charge_rates where id = rate_id for update;
  if rate_row.id is null or rate_row.status <> 'DRAFT' then
    raise exception 'CHARGE_RATE_NOT_ACTIVE';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_rates
  set status = 'APPROVED',
      approved_by_account_id = actor,
      approved_at = statement_timestamp()
  where id = rate_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_RATE_APPROVED', actor, operation_key, null, null, null, null, null, jsonb_build_object('chargeRateId', rate_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_CHARGE_RATE', operation_key, 'CHARGE_RATE', rate_id);
  return query select rate_id, 'APPROVED';
end;
$$;

create function finance.activate_charge_rate(rate_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
begin
  actor := finance.require_finance_permission('finance.rates.manage');
  prior := finance.begin_financial_command(actor, 'ACTIVATE_CHARGE_RATE', operation_key, jsonb_build_object('rate', rate_id));
  if prior is not null then
    return query select prior, (select rates.status::text from finance.charge_rates rates where rates.id = prior);
    return;
  end if;

  perform finance.assert_charge_rate_activation_allowed(rate_id);

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_rates
  set status = 'ACTIVE'
  where id = rate_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_RATE_ACTIVATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('chargeRateId', rate_id), correlation);
  perform finance.complete_financial_command(actor, 'ACTIVATE_CHARGE_RATE', operation_key, 'CHARGE_RATE', rate_id);
  return query select rate_id, 'ACTIVE';
end;
$$;

create function finance.create_student_charge(
  account_id uuid,
  concept_id uuid,
  rate_id uuid,
  requested_period_id uuid,
  requested_enrollment_id uuid,
  requested_description text,
  requested_amount numeric,
  requested_due_date date,
  requested_source finance.student_charge_source,
  requested_external_reference text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  account_row finance.student_accounts%rowtype;
  concept_row finance.charge_concepts%rowtype;
  rate_row finance.charge_rates%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.charges.create');
  if requested_amount < 0 then
    raise exception 'CHARGE_AMOUNT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'CREATE_STUDENT_CHARGE', operation_key, jsonb_build_object(
    'account', account_id,
    'concept', concept_id,
    'rate', rate_id,
    'period', requested_period_id,
    'enrollment', requested_enrollment_id,
    'description', requested_description,
    'amount', requested_amount,
    'dueDate', requested_due_date,
    'source', requested_source,
    'externalReference', requested_external_reference
  ));
  if prior is not null then
    return query select prior, (select charges.status::text from finance.student_charges charges where charges.id = prior);
    return;
  end if;

  select * into account_row from finance.student_accounts where id = account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;

  select * into concept_row from finance.charge_concepts where id = concept_id;
  if concept_row.id is null or concept_row.status not in ('ACTIVE', 'PENDING_INSTITUTIONAL_VALIDATION') then
    raise exception 'CHARGE_CONCEPT_NOT_ACTIVE';
  end if;

  if rate_id is not null then
    select * into rate_row from finance.charge_rates where id = rate_id;
    if rate_row.id is null or rate_row.status <> 'ACTIVE' then
      raise exception 'CHARGE_RATE_NOT_ACTIVE';
    end if;
    if rate_row.amount <> requested_amount then
      raise exception 'CHARGE_AMOUNT_INVALID';
    end if;
  end if;

  insert into finance.student_charges(
    student_account_id, charge_concept_id, charge_rate_id, academic_period_id, enrollment_id,
    description, original_amount, currency_code, due_date, status, source, external_reference,
    idempotency_key, request_fingerprint, created_by_account_id
  ) values (
    account_id, concept_id, rate_id, requested_period_id, requested_enrollment_id,
    requested_description, requested_amount, 'MXN', requested_due_date, 'DRAFT', requested_source, requested_external_reference,
    operation_key, finance.financial_fingerprint(jsonb_build_object(
      'account', account_id, 'concept', concept_id, 'rate', rate_id, 'period', requested_period_id,
      'enrollment', requested_enrollment_id, 'description', requested_description, 'amount', requested_amount,
      'dueDate', requested_due_date, 'source', requested_source, 'externalReference', requested_external_reference
    )), actor
  ) returning id into created;

  perform finance.append_financial_event('STUDENT_CHARGE_CREATED', actor, operation_key, account_id, created, null, null, null, jsonb_build_object('chargeId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_STUDENT_CHARGE', operation_key, 'STUDENT_CHARGE', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.post_student_charge(charge_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  charge_row finance.student_charges%rowtype;
begin
  actor := finance.require_finance_permission('finance.charges.post');
  prior := finance.begin_financial_command(actor, 'POST_STUDENT_CHARGE', operation_key, jsonb_build_object('charge', charge_id));
  if prior is not null then
    return query select prior, (select charges.status::text from finance.student_charges charges where charges.id = prior);
    return;
  end if;
  select * into charge_row from finance.student_charges where id = charge_id for update;
  if charge_row.id is null or charge_row.status <> 'DRAFT' then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_charges
  set status = 'POSTED',
      posted_by_account_id = actor,
      posted_at = statement_timestamp()
  where id = charge_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('STUDENT_CHARGE_POSTED', actor, operation_key, charge_row.student_account_id, charge_id, null, null, null, jsonb_build_object('chargeId', charge_id), correlation);
  perform finance.complete_financial_command(actor, 'POST_STUDENT_CHARGE', operation_key, 'STUDENT_CHARGE', charge_id);
  return query select charge_id, 'POSTED';
end;
$$;

create function finance.cancel_student_charge(charge_id uuid, reason_code finance.charge_cancellation_reason_code, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  charge_row finance.student_charges%rowtype;
begin
  actor := finance.require_finance_permission('finance.charges.cancel');
  prior := finance.begin_financial_command(actor, 'CANCEL_STUDENT_CHARGE', operation_key, jsonb_build_object('charge', charge_id, 'reason', reason_code));
  if prior is not null then
    return query select prior, (select charges.status::text from finance.student_charges charges where charges.id = prior);
    return;
  end if;
  select * into charge_row from finance.student_charges where id = charge_id for update;
  if charge_row.id is null or charge_row.status not in ('DRAFT', 'POSTED') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if charge_row.status <> 'DRAFT' and finance.charge_applied_allocations(charge_id) > 0 then
    raise exception 'CHARGE_ALREADY_PAID';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_charges
  set status = 'CANCELLED',
      cancelled_by_account_id = actor,
      cancelled_at = statement_timestamp(),
      cancellation_reason_code = reason_code
  where id = charge_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('STUDENT_CHARGE_CANCELLED', actor, operation_key, charge_row.student_account_id, charge_id, null, null, null, jsonb_build_object('chargeId', charge_id), correlation);
  perform finance.complete_financial_command(actor, 'CANCEL_STUDENT_CHARGE', operation_key, 'STUDENT_CHARGE', charge_id);
  return query select charge_id, 'CANCELLED';
end;
$$;

create function finance.create_charge_adjustment(
  charge_id uuid,
  adjustment_kind finance.charge_adjustment_type,
  requested_amount numeric,
  reason_code finance.charge_adjustment_reason_code,
  requested_description text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  charge_row finance.student_charges%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.adjustments.create');
  if requested_amount <= 0 then
    raise exception 'CHARGE_AMOUNT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'CREATE_CHARGE_ADJUSTMENT', operation_key, jsonb_build_object(
    'charge', charge_id, 'type', adjustment_kind, 'amount', requested_amount, 'reason', reason_code, 'description', requested_description
  ));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  select * into charge_row from finance.student_charges where id = charge_id for update;
  if charge_row.id is null or charge_row.status not in ('POSTED', 'PARTIALLY_PAID', 'PAID', 'DRAFT') then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  insert into finance.charge_adjustments(
    student_charge_id, adjustment_type, amount, reason_code, description, status,
    created_by_account_id, idempotency_key, request_fingerprint
  ) values (
    charge_id, adjustment_kind, requested_amount, reason_code, requested_description, 'DRAFT',
    actor, operation_key, finance.financial_fingerprint(jsonb_build_object(
      'charge', charge_id, 'type', adjustment_kind, 'amount', requested_amount, 'reason', reason_code, 'description', requested_description
    ))
  ) returning id into created;
  perform finance.append_financial_event('CHARGE_ADJUSTMENT_CREATED', actor, operation_key, charge_row.student_account_id, charge_id, created, null, null, jsonb_build_object('adjustmentId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_ADJUSTMENT', operation_key, 'CHARGE_ADJUSTMENT', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.approve_charge_adjustment(adjustment_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  adjustment_row finance.charge_adjustments%rowtype;
begin
  actor := finance.require_finance_permission('finance.adjustments.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_CHARGE_ADJUSTMENT', operation_key, jsonb_build_object('adjustment', adjustment_id));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  select * into adjustment_row from finance.charge_adjustments where id = adjustment_id for update;
  if adjustment_row.id is null or adjustment_row.status <> 'DRAFT' then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_adjustments
  set status = 'APPROVED',
      approved_by_account_id = actor,
      approved_at = statement_timestamp()
  where id = adjustment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('CHARGE_ADJUSTMENT_APPROVED', actor, operation_key, null, adjustment_row.student_charge_id, adjustment_id, null, null, jsonb_build_object('adjustmentId', adjustment_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_CHARGE_ADJUSTMENT', operation_key, 'CHARGE_ADJUSTMENT', adjustment_id);
  return query select adjustment_id, 'APPROVED';
end;
$$;

create function finance.apply_charge_adjustment(adjustment_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  adjustment_row finance.charge_adjustments%rowtype;
  charge_row finance.student_charges%rowtype;
begin
  actor := finance.require_finance_permission('finance.adjustments.approve');
  prior := finance.begin_financial_command(actor, 'APPLY_CHARGE_ADJUSTMENT', operation_key, jsonb_build_object('adjustment', adjustment_id));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  select * into adjustment_row from finance.charge_adjustments where id = adjustment_id for update;
  if adjustment_row.id is null or adjustment_row.status <> 'APPROVED' then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  select * into charge_row from finance.student_charges where id = adjustment_row.student_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  if adjustment_row.adjustment_type in ('DISCOUNT', 'CREDIT_ADJUSTMENT', 'WAIVER')
     and adjustment_row.amount > finance.get_charge_balance(charge_row.id) then
    raise exception 'ADJUSTMENT_EXCEEDS_BALANCE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_adjustments
  set status = 'APPLIED',
      effective_at = statement_timestamp()
  where id = adjustment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.recompute_charge_status(charge_row.id);
  perform finance.append_financial_event('CHARGE_ADJUSTMENT_APPLIED', actor, operation_key, charge_row.student_account_id, charge_row.id, adjustment_id, null, null, jsonb_build_object('adjustmentId', adjustment_id), correlation);
  perform finance.complete_financial_command(actor, 'APPLY_CHARGE_ADJUSTMENT', operation_key, 'CHARGE_ADJUSTMENT', adjustment_id);
  return query select adjustment_id, 'APPLIED';
end;
$$;

create function finance.register_payment(
  account_id uuid,
  requested_amount numeric,
  requested_method finance.payment_method,
  requested_reference text,
  requested_paid_at timestamptz,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  prior_status text;
  account_row finance.student_accounts%rowtype;
  created uuid;
  receipt text;
begin
  actor := finance.require_finance_permission('finance.payments.register');
  if requested_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'REGISTER_PAYMENT', operation_key, jsonb_build_object(
    'account', account_id, 'amount', requested_amount, 'method', requested_method, 'reference', requested_reference, 'paidAt', requested_paid_at
  ));
  if prior is not null then
    select payments.status::text
      into prior_status
    from finance.payments payments
    where payments.id = prior;
    return query select prior, prior_status;
    return;
  end if;
  select * into account_row from finance.student_accounts where id = account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;
  receipt := finance.next_receipt_number();
  insert into finance.payments(
    student_account_id, receipt_number, amount, currency_code, payment_method, payment_reference,
    paid_at, received_by_account_id, status, idempotency_key, request_fingerprint
  ) values (
    account_id, receipt, requested_amount, 'MXN', requested_method, requested_reference,
    requested_paid_at, actor, 'PENDING', operation_key, finance.financial_fingerprint(jsonb_build_object(
      'account', account_id, 'amount', requested_amount, 'method', requested_method, 'reference', requested_reference, 'paidAt', requested_paid_at
    ))
  ) returning id into created;
  perform finance.append_financial_event('PAYMENT_REGISTERED', actor, operation_key, account_id, null, null, created, null, jsonb_build_object('paymentId', created), correlation);
  perform finance.append_financial_event('RECEIPT_ASSIGNED', actor, operation_key, account_id, null, null, created, null, jsonb_build_object('paymentId', created, 'receiptNumber', receipt), correlation);
  perform finance.complete_financial_command(actor, 'REGISTER_PAYMENT', operation_key, 'PAYMENT', created);
  return query select created, 'PENDING';
end;
$$;

create function finance.confirm_payment(payment_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  payment_row finance.payments%rowtype;
begin
  actor := finance.require_finance_permission('finance.payments.confirm');
  prior := finance.begin_financial_command(actor, 'CONFIRM_PAYMENT', operation_key, jsonb_build_object('payment', payment_id));
  if prior is not null then
    return query select prior, (select payments.status::text from finance.payments payments where payments.id = prior);
    return;
  end if;
  select * into payment_row from finance.payments where id = payment_id for update;
  if payment_row.id is null or payment_row.status <> 'PENDING' then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payments set status = 'CONFIRMED' where id = payment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('PAYMENT_CONFIRMED', actor, operation_key, payment_row.student_account_id, null, null, payment_id, null, jsonb_build_object('paymentId', payment_id), correlation);
  perform finance.complete_financial_command(actor, 'CONFIRM_PAYMENT', operation_key, 'PAYMENT', payment_id);
  return query select payment_id, 'CONFIRMED';
end;
$$;

create function finance.allocate_payment(
  payment_id uuid,
  charge_id uuid,
  requested_amount numeric,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  payment_row finance.payments%rowtype;
  charge_row finance.student_charges%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.payments.allocate');
  if requested_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'ALLOCATE_PAYMENT', operation_key, jsonb_build_object('payment', payment_id, 'charge', charge_id, 'amount', requested_amount));
  if prior is not null then
    return query select prior, (select allocations.status::text from finance.payment_allocations allocations where allocations.id = prior);
    return;
  end if;
  select * into payment_row from finance.payments where id = payment_id for update;
  select * into charge_row from finance.student_charges where id = charge_id for update;
  if payment_row.id is null or payment_row.status not in ('CONFIRMED', 'PARTIALLY_APPLIED') then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  if charge_row.id is null or charge_row.status not in ('POSTED', 'PARTIALLY_PAID') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if payment_row.student_account_id <> charge_row.student_account_id then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  if payment_row.currency_code <> charge_row.currency_code then
    raise exception 'CURRENCY_MISMATCH';
  end if;
  if requested_amount > finance.get_payment_available_amount(payment_id) then
    raise exception 'PAYMENT_OVERALLOCATION';
  end if;
  if requested_amount > finance.get_charge_balance(charge_id) then
    raise exception 'PAYMENT_OVERALLOCATION';
  end if;
  insert into finance.payment_allocations(
    payment_id, student_charge_id, amount, status, applied_by_account_id, applied_at,
    idempotency_key, request_fingerprint
  ) values (
    payment_id, charge_id, requested_amount, 'APPLIED', actor, statement_timestamp(),
    operation_key, finance.financial_fingerprint(jsonb_build_object('payment', payment_id, 'charge', charge_id, 'amount', requested_amount))
  ) returning id into created;
  perform finance.recompute_charge_status(charge_id);
  perform finance.recompute_payment_status(payment_id);
  perform finance.append_financial_event('PAYMENT_ALLOCATED', actor, operation_key, payment_row.student_account_id, charge_id, null, payment_id, created, jsonb_build_object('allocationId', created), correlation);
  perform finance.complete_financial_command(actor, 'ALLOCATE_PAYMENT', operation_key, 'PAYMENT_ALLOCATION', created);
  return query select created, 'APPLIED';
end;
$$;

create function finance.reverse_payment_allocation(allocation_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  allocation_row finance.payment_allocations%rowtype;
  created uuid;
begin
  actor := finance.require_finance_permission('finance.payments.reverse');
  prior := finance.begin_financial_command(actor, 'REVERSE_PAYMENT_ALLOCATION', operation_key, jsonb_build_object('allocation', allocation_id));
  if prior is not null then
    return query select prior, (select allocations.status::text from finance.payment_allocations allocations where allocations.id = prior);
    return;
  end if;
  select * into allocation_row from finance.payment_allocations where id = allocation_id for update;
  if allocation_row.id is null or allocation_row.status <> 'APPLIED' then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  if exists(select 1 from finance.payment_allocations where reversed_by_allocation_id = allocation_id) then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  insert into finance.payment_allocations(
    payment_id, student_charge_id, amount, status, applied_by_account_id, applied_at,
    reversed_by_allocation_id, idempotency_key, request_fingerprint
  ) values (
    allocation_row.payment_id, allocation_row.student_charge_id, allocation_row.amount, 'REVERSED', actor, statement_timestamp(),
    allocation_id, operation_key, finance.financial_fingerprint(jsonb_build_object('allocation', allocation_id, 'amount', allocation_row.amount))
  ) returning id into created;
  perform finance.recompute_charge_status(allocation_row.student_charge_id);
  perform finance.recompute_payment_status(allocation_row.payment_id);
  perform finance.append_financial_event('PAYMENT_ALLOCATION_REVERSED', actor, operation_key, null, allocation_row.student_charge_id, null, allocation_row.payment_id, created, jsonb_build_object('allocationId', allocation_id, 'reversalId', created), correlation);
  perform finance.complete_financial_command(actor, 'REVERSE_PAYMENT_ALLOCATION', operation_key, 'PAYMENT_ALLOCATION', created);
  return query select created, 'REVERSED';
end;
$$;

create function finance.reverse_payment(
  payment_id uuid,
  reason_code finance.payment_reversal_reason_code,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  payment_row finance.payments%rowtype;
  reversal_id uuid;
  receipt text;
begin
  actor := finance.require_finance_permission('finance.payments.reverse');
  prior := finance.begin_financial_command(actor, 'REVERSE_PAYMENT', operation_key, jsonb_build_object('payment', payment_id, 'reason', reason_code));
  if prior is not null then
    return query select prior, (select payments.status::text from finance.payments payments where payments.id = prior);
    return;
  end if;
  select * into payment_row from finance.payments where id = payment_id for update;
  if payment_row.id is null or payment_row.status = 'REVERSED' then
    raise exception 'PAYMENT_INVALID_STATE';
  end if;
  if finance.get_payment_available_amount(payment_id) <> payment_row.amount then
    raise exception 'PAYMENT_ALREADY_APPLIED';
  end if;
  receipt := finance.next_receipt_number();
  insert into finance.payments(
    student_account_id, receipt_number, amount, currency_code, payment_method, payment_reference,
    paid_at, received_by_account_id, status, idempotency_key, request_fingerprint
  ) values (
    payment_row.student_account_id, receipt, payment_row.amount, payment_row.currency_code, payment_row.payment_method, payment_row.payment_reference,
    statement_timestamp(), actor, 'REVERSED', operation_key || '_REVERSAL', finance.financial_fingerprint(jsonb_build_object('payment', payment_id, 'reason', reason_code, 'reversal', true))
  ) returning id into reversal_id;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payments
  set status = 'REVERSED',
      reversed_by_payment_id = reversal_id,
      reversal_reason_code = reason_code
  where id = payment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('PAYMENT_REVERSED', actor, operation_key, payment_row.student_account_id, null, null, payment_id, null, jsonb_build_object('paymentId', payment_id, 'reversalPaymentId', reversal_id), correlation);
  perform finance.complete_financial_command(actor, 'REVERSE_PAYMENT', operation_key, 'PAYMENT', reversal_id);
  return query select reversal_id, 'REVERSED';
end;
$$;

create function finance.close_student_account(account_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  account_row finance.student_accounts%rowtype;
begin
  actor := finance.require_finance_permission('finance.accounts.close');
  prior := finance.begin_financial_command(actor, 'CLOSE_STUDENT_ACCOUNT', operation_key, jsonb_build_object('account', account_id));
  if prior is not null then
    return query select prior, (select accounts.status::text from finance.student_accounts accounts where accounts.id = prior);
    return;
  end if;
  select * into account_row from finance.student_accounts where id = account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;
  if finance.get_student_account_balance(account_id) <> 0 then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_accounts
  set status = 'CLOSED',
      closed_at = statement_timestamp()
  where id = account_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('STUDENT_ACCOUNT_CLOSED', actor, operation_key, account_id, null, null, null, null, jsonb_build_object('studentAccountId', account_id), correlation);
  perform finance.complete_financial_command(actor, 'CLOSE_STUDENT_ACCOUNT', operation_key, 'STUDENT_ACCOUNT', account_id);
  return query select account_id, 'CLOSED';
end;
$$;

create function finance.resolve_student_finance_context(requested_period_id uuid default null)
returns table(
  resolved_account_id uuid,
  resolved_student_record_id uuid,
  resolved_student_account_id uuid,
  resolved_academic_period_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_account core.accounts%rowtype;
  current_record academic.student_records%rowtype;
  current_finance_account finance.student_accounts%rowtype;
  current_enrollment academic.period_enrollments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  if not exists (
    select 1 from core.get_current_identity_context() identity_context
    where identity_context.session_valid
      and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
  ) then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  select * into current_account from core.accounts where auth_user_id = auth.uid();
  if current_account.id is null or current_account.account_status <> 'ACTIVE' then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  if not exists (
    select 1
    from core.account_roles assignments
    join core.roles roles on roles.id = assignments.role_id
    where assignments.account_id = current_account.id
      and assignments.revoked_at is null
      and roles.is_active
      and roles.code = 'ALUMNO'
  ) then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  select * into current_record
  from academic.student_records records
  where records.account_id = current_account.id
  order by records.created_at desc
  limit 1;
  if current_record.id is null then
    raise exception 'STUDENT_ACCOUNT_NOT_FOUND';
  end if;
  select * into current_finance_account
  from finance.student_accounts accounts
  where accounts.student_record_id = current_record.id
  order by accounts.created_at desc
  limit 1;
  if requested_period_id is null then
    select pe.* into current_enrollment
    from academic.period_enrollments pe
    join academic.academic_periods ap on ap.id = pe.academic_period_id
    where pe.student_record_id = current_record.id
      and pe.status <> 'CANCELLED'
    order by ap.starts_on desc, pe.enrolled_at desc
    limit 1;
  else
    select * into current_enrollment
    from academic.period_enrollments pe
    where pe.student_record_id = current_record.id
      and pe.academic_period_id = requested_period_id
      and pe.status <> 'CANCELLED'
    limit 1;
    if current_enrollment.id is null then
      raise exception 'FINANCIAL_PERIOD_INVALID';
    end if;
  end if;
  return query select current_account.id, current_record.id, current_finance_account.id, current_enrollment.academic_period_id;
end;
$$;

create function finance.require_guardian_finance_context(requested_link_id uuid, requested_period_id uuid default null)
returns table(
  resolved_guardian_account_id uuid,
  resolved_student_record_id uuid,
  resolved_student_account_id uuid,
  resolved_academic_period_id uuid,
  resolved_access_scope_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_account core.accounts%rowtype;
  current_link academic.guardian_student_links%rowtype;
  current_scope academic.guardian_access_scopes%rowtype;
  current_enrollment academic.period_enrollments%rowtype;
  current_finance_account finance.student_accounts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  if not exists (
    select 1 from core.get_current_identity_context() identity_context
    where identity_context.session_valid
      and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
  ) then
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  select * into current_account from core.accounts where auth_user_id = auth.uid();
  if current_account.id is null or current_account.account_status <> 'ACTIVE' then
    raise exception 'FINANCE_SCOPE_DENIED';
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
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  select * into current_link
  from academic.guardian_student_links links
  where links.id = requested_link_id
    and links.guardian_account_id = current_account.id
    and links.status = 'ACTIVE'
    and links.valid_from <= statement_timestamp()
    and (links.valid_until is null or links.valid_until >= statement_timestamp());
  if current_link.id is null then
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  select * into current_scope
  from academic.guardian_access_scopes scopes
  where scopes.id = current_link.access_scope_id
    and scopes.status = 'ACTIVE';
  if current_scope.id is null or not current_scope.can_view_financial_account then
    raise exception 'FINANCE_SCOPE_DENIED';
  end if;
  select * into current_finance_account
  from finance.student_accounts accounts
  where accounts.student_record_id = current_link.student_record_id
  order by accounts.created_at desc
  limit 1;
  if requested_period_id is null then
    select pe.* into current_enrollment
    from academic.period_enrollments pe
    join academic.academic_periods ap on ap.id = pe.academic_period_id
    where pe.student_record_id = current_link.student_record_id
      and pe.status <> 'CANCELLED'
    order by ap.starts_on desc, pe.enrolled_at desc
    limit 1;
  else
    select * into current_enrollment
    from academic.period_enrollments pe
    where pe.student_record_id = current_link.student_record_id
      and pe.academic_period_id = requested_period_id
      and pe.status <> 'CANCELLED'
    limit 1;
    if current_enrollment.id is null then
      raise exception 'FINANCE_SCOPE_DENIED';
    end if;
  end if;
  return query select current_account.id, current_link.student_record_id, current_finance_account.id, current_enrollment.academic_period_id, current_scope.id;
end;
$$;

create function finance.get_student_account_ledger(account_id uuid, requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with charge_rows as (
  select
    charges.created_at as effective_at,
    charges.created_at,
    charges.id::text as reference_id,
    charges.id as charge_id,
    null::uuid as payment_id,
    charges.description as concept_name,
    charges.status::text as status,
    finance.format_money(charges.original_amount) as charge_amount,
    '0.00'::text as credit_amount,
    case when charges.academic_period_id = requested_period_id or requested_period_id is null then true else false end as include_row
  from finance.student_charges charges
  where charges.student_account_id = account_id
    and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REVERSED')
), adjustment_rows as (
  select
    coalesce(adjustments.effective_at, adjustments.created_at) as effective_at,
    adjustments.created_at,
    adjustments.id::text as reference_id,
    adjustments.student_charge_id as charge_id,
    null::uuid as payment_id,
    concat('Ajuste ', adjustments.adjustment_type::text) as concept_name,
    adjustments.status::text as status,
    case when adjustments.adjustment_type = 'DEBIT_ADJUSTMENT' then finance.format_money(adjustments.amount) else '0.00' end as charge_amount,
    case when adjustments.adjustment_type in ('DISCOUNT', 'CREDIT_ADJUSTMENT', 'WAIVER') then finance.format_money(adjustments.amount) else '0.00' end as credit_amount,
    case when charges.academic_period_id = requested_period_id or requested_period_id is null then true else false end as include_row
  from finance.charge_adjustments adjustments
  join finance.student_charges charges on charges.id = adjustments.student_charge_id
  where adjustments.status = 'APPLIED'
    and charges.student_account_id = account_id
), payment_rows as (
  select
    payments.paid_at as effective_at,
    payments.created_at,
    payments.id::text as reference_id,
    null::uuid as charge_id,
    payments.id as payment_id,
    concat('Pago ', payments.receipt_number) as concept_name,
    payments.status::text as status,
    '0.00'::text as charge_amount,
    finance.format_money(payments.amount) as credit_amount,
    true as include_row
  from finance.payments payments
  where payments.student_account_id = account_id
    and payments.status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED')
), allocation_reversal_rows as (
  select
    allocations.applied_at as effective_at,
    allocations.created_at,
    allocations.id::text as reference_id,
    allocations.student_charge_id as charge_id,
    allocations.payment_id,
    case when allocations.status = 'REVERSED' then 'Reverso de aplicación' else 'Aplicación de pago' end as concept_name,
    allocations.status::text as status,
    case when allocations.status = 'REVERSED' then finance.format_money(allocations.amount) else '0.00' end as charge_amount,
    case when allocations.status = 'APPLIED' then finance.format_money(allocations.amount) else '0.00' end as credit_amount,
    case when charges.academic_period_id = requested_period_id or requested_period_id is null then true else false end as include_row
  from finance.payment_allocations allocations
  join finance.student_charges charges on charges.id = allocations.student_charge_id
  where charges.student_account_id = account_id
), rows_union as (
  select * from charge_rows
  union all
  select * from adjustment_rows
  union all
  select * from payment_rows
  union all
  select * from allocation_reversal_rows
), ordered as (
  select
    effective_at,
    created_at,
    reference_id,
    charge_id,
    payment_id,
    concept_name,
    status,
    charge_amount,
    credit_amount,
    sum((charge_amount::numeric) - (credit_amount::numeric)) over (
      order by effective_at, created_at, reference_id
      rows between unbounded preceding and current row
    ) as running_balance
  from rows_union
  where include_row
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'effectiveAt', effective_at,
      'reference', reference_id,
      'concept', concept_name,
      'charge', charge_amount,
      'credit', credit_amount,
      'balance', finance.format_money(running_balance),
      'status', status
    )
    order by effective_at, created_at, reference_id
  ),
  '[]'::jsonb
)
from ordered
$$;

create function finance.get_my_student_financial_summary()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from finance.resolve_student_finance_context(null)
),
account as (
  select accounts.*
  from context
  left join finance.student_accounts accounts on accounts.id = context.resolved_student_account_id
)
select case
  when (select id from account) is null then jsonb_build_object(
    'accountStatus', 'NOT_OPENED',
    'currencyCode', 'MXN',
    'totalBalance', '0.00',
    'pendingChargesCount', 0,
    'paymentsCount', 0,
    'lastUpdatedAt', null
  )
  else jsonb_build_object(
    'accountStatus', (select status::text from account),
    'currencyCode', 'MXN',
    'totalBalance', finance.format_money(finance.get_student_account_balance((select id from account))),
    'pendingChargesCount', (
      select count(*)::int from finance.student_charges
      where student_account_id = (select id from account)
        and status in ('POSTED', 'PARTIALLY_PAID')
    ),
    'paymentsCount', (
      select count(*)::int from finance.payments
      where student_account_id = (select id from account)
        and status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED', 'REVERSED')
    ),
    'lastUpdatedAt', (
      select max(updated_at)
      from (
        select updated_at from finance.student_accounts where id = (select id from account)
        union all
        select updated_at from finance.student_charges where student_account_id = (select id from account)
        union all
        select updated_at from finance.payments where student_account_id = (select id from account)
      ) t
    )
  )
end
$$;

create function finance.get_my_student_account_statement(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from finance.resolve_student_finance_context(requested_period_id)
)
select case
  when (select resolved_student_account_id from context) is null then '[]'::jsonb
  else finance.get_student_account_ledger((select resolved_student_account_id from context), (select resolved_academic_period_id from context))
end
$$;

create function finance.get_my_student_charges(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from finance.resolve_student_finance_context(requested_period_id)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'chargeId', charges.id,
      'description', charges.description,
      'originalAmount', finance.format_money(charges.original_amount),
      'balance', finance.format_money(finance.get_charge_balance(charges.id)),
      'currencyCode', charges.currency_code,
      'dueDate', charges.due_date,
      'status', charges.status,
      'source', charges.source,
      'academicPeriodId', charges.academic_period_id
    )
    order by charges.created_at desc
  ),
  '[]'::jsonb
)
from context
join finance.student_charges charges on charges.student_account_id = context.resolved_student_account_id
where requested_period_id is null or charges.academic_period_id = context.resolved_academic_period_id
$$;

create function finance.get_my_student_payments(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from finance.resolve_student_finance_context(requested_period_id)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'paymentId', payments.id,
      'receiptNumber', payments.receipt_number,
      'amount', finance.format_money(payments.amount),
      'currencyCode', payments.currency_code,
      'paymentMethod', payments.payment_method,
      'paymentReferenceMasked', finance.mask_payment_reference(payments.payment_reference),
      'paidAt', payments.paid_at,
      'status', payments.status
    )
    order by payments.paid_at desc, payments.created_at desc
  ),
  '[]'::jsonb
)
from context
join finance.payments payments on payments.student_account_id = context.resolved_student_account_id
$$;

create function finance.get_my_student_payment(payment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  payment_data jsonb;
begin
  with context as (
    select * from finance.resolve_student_finance_context(null)
  ),
  payment_row as (
    select *
    from finance.payments
    where id = payment_id
      and student_account_id = (select resolved_student_account_id from context)
  )
  select case
    when not exists(select 1 from payment_row) then null
    else jsonb_build_object(
    'paymentId', (select id from payment_row),
    'receiptNumber', (select receipt_number from payment_row),
    'amount', finance.format_money((select amount from payment_row)),
    'currencyCode', 'MXN',
    'paymentMethod', (select payment_method::text from payment_row),
    'paymentReferenceMasked', finance.mask_payment_reference((select payment_reference from payment_row)),
    'paidAt', (select paid_at from payment_row),
    'status', (select status::text from payment_row),
    'allocations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'allocationId', allocations.id,
        'chargeId', allocations.student_charge_id,
        'amount', finance.format_money(allocations.amount),
        'status', allocations.status
      ) order by allocations.applied_at, allocations.created_at, allocations.id)
      from finance.payment_allocations allocations
      where allocations.payment_id = (select id from payment_row)
    ), '[]'::jsonb)
  )
  end
  into payment_data;

  if payment_data is null then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  return payment_data;
end;
$$;

create function finance.get_my_student_receipt(payment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with payment_data as (
  select * from finance.get_my_student_payment(payment_id)
)
select jsonb_build_object(
    'title', 'Recibo interno de pago',
    'legend', 'Comprobante interno de registro de pago. No constituye CFDI ni comprobante fiscal.',
    'payment', (select * from payment_data)
  )
from payment_data
$$;

create function finance.get_my_guardian_student_financial_summary(link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
select jsonb_build_object('error', 'FINANCE_SCOPE_DENIED')
where true
$$;

create function finance.get_my_guardian_student_account_statement(link_id uuid, requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
select jsonb_build_object('error', 'FINANCE_SCOPE_DENIED')
where true
$$;

create or replace function public.get_my_student_financial_summary()
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_financial_summary() $$;

create or replace function public.get_my_student_account_statement(requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_account_statement(requested_period_id) $$;

create or replace function public.get_my_student_charges(requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_charges(requested_period_id) $$;

create or replace function public.get_my_student_payments(requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_payments(requested_period_id) $$;

create or replace function public.get_my_student_payment(payment_id uuid)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_payment(payment_id) $$;

create or replace function public.get_my_student_receipt(payment_id uuid)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_student_receipt(payment_id) $$;

create or replace function public.get_my_guardian_student_financial_summary(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_guardian_student_financial_summary(link_id) $$;

create or replace function public.get_my_guardian_student_account_statement(link_id uuid, requested_period_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as
$$ select finance.get_my_guardian_student_account_statement(link_id, requested_period_id) $$;

alter schema finance owner to postgres;
alter table finance.charge_concepts owner to postgres;
alter table finance.charge_rates owner to postgres;
alter table finance.student_accounts owner to postgres;
alter table finance.student_charges owner to postgres;
alter table finance.charge_adjustments owner to postgres;
alter table finance.payments owner to postgres;
alter table finance.payment_allocations owner to postgres;
alter table finance.financial_commands owner to postgres;
alter table finance.financial_events owner to postgres;
alter table finance.receipt_sequences owner to postgres;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('finance', 'public')
      and p.proname in (
        'financial_fingerprint',
        'mask_payment_reference',
        'format_money',
        'require_finance_permission',
        'begin_financial_command',
        'complete_financial_command',
        'append_financial_event',
        'guard_financial_immutable',
        'touch_updated_at',
        'rate_scope_key',
        'assert_charge_rate_activation_allowed',
        'charge_adjustment_effect',
        'charge_applied_adjustments',
        'charge_applied_allocations',
        'payment_applied_allocations',
        'get_charge_balance',
        'get_payment_available_amount',
        'get_student_account_balance',
        'recompute_charge_status',
        'recompute_payment_status',
        'next_receipt_number',
        'open_student_account',
        'create_charge_concept',
        'create_charge_rate',
        'approve_charge_rate',
        'activate_charge_rate',
        'create_student_charge',
        'post_student_charge',
        'cancel_student_charge',
        'create_charge_adjustment',
        'approve_charge_adjustment',
        'apply_charge_adjustment',
        'register_payment',
        'confirm_payment',
        'allocate_payment',
        'reverse_payment_allocation',
        'reverse_payment',
        'close_student_account',
        'resolve_student_finance_context',
        'require_guardian_finance_context',
        'get_student_account_ledger',
        'get_my_student_financial_summary',
        'get_my_student_account_statement',
        'get_my_student_charges',
        'get_my_student_payments',
        'get_my_student_payment',
        'get_my_student_receipt',
        'get_my_guardian_student_financial_summary',
        'get_my_guardian_student_account_statement'
      )
  loop
    execute format('alter function %s owner to postgres', f.signature);
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end$$;

grant execute on function public.get_my_student_financial_summary() to authenticated;
grant execute on function public.get_my_student_account_statement(uuid) to authenticated;
grant execute on function public.get_my_student_charges(uuid) to authenticated;
grant execute on function public.get_my_student_payments(uuid) to authenticated;
grant execute on function public.get_my_student_payment(uuid) to authenticated;
grant execute on function public.get_my_student_receipt(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_financial_summary(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_account_statement(uuid, uuid) to authenticated;

alter table finance.charge_concepts enable row level security;
alter table finance.charge_rates enable row level security;
alter table finance.student_accounts enable row level security;
alter table finance.student_charges enable row level security;
alter table finance.charge_adjustments enable row level security;
alter table finance.payments enable row level security;
alter table finance.payment_allocations enable row level security;
alter table finance.financial_commands enable row level security;
alter table finance.financial_events enable row level security;
alter table finance.receipt_sequences enable row level security;

revoke all on all tables in schema finance from public, anon, authenticated;
revoke all on all sequences in schema finance from public, anon, authenticated;
revoke all on all routines in schema finance from public, anon, authenticated;

commit;
