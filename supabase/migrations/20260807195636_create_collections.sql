begin;

create type finance.collection_case_status as enum (
  'OPEN',
  'IN_FOLLOW_UP',
  'PROMISE_PENDING',
  'REVIEW_REQUIRED',
  'RESOLVED',
  'CLOSED'
);

create type finance.collection_case_priority as enum (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

create type finance.collection_open_reason_code as enum (
  'OVERDUE_BALANCE',
  'MANUAL_REVIEW',
  'OTHER_MANUAL_REVIEW'
);

create type finance.collection_close_reason_code as enum (
  'BALANCE_SETTLED',
  'DUPLICATE_CASE',
  'OPENED_IN_ERROR',
  'OTHER_MANUAL_REVIEW'
);

create type finance.collection_action_type as enum (
  'ACCOUNT_REVIEW',
  'IN_PERSON_CONTACT',
  'PHONE_CONTACT',
  'EMAIL_CONTACT',
  'NOTICE_DELIVERED',
  'PAYMENT_COMMITMENT_CREATED',
  'PAYMENT_COMMITMENT_UPDATED',
  'PAYMENT_COMMITMENT_BROKEN',
  'PAYMENT_RECEIVED',
  'CASE_REVIEWED',
  'OTHER_MANUAL_REVIEW'
);

create type finance.collection_action_status as enum (
  'RECORDED',
  'COMPLETED',
  'CANCELLED'
);

create type finance.collection_contact_channel as enum (
  'PHONE',
  'EMAIL',
  'IN_PERSON',
  'OTHER',
  'NONE'
);

create type finance.payment_commitment_status as enum (
  'PENDING',
  'FULFILLED',
  'BROKEN',
  'CANCELLED'
);

do $$
begin
  alter type finance.financial_command_type add value if not exists 'OPEN_COLLECTION_CASE';
  alter type finance.financial_command_type add value if not exists 'ADD_COLLECTION_ACTION';
  alter type finance.financial_command_type add value if not exists 'CREATE_PAYMENT_COMMITMENT';
  alter type finance.financial_command_type add value if not exists 'FULFILL_PAYMENT_COMMITMENT';
  alter type finance.financial_command_type add value if not exists 'BREAK_PAYMENT_COMMITMENT';
  alter type finance.financial_command_type add value if not exists 'CANCEL_PAYMENT_COMMITMENT';
  alter type finance.financial_command_type add value if not exists 'RESOLVE_COLLECTION_CASE';
  alter type finance.financial_command_type add value if not exists 'CLOSE_COLLECTION_CASE';
end;
$$;

do $$
begin
  alter type finance.financial_event_type add value if not exists 'COLLECTION_CASE_OPENED';
  alter type finance.financial_event_type add value if not exists 'COLLECTION_CASE_ASSIGNED';
  alter type finance.financial_event_type add value if not exists 'COLLECTION_ACTION_CREATED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_COMMITMENT_CREATED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_COMMITMENT_UPDATED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_COMMITMENT_FULFILLED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_COMMITMENT_BROKEN';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_COMMITMENT_CANCELLED';
  alter type finance.financial_event_type add value if not exists 'COLLECTION_CASE_RESOLVED';
  alter type finance.financial_event_type add value if not exists 'COLLECTION_CASE_CLOSED';
  alter type finance.financial_event_type add value if not exists 'COLLECTION_OPERATION_DENIED';
end;
$$;

create table finance.collection_cases (
  id uuid primary key default gen_random_uuid(),
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  status finance.collection_case_status not null,
  priority finance.collection_case_priority not null default 'NORMAL',
  opened_reason_code finance.collection_open_reason_code not null,
  opened_by_account_id uuid not null references core.accounts(id) on delete restrict,
  assigned_to_account_id uuid references core.accounts(id) on delete restrict,
  opened_at timestamptz not null default statement_timestamp(),
  last_action_at timestamptz,
  next_action_at timestamptz,
  closed_at timestamptz,
  closed_by_account_id uuid references core.accounts(id) on delete restrict,
  close_reason_code finance.collection_close_reason_code,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (
      status <> 'CLOSED'
      and closed_at is null
      and closed_by_account_id is null
      and close_reason_code is null
    )
    or (
      status = 'CLOSED'
      and closed_at is not null
      and closed_by_account_id is not null
      and close_reason_code is not null
    )
  )
);

create unique index collection_cases_one_active_case_per_account
  on finance.collection_cases(student_account_id)
  where status in ('OPEN', 'IN_FOLLOW_UP', 'PROMISE_PENDING', 'REVIEW_REQUIRED', 'RESOLVED');

create table finance.collection_actions (
  id uuid primary key default gen_random_uuid(),
  collection_case_id uuid not null references finance.collection_cases(id) on delete restrict,
  action_type finance.collection_action_type not null,
  action_status finance.collection_action_status not null default 'RECORDED',
  contact_channel finance.collection_contact_channel not null default 'NONE',
  occurred_at timestamptz not null,
  performed_by_account_id uuid not null references core.accounts(id) on delete restrict,
  summary text not null,
  next_action_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (char_length(btrim(summary)) between 1 and 500)
);

