do $$
begin
  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_register_status'
  ) then
    create type finance.cash_register_status as enum (
      'ACTIVE',
      'SUSPENDED',
      'RETIRED',
      'PENDING_INSTITUTIONAL_VALIDATION'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cashier_assignment_status'
  ) then
    create type finance.cashier_assignment_status as enum (
      'ACTIVE',
      'SUSPENDED',
      'REVOKED',
      'EXPIRED'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_session_status'
  ) then
    create type finance.cash_session_status as enum (
      'OPEN',
      'CLOSING',
      'RECONCILIATION_REQUIRED',
      'CLOSED',
      'CANCELLED'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_movement_type'
  ) then
    create type finance.cash_movement_type as enum (
      'CASH_IN',
      'CASH_OUT',
      'CASH_WITHDRAWAL',
      'CASH_TRANSFER',
      'REVERSAL'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_movement_status'
  ) then
    create type finance.cash_movement_status as enum (
      'ACTIVE',
      'REVERSED'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_movement_reason_code'
  ) then
    create type finance.cash_movement_reason_code as enum (
      'CHANGE_FUND_ADDITION',
      'SAFE_DROP',
      'CASH_TRANSFER',
      'CORRECTION',
      'OTHER_MANUAL_REVIEW'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_difference_reason_code'
  ) then
    create type finance.cash_difference_reason_code as enum (
      'COUNT_ERROR',
      'UNREGISTERED_MOVEMENT',
      'POST_CLOSE_REVERSAL',
      'PENDING_INSTITUTIONAL_VALIDATION',
      'OTHER_MANUAL_REVIEW'
    );
  end if;

  if not exists (
    select 1 from pg_type
    where typnamespace = 'finance'::regnamespace and typname = 'cash_reconciliation_status'
  ) then
    create type finance.cash_reconciliation_status as enum (
      'BALANCED',
      'OVERAGE',
      'SHORTAGE',
      'REVIEW_REQUIRED',
      'APPROVED'
    );
  end if;
end $$;

alter type finance.financial_command_type add value if not exists 'CREATE_CASH_REGISTER';
alter type finance.financial_command_type add value if not exists 'ASSIGN_CASHIER_TO_REGISTER';
alter type finance.financial_command_type add value if not exists 'OPEN_CASH_SESSION';
alter type finance.financial_command_type add value if not exists 'LINK_PAYMENT_TO_CASH_SESSION';
alter type finance.financial_command_type add value if not exists 'CREATE_CASH_MOVEMENT';
alter type finance.financial_command_type add value if not exists 'REVERSE_CASH_MOVEMENT';
alter type finance.financial_command_type add value if not exists 'BEGIN_CASH_SESSION_CLOSE';
alter type finance.financial_command_type add value if not exists 'RECORD_CASH_COUNT';
alter type finance.financial_command_type add value if not exists 'CLOSE_CASH_SESSION';
alter type finance.financial_command_type add value if not exists 'APPROVE_CASH_DIFFERENCE';

alter type finance.financial_event_type add value if not exists 'CASH_REGISTER_CREATED';
alter type finance.financial_event_type add value if not exists 'CASHIER_ASSIGNED';
alter type finance.financial_event_type add value if not exists 'CASH_SESSION_OPENED';
alter type finance.financial_event_type add value if not exists 'CASH_PAYMENT_LINKED';
alter type finance.financial_event_type add value if not exists 'CASH_MOVEMENT_CREATED';
alter type finance.financial_event_type add value if not exists 'CASH_MOVEMENT_REVERSED';
alter type finance.financial_event_type add value if not exists 'CASH_COUNT_RECORDED';
alter type finance.financial_event_type add value if not exists 'CASH_SESSION_CLOSING_STARTED';
alter type finance.financial_event_type add value if not exists 'CASH_RECONCILIATION_CREATED';
alter type finance.financial_event_type add value if not exists 'CASH_DIFFERENCE_DETECTED';
alter type finance.financial_event_type add value if not exists 'CASH_DIFFERENCE_APPROVED';
alter type finance.financial_event_type add value if not exists 'CASH_SESSION_CLOSED';
alter type finance.financial_event_type add value if not exists 'CASH_OPERATION_DENIED';

create table finance.cash_registers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status finance.cash_register_status not null,
  location_label text,
  currency_code char(3) not null default 'MXN',
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (currency_code = 'MXN'),
  check (btrim(code) <> ''),
  check (btrim(name) <> '')
);

create table finance.cashier_assignments (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references finance.cash_registers(id) on delete restrict,
  account_id uuid not null references core.accounts(id) on delete restrict,
  status finance.cashier_assignment_status not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  assigned_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_until is null or valid_until > valid_from)
);

create table finance.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references finance.cash_registers(id) on delete restrict,
  cashier_account_id uuid not null references core.accounts(id) on delete restrict,
  business_date date not null,
  opened_at timestamptz not null,
  opening_amount numeric(12,2) not null,
  status finance.cash_session_status not null,
  closed_at timestamptz,
  closed_by_account_id uuid references core.accounts(id) on delete restrict,
  expected_cash_amount numeric(12,2),
  counted_cash_amount numeric(12,2),
  difference_amount numeric(12,2),
  difference_reason_code finance.cash_difference_reason_code,
  difference_note text,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (opening_amount >= 0),
  check (expected_cash_amount is null or expected_cash_amount >= 0),
  check (counted_cash_amount is null or counted_cash_amount >= 0),
  check (
    (status in ('OPEN', 'CLOSING') and closed_at is null and closed_by_account_id is null and approved_by_account_id is null and approved_at is null)
    or
    (status in ('RECONCILIATION_REQUIRED', 'CLOSED', 'CANCELLED'))
  ),
  check (approved_by_account_id is null or approved_by_account_id <> cashier_account_id)
);

create unique index cash_sessions_one_active_register
on finance.cash_sessions(cash_register_id)
where status in ('OPEN', 'CLOSING', 'RECONCILIATION_REQUIRED');

create unique index cash_sessions_one_active_cashier
on finance.cash_sessions(cashier_account_id)
where status in ('OPEN', 'CLOSING', 'RECONCILIATION_REQUIRED');

create table finance.cash_session_payments (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references finance.cash_sessions(id) on delete restrict,
  payment_id uuid not null references finance.payments(id) on delete restrict,
  linked_at timestamptz not null default statement_timestamp(),
  linked_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (payment_id)
);

create table finance.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references finance.cash_sessions(id) on delete restrict,
  movement_type finance.cash_movement_type not null,
  amount numeric(12,2) not null,
  reason_code finance.cash_movement_reason_code not null,
  note text,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  reversed_by_movement_id uuid references finance.cash_movements(id) on delete restrict,
  status finance.cash_movement_status not null,
  effective_at timestamptz not null,
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (amount > 0),
  unique (created_by_account_id, idempotency_key)
);

create table finance.cash_counts (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references finance.cash_sessions(id) on delete restrict,
  counted_amount numeric(12,2) not null,
  counted_by_account_id uuid not null references core.accounts(id) on delete restrict,
  counted_at timestamptz not null default statement_timestamp(),
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (counted_amount >= 0),
  unique (cash_session_id),
  unique (counted_by_account_id, idempotency_key)
);

create table finance.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid not null references finance.cash_sessions(id) on delete restrict,
  expected_amount numeric(12,2) not null,
  counted_amount numeric(12,2) not null,
  difference_amount numeric(12,2) not null,
  status finance.cash_reconciliation_status not null,
  reason_code finance.cash_difference_reason_code,
  reviewed_by_account_id uuid references core.accounts(id) on delete restrict,
  reviewed_at timestamptz,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (expected_amount >= 0),
  check (counted_amount >= 0),
  unique (cash_session_id)
);

create function finance.require_cash_permission(permission_code text)
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
    allowed := permission_code like 'finance.cash.%';
  elsif role_codes && array['ADMINISTRATIVO'] then
    allowed := permission_code in (
      'finance.cash.registers.manage',
      'finance.cash.assignments.manage',
      'finance.cash.sessions.open',
      'finance.cash.sessions.read',
      'finance.cash.sessions.close',
      'finance.cash.movements.create',
      'finance.cash.movements.reverse',
      'finance.cash.counts.create',
      'finance.cash.reconciliation.review',
      'finance.cash.reconciliation.approve',
      'finance.cash.reports.read'
    );
  elsif role_codes && array['CAJA'] then
    allowed := permission_code in (
      'finance.cash.sessions.open',
      'finance.cash.sessions.read',
      'finance.cash.sessions.close',
      'finance.cash.movements.create',
      'finance.cash.counts.create',
      'finance.cash.reports.read'
    );
  end if;

  if not allowed then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  return actor.id;
end;
$$;