create table finance.payment_commitments (
  id uuid primary key default gen_random_uuid(),
  collection_case_id uuid not null references finance.collection_cases(id) on delete restrict,
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  status finance.payment_commitment_status not null,
  promised_amount numeric(12,2) not null,
  promised_date date not null,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  notes text,
  updated_at timestamptz not null default statement_timestamp(),
  check (promised_amount > 0),
  check (notes is null or char_length(btrim(notes)) between 1 and 500),
  check (
    (
      status = 'FULFILLED'
      and fulfilled_at is not null
      and cancelled_at is null
    )
    or (
      status = 'CANCELLED'
      and cancelled_at is not null
      and fulfilled_at is null
    )
    or (
      status in ('PENDING', 'BROKEN')
      and fulfilled_at is null
    )
  )
);

create unique index payment_commitments_one_pending_per_case
  on finance.payment_commitments(collection_case_id)
  where status = 'PENDING';

create function finance.collection_case_is_active(target_status finance.collection_case_status)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $$
  select target_status in ('OPEN', 'IN_FOLLOW_UP', 'PROMISE_PENDING', 'REVIEW_REQUIRED', 'RESOLVED')
$$;

create function finance.derive_collection_aging_bucket(
  charge_due_date date,
  charge_balance numeric,
  charge_status finance.student_charge_status,
  business_date date default current_date
)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select case
    when charge_status not in ('POSTED', 'PARTIALLY_PAID') or charge_balance <= 0 then 'SETTLED'
    when charge_due_date is null then 'NO_DUE_DATE'
    when charge_due_date >= business_date then 'CURRENT'
    when (business_date - charge_due_date) between 1 and 30 then '1_30_DAYS'
    when (business_date - charge_due_date) between 31 and 60 then '31_60_DAYS'
    when (business_date - charge_due_date) between 61 and 90 then '61_90_DAYS'
    else '91_PLUS_DAYS'
  end
$$;

create function finance.require_collection_permission(permission_code text)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor core.accounts%rowtype;
  identity_context record;
  role_codes text[];
  allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  select * into identity_context
  from core.get_current_identity_context()
  where session_valid
    and mfa_satisfied
    and 'SISTEMA_ADMINISTRATIVO' = any(allowed_applications);

  if identity_context.auth_user_id is null then
    raise exception using errcode='42501', message='APPLICATION_NOT_ALLOWED';
  end if;

  if not core.is_current_session_version_valid() then
    raise exception using errcode='42501', message='SESSION_VERSION_INVALID';
  end if;

  if not core.is_current_aal2() then
    raise exception using errcode='42501', message='AAL2_REQUIRED';
  end if;

  select * into actor from core.accounts where auth_user_id = auth.uid();
  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  select coalesce(array_agg(roles.code order by roles.code), array[]::text[])
    into role_codes
  from core.account_roles assignments
  join core.roles roles on roles.id = assignments.role_id
  where assignments.account_id = actor.id
    and assignments.revoked_at is null
    and roles.is_active;

  if role_codes && array['SUPERADMIN']::text[] then
    allowed := permission_code like 'finance.collections.%';
  elsif role_codes && array['ADMINISTRATIVO']::text[] then
    allowed := permission_code in (
      'finance.collections.cases.open',
      'finance.collections.cases.read',
      'finance.collections.cases.manage',
      'finance.collections.actions.create',
      'finance.collections.commitments.create',
      'finance.collections.commitments.manage',
      'finance.collections.reports.read'
    );
  elsif role_codes && array['CONTROL_ESCOLAR']::text[] then
    allowed := permission_code in (
      'finance.collections.cases.read',
      'finance.collections.reports.read'
    );
  end if;

  if not allowed then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  return actor.id;
end;
$$;

create function finance.guard_collection_action_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;
  return new;
end;
$$;

create function finance.guard_collection_case_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;

  if old.status = 'CLOSED' and (
    new.student_account_id,
    new.opened_reason_code,
    new.opened_by_account_id,
    new.opened_at,
    new.created_at
  ) is distinct from (
    old.student_account_id,
    old.opened_reason_code,
    old.opened_by_account_id,
    old.opened_at,
    old.created_at
  ) then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;

  return new;
end;
$$;

create function finance.guard_payment_commitment_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;

  if old.status in ('FULFILLED', 'BROKEN', 'CANCELLED') and (
    new.collection_case_id,
    new.student_account_id,
    new.promised_amount,
    new.promised_date,
    new.created_by_account_id,
    new.created_at
  ) is distinct from (
    old.collection_case_id,
    old.student_account_id,
    old.promised_amount,
    old.promised_date,
    old.created_by_account_id,
    old.created_at
  ) then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;

  return new;
end;
$$;

create function finance.touch_collection_updated_at()
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