create function finance.require_active_cashier_assignment(
  actor_id uuid,
  target_register_id uuid,
  target_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  session_row finance.cash_sessions%rowtype;
  resolved_register_id uuid := target_register_id;
  assignment_id uuid;
begin
  if target_session_id is not null then
    select * into session_row
    from finance.cash_sessions
    where id = target_session_id;

    if session_row.id is null then
      raise exception 'CASH_SESSION_NOT_FOUND';
    end if;

    resolved_register_id := session_row.cash_register_id;
  end if;

  select assignments.id
  into assignment_id
  from finance.cashier_assignments assignments
  where assignments.cash_register_id = resolved_register_id
    and assignments.account_id = actor_id
    and assignments.status = 'ACTIVE'
    and assignments.valid_from <= statement_timestamp()
    and (assignments.valid_until is null or assignments.valid_until > statement_timestamp())
  order by assignments.valid_from desc, assignments.created_at desc
  limit 1;

  if assignment_id is null then
    raise exception 'CASHIER_NOT_ASSIGNED';
  end if;

  return assignment_id;
end;
$$;

create function finance.guard_cash_append_only()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception 'HISTORICAL_RECORD_IMMUTABLE';
end;
$$;

create function finance.guard_cash_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if current_setting('finance.controlled_mutation', true) = 'on' then
    return new;
  end if;
  raise exception 'HISTORICAL_RECORD_IMMUTABLE';
end;
$$;

create function finance.calculate_expected_cash(target_cash_session_id uuid)
returns numeric(12,2)
language sql
stable
security definer
set search_path=''
as $$
with session_row as (
  select opening_amount
  from finance.cash_sessions
  where id = target_cash_session_id
),
linked_cash_payments as (
  select coalesce(sum(payments.amount), 0::numeric) as amount
  from finance.cash_session_payments links
  join finance.payments payments on payments.id = links.payment_id
  where links.cash_session_id = target_cash_session_id
    and payments.payment_method = 'CASH'
    and payments.status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED')
),
movement_effects as (
  select coalesce(sum(
    case
      when movements.status = 'REVERSED' then 0::numeric
      when movements.movement_type = 'CASH_IN' then movements.amount
      when movements.movement_type in ('CASH_OUT', 'CASH_WITHDRAWAL') then -movements.amount
      when movements.movement_type = 'CASH_TRANSFER' then -movements.amount
      when movements.movement_type = 'REVERSAL' then
        case original.movement_type
          when 'CASH_IN' then -movements.amount
          when 'CASH_OUT' then movements.amount
          when 'CASH_WITHDRAWAL' then movements.amount
          when 'CASH_TRANSFER' then movements.amount
          else 0::numeric
        end
      else 0::numeric
    end
  ), 0::numeric) as amount
  from finance.cash_movements movements
  left join finance.cash_movements original on original.reversed_by_movement_id = movements.id
  where movements.cash_session_id = target_cash_session_id
)
select coalesce((select opening_amount from session_row), 0::numeric)
  + (select amount from linked_cash_payments)
  + (select amount from movement_effects)
$$;

create function finance.create_cash_register(
  register_code text,
  register_name text,
  register_location_label text,
  requested_status finance.cash_register_status,
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
  normalized_code text := upper(btrim(register_code));
begin
  actor := finance.require_cash_permission('finance.cash.registers.manage');
  prior := finance.begin_financial_command(actor, 'CREATE_CASH_REGISTER', operation_key, jsonb_build_object(
    'code', normalized_code,
    'name', btrim(register_name),
    'location', register_location_label,
    'status', requested_status
  ));
  if prior is not null then
    return query select prior, (select registers.status::text from finance.cash_registers registers where registers.id = prior);
    return;
  end if;

  if normalized_code = '' or btrim(register_name) = '' then
    raise exception 'CASH_REGISTER_NOT_ACTIVE';
  end if;

  insert into finance.cash_registers(code, name, status, location_label, created_by_account_id)
  values (normalized_code, btrim(register_name), requested_status, register_location_label, actor)
  returning id into created;

  perform finance.append_financial_event('CASH_REGISTER_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashRegisterId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CASH_REGISTER', operation_key, 'CASH_REGISTER', created);
  return query select created, requested_status::text;
end;
$$;

create function finance.assign_cashier_to_register(
  target_register_id uuid,
  target_account_id uuid,
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
  created uuid;
  target_account core.accounts%rowtype;
  register_row finance.cash_registers%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.assignments.manage');
  prior := finance.begin_financial_command(actor, 'ASSIGN_CASHIER_TO_REGISTER', operation_key, jsonb_build_object(
    'register', target_register_id,
    'account', target_account_id,
    'validFrom', requested_valid_from,
    'validUntil', requested_valid_until
  ));
  if prior is not null then
    return query select prior, (select assignments.status::text from finance.cashier_assignments assignments where assignments.id = prior);
    return;
  end if;

  select * into register_row from finance.cash_registers where id = target_register_id;
  if register_row.id is null then
    raise exception 'CASH_REGISTER_NOT_FOUND';
  end if;

  select * into target_account from core.accounts where id = target_account_id;
  if target_account.id is null or target_account.account_status <> 'ACTIVE' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1
    from core.account_roles assignments
    join core.roles roles on roles.id = assignments.role_id
    where assignments.account_id = target_account_id
      and assignments.revoked_at is null
      and roles.is_active
      and roles.code = 'CAJA'
  ) then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  insert into finance.cashier_assignments(
    cash_register_id,
    account_id,
    status,
    valid_from,
    valid_until,
    assigned_by_account_id
  ) values (
    target_register_id,
    target_account_id,
    'ACTIVE',
    requested_valid_from,
    requested_valid_until,
    actor
  ) returning id into created;

  perform finance.append_financial_event('CASHIER_ASSIGNED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashierAssignmentId', created), correlation);
  perform finance.complete_financial_command(actor, 'ASSIGN_CASHIER_TO_REGISTER', operation_key, 'CASHIER_ASSIGNMENT', created);
  return query select created, 'ACTIVE';
end;
$$;

create function finance.open_cash_session(
  target_register_id uuid,
  requested_business_date date,
  requested_opening_amount numeric,
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
  register_row finance.cash_registers%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.sessions.open');
  perform finance.require_active_cashier_assignment(actor, target_register_id, null);
  if requested_opening_amount < 0 then
    raise exception 'CASH_MOVEMENT_INVALID';
  end if;

  prior := finance.begin_financial_command(actor, 'OPEN_CASH_SESSION', operation_key, jsonb_build_object(
    'register', target_register_id,
    'businessDate', requested_business_date,
    'openingAmount', requested_opening_amount
  ));
  if prior is not null then
    return query select prior, (select sessions.status::text from finance.cash_sessions sessions where sessions.id = prior);
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_register_id::text || ':cash-session-open', 0));
  perform pg_advisory_xact_lock(hashtextextended(actor::text || ':cashier-session-open', 0));

  select * into register_row from finance.cash_registers where id = target_register_id for update;
  if register_row.id is null then
    raise exception 'CASH_REGISTER_NOT_FOUND';
  end if;
  if register_row.status <> 'ACTIVE' then
    raise exception 'CASH_REGISTER_NOT_ACTIVE';
  end if;

  if exists(
    select 1 from finance.cash_sessions sessions
    where sessions.cash_register_id = target_register_id
      and sessions.status in ('OPEN', 'CLOSING', 'RECONCILIATION_REQUIRED')
  ) then
    raise exception 'CASH_SESSION_ALREADY_OPEN';
  end if;

  if exists(
    select 1 from finance.cash_sessions sessions
    where sessions.cashier_account_id = actor
      and sessions.status in ('OPEN', 'CLOSING', 'RECONCILIATION_REQUIRED')
  ) then
    raise exception 'CASH_SESSION_ALREADY_OPEN';
  end if;

  insert into finance.cash_sessions(
    cash_register_id,
    cashier_account_id,
    business_date,
    opened_at,
    opening_amount,
    status
  ) values (
    target_register_id,
    actor,
    requested_business_date,
    statement_timestamp(),
    requested_opening_amount,
    'OPEN'
  ) returning id into created;

  perform finance.append_financial_event('CASH_SESSION_OPENED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', created), correlation);
  perform finance.complete_financial_command(actor, 'OPEN_CASH_SESSION', operation_key, 'CASH_SESSION', created);
  return query select created, 'OPEN';
end;
$$;

create function finance.link_payment_to_cash_session(
  target_session_id uuid,
  target_payment_id uuid,
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
  session_row finance.cash_sessions%rowtype;
  payment_row finance.payments%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.sessions.read');
  perform finance.require_active_cashier_assignment(actor, null, target_session_id);
  prior := finance.begin_financial_command(actor, 'LINK_PAYMENT_TO_CASH_SESSION', operation_key, jsonb_build_object('session', target_session_id, 'payment', target_payment_id));
  if prior is not null then
    return query select prior, 'LINKED';
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'OPEN' then
    raise exception 'CASH_SESSION_NOT_OPEN';
  end if;

  select * into payment_row from finance.payments where id = target_payment_id for update;
  if payment_row.id is null then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;
  if payment_row.status not in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED') then
    raise exception 'CASH_PAYMENT_REQUIRES_OPEN_SESSION';
  end if;
  if payment_row.payment_method = 'OTHER' then
    raise exception 'CASH_OPERATION_NOT_ALLOWED';
  end if;

  insert into finance.cash_session_payments(cash_session_id, payment_id, linked_by_account_id)
  values (target_session_id, target_payment_id, actor)
  returning id into created;

  perform finance.append_financial_event('CASH_PAYMENT_LINKED', actor, operation_key, payment_row.student_account_id, null, null, target_payment_id, null, jsonb_build_object('cashSessionId', target_session_id, 'paymentId', target_payment_id), correlation);
  perform finance.complete_financial_command(actor, 'LINK_PAYMENT_TO_CASH_SESSION', operation_key, 'CASH_SESSION_PAYMENT', created);
  return query select created, 'LINKED';
end;
$$;

create function finance.register_cash_movement(
  target_session_id uuid,
  requested_type finance.cash_movement_type,
  requested_amount numeric,
  requested_reason_code finance.cash_movement_reason_code,
  requested_note text,
  requested_effective_at timestamptz,
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
  session_row finance.cash_sessions%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.movements.create');
  perform finance.require_active_cashier_assignment(actor, null, target_session_id);
  if requested_amount <= 0 then
    raise exception 'CASH_MOVEMENT_INVALID';
  end if;
  if requested_type not in ('CASH_IN', 'CASH_OUT', 'CASH_WITHDRAWAL', 'CASH_TRANSFER') then
    raise exception 'CASH_MOVEMENT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'CREATE_CASH_MOVEMENT', operation_key, jsonb_build_object(
    'session', target_session_id,
    'type', requested_type,
    'amount', requested_amount,
    'reason', requested_reason_code,
    'note', requested_note,
    'effectiveAt', requested_effective_at
  ));
  if prior is not null then
    return query select prior, (select movements.status::text from finance.cash_movements movements where movements.id = prior);
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'OPEN' then
    raise exception 'CASH_SESSION_NOT_OPEN';
  end if;

  insert into finance.cash_movements(
    cash_session_id,
    movement_type,
    amount,
    reason_code,
    note,
    created_by_account_id,
    status,
    effective_at,
    idempotency_key,
    request_fingerprint
  ) values (
    target_session_id,
    requested_type,
    requested_amount,
    requested_reason_code,
    requested_note,
    actor,
    'ACTIVE',
    coalesce(requested_effective_at, statement_timestamp()),
    operation_key,
    finance.financial_fingerprint(jsonb_build_object(
      'session', target_session_id,
      'type', requested_type,
      'amount', requested_amount,
      'reason', requested_reason_code,
      'note', requested_note,
      'effectiveAt', requested_effective_at
    ))
  ) returning id into created;

  perform finance.append_financial_event('CASH_MOVEMENT_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashMovementId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CASH_MOVEMENT', operation_key, 'CASH_MOVEMENT', created);
  return query select created, 'ACTIVE';