create function finance.get_student_debt_position(
  requested_student_account_id uuid,
  business_date date default current_date
)
returns table(
  student_account_id uuid,
  total_outstanding numeric(12,2),
  total_overdue numeric(12,2),
  total_not_due numeric(12,2),
  oldest_overdue_date date,
  days_past_due integer,
  charge_count integer,
  overdue_charge_count integer,
  charge_id uuid,
  charge_description text,
  charge_status finance.student_charge_status,
  due_date date,
  original_amount numeric(12,2),
  outstanding_amount numeric(12,2),
  debt_status text,
  aging_bucket text
)
language sql
stable
security definer
set search_path=''
as $$
with debt_rows as (
  select
    charges.student_account_id,
    charges.id as charge_id,
    charges.description as charge_description,
    charges.status as charge_status,
    charges.due_date,
    charges.original_amount,
    finance.get_charge_balance(charges.id)::numeric(12,2) as outstanding_amount,
    case
      when charges.status not in ('POSTED', 'PARTIALLY_PAID') or finance.get_charge_balance(charges.id) <= 0 then 'SETTLED'
      when charges.due_date is null then 'NO_DUE_DATE'
      when charges.due_date = business_date then 'DUE_TODAY'
      when charges.due_date < business_date then 'OVERDUE'
      else 'NOT_DUE'
    end as debt_status,
    finance.derive_collection_aging_bucket(
      charges.due_date,
      finance.get_charge_balance(charges.id),
      charges.status,
      business_date
    ) as aging_bucket
  from finance.student_charges charges
  where charges.student_account_id = requested_student_account_id
    and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'REVERSED')
),
summary as (
  select
    coalesce(sum(outstanding_amount), 0)::numeric(12,2) as total_outstanding,
    coalesce(sum(outstanding_amount) filter (where debt_status = 'OVERDUE'), 0)::numeric(12,2) as total_overdue,
    coalesce(sum(outstanding_amount) filter (where debt_status in ('NOT_DUE', 'DUE_TODAY')), 0)::numeric(12,2) as total_not_due,
    min(due_date) filter (where debt_status = 'OVERDUE') as oldest_overdue_date,
    count(*)::integer as charge_count,
    count(*) filter (where debt_status = 'OVERDUE')::integer as overdue_charge_count
  from debt_rows
)
select
  requested_student_account_id,
  summary.total_outstanding,
  summary.total_overdue,
  summary.total_not_due,
  summary.oldest_overdue_date,
  case
    when summary.oldest_overdue_date is null then 0
    else greatest(0, business_date - summary.oldest_overdue_date)
  end::integer as days_past_due,
  summary.charge_count,
  summary.overdue_charge_count,
  debt_rows.charge_id,
  debt_rows.charge_description,
  debt_rows.charge_status,
  debt_rows.due_date,
  debt_rows.original_amount,
  debt_rows.outstanding_amount,
  debt_rows.debt_status,
  debt_rows.aging_bucket
from summary
left join debt_rows on true
order by debt_rows.due_date nulls last, debt_rows.charge_id;
$$;

create function finance.list_overdue_student_accounts(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_aging_bucket text default null,
  requested_collection_case_status finance.collection_case_status default null,
  requested_search_text text default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  business_date date default current_date
)
returns table(
  student_account_id uuid,
  institutional_student_code text,
  display_name text,
  semester_number integer,
  group_name text,
  total_outstanding numeric(12,2),
  total_overdue numeric(12,2),
  oldest_overdue_date date,
  days_past_due integer,
  aging_bucket text,
  collection_case_status finance.collection_case_status
)
language sql
stable
security definer
set search_path=''
as $$
with account_scope as (
  select
    accounts.id as student_account_id,
    records.institutional_student_code,
    null::text as display_name,
    enrollments.semester_number::integer as semester_number,
    groups.display_name as group_name,
    debt.total_outstanding,
    debt.total_overdue,
    debt.oldest_overdue_date,
    debt.days_past_due,
    case
      when debt.total_overdue <= 0 then 'CURRENT'
      when debt.days_past_due between 1 and 30 then '1_30_DAYS'
      when debt.days_past_due between 31 and 60 then '31_60_DAYS'
      when debt.days_past_due between 61 and 90 then '61_90_DAYS'
      else '91_PLUS_DAYS'
    end as aging_bucket,
    current_case.status as collection_case_status
  from finance.student_accounts accounts
  join academic.student_records records on records.id = accounts.student_record_id
  left join lateral (
    select *
    from academic.period_enrollments pe
    where pe.student_record_id = records.id
      and (requested_academic_period_id is null or pe.academic_period_id = requested_academic_period_id)
      and pe.status <> 'CANCELLED'
    order by pe.enrolled_at desc nulls last, pe.created_at desc
    limit 1
  ) enrollments on true
  left join academic.groups groups on groups.id = enrollments.group_id
  left join lateral (
    select
      position.total_outstanding,
      position.total_overdue,
      position.oldest_overdue_date,
      position.days_past_due
    from finance.get_student_debt_position(accounts.id, business_date) position
    limit 1
  ) debt on true
  left join lateral (
    select cases.status
    from finance.collection_cases cases
    where cases.student_account_id = accounts.id
      and finance.collection_case_is_active(cases.status)
    order by cases.created_at desc
    limit 1
  ) current_case on true
  where accounts.status = 'ACTIVE'
    and coalesce(debt.total_overdue, 0) > 0
    and (requested_semester_number is null or enrollments.semester_number = requested_semester_number)
    and (requested_group_id is null or enrollments.group_id = requested_group_id)
    and (requested_training_area_id is null or enrollments.training_area_id = requested_training_area_id)
)
select *
from account_scope
where (requested_aging_bucket is null or aging_bucket = requested_aging_bucket)
  and (requested_collection_case_status is null or collection_case_status = requested_collection_case_status)
  and (
    requested_search_text is null
    or lower(institutional_student_code) like '%' || lower(requested_search_text) || '%'
  )
order by total_overdue desc, oldest_overdue_date asc nulls last, institutional_student_code
limit greatest(1, least(requested_limit, 100))
offset greatest(requested_offset, 0);
$$;