end;
$$;

create function finance.reverse_cash_movement(
  target_movement_id uuid,
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
  movement_row finance.cash_movements%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.movements.reverse');
  prior := finance.begin_financial_command(actor, 'REVERSE_CASH_MOVEMENT', operation_key, jsonb_build_object('movement', target_movement_id));
  if prior is not null then
    return query select prior, (select movements.status::text from finance.cash_movements movements where movements.id = prior);
    return;
  end if;

  select * into movement_row from finance.cash_movements where id = target_movement_id for update;
  if movement_row.id is null or movement_row.status <> 'ACTIVE' or movement_row.movement_type = 'REVERSAL' then
    raise exception 'CASH_MOVEMENT_INVALID';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.cash_movements
  set status = 'REVERSED'
  where id = target_movement_id;

  insert into finance.cash_movements(
    cash_session_id,
    movement_type,
    amount,
    reason_code,
    note,
    created_by_account_id,
    reversed_by_movement_id,
    status,
    effective_at,
    idempotency_key,
    request_fingerprint
  ) values (
    movement_row.cash_session_id,
    'REVERSAL',
    movement_row.amount,
    'CORRECTION',
    concat('Reverso de movimiento ', target_movement_id::text),
    actor,
    target_movement_id,
    'ACTIVE',
    statement_timestamp(),
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('movement', target_movement_id, 'reversal', true))
  ) returning id into created;

  update finance.cash_movements
  set reversed_by_movement_id = created
  where id = target_movement_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CASH_MOVEMENT_REVERSED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashMovementId', target_movement_id, 'reversalMovementId', created), correlation);
  perform finance.complete_financial_command(actor, 'REVERSE_CASH_MOVEMENT', operation_key, 'CASH_MOVEMENT', created);
  return query select created, 'ACTIVE';
end;
$$;

create function finance.begin_cash_session_close(
  target_session_id uuid,
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
  session_row finance.cash_sessions%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.sessions.close');
  perform finance.require_active_cashier_assignment(actor, null, target_session_id);
  prior := finance.begin_financial_command(actor, 'BEGIN_CASH_SESSION_CLOSE', operation_key, jsonb_build_object('session', target_session_id));
  if prior is not null then
    return query select prior, (select sessions.status::text from finance.cash_sessions sessions where sessions.id = prior);
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'OPEN' then
    raise exception 'CASH_SESSION_INVALID_STATE';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.cash_sessions
  set status = 'CLOSING',
      updated_at = statement_timestamp()
  where id = target_session_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CASH_SESSION_CLOSING_STARTED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id), correlation);
  perform finance.complete_financial_command(actor, 'BEGIN_CASH_SESSION_CLOSE', operation_key, 'CASH_SESSION', target_session_id);
  return query select target_session_id, 'CLOSING';
end;
$$;

create function finance.record_cash_count(
  target_session_id uuid,
  requested_counted_amount numeric,
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
  session_row finance.cash_sessions%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.counts.create');
  perform finance.require_active_cashier_assignment(actor, null, target_session_id);
  if requested_counted_amount < 0 then
    raise exception 'CASH_MOVEMENT_INVALID';
  end if;
  prior := finance.begin_financial_command(actor, 'RECORD_CASH_COUNT', operation_key, jsonb_build_object('session', target_session_id, 'countedAmount', requested_counted_amount));
  if prior is not null then
    return query select prior, 'RECORDED';
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'CLOSING' then
    raise exception 'CASH_SESSION_INVALID_STATE';
  end if;

  insert into finance.cash_counts(
    cash_session_id,
    counted_amount,
    counted_by_account_id,
    idempotency_key,
    request_fingerprint
  ) values (
    target_session_id,
    requested_counted_amount,
    actor,
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('session', target_session_id, 'countedAmount', requested_counted_amount))
  ) returning id into created;

  perform finance.append_financial_event('CASH_COUNT_RECORDED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id, 'cashCountId', created), correlation);
  perform finance.complete_financial_command(actor, 'RECORD_CASH_COUNT', operation_key, 'CASH_COUNT', created);
  return query select created, 'RECORDED';
end;
$$;

create function finance.close_cash_session(
  target_session_id uuid,
  requested_difference_reason_code finance.cash_difference_reason_code default null,
  requested_difference_note text default null,
  operation_key text default null,
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
  session_row finance.cash_sessions%rowtype;
  count_row finance.cash_counts%rowtype;
  reconciliation_id uuid;
  expected_amount numeric(12,2);
  calculated_difference_amount numeric(12,2);
  reconciliation_status finance.cash_reconciliation_status;
  session_status finance.cash_session_status;
begin
  actor := finance.require_cash_permission('finance.cash.sessions.close');
  perform finance.require_active_cashier_assignment(actor, null, target_session_id);
  prior := finance.begin_financial_command(actor, 'CLOSE_CASH_SESSION', operation_key, jsonb_build_object('session', target_session_id, 'reasonCode', requested_difference_reason_code, 'note', requested_difference_note));
  if prior is not null then
    return query select prior, (select sessions.status::text from finance.cash_sessions sessions where sessions.id = target_session_id);
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'CLOSING' then
    raise exception 'CASH_SESSION_INVALID_STATE';
  end if;

  select * into count_row from finance.cash_counts where cash_session_id = target_session_id for update;
  if count_row.id is null then
    raise exception 'CASH_COUNT_REQUIRED';
  end if;

  expected_amount := finance.calculate_expected_cash(target_session_id);
  calculated_difference_amount := round(count_row.counted_amount - expected_amount, 2);
  if calculated_difference_amount = 0 then
    reconciliation_status := 'BALANCED';
    session_status := 'CLOSED';
  else
    reconciliation_status := 'REVIEW_REQUIRED';
    session_status := 'RECONCILIATION_REQUIRED';
  end if;

  insert into finance.cash_reconciliations(
    cash_session_id,
    expected_amount,
    counted_amount,
    difference_amount,
    status,
    reason_code
  ) values (
    target_session_id,
    expected_amount,
    count_row.counted_amount,
    calculated_difference_amount,
    reconciliation_status,
    requested_difference_reason_code
  ) returning id into reconciliation_id;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.cash_sessions
  set status = session_status,
      expected_cash_amount = expected_amount,
      counted_cash_amount = count_row.counted_amount,
      difference_amount = calculated_difference_amount,
      difference_reason_code = requested_difference_reason_code,
      difference_note = requested_difference_note,
      closed_at = case when session_status = 'CLOSED' then statement_timestamp() else null end,
      closed_by_account_id = case when session_status = 'CLOSED' then actor else null end,
      updated_at = statement_timestamp()
  where id = target_session_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CASH_RECONCILIATION_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id, 'cashReconciliationId', reconciliation_id), correlation);

  if calculated_difference_amount = 0 then
    perform finance.append_financial_event('CASH_SESSION_CLOSED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id), correlation);
  else
    perform finance.append_financial_event('CASH_DIFFERENCE_DETECTED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id, 'differenceAmount', calculated_difference_amount), correlation);
  end if;

  perform finance.complete_financial_command(actor, 'CLOSE_CASH_SESSION', operation_key, 'CASH_RECONCILIATION', reconciliation_id);
  return query select reconciliation_id, session_status::text;
end;
$$;

create function finance.approve_cash_difference(
  target_session_id uuid,
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
  session_row finance.cash_sessions%rowtype;
  reconciliation_row finance.cash_reconciliations%rowtype;
begin
  actor := finance.require_cash_permission('finance.cash.reconciliation.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_CASH_DIFFERENCE', operation_key, jsonb_build_object('session', target_session_id));
  if prior is not null then
    return query select prior, 'APPROVED';
    return;
  end if;

  select * into session_row from finance.cash_sessions where id = target_session_id for update;
  if session_row.id is null then
    raise exception 'CASH_SESSION_NOT_FOUND';
  end if;
  if session_row.status <> 'RECONCILIATION_REQUIRED' then
    raise exception 'CASH_DIFFERENCE_REQUIRES_REVIEW';
  end if;
  if session_row.cashier_account_id = actor then
    raise exception 'CASH_DIFFERENCE_APPROVAL_REQUIRED';
  end if;

  select * into reconciliation_row from finance.cash_reconciliations where cash_session_id = target_session_id for update;
  if reconciliation_row.id is null or reconciliation_row.status <> 'REVIEW_REQUIRED' then
    raise exception 'CASH_RECONCILIATION_REQUIRED';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.cash_reconciliations
  set status = 'APPROVED',
      reviewed_by_account_id = actor,
      reviewed_at = statement_timestamp(),
      approved_by_account_id = actor,
      approved_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = reconciliation_row.id;

  update finance.cash_sessions
  set status = 'CLOSED',
      approved_by_account_id = actor,
      approved_at = statement_timestamp(),
      closed_by_account_id = actor,
      closed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = target_session_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CASH_DIFFERENCE_APPROVED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id, 'cashReconciliationId', reconciliation_row.id), correlation);
  perform finance.append_financial_event('CASH_SESSION_CLOSED', actor, operation_key, null, null, null, null, null, jsonb_build_object('cashSessionId', target_session_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_CASH_DIFFERENCE', operation_key, 'CASH_RECONCILIATION', reconciliation_row.id);
  return query select reconciliation_row.id, 'CLOSED';
end;
$$;

create function finance.register_cashier_payment(
  account_id uuid,
  session_id uuid,
  requested_amount numeric,
  requested_method finance.payment_method,
  requested_reference text,
  requested_paid_at timestamptz,
  register_operation_key text,
  confirm_operation_key text,
  allocate_charge_id uuid,
  allocate_amount numeric,
  allocate_operation_key text,
  link_operation_key text,
  correlation uuid default null
)
returns table(payment_id uuid, receipt_number text, payment_status text, cash_session_payment_id uuid)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  payment_entity uuid;
  payment_row finance.payments%rowtype;
  link_entity uuid;
begin
  if requested_method = 'CASH' then
    actor := finance.require_cash_permission('finance.cash.sessions.read');
    perform finance.require_active_cashier_assignment(actor, null, session_id);
  elsif requested_method = 'OTHER' then
    raise exception 'CASH_OPERATION_NOT_ALLOWED';
  end if;

  select entity_id into payment_entity
  from finance.register_payment(account_id, requested_amount, requested_method, requested_reference, requested_paid_at, register_operation_key, correlation);

  perform finance.confirm_payment(payment_entity, confirm_operation_key, correlation);

  if allocate_charge_id is not null and allocate_amount is not null then
    perform finance.allocate_payment(payment_entity, allocate_charge_id, allocate_amount, allocate_operation_key, correlation);
  end if;

  if session_id is not null then
    select entity_id into link_entity
    from finance.link_payment_to_cash_session(session_id, payment_entity, link_operation_key, correlation);
  else
    link_entity := null;
  end if;

  select * into payment_row from finance.payments where id = payment_entity;
  return query select payment_entity, payment_row.receipt_number, payment_row.status::text, link_entity;
end;
$$;

create function finance.get_cash_registers()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_cash_permission('finance.cash.sessions.read') as actor_id
)
select coalesce(jsonb_agg(jsonb_build_object(
  'cashRegisterId', registers.id,
  'code', registers.code,
  'name', registers.name,
  'status', registers.status,
  'locationLabel', registers.location_label,
  'currencyCode', registers.currency_code,
  'assigned', exists(
    select 1
    from finance.cashier_assignments assignments, actor
    where assignments.cash_register_id = registers.id
      and assignments.account_id = actor.actor_id
      and assignments.status = 'ACTIVE'
      and assignments.valid_from <= statement_timestamp()
      and (assignments.valid_until is null or assignments.valid_until > statement_timestamp())
  )
) order by registers.code), '[]'::jsonb)
from finance.cash_registers registers
$$;

create function finance.get_active_cash_session()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_cash_permission('finance.cash.sessions.read') as actor_id
),
session_row as (
  select sessions.*
  from finance.cash_sessions sessions, actor
  where sessions.cashier_account_id = actor.actor_id
    and sessions.status in ('OPEN', 'CLOSING', 'RECONCILIATION_REQUIRED')
  order by sessions.opened_at desc
  limit 1
)
select case
  when not exists(select 1 from session_row) then null
  else jsonb_build_object(
    'cashSessionId', (select id from session_row),
    'cashRegisterId', (select cash_register_id from session_row),
    'businessDate', (select business_date from session_row),
    'status', (select status from session_row),
    'openingAmount', finance.format_money((select opening_amount from session_row)),
    'expectedCashAmount', case when (select expected_cash_amount from session_row) is null then null else finance.format_money((select expected_cash_amount from session_row)) end,
    'countedCashAmount', case when (select counted_cash_amount from session_row) is null then null else finance.format_money((select counted_cash_amount from session_row)) end,
    'differenceAmount', case when (select difference_amount from session_row) is null then null else finance.format_money((select difference_amount from session_row)) end
  )
end
$$;

create or replace function public.get_cash_registers()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.get_cash_registers() $$;

create or replace function public.get_active_cash_session()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.get_active_cash_session() $$;

create or replace function public.open_cash_session(
  target_register_id uuid,
  requested_business_date date,
  requested_opening_amount numeric,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.open_cash_session(target_register_id, requested_business_date, requested_opening_amount, operation_key, correlation_id) $$;

create or replace function public.begin_cash_session_close(
  target_session_id uuid,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.begin_cash_session_close(target_session_id, operation_key, correlation_id) $$;

create or replace function public.record_cash_count(
  target_session_id uuid,
  requested_counted_amount numeric,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.record_cash_count(target_session_id, requested_counted_amount, operation_key, correlation_id) $$;

create or replace function public.close_cash_session(
  target_session_id uuid,
  requested_difference_reason_code finance.cash_difference_reason_code default null,
  requested_difference_note text default null,
  operation_key text default null,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.close_cash_session(target_session_id, requested_difference_reason_code, requested_difference_note, operation_key, correlation_id) $$;

create or replace function public.approve_cash_difference(
  target_session_id uuid,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.approve_cash_difference(target_session_id, operation_key, correlation_id) $$;

create or replace function public.register_cash_movement(
  target_session_id uuid,
  requested_type finance.cash_movement_type,
  requested_amount numeric,
  requested_reason_code finance.cash_movement_reason_code,
  requested_note text,
  requested_effective_at timestamptz,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.register_cash_movement(target_session_id, requested_type, requested_amount, requested_reason_code, requested_note, requested_effective_at, operation_key, correlation_id) $$;

create or replace function public.register_cashier_payment(
  account_id uuid,
  session_id uuid,
  requested_amount numeric,
  requested_method finance.payment_method,
  requested_reference text,
  requested_paid_at timestamptz,
  register_operation_key text,
  confirm_operation_key text,
  allocate_charge_id uuid,
  allocate_amount numeric,
  allocate_operation_key text,
  link_operation_key text,
  correlation_id uuid default null
)
returns table(payment_id uuid, receipt_number text, payment_status text, cash_session_payment_id uuid)
language sql
security definer
set search_path=''
as $$ select * from finance.register_cashier_payment(account_id, session_id, requested_amount, requested_method, requested_reference, requested_paid_at, register_operation_key, confirm_operation_key, allocate_charge_id, allocate_amount, allocate_operation_key, link_operation_key, correlation_id) $$;

create trigger cash_registers_updated_at
before update on finance.cash_registers
for each row execute function finance.touch_updated_at();

create trigger cash_sessions_updated_at
before update on finance.cash_sessions
for each row execute function finance.touch_updated_at();

create trigger cash_movements_updated_at
before update on finance.cash_movements
for each row execute function finance.touch_updated_at();

create trigger cash_counts_updated_at
before update on finance.cash_counts
for each row execute function finance.touch_updated_at();

create trigger cash_reconciliations_updated_at
before update on finance.cash_reconciliations
for each row execute function finance.touch_updated_at();

create trigger cash_sessions_guard
before update or delete on finance.cash_sessions
for each row execute function finance.guard_cash_mutation();

create trigger cash_session_payments_guard
before update or delete on finance.cash_session_payments
for each row execute function finance.guard_cash_append_only();

create trigger cash_movements_guard
before update or delete on finance.cash_movements
for each row execute function finance.guard_cash_mutation();

create trigger cash_counts_guard
before update or delete on finance.cash_counts
for each row execute function finance.guard_cash_append_only();

create trigger cash_reconciliations_guard
before update or delete on finance.cash_reconciliations
for each row execute function finance.guard_cash_mutation();

alter table finance.cash_registers owner to postgres;
alter table finance.cashier_assignments owner to postgres;
alter table finance.cash_sessions owner to postgres;
alter table finance.cash_session_payments owner to postgres;
alter table finance.cash_movements owner to postgres;
alter table finance.cash_counts owner to postgres;
alter table finance.cash_reconciliations owner to postgres;

revoke all on function finance.require_cash_permission(text) from public, anon, authenticated;
revoke all on function finance.require_active_cashier_assignment(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function finance.calculate_expected_cash(uuid) from public, anon, authenticated;
revoke all on function finance.create_cash_register(text, text, text, finance.cash_register_status, text, uuid) from public, anon, authenticated;
revoke all on function finance.assign_cashier_to_register(uuid, uuid, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function finance.open_cash_session(uuid, date, numeric, text, uuid) from public, anon, authenticated;
revoke all on function finance.link_payment_to_cash_session(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.register_cash_movement(uuid, finance.cash_movement_type, numeric, finance.cash_movement_reason_code, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function finance.reverse_cash_movement(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.begin_cash_session_close(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.record_cash_count(uuid, numeric, text, uuid) from public, anon, authenticated;
revoke all on function finance.close_cash_session(uuid, finance.cash_difference_reason_code, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_cash_difference(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.register_cashier_payment(uuid, uuid, numeric, finance.payment_method, text, timestamptz, text, text, uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.get_cash_registers() from public, anon, authenticated;
revoke all on function finance.get_active_cash_session() from public, anon, authenticated;

grant execute on function public.get_cash_registers() to authenticated;
grant execute on function public.get_active_cash_session() to authenticated;
grant execute on function public.open_cash_session(uuid, date, numeric, text, uuid) to authenticated;
grant execute on function public.begin_cash_session_close(uuid, text, uuid) to authenticated;
grant execute on function public.record_cash_count(uuid, numeric, text, uuid) to authenticated;
grant execute on function public.close_cash_session(uuid, finance.cash_difference_reason_code, text, text, uuid) to authenticated;
grant execute on function public.approve_cash_difference(uuid, text, uuid) to authenticated;
grant execute on function public.register_cash_movement(uuid, finance.cash_movement_type, numeric, finance.cash_movement_reason_code, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.register_cashier_payment(uuid, uuid, numeric, finance.payment_method, text, timestamptz, text, text, uuid, numeric, text, text, uuid) to authenticated;

alter table finance.cash_registers enable row level security;
alter table finance.cashier_assignments enable row level security;
alter table finance.cash_sessions enable row level security;
alter table finance.cash_session_payments enable row level security;
alter table finance.cash_movements enable row level security;
alter table finance.cash_counts enable row level security;
alter table finance.cash_reconciliations enable row level security;