create function finance.open_collection_case(
  requested_student_account_id uuid,
  requested_opened_reason_code finance.collection_open_reason_code,
  requested_priority finance.collection_case_priority default 'NORMAL',
  requested_assigned_to_account_id uuid default null,
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
  account_row finance.student_accounts%rowtype;
  debt_row record;
  created uuid;
begin
  actor := finance.require_collection_permission('finance.collections.cases.open');
  if operation_key is null or btrim(operation_key) = '' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  prior := finance.begin_financial_command(
    actor,
    'OPEN_COLLECTION_CASE',
    operation_key,
    jsonb_build_object(
      'studentAccountId', requested_student_account_id,
      'reason', requested_opened_reason_code,
      'priority', requested_priority,
      'assignedTo', requested_assigned_to_account_id
    )
  );
  if prior is not null then
    return query select prior, (select cases.status::text from finance.collection_cases cases where cases.id = prior);
    return;
  end if;

  select * into account_row from finance.student_accounts where id = requested_student_account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;

  select *
    into debt_row
  from finance.get_student_debt_position(requested_student_account_id, current_date)
  limit 1;
  if coalesce(debt_row.total_overdue, 0) <= 0 then
    raise exception 'COLLECTION_CASE_REQUIRES_OVERDUE_BALANCE';
  end if;

  insert into finance.collection_cases(
    student_account_id,
    status,
    priority,
    opened_reason_code,
    opened_by_account_id,
    assigned_to_account_id
  ) values (
    requested_student_account_id,
    'OPEN',
    requested_priority,
    requested_opened_reason_code,
    actor,
    requested_assigned_to_account_id
  ) returning id into created;

  perform finance.append_financial_event(
    'COLLECTION_CASE_OPENED',
    actor,
    operation_key,
    requested_student_account_id,
    null,
    null,
    null,
    null,
    jsonb_build_object('collectionCaseId', created),
    correlation
  );
  if requested_assigned_to_account_id is not null then
    perform finance.append_financial_event(
      'COLLECTION_CASE_ASSIGNED',
      actor,
      operation_key || ':assign',
      requested_student_account_id,
      null,
      null,
      null,
      null,
      jsonb_build_object('collectionCaseId', created, 'assignedToAccountId', requested_assigned_to_account_id),
      correlation
    );
  end if;
  perform finance.complete_financial_command(actor, 'OPEN_COLLECTION_CASE', operation_key, 'COLLECTION_CASE', created);
  return query select created, 'OPEN';
exception
  when unique_violation then
    raise exception 'CONCURRENT_MODIFICATION';
end;
$$;

create function finance.add_collection_action(
  requested_collection_case_id uuid,
  requested_action_type finance.collection_action_type,
  requested_action_status finance.collection_action_status,
  requested_contact_channel finance.collection_contact_channel,
  requested_occurred_at timestamptz,
  requested_summary text,
  requested_next_action_at timestamptz default null,
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
  case_row finance.collection_cases%rowtype;
  created uuid;
  next_case_status finance.collection_case_status;
begin
  actor := finance.require_collection_permission('finance.collections.actions.create');
  if operation_key is null or btrim(operation_key) = '' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if char_length(btrim(coalesce(requested_summary, ''))) not between 1 and 500 then
    raise exception 'COLLECTION_ACTION_SUMMARY_INVALID';
  end if;
  prior := finance.begin_financial_command(
    actor,
    'ADD_COLLECTION_ACTION',
    operation_key,
    jsonb_build_object(
      'collectionCaseId', requested_collection_case_id,
      'actionType', requested_action_type,
      'occurredAt', requested_occurred_at,
      'summary', requested_summary,
      'nextActionAt', requested_next_action_at
    )
  );
  if prior is not null then
    return query select prior, (select actions.action_status::text from finance.collection_actions actions where actions.id = prior);
    return;
  end if;

  select * into case_row from finance.collection_cases where id = requested_collection_case_id for update;
  if case_row.id is null or not finance.collection_case_is_active(case_row.status) then
    raise exception 'COLLECTION_CASE_INVALID_STATE';
  end if;

  insert into finance.collection_actions(
    collection_case_id,
    action_type,
    action_status,
    contact_channel,
    occurred_at,
    performed_by_account_id,
    summary,
    next_action_at
  ) values (
    requested_collection_case_id,
    requested_action_type,
    requested_action_status,
    requested_contact_channel,
    requested_occurred_at,
    actor,
    btrim(requested_summary),
    requested_next_action_at
  ) returning id into created;

  next_case_status := case
    when requested_action_type = 'PAYMENT_COMMITMENT_BROKEN' then 'REVIEW_REQUIRED'
    when case_row.status = 'OPEN' then 'IN_FOLLOW_UP'
    else case_row.status
  end;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.collection_cases
  set last_action_at = requested_occurred_at,
      next_action_at = requested_next_action_at,
      status = next_case_status,
      updated_at = statement_timestamp()
  where id = requested_collection_case_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event(
    'COLLECTION_ACTION_CREATED',
    actor,
    operation_key,
    case_row.student_account_id,
    null,
    null,
    null,
    null,
    jsonb_build_object('collectionCaseId', requested_collection_case_id, 'collectionActionId', created, 'actionType', requested_action_type),
    correlation
  );
  perform finance.complete_financial_command(actor, 'ADD_COLLECTION_ACTION', operation_key, 'COLLECTION_ACTION', created);
  return query select created, requested_action_status::text;
end;
$$;

create function finance.create_payment_commitment(
  requested_collection_case_id uuid,
  requested_student_account_id uuid,
  requested_promised_amount numeric,
  requested_promised_date date,
  requested_notes text default null,
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
  case_row finance.collection_cases%rowtype;
  created uuid;
begin
  actor := finance.require_collection_permission('finance.collections.commitments.create');
  if operation_key is null or btrim(operation_key) = '' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if requested_promised_amount <= 0 then
    raise exception 'PAYMENT_AMOUNT_INVALID';
  end if;
  if requested_promised_date is null then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;
  if requested_notes is not null and char_length(btrim(requested_notes)) not between 1 and 500 then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;
  prior := finance.begin_financial_command(
    actor,
    'CREATE_PAYMENT_COMMITMENT',
    operation_key,
    jsonb_build_object(
      'collectionCaseId', requested_collection_case_id,
      'studentAccountId', requested_student_account_id,
      'promisedAmount', requested_promised_amount,
      'promisedDate', requested_promised_date,
      'notes', requested_notes
    )
  );
  if prior is not null then
    return query select prior, (select commitments.status::text from finance.payment_commitments commitments where commitments.id = prior);
    return;
  end if;

  select * into case_row from finance.collection_cases where id = requested_collection_case_id for update;
  if case_row.id is null or not finance.collection_case_is_active(case_row.status) then
    raise exception 'COLLECTION_CASE_INVALID_STATE';
  end if;
  if case_row.student_account_id <> requested_student_account_id then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;

  insert into finance.payment_commitments(
    collection_case_id,
    student_account_id,
    status,
    promised_amount,
    promised_date,
    created_by_account_id,
    notes
  ) values (
    requested_collection_case_id,
    requested_student_account_id,
    'PENDING',
    requested_promised_amount,
    requested_promised_date,
    actor,
    case when requested_notes is null then null else btrim(requested_notes) end
  ) returning id into created;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.collection_cases
  set status = 'PROMISE_PENDING',
      updated_at = statement_timestamp()
  where id = requested_collection_case_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event(
    'PAYMENT_COMMITMENT_CREATED',
    actor,
    operation_key,
    requested_student_account_id,
    null,
    null,
    null,
    null,
    jsonb_build_object('collectionCaseId', requested_collection_case_id, 'paymentCommitmentId', created, 'promisedDate', requested_promised_date),
    correlation
  );
  perform finance.complete_financial_command(actor, 'CREATE_PAYMENT_COMMITMENT', operation_key, 'PAYMENT_COMMITMENT', created);
  return query select created, 'PENDING';
exception
  when unique_violation then
    raise exception 'CONCURRENT_MODIFICATION';
end;
$$;

create function finance.evaluate_payment_commitment(
  requested_commitment_id uuid,
  business_date date default current_date
)
returns table(
  payment_commitment_id uuid,
  promised_amount numeric(12,2),
  promised_date date,
  qualifying_payments_after_created numeric(12,2),
  outstanding_current numeric(12,2),
  is_past_due boolean,
  can_be_marked_fulfilled boolean,
  appears_broken boolean
)
language sql
stable
security definer
set search_path=''
as $$
with commitment as (
  select *
  from finance.payment_commitments
  where id = requested_commitment_id
),
qualifying as (
  select coalesce(sum(
    case
      when allocations.status = 'APPLIED' then allocations.amount
      else allocations.amount * -1
    end
  ), 0)::numeric(12,2) as total
  from commitment
  join finance.payment_allocations allocations on true
  join finance.payments payments on payments.id = allocations.payment_id
  join finance.student_charges charges on charges.id = allocations.student_charge_id
  where payments.student_account_id = commitment.student_account_id
    and charges.student_account_id = commitment.student_account_id
    and allocations.applied_at >= commitment.created_at
),
debt as (
  select total_outstanding
  from commitment
  join lateral finance.get_student_debt_position(commitment.student_account_id, business_date) position on true
  limit 1
)
select
  commitment.id,
  commitment.promised_amount,
  commitment.promised_date,
  qualifying.total,
  coalesce(debt.total_outstanding, 0)::numeric(12,2),
  commitment.promised_date < business_date,
  qualifying.total >= commitment.promised_amount,
  commitment.promised_date < business_date and qualifying.total < commitment.promised_amount
from commitment
left join qualifying on true
left join debt on true
$$;

create function finance.mark_payment_commitment_fulfilled(
  requested_commitment_id uuid,
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
  commitment_row finance.payment_commitments%rowtype;
  evaluation record;
begin
  actor := finance.require_collection_permission('finance.collections.commitments.manage');
  prior := finance.begin_financial_command(actor, 'FULFILL_PAYMENT_COMMITMENT', operation_key, jsonb_build_object('paymentCommitmentId', requested_commitment_id));
  if prior is not null then
    return query select prior, (select commitments.status::text from finance.payment_commitments commitments where commitments.id = prior);
    return;
  end if;

  select * into commitment_row from finance.payment_commitments where id = requested_commitment_id for update;
  if commitment_row.id is null or commitment_row.status <> 'PENDING' then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;

  select * into evaluation from finance.evaluate_payment_commitment(requested_commitment_id, current_date);
  if not coalesce(evaluation.can_be_marked_fulfilled, false) then
    raise exception 'COLLECTION_COMMITMENT_EVIDENCE_REQUIRED';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_commitments
  set status = 'FULFILLED',
      fulfilled_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = requested_commitment_id;
  update finance.collection_cases
  set status = 'IN_FOLLOW_UP',
      updated_at = statement_timestamp()
  where id = commitment_row.collection_case_id
    and finance.collection_cases.status = 'PROMISE_PENDING';
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('PAYMENT_COMMITMENT_FULFILLED', actor, operation_key, commitment_row.student_account_id, null, null, null, null, jsonb_build_object('paymentCommitmentId', requested_commitment_id, 'collectionCaseId', commitment_row.collection_case_id), correlation);
  perform finance.complete_financial_command(actor, 'FULFILL_PAYMENT_COMMITMENT', operation_key, 'PAYMENT_COMMITMENT', requested_commitment_id);
  return query select requested_commitment_id, 'FULFILLED';
end;
$$;

create function finance.mark_payment_commitment_broken(
  requested_commitment_id uuid,
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
  commitment_row finance.payment_commitments%rowtype;
  evaluation record;
begin
  actor := finance.require_collection_permission('finance.collections.commitments.manage');
  prior := finance.begin_financial_command(actor, 'BREAK_PAYMENT_COMMITMENT', operation_key, jsonb_build_object('paymentCommitmentId', requested_commitment_id));
  if prior is not null then
    return query select prior, (select commitments.status::text from finance.payment_commitments commitments where commitments.id = prior);
    return;
  end if;

  select * into commitment_row from finance.payment_commitments where id = requested_commitment_id for update;
  if commitment_row.id is null or commitment_row.status <> 'PENDING' then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;

  select * into evaluation from finance.evaluate_payment_commitment(requested_commitment_id, current_date);
  if not coalesce(evaluation.is_past_due, false) or coalesce(evaluation.can_be_marked_fulfilled, false) then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_commitments
  set status = 'BROKEN',
      updated_at = statement_timestamp()
  where id = requested_commitment_id;
  update finance.collection_cases
  set status = 'REVIEW_REQUIRED',
      updated_at = statement_timestamp()
  where id = commitment_row.collection_case_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('PAYMENT_COMMITMENT_BROKEN', actor, operation_key, commitment_row.student_account_id, null, null, null, null, jsonb_build_object('paymentCommitmentId', requested_commitment_id, 'collectionCaseId', commitment_row.collection_case_id), correlation);
  perform finance.complete_financial_command(actor, 'BREAK_PAYMENT_COMMITMENT', operation_key, 'PAYMENT_COMMITMENT', requested_commitment_id);
  return query select requested_commitment_id, 'BROKEN';
end;
$$;

create function finance.cancel_payment_commitment(
  requested_commitment_id uuid,
  requested_note text,
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
  commitment_row finance.payment_commitments%rowtype;
begin
  actor := finance.require_collection_permission('finance.collections.commitments.manage');
  if char_length(btrim(coalesce(requested_note, ''))) not between 1 and 500 then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;
  prior := finance.begin_financial_command(actor, 'CANCEL_PAYMENT_COMMITMENT', operation_key, jsonb_build_object('paymentCommitmentId', requested_commitment_id, 'note', requested_note));
  if prior is not null then
    return query select prior, (select commitments.status::text from finance.payment_commitments commitments where commitments.id = prior);
    return;
  end if;

  select * into commitment_row from finance.payment_commitments where id = requested_commitment_id for update;
  if commitment_row.id is null or commitment_row.status <> 'PENDING' then
    raise exception 'COLLECTION_COMMITMENT_INVALID_STATE';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_commitments
  set status = 'CANCELLED',
      cancelled_at = statement_timestamp(),
      notes = btrim(requested_note),
      updated_at = statement_timestamp()
  where id = requested_commitment_id;
  update finance.collection_cases
  set status = 'IN_FOLLOW_UP',
      updated_at = statement_timestamp()
  where id = commitment_row.collection_case_id
    and finance.collection_cases.status = 'PROMISE_PENDING';
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('PAYMENT_COMMITMENT_CANCELLED', actor, operation_key, commitment_row.student_account_id, null, null, null, null, jsonb_build_object('paymentCommitmentId', requested_commitment_id, 'collectionCaseId', commitment_row.collection_case_id), correlation);
  perform finance.complete_financial_command(actor, 'CANCEL_PAYMENT_COMMITMENT', operation_key, 'PAYMENT_COMMITMENT', requested_commitment_id);
  return query select requested_commitment_id, 'CANCELLED';
end;
$$;

create function finance.resolve_collection_case(
  requested_collection_case_id uuid,
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
  case_row finance.collection_cases%rowtype;
  debt_row record;
begin
  actor := finance.require_collection_permission('finance.collections.cases.manage');
  prior := finance.begin_financial_command(actor, 'RESOLVE_COLLECTION_CASE', operation_key, jsonb_build_object('collectionCaseId', requested_collection_case_id));
  if prior is not null then
    return query select prior, (select cases.status::text from finance.collection_cases cases where cases.id = prior);
    return;
  end if;

  select * into case_row from finance.collection_cases where id = requested_collection_case_id for update;
  if case_row.id is null or not finance.collection_case_is_active(case_row.status) then
    raise exception 'COLLECTION_CASE_INVALID_STATE';
  end if;

  select * into debt_row from finance.get_student_debt_position(case_row.student_account_id, current_date) limit 1;
  if coalesce(debt_row.total_overdue, 0) > 0 then
    raise exception 'COLLECTION_CASE_REQUIRES_SETTLED_OVERDUE';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.collection_cases
  set status = 'RESOLVED',
      updated_at = statement_timestamp()
  where id = requested_collection_case_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('COLLECTION_CASE_RESOLVED', actor, operation_key, case_row.student_account_id, null, null, null, null, jsonb_build_object('collectionCaseId', requested_collection_case_id), correlation);
  perform finance.complete_financial_command(actor, 'RESOLVE_COLLECTION_CASE', operation_key, 'COLLECTION_CASE', requested_collection_case_id);
  return query select requested_collection_case_id, 'RESOLVED';
end;
$$;

create function finance.close_collection_case(
  requested_collection_case_id uuid,
  requested_close_reason_code finance.collection_close_reason_code,
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
  case_row finance.collection_cases%rowtype;
  debt_row record;
begin
  actor := finance.require_collection_permission('finance.collections.cases.manage');
  prior := finance.begin_financial_command(actor, 'CLOSE_COLLECTION_CASE', operation_key, jsonb_build_object('collectionCaseId', requested_collection_case_id, 'reason', requested_close_reason_code));
  if prior is not null then
    return query select prior, (select cases.status::text from finance.collection_cases cases where cases.id = prior);
    return;
  end if;

  select * into case_row from finance.collection_cases where id = requested_collection_case_id for update;
  if case_row.id is null or case_row.status = 'CLOSED' then
    raise exception 'COLLECTION_CASE_INVALID_STATE';
  end if;

  select * into debt_row from finance.get_student_debt_position(case_row.student_account_id, current_date) limit 1;

  if requested_close_reason_code = 'BALANCE_SETTLED' and coalesce(debt_row.total_overdue, 0) > 0 then
    raise exception 'COLLECTION_CASE_REQUIRES_SETTLED_OVERDUE';
  end if;
  if requested_close_reason_code = 'OTHER_MANUAL_REVIEW' and coalesce(debt_row.total_overdue, 0) > 0 then
    raise exception 'COLLECTION_CASE_CLOSE_DENIED';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.collection_cases
  set status = 'CLOSED',
      closed_at = statement_timestamp(),
      closed_by_account_id = actor,
      close_reason_code = requested_close_reason_code,
      updated_at = statement_timestamp()
  where id = requested_collection_case_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('COLLECTION_CASE_CLOSED', actor, operation_key, case_row.student_account_id, null, null, null, null, jsonb_build_object('collectionCaseId', requested_collection_case_id, 'closeReasonCode', requested_close_reason_code), correlation);
  perform finance.complete_financial_command(actor, 'CLOSE_COLLECTION_CASE', operation_key, 'COLLECTION_CASE', requested_collection_case_id);
  return query select requested_collection_case_id, 'CLOSED';
end;
$$;

create or replace function public.get_student_debt_position(
  student_account_id uuid,
  business_date date default current_date
)
returns table(
  student_account_id uuid,
  total_outstanding numeric(12,2),
  total_overdue numeric(12,2),
  total_not_due numeric(12,2),
  oldest_overdue_date date,
  days_past_due integer,
  charge_count integer,
  overdue_charge_count integer,
  charge_id uuid,
  charge_description text,
  charge_status finance.student_charge_status,
  due_date date,
  original_amount numeric(12,2),
  outstanding_amount numeric(12,2),
  debt_status text,
  aging_bucket text
)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.get_student_debt_position(student_account_id, business_date)
$$;

create or replace function public.list_overdue_student_accounts(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_aging_bucket text default null,
  requested_collection_case_status finance.collection_case_status default null,
  requested_search_text text default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  business_date date default current_date
)
returns table(
  student_account_id uuid,
  institutional_student_code text,
  display_name text,
  semester_number integer,
  group_name text,
  total_outstanding numeric(12,2),
  total_overdue numeric(12,2),
  oldest_overdue_date date,
  days_past_due integer,
  aging_bucket text,
  collection_case_status finance.collection_case_status
)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.list_overdue_student_accounts(
    requested_academic_period_id,
    requested_semester_number,
    requested_group_id,
    requested_training_area_id,
    requested_aging_bucket,
    requested_collection_case_status,
    requested_search_text,
    requested_limit,
    requested_offset,
    business_date
  )
$$;

create or replace function public.open_collection_case(
  requested_student_account_id uuid,
  requested_opened_reason_code finance.collection_open_reason_code,
  requested_priority finance.collection_case_priority default 'NORMAL',
  requested_assigned_to_account_id uuid default null,
  operation_key text default null,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.open_collection_case(
    requested_student_account_id,
    requested_opened_reason_code,
    requested_priority,
    requested_assigned_to_account_id,
    operation_key,
    correlation
  )
$$;

create or replace function public.add_collection_action(
  requested_collection_case_id uuid,
  requested_action_type finance.collection_action_type,
  requested_action_status finance.collection_action_status,
  requested_contact_channel finance.collection_contact_channel,
  requested_occurred_at timestamptz,
  requested_summary text,
  requested_next_action_at timestamptz default null,
  operation_key text default null,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.add_collection_action(
    requested_collection_case_id,
    requested_action_type,
    requested_action_status,
    requested_contact_channel,
    requested_occurred_at,
    requested_summary,
    requested_next_action_at,
    operation_key,
    correlation
  )
$$;

create or replace function public.create_payment_commitment(
  requested_collection_case_id uuid,
  requested_student_account_id uuid,
  requested_promised_amount numeric,
  requested_promised_date date,
  requested_notes text default null,
  operation_key text default null,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.create_payment_commitment(
    requested_collection_case_id,
    requested_student_account_id,
    requested_promised_amount,
    requested_promised_date,
    requested_notes,
    operation_key,
    correlation
  )
$$;

create or replace function public.evaluate_payment_commitment(
  requested_commitment_id uuid,
  business_date date default current_date
)
returns table(
  payment_commitment_id uuid,
  promised_amount numeric(12,2),
  promised_date date,
  qualifying_payments_after_created numeric(12,2),
  outstanding_current numeric(12,2),
  is_past_due boolean,
  can_be_marked_fulfilled boolean,
  appears_broken boolean
)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.evaluate_payment_commitment(requested_commitment_id, business_date)
$$;

create or replace function public.mark_payment_commitment_fulfilled(
  requested_commitment_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.mark_payment_commitment_fulfilled(requested_commitment_id, operation_key, correlation)
$$;

create or replace function public.mark_payment_commitment_broken(
  requested_commitment_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.mark_payment_commitment_broken(requested_commitment_id, operation_key, correlation)
$$;

create or replace function public.cancel_payment_commitment(
  requested_commitment_id uuid,
  requested_note text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.cancel_payment_commitment(requested_commitment_id, requested_note, operation_key, correlation)
$$;

create or replace function public.resolve_collection_case(
  requested_collection_case_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.resolve_collection_case(requested_collection_case_id, operation_key, correlation)
$$;

create or replace function public.close_collection_case(
  requested_collection_case_id uuid,
  requested_close_reason_code finance.collection_close_reason_code,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
stable
security definer
set search_path=''
as $$
  select * from finance.close_collection_case(requested_collection_case_id, requested_close_reason_code, operation_key, correlation)
$$;

alter table finance.collection_cases owner to postgres;
alter table finance.collection_actions owner to postgres;
alter table finance.payment_commitments owner to postgres;

alter table finance.collection_cases enable row level security;
alter table finance.collection_actions enable row level security;
alter table finance.payment_commitments enable row level security;

revoke all on table finance.collection_cases from public, anon, authenticated;
revoke all on table finance.collection_actions from public, anon, authenticated;
revoke all on table finance.payment_commitments from public, anon, authenticated;

revoke all on function finance.get_student_debt_position(uuid, date) from public, anon, authenticated;
revoke all on function finance.list_overdue_student_accounts(uuid, integer, uuid, uuid, text, finance.collection_case_status, text, integer, integer, date) from public, anon, authenticated;
revoke all on function finance.open_collection_case(uuid, finance.collection_open_reason_code, finance.collection_case_priority, uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.add_collection_action(uuid, finance.collection_action_type, finance.collection_action_status, finance.collection_contact_channel, timestamptz, text, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_payment_commitment(uuid, uuid, numeric, date, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.evaluate_payment_commitment(uuid, date) from public, anon, authenticated;
revoke all on function finance.mark_payment_commitment_fulfilled(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.mark_payment_commitment_broken(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.cancel_payment_commitment(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.resolve_collection_case(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.close_collection_case(uuid, finance.collection_close_reason_code, text, uuid) from public, anon, authenticated;

grant execute on function public.get_student_debt_position(uuid, date) to authenticated;
grant execute on function public.list_overdue_student_accounts(uuid, integer, uuid, uuid, text, finance.collection_case_status, text, integer, integer, date) to authenticated;
grant execute on function public.open_collection_case(uuid, finance.collection_open_reason_code, finance.collection_case_priority, uuid, text, uuid) to authenticated;
grant execute on function public.add_collection_action(uuid, finance.collection_action_type, finance.collection_action_status, finance.collection_contact_channel, timestamptz, text, timestamptz, text, uuid) to authenticated;
grant execute on function public.create_payment_commitment(uuid, uuid, numeric, date, text, text, uuid) to authenticated;
grant execute on function public.evaluate_payment_commitment(uuid, date) to authenticated;
grant execute on function public.mark_payment_commitment_fulfilled(uuid, text, uuid) to authenticated;
grant execute on function public.mark_payment_commitment_broken(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_payment_commitment(uuid, text, text, uuid) to authenticated;
grant execute on function public.resolve_collection_case(uuid, text, uuid) to authenticated;
grant execute on function public.close_collection_case(uuid, finance.collection_close_reason_code, text, uuid) to authenticated;

create trigger collection_cases_touch_updated_at
before update on finance.collection_cases
for each row execute function finance.touch_collection_updated_at();

create trigger payment_commitments_touch_updated_at
before update on finance.payment_commitments
for each row execute function finance.touch_collection_updated_at();

create trigger collection_actions_immutable_guard
before update or delete on finance.collection_actions
for each row execute function finance.guard_collection_action_immutable();

create trigger collection_cases_mutation_guard
before update or delete on finance.collection_cases
for each row execute function finance.guard_collection_case_mutation();

create trigger payment_commitments_mutation_guard
before update or delete on finance.payment_commitments
for each row execute function finance.guard_payment_commitment_mutation();

commit;
