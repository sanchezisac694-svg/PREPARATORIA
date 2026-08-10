begin;

do $$
begin
  alter type finance.financial_command_type add value if not exists 'CREATE_FINANCIAL_PERIOD_CLOSE';
  alter type finance.financial_command_type add value if not exists 'APPROVE_FINANCIAL_PERIOD_CLOSE';
  alter type finance.financial_command_type add value if not exists 'SUPERSEDE_FINANCIAL_PERIOD_CLOSE';
end;
$$;

do $$
begin
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_REPORT_VIEWED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_REPORT_EXPORTED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_PERIOD_CLOSE_CREATED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_PERIOD_CLOSE_APPROVED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_PERIOD_CLOSE_SUPERSEDED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_REPORT_OPERATION_DENIED';
end;
$$;

create type finance.financial_period_closure_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'SUPERSEDED'
);

create type finance.financial_report_grouping as enum (
  'DAY',
  'MONTH',
  'ACADEMIC_PERIOD'
);

create or replace function finance.payment_applied_allocations(payment_id uuid)
returns numeric
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    sum(case when allocations.status = 'APPLIED' then allocations.amount else allocations.amount * -1 end),
    0::numeric
  )
  from finance.payment_allocations allocations
  where allocations.payment_id = $1
$$;

create table finance.financial_period_closures (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references academic.academic_periods(id) on delete restrict,
  business_date date not null,
  status finance.financial_period_closure_status not null default 'DRAFT',
  version integer not null check (version > 0),
  supersedes_closure_id uuid references finance.financial_period_closures(id) on delete restrict,
  gross_charges numeric(12,2) not null check (gross_charges >= 0),
  credit_adjustments numeric(12,2) not null check (credit_adjustments >= 0),
  discounts numeric(12,2) not null check (discounts >= 0),
  waivers numeric(12,2) not null check (waivers >= 0),
  scholarship_adjustments numeric(12,2) not null check (scholarship_adjustments >= 0),
  net_charges numeric(12,2) not null check (net_charges >= 0),
  confirmed_payments numeric(12,2) not null check (confirmed_payments >= 0),
  reversed_payments numeric(12,2) not null check (reversed_payments >= 0),
  net_collections numeric(12,2) not null,
  outstanding numeric(12,2) not null check (outstanding >= 0),
  overdue numeric(12,2) not null check (overdue >= 0),
  cash_expected numeric(12,2),
  cash_counted numeric(12,2),
  cash_difference numeric(12,2),
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  approved_at timestamptz,
  superseded_at timestamptz,
  superseded_by_account_id uuid references core.accounts(id) on delete restrict,
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (status = 'DRAFT' and approved_at is null and approved_by_account_id is null and superseded_at is null and superseded_by_account_id is null)
    or (status = 'UNDER_REVIEW' and approved_at is null and approved_by_account_id is null and superseded_at is null and superseded_by_account_id is null)
    or (status = 'APPROVED' and approved_at is not null and approved_by_account_id is not null and superseded_at is null and superseded_by_account_id is null)
    or (status = 'SUPERSEDED' and approved_at is not null and approved_by_account_id is not null and superseded_at is not null and superseded_by_account_id is not null)
  ),
  check (
    (supersedes_closure_id is null and version = 1)
    or (supersedes_closure_id is not null and version > 1)
  ),
  check (
    approved_by_account_id is null
    or approved_by_account_id <> created_by_account_id
  ),
  check (
    cash_expected is null
    or cash_counted is null
    or cash_difference = round(cash_counted - cash_expected, 2)
  ),
  unique (academic_period_id, business_date, version)
);

create unique index financial_period_closures_one_active_equivalent
  on finance.financial_period_closures(academic_period_id, business_date)
  where status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED');

create index financial_period_closures_period_business_idx
  on finance.financial_period_closures(academic_period_id, business_date desc, created_at desc);

create function finance.require_financial_reports_permission(
  permission_code text,
  require_aal2 boolean default false
)
returns uuid
language plpgsql
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
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  select * into identity_context
  from core.get_current_identity_context()
  where session_valid
    and 'SISTEMA_ADMINISTRATIVO' = any(allowed_applications);

  if identity_context.auth_user_id is null then
    raise exception 'APPLICATION_NOT_ALLOWED';
  end if;

  if not core.is_current_session_version_valid() then
    raise exception 'SESSION_VERSION_INVALID';
  end if;

  if require_aal2 and not core.is_current_aal2() then
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
    allowed := permission_code like 'finance.reports.%'
      or permission_code like 'finance.period-close.%';
  elsif role_codes && array['ADMINISTRATIVO'] then
    allowed := permission_code in (
      'finance.reports.charges.read',
      'finance.reports.payments.read',
      'finance.reports.collections.read',
      'finance.reports.cash.read',
      'finance.reports.benefits.read',
      'finance.reports.agreements.read',
      'finance.reports.summary.read',
      'finance.reports.export',
      'finance.period-close.create',
      'finance.period-close.approve',
      'finance.period-close.read'
    );
  elsif role_codes && array['CAJA'] then
    allowed := permission_code in (
      'finance.reports.cash.read',
      'finance.reports.payments.read'
    );
  end if;

  if not allowed then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  return actor.id;
end;
$$;

create function finance.guard_financial_period_closure_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;

  if current_setting('finance.controlled_mutation', true) = 'on' then
    return new;
  end if;

  raise exception 'HISTORICAL_RECORD_IMMUTABLE';
end;
$$;

create trigger financial_period_closures_touch_updated_at
before update on finance.financial_period_closures
for each row execute function finance.touch_updated_at();

create trigger financial_period_closures_guard
before update or delete on finance.financial_period_closures
for each row execute function finance.guard_financial_period_closure_mutation();

create function finance.report_csv_safe_cell(value text)
returns text
language sql
immutable
security invoker
set search_path=''
as $$
  select case
    when value is null then ''
    when left(value, 1) in ('=', '+', '-', '@') then '''' || value
    else value
  end
$$;

create function finance.report_page_size(requested integer)
returns integer
language sql
immutable
security invoker
set search_path=''
as $$
  select least(greatest(coalesce(requested, 50), 1), 200)
$$;

create function finance.report_offset(requested integer)
returns integer
language sql
immutable
security invoker
set search_path=''
as $$
  select greatest(coalesce(requested, 0), 0)
$$;

create function finance.format_student_display_name(student_code text)
returns text
language sql
immutable
security invoker
set search_path=''
as $$
  select case
    when student_code is null or btrim(student_code) = '' then 'Alumno institucional'
    else 'Alumno ' || btrim(student_code)
  end
$$;

create function finance.get_financial_snapshot(
  requested_academic_period_id uuid default null,
  requested_business_date date default current_date
)
returns table(
  gross_charges numeric(12,2),
  credit_adjustments numeric(12,2),
  discounts numeric(12,2),
  waivers numeric(12,2),
  scholarship_adjustments numeric(12,2),
  net_charges numeric(12,2),
  confirmed_payments numeric(12,2),
  reversed_payments numeric(12,2),
  net_collections numeric(12,2),
  outstanding numeric(12,2),
  overdue numeric(12,2),
  charge_count integer,
  payment_count integer,
  debtor_account_count integer,
  cash_expected numeric(12,2),
  cash_counted numeric(12,2),
  cash_difference numeric(12,2)
)
language sql
stable
security definer
set search_path=''
as $$
with charge_base as (
  select
    charges.id,
    charges.student_account_id,
    charges.original_amount,
    charges.due_date
  from finance.student_charges charges
  where charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID')
    and charges.posted_at is not null
    and charges.posted_at::date <= requested_business_date
    and (requested_academic_period_id is null or charges.academic_period_id = requested_academic_period_id)
), adjustment_rows as (
  select
    adjustments.student_charge_id,
    coalesce(sum(
      case
        when adjustments.adjustment_type = 'CREDIT_ADJUSTMENT' then adjustments.amount
        when adjustments.adjustment_type = 'DISCOUNT' then adjustments.amount * -1
        when adjustments.adjustment_type = 'WAIVER' then adjustments.amount * -1
        when adjustments.adjustment_type = 'DEBIT_ADJUSTMENT' then adjustments.amount
        else 0::numeric
      end
    ), 0::numeric) as total_effect,
    coalesce(sum(case when adjustments.adjustment_type = 'CREDIT_ADJUSTMENT' then adjustments.amount else 0::numeric end), 0::numeric) as total_credit_adjustments,
    coalesce(sum(case when adjustments.adjustment_type = 'DISCOUNT' and scholarships.charge_adjustment_id is null then adjustments.amount else 0::numeric end), 0::numeric) as total_discounts,
    coalesce(sum(case when adjustments.adjustment_type = 'WAIVER' then adjustments.amount else 0::numeric end), 0::numeric) as total_waivers,
    coalesce(sum(case when adjustments.adjustment_type = 'DISCOUNT' and scholarships.charge_adjustment_id is not null then adjustments.amount else 0::numeric end), 0::numeric) as total_scholarships
  from finance.charge_adjustments adjustments
  left join finance.charge_adjustments reversal on reversal.id = adjustments.reversed_by_adjustment_id
  left join finance.scholarship_applications scholarships on scholarships.charge_adjustment_id = adjustments.id
  where adjustments.adjustment_type <> 'REVERSAL'
    and adjustments.effective_at is not null
    and adjustments.effective_at::date <= requested_business_date
    and (
      adjustments.reversed_by_adjustment_id is null
      or reversal.effective_at is null
      or reversal.effective_at::date > requested_business_date
    )
  group by adjustments.student_charge_id
), allocation_rows as (
  select
    allocations.student_charge_id,
    coalesce(sum(allocations.amount), 0::numeric) as total_allocated
  from finance.payment_allocations allocations
  left join finance.payment_allocations reversal on reversal.reversed_by_allocation_id = allocations.id
  join finance.payments payments on payments.id = allocations.payment_id
  join finance.student_charges charges on charges.id = allocations.student_charge_id
  where allocations.status = 'APPLIED'
    and allocations.applied_at::date <= requested_business_date
    and (
      reversal.id is null
      or reversal.applied_at is null
      or reversal.applied_at::date > requested_business_date
    )
    and payments.paid_at::date <= requested_business_date
    and (requested_academic_period_id is null or charges.academic_period_id = requested_academic_period_id)
  group by allocations.student_charge_id
), charge_positions as (
  select
    charges.id,
    charges.student_account_id,
    charges.original_amount,
    coalesce(adjustments.total_effect, 0::numeric) as adjustment_effect,
    coalesce(adjustments.total_credit_adjustments, 0::numeric) as credit_adjustments_value,
    coalesce(adjustments.total_discounts, 0::numeric) as discounts_value,
    coalesce(adjustments.total_waivers, 0::numeric) as waivers_value,
    coalesce(adjustments.total_scholarships, 0::numeric) as scholarship_value,
    coalesce(allocations.total_allocated, 0::numeric) as allocated_value,
    greatest(0::numeric, charges.original_amount + coalesce(adjustments.total_effect, 0::numeric) - coalesce(allocations.total_allocated, 0::numeric)) as outstanding_value,
    charges.due_date
  from charge_base charges
  left join adjustment_rows adjustments on adjustments.student_charge_id = charges.id
  left join allocation_rows allocations on allocations.student_charge_id = charges.id
), payment_rows as (
  select
    payments.id,
    payments.amount,
    payments.status,
    payments.student_account_id
  from finance.payments payments
  left join finance.payments reversal on reversal.id = payments.reversed_by_payment_id
  where payments.paid_at::date <= requested_business_date
    and payments.status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED')
    and (
      requested_academic_period_id is null
      or exists (
        select 1
        from finance.payment_allocations allocations
        join finance.student_charges charges on charges.id = allocations.student_charge_id
        where allocations.payment_id = payments.id
          and charges.academic_period_id = requested_academic_period_id
      )
    )
    and (
      payments.reversed_by_payment_id is null
      or reversal.paid_at is null
      or reversal.paid_at::date > requested_business_date
    )
), reversal_rows as (
  select payments.id, payments.amount
  from finance.payments payments
  where payments.status = 'REVERSED'
    and payments.paid_at::date <= requested_business_date
    and payments.reversal_reason_code is not null
    and (
      requested_academic_period_id is null
      or exists (
        select 1
        from finance.payment_allocations allocations
        join finance.student_charges charges on charges.id = allocations.student_charge_id
        where allocations.payment_id = payments.id
          and charges.academic_period_id = requested_academic_period_id
      )
    )
), cash_rows as (
  select
    coalesce(sum(sessions.expected_cash_amount), 0::numeric) as total_expected,
    coalesce(sum(counts.counted_amount), 0::numeric) as total_counted,
    coalesce(sum(reconciliations.difference_amount), 0::numeric) as total_difference
  from finance.cash_sessions sessions
  left join finance.cash_counts counts on counts.cash_session_id = sessions.id
  left join finance.cash_reconciliations reconciliations on reconciliations.cash_session_id = sessions.id
  where sessions.business_date = requested_business_date
), debtor_accounts as (
  select count(distinct student_account_id)::integer as debtor_count
  from charge_positions
  where outstanding_value > 0
)
select
  coalesce(sum(charge_positions.original_amount), 0)::numeric(12,2) as gross_charges,
  coalesce(sum(charge_positions.credit_adjustments_value), 0)::numeric(12,2) as credit_adjustments,
  coalesce(sum(charge_positions.discounts_value), 0)::numeric(12,2) as discounts,
  coalesce(sum(charge_positions.waivers_value), 0)::numeric(12,2) as waivers,
  coalesce(sum(charge_positions.scholarship_value), 0)::numeric(12,2) as scholarship_adjustments,
  coalesce(sum(charge_positions.original_amount + charge_positions.adjustment_effect), 0)::numeric(12,2) as net_charges,
  coalesce((select sum(amount) from payment_rows), 0)::numeric(12,2) as confirmed_payments,
  coalesce((select sum(amount) from reversal_rows), 0)::numeric(12,2) as reversed_payments,
  round(
    coalesce((select sum(amount) from payment_rows), 0)::numeric
    - coalesce((select sum(amount) from reversal_rows), 0)::numeric,
    2
  )::numeric(12,2) as net_collections,
  coalesce(sum(charge_positions.outstanding_value), 0)::numeric(12,2) as outstanding,
  coalesce(sum(case when charge_positions.due_date is not null and charge_positions.due_date < requested_business_date then charge_positions.outstanding_value else 0::numeric end), 0)::numeric(12,2) as overdue,
  count(*)::integer as charge_count,
  coalesce((select count(*) from payment_rows), 0)::integer as payment_count,
  (select debtor_count from debtor_accounts) as debtor_account_count,
  (select total_expected::numeric(12,2) from cash_rows) as cash_expected,
  (select total_counted::numeric(12,2) from cash_rows) as cash_counted,
  (select total_difference::numeric(12,2) from cash_rows) as cash_difference
from charge_positions
$$;

create function finance.get_financial_period_summary(
  requested_academic_period_id uuid default null,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.summary.read', false) as actor_id
), snapshot as (
  select * from finance.get_financial_snapshot(requested_academic_period_id, requested_business_date)
)
select jsonb_build_object(
  'academicPeriodId', requested_academic_period_id,
  'businessDate', requested_business_date,
  'grossCharges', finance.format_money(snapshot.gross_charges),
  'creditAdjustments', finance.format_money(snapshot.credit_adjustments),
  'discounts', finance.format_money(snapshot.discounts),
  'waivers', finance.format_money(snapshot.waivers),
  'scholarshipAdjustments', finance.format_money(snapshot.scholarship_adjustments),
  'netCharges', finance.format_money(snapshot.net_charges),
  'confirmedPayments', finance.format_money(snapshot.confirmed_payments),
  'reversedPayments', finance.format_money(snapshot.reversed_payments),
  'netCollections', finance.format_money(snapshot.net_collections),
  'outstanding', finance.format_money(snapshot.outstanding),
  'overdue', finance.format_money(snapshot.overdue),
  'chargeCount', snapshot.charge_count,
  'paymentCount', snapshot.payment_count,
  'debtorAccountCount', snapshot.debtor_account_count,
  'cashExpected', case when snapshot.cash_expected is null then null else finance.format_money(snapshot.cash_expected) end,
  'cashCounted', case when snapshot.cash_counted is null then null else finance.format_money(snapshot.cash_counted) end,
  'cashDifference', case when snapshot.cash_difference is null then null else finance.format_money(snapshot.cash_difference) end
)
from actor, snapshot
$$;

create function finance.report_charges(
  requested_academic_period_id uuid default null,
  date_from date default null,
  date_to date default null,
  requested_charge_concept_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_charge_status finance.student_charge_status default null,
  requested_business_date date default current_date,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.charges.read', false) as actor_id
), filtered as (
  select
    charges.id,
    records.institutional_student_code,
    finance.format_student_display_name(records.institutional_student_code) as student_display_name,
    concepts.name as concept_name,
    charges.posted_at,
    charges.due_date,
    charges.original_amount,
    charges.status,
    coalesce(adjustments.total_effect, 0::numeric) as adjustment_effect,
    coalesce(allocations.total_allocated, 0::numeric) as amount_paid,
    greatest(0::numeric, charges.original_amount + coalesce(adjustments.total_effect, 0::numeric) - coalesce(allocations.total_allocated, 0::numeric)) as outstanding
  from finance.student_charges charges
  join finance.student_accounts accounts on accounts.id = charges.student_account_id
  join academic.student_records records on records.id = accounts.student_record_id
  join finance.charge_concepts concepts on concepts.id = charges.charge_concept_id
  left join academic.period_enrollments enrollments on enrollments.id = charges.enrollment_id
  left join (
    select
      adjustments.student_charge_id,
      coalesce(sum(
        case
          when adjustments.adjustment_type = 'CREDIT_ADJUSTMENT' then adjustments.amount
          when adjustments.adjustment_type in ('DISCOUNT', 'WAIVER') then adjustments.amount * -1
          when adjustments.adjustment_type = 'DEBIT_ADJUSTMENT' then adjustments.amount
          else 0::numeric
        end
      ), 0::numeric) as total_effect
    from finance.charge_adjustments adjustments
    left join finance.charge_adjustments reversal on reversal.id = adjustments.reversed_by_adjustment_id
    where adjustments.adjustment_type <> 'REVERSAL'
      and adjustments.effective_at is not null
      and adjustments.effective_at::date <= requested_business_date
      and (
        adjustments.reversed_by_adjustment_id is null
        or reversal.effective_at is null
        or reversal.effective_at::date > requested_business_date
      )
    group by adjustments.student_charge_id
  ) adjustments on adjustments.student_charge_id = charges.id
  left join (
    select
      allocations.student_charge_id,
      coalesce(sum(allocations.amount), 0::numeric) as total_allocated
    from finance.payment_allocations allocations
    left join finance.payment_allocations reversal on reversal.reversed_by_allocation_id = allocations.id
    join finance.payments payments on payments.id = allocations.payment_id
    where allocations.status = 'APPLIED'
      and allocations.applied_at::date <= requested_business_date
      and payments.paid_at::date <= requested_business_date
      and (
        reversal.id is null
        or reversal.applied_at is null
        or reversal.applied_at::date > requested_business_date
      )
    group by allocations.student_charge_id
  ) allocations on allocations.student_charge_id = charges.id
  where charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID')
    and charges.posted_at is not null
    and (requested_academic_period_id is null or charges.academic_period_id = requested_academic_period_id)
    and (date_from is null or charges.posted_at::date >= date_from)
    and (date_to is null or charges.posted_at::date <= date_to)
    and (requested_charge_concept_id is null or charges.charge_concept_id = requested_charge_concept_id)
    and (requested_semester_number is null or enrollments.semester_number = requested_semester_number)
    and (requested_group_id is null or enrollments.group_id = requested_group_id)
    and (requested_training_area_id is null or enrollments.training_area_id = requested_training_area_id)
    and (requested_charge_status is null or charges.status = requested_charge_status)
), counted as (
  select *, count(*) over() as total_rows
  from filtered
  order by posted_at desc, id
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'businessDate', requested_business_date,
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'studentIdentifier', institutional_student_code,
    'studentDisplayName', student_display_name,
    'chargeId', id,
    'concept', concept_name,
    'postedAt', posted_at,
    'dueDate', due_date,
    'originalAmount', finance.format_money(original_amount),
    'appliedAdjustments', finance.format_money(adjustment_effect),
    'amountPaid', finance.format_money(amount_paid),
    'outstanding', finance.format_money(outstanding),
    'isOverdue', due_date is not null and due_date < requested_business_date and outstanding > 0,
    'chargeStatus', status
  ) order by posted_at desc, id), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.report_payments(
  date_from date default null,
  date_to date default null,
  requested_academic_period_id uuid default null,
  requested_payment_method finance.payment_method default null,
  requested_payment_status finance.payment_status default null,
  requested_cash_register_id uuid default null,
  requested_cashier_account_id uuid default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.payments.read', false) as actor_id
), payment_rows as (
  select
    payments.id,
    payments.receipt_number,
    payments.paid_at,
    payments.payment_method,
    payments.status,
    payments.amount,
    records.institutional_student_code,
    finance.format_student_display_name(records.institutional_student_code) as student_display_name,
    sessions.id as cash_session_id,
    registers.code as cash_register_code,
    registers.name as cash_register_name,
    sessions.business_date,
    coalesce(applied.total_applied, 0::numeric) as applied_amount
  from finance.payments payments
  join finance.student_accounts accounts on accounts.id = payments.student_account_id
  join academic.student_records records on records.id = accounts.student_record_id
  left join (
    select allocations.payment_id, coalesce(sum(allocations.amount), 0::numeric) as total_applied
    from finance.payment_allocations allocations
    left join finance.payment_allocations reversal on reversal.reversed_by_allocation_id = allocations.id
    where allocations.status = 'APPLIED'
      and (
        reversal.id is null
        or reversal.applied_at is null
        or reversal.applied_at::date > current_date
      )
    group by allocations.payment_id
  ) applied on applied.payment_id = payments.id
  left join finance.cash_session_payments links on links.payment_id = payments.id
  left join finance.cash_sessions sessions on sessions.id = links.cash_session_id
  left join finance.cash_registers registers on registers.id = sessions.cash_register_id
  where (date_from is null or payments.paid_at::date >= date_from)
    and (date_to is null or payments.paid_at::date <= date_to)
    and (requested_payment_method is null or payments.payment_method = requested_payment_method)
    and (requested_payment_status is null or payments.status = requested_payment_status)
    and (requested_cash_register_id is null or sessions.cash_register_id = requested_cash_register_id)
    and (requested_cashier_account_id is null or sessions.cashier_account_id = requested_cashier_account_id)
    and (
      requested_academic_period_id is null
      or exists (
        select 1
        from finance.payment_allocations allocations
        join finance.student_charges charges on charges.id = allocations.student_charge_id
        where allocations.payment_id = payments.id
          and charges.academic_period_id = requested_academic_period_id
      )
    )
), counted as (
  select *, count(*) over() as total_rows
  from payment_rows
  order by paid_at desc, id
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'paymentId', id,
    'receiptNumber', receipt_number,
    'paidAt', paid_at,
    'method', payment_method,
    'status', status,
    'amount', finance.format_money(amount),
    'appliedAmount', finance.format_money(applied_amount),
    'unappliedAmount', finance.format_money(greatest(amount - applied_amount, 0::numeric)),
    'studentIdentifier', institutional_student_code,
    'studentDisplayName', student_display_name,
    'cashSession', case when cash_session_id is null then null else jsonb_build_object(
      'cashSessionId', cash_session_id,
      'cashRegisterCode', cash_register_code,
      'cashRegisterName', cash_register_name,
      'businessDate', business_date
    ) end
  ) order by paid_at desc, id), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.report_cash_operations(
  requested_business_date date default current_date,
  requested_cash_register_id uuid default null,
  requested_cashier_account_id uuid default null,
  requested_session_status finance.cash_session_status default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.cash.read', false) as actor_id
), session_base as (
  select
    sessions.id,
    sessions.business_date,
    sessions.status,
    sessions.opening_amount,
    sessions.expected_cash_amount,
    counts.counted_amount,
    reconciliations.difference_amount,
    reconciliations.status as reconciliation_status,
    registers.code as cash_register_code,
    registers.name as cash_register_name,
    sessions.cashier_account_id,
    coalesce(cash_receipts.total_amount, 0::numeric) as cash_receipts,
    coalesce(movements.total_cash_in, 0::numeric) as cash_in,
    coalesce(movements.total_cash_out, 0::numeric) as cash_out,
    coalesce(movements.total_reversals, 0::numeric) as reversals
  from finance.cash_sessions sessions
  join finance.cash_registers registers on registers.id = sessions.cash_register_id
  left join finance.cash_counts counts on counts.cash_session_id = sessions.id
  left join finance.cash_reconciliations reconciliations on reconciliations.cash_session_id = sessions.id
  left join (
    select
      links.cash_session_id,
      coalesce(sum(payments.amount), 0::numeric) as total_amount
    from finance.cash_session_payments links
    join finance.payments payments on payments.id = links.payment_id
    where payments.payment_method = 'CASH'
      and payments.status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED')
    group by links.cash_session_id
  ) cash_receipts on cash_receipts.cash_session_id = sessions.id
  left join (
    select
      cash_movements.cash_session_id,
      coalesce(sum(case when movement_type = 'CASH_IN' then amount else 0::numeric end), 0::numeric) as total_cash_in,
      coalesce(sum(case when movement_type in ('CASH_OUT', 'CASH_WITHDRAWAL', 'CASH_TRANSFER') then amount else 0::numeric end), 0::numeric) as total_cash_out,
      coalesce(sum(case when movement_type = 'REVERSAL' then amount else 0::numeric end), 0::numeric) as total_reversals
    from finance.cash_movements cash_movements
    where cash_movements.status = 'ACTIVE'
    group by cash_movements.cash_session_id
  ) movements on movements.cash_session_id = sessions.id
  where sessions.business_date = requested_business_date
    and (requested_cash_register_id is null or sessions.cash_register_id = requested_cash_register_id)
    and (requested_cashier_account_id is null or sessions.cashier_account_id = requested_cashier_account_id)
    and (requested_session_status is null or sessions.status = requested_session_status)
), counted as (
  select *, count(*) over() as total_rows
  from session_base
  order by business_date desc, id desc
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'cashSessionId', id,
    'businessDate', business_date,
    'sessionStatus', status,
    'cashRegisterCode', cash_register_code,
    'cashRegisterName', cash_register_name,
    'opening', finance.format_money(opening_amount),
    'cashReceipts', finance.format_money(cash_receipts),
    'cashIn', finance.format_money(cash_in),
    'cashOut', finance.format_money(cash_out),
    'reversals', finance.format_money(reversals),
    'expected', case when expected_cash_amount is null then null else finance.format_money(expected_cash_amount) end,
    'counted', case when counted_amount is null then null else finance.format_money(counted_amount) end,
    'difference', case when difference_amount is null then null else finance.format_money(difference_amount) end,
    'reconciliationStatus', reconciliation_status
  ) order by business_date desc, id desc), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.report_financial_benefits(
  requested_academic_period_id uuid default null,
  date_from date default null,
  date_to date default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.benefits.read', false) as actor_id
), benefit_rows as (
  select
    adjustments.id,
    records.institutional_student_code,
    finance.format_student_display_name(records.institutional_student_code) as student_display_name,
    concepts.name as concept_name,
    charges.id as charge_id,
    adjustments.amount,
    adjustments.effective_at,
    case
      when adjustments.adjustment_type = 'WAIVER' then 'WAIVER'
      when adjustments.adjustment_type = 'DISCOUNT' and scholarships.charge_adjustment_id is not null then 'SCHOLARSHIP'
      when adjustments.adjustment_type = 'DISCOUNT' then 'AUTHORIZED_DISCOUNT'
      when adjustments.adjustment_type = 'REVERSAL' then 'REVERSAL'
      else adjustments.adjustment_type::text
    end as benefit_type,
    case
      when scholarships.charge_adjustment_id is not null then programs.name
      else null
    end as program_name,
    case
      when adjustments.reversed_by_adjustment_id is not null then 'REVERSED'
      else adjustments.status::text
    end as benefit_status
  from finance.charge_adjustments adjustments
  join finance.student_charges charges on charges.id = adjustments.student_charge_id
  join finance.charge_concepts concepts on concepts.id = charges.charge_concept_id
  join finance.student_accounts accounts on accounts.id = charges.student_account_id
  join academic.student_records records on records.id = accounts.student_record_id
  left join finance.scholarship_applications scholarships on scholarships.charge_adjustment_id = adjustments.id
  left join finance.student_scholarships student_scholarships on student_scholarships.id = scholarships.student_scholarship_id
  left join finance.scholarship_programs programs on programs.id = student_scholarships.scholarship_program_id
  where adjustments.adjustment_type in ('DISCOUNT', 'WAIVER', 'REVERSAL')
    and adjustments.effective_at is not null
    and (requested_academic_period_id is null or charges.academic_period_id = requested_academic_period_id)
    and (date_from is null or adjustments.effective_at::date >= date_from)
    and (date_to is null or adjustments.effective_at::date <= date_to)
), counted as (
  select *, count(*) over() as total_rows
  from benefit_rows
  order by effective_at desc, id
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'adjustmentId', id,
    'studentIdentifier', institutional_student_code,
    'studentDisplayName', student_display_name,
    'concept', concept_name,
    'chargeId', charge_id,
    'benefitType', benefit_type,
    'benefitAmount', finance.format_money(amount),
    'appliedAt', effective_at,
    'status', benefit_status,
    'program', program_name
  ) order by effective_at desc, id), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.report_payment_agreements(
  requested_academic_period_id uuid default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.agreements.read', false) as actor_id
), agreement_rows as (
  select
    agreements.id,
    agreements.status,
    records.institutional_student_code,
    finance.format_student_display_name(records.institutional_student_code) as student_display_name,
    agreements.original_outstanding_snapshot,
    agreements.agreed_amount,
    evaluation.total_scheduled,
    evaluation.total_fulfilled,
    evaluation.remaining,
    evaluation.next_installment_date,
    evaluation.installments_due,
    evaluation.installments_past_due,
    evaluation.evaluation_status
  from finance.payment_agreements agreements
  join finance.student_accounts accounts on accounts.id = agreements.student_account_id
  join academic.student_records records on records.id = accounts.student_record_id
  left join lateral (
    select
      coalesce(sum(installments.scheduled_amount), 0::numeric) as total_scheduled,
      coalesce(sum(least(installments.fulfilled_amount, installments.scheduled_amount)), 0::numeric) as total_fulfilled,
      greatest(agreements.agreed_amount - coalesce(sum(least(installments.fulfilled_amount, installments.scheduled_amount)), 0::numeric), 0::numeric) as remaining,
      min(installments.due_date) filter (where installments.status <> 'FULFILLED') as next_installment_date,
      count(*) filter (where installments.due_date <= requested_business_date and installments.status <> 'FULFILLED')::integer as installments_due,
      count(*) filter (where installments.due_date < requested_business_date and installments.status <> 'FULFILLED')::integer as installments_past_due,
      case
        when agreements.status = 'COMPLETED' or coalesce(sum(least(installments.fulfilled_amount, installments.scheduled_amount)), 0::numeric) >= agreements.agreed_amount then 'COMPLETED'
        when count(*) filter (where installments.due_date < requested_business_date and installments.status <> 'FULFILLED') > 0 then 'PAST_DUE'
        when count(*) filter (where installments.due_date <= requested_business_date and installments.status <> 'FULFILLED') > 0 then 'DUE'
        else 'ON_TRACK'
      end as evaluation_status
    from finance.payment_agreement_installments installments
    where installments.payment_agreement_id = agreements.id
  ) evaluation on true
  where (
      requested_academic_period_id is null
      or exists (
        select 1
        from finance.student_charges charges
        where charges.student_account_id = agreements.student_account_id
          and charges.academic_period_id = requested_academic_period_id
      )
    )
), counted as (
  select *, count(*) over() as total_rows
  from agreement_rows
  order by id desc
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'paymentAgreementId', id,
    'agreementStatus', status,
    'studentIdentifier', institutional_student_code,
    'studentDisplayName', student_display_name,
    'initialSnapshot', finance.format_money(original_outstanding_snapshot),
    'scheduledTotal', finance.format_money(total_scheduled),
    'fulfilledAmount', finance.format_money(total_fulfilled),
    'remaining', finance.format_money(remaining),
    'nextInstallment', next_installment_date,
    'dueInstallments', installments_due,
    'pastDueInstallments', installments_past_due,
    'evaluationStatus', evaluation_status
  ) order by id desc), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.report_debt_summary(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_aging_bucket text default null,
  requested_collection_case_status finance.collection_case_status default null,
  requested_search_text text default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.reports.collections.read', false) as actor_id
), rows as (
  select *
  from finance.list_overdue_student_accounts(
    requested_academic_period_id,
    requested_semester_number,
    requested_group_id,
    requested_training_area_id,
    requested_aging_bucket,
    requested_collection_case_status,
    requested_search_text,
    finance.report_page_size(requested_limit),
    finance.report_offset(requested_offset),
    requested_business_date
  )
), summary as (
  select
    coalesce(sum(total_outstanding), 0::numeric) as total_outstanding,
    coalesce(sum(total_overdue), 0::numeric) as total_overdue,
    count(*)::integer as debtor_accounts
  from finance.list_overdue_student_accounts(
    requested_academic_period_id,
    requested_semester_number,
    requested_group_id,
    requested_training_area_id,
    requested_aging_bucket,
    requested_collection_case_status,
    requested_search_text,
    200,
    0,
    requested_business_date
  )
), row_payload as (
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'agingBucket', rows.aging_bucket,
      'caseStatus', rows.collection_case_status,
      'studentIdentifier', rows.institutional_student_code,
      'studentDisplayName', rows.display_name,
      'groupName', rows.group_name,
      'oldestOverdueDate', rows.oldest_overdue_date,
      'semesterNumber', rows.semester_number,
      'totalOutstanding', finance.format_money(rows.total_outstanding),
      'totalOverdue', finance.format_money(rows.total_overdue)
    )),
    '[]'::jsonb
  ) as rows
  from rows
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'totalOutstanding', finance.format_money(summary.total_outstanding),
    'totalOverdue', finance.format_money(summary.total_overdue),
    'debtorAccounts', summary.debtor_accounts
  ),
  'rows', row_payload.rows
)
from actor, summary, row_payload
$$;

create function finance.list_financial_period_closures(
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.period-close.read', false) as actor_id
), counted as (
  select
    closures.*,
    periods.code as academic_period_code,
    periods.name as academic_period_name,
    count(*) over() as total_rows
  from finance.financial_period_closures closures
  join academic.academic_periods periods on periods.id = closures.academic_period_id
  order by closures.business_date desc, closures.version desc, closures.created_at desc
), paged as (
  select *
  from counted
  offset finance.report_offset(requested_offset)
  limit finance.report_page_size(requested_limit)
)
select jsonb_build_object(
  'pageSize', finance.report_page_size(requested_limit),
  'offset', finance.report_offset(requested_offset),
  'totalRows', coalesce(max(total_rows), 0),
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'closureId', id,
    'academicPeriodId', academic_period_id,
    'academicPeriodCode', academic_period_code,
    'academicPeriodName', academic_period_name,
    'businessDate', business_date,
    'status', status,
    'version', version,
    'grossCharges', finance.format_money(gross_charges),
    'netCollections', finance.format_money(net_collections),
    'outstanding', finance.format_money(outstanding),
    'overdue', finance.format_money(overdue),
    'createdAt', created_at,
    'approvedAt', approved_at
  ) order by business_date desc, version desc, created_at desc), '[]'::jsonb)
)
from actor, paged
$$;

create function finance.get_financial_period_close(closure_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with actor as (
  select finance.require_financial_reports_permission('finance.period-close.read', false) as actor_id
), closure_row as (
  select
    closures.*,
    periods.code as academic_period_code,
    periods.name as academic_period_name
  from finance.financial_period_closures closures
  join academic.academic_periods periods on periods.id = closures.academic_period_id
  where closures.id = closure_id
)
select jsonb_build_object(
  'closureId', id,
  'academicPeriodId', academic_period_id,
  'academicPeriodCode', academic_period_code,
  'academicPeriodName', academic_period_name,
  'businessDate', business_date,
  'status', status,
  'version', version,
  'supersedesClosureId', supersedes_closure_id,
  'grossCharges', finance.format_money(gross_charges),
  'creditAdjustments', finance.format_money(credit_adjustments),
  'discounts', finance.format_money(discounts),
  'waivers', finance.format_money(waivers),
  'scholarshipAdjustments', finance.format_money(scholarship_adjustments),
  'netCharges', finance.format_money(net_charges),
  'confirmedPayments', finance.format_money(confirmed_payments),
  'reversedPayments', finance.format_money(reversed_payments),
  'netCollections', finance.format_money(net_collections),
  'outstanding', finance.format_money(outstanding),
  'overdue', finance.format_money(overdue),
  'cashExpected', case when cash_expected is null then null else finance.format_money(cash_expected) end,
  'cashCounted', case when cash_counted is null then null else finance.format_money(cash_counted) end,
  'cashDifference', case when cash_difference is null then null else finance.format_money(cash_difference) end,
  'createdByAccountId', created_by_account_id,
  'approvedByAccountId', approved_by_account_id,
  'createdAt', created_at,
  'approvedAt', approved_at,
  'supersededAt', superseded_at,
  'supersededByAccountId', superseded_by_account_id
)
from actor, closure_row
$$;

create function finance.create_financial_period_close(
  requested_academic_period_id uuid,
  requested_business_date date,
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
  snapshot record;
  created uuid;
  next_version integer;
begin
  actor := finance.require_financial_reports_permission('finance.period-close.create', true);
  prior := finance.begin_financial_command(
    actor,
    'CREATE_FINANCIAL_PERIOD_CLOSE',
    operation_key,
    jsonb_build_object(
      'academicPeriodId', requested_academic_period_id,
      'businessDate', requested_business_date
    )
  );

  if prior is not null then
    return query select prior, (select closures.status::text from finance.financial_period_closures closures where closures.id = prior);
    return;
  end if;

  if not exists(select 1 from academic.academic_periods where id = requested_academic_period_id) then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;

  if exists (
    select 1
    from finance.financial_period_closures closures
    where closures.academic_period_id = requested_academic_period_id
      and closures.business_date = requested_business_date
      and closures.status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED')
  ) then
    raise exception 'CONCURRENT_MODIFICATION';
  end if;

  select coalesce(max(version), 0) + 1
    into next_version
  from finance.financial_period_closures
  where academic_period_id = requested_academic_period_id
    and business_date = requested_business_date;

  select * into snapshot
  from finance.get_financial_snapshot(requested_academic_period_id, requested_business_date);

  insert into finance.financial_period_closures(
    academic_period_id,
    business_date,
    status,
    version,
    gross_charges,
    credit_adjustments,
    discounts,
    waivers,
    scholarship_adjustments,
    net_charges,
    confirmed_payments,
    reversed_payments,
    net_collections,
    outstanding,
    overdue,
    cash_expected,
    cash_counted,
    cash_difference,
    created_by_account_id
  )
  values (
    requested_academic_period_id,
    requested_business_date,
    'UNDER_REVIEW',
    next_version,
    snapshot.gross_charges,
    snapshot.credit_adjustments,
    snapshot.discounts,
    snapshot.waivers,
    snapshot.scholarship_adjustments,
    snapshot.net_charges,
    snapshot.confirmed_payments,
    snapshot.reversed_payments,
    snapshot.net_collections,
    snapshot.outstanding,
    snapshot.overdue,
    snapshot.cash_expected,
    snapshot.cash_counted,
    snapshot.cash_difference,
    actor
  )
  returning id into created;

  perform finance.append_financial_event(
    'FINANCIAL_PERIOD_CLOSE_CREATED',
    actor,
    operation_key,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'financialPeriodClosureId', created,
      'academicPeriodId', requested_academic_period_id,
      'businessDate', requested_business_date
    ),
    correlation
  );
  perform finance.complete_financial_command(actor, 'CREATE_FINANCIAL_PERIOD_CLOSE', operation_key, 'FINANCIAL_PERIOD_CLOSE', created);
  return query select created, 'UNDER_REVIEW';
end;
$$;

create function finance.approve_financial_period_close(
  target_closure_id uuid,
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
  closure_row finance.financial_period_closures%rowtype;
begin
  actor := finance.require_financial_reports_permission('finance.period-close.approve', true);
  prior := finance.begin_financial_command(actor, 'APPROVE_FINANCIAL_PERIOD_CLOSE', operation_key, jsonb_build_object('closureId', target_closure_id));
  if prior is not null then
    return query select prior, (select closures.status::text from finance.financial_period_closures closures where closures.id = prior);
    return;
  end if;

  select * into closure_row
  from finance.financial_period_closures
  where id = target_closure_id
  for update;

  if closure_row.id is null or closure_row.status <> 'UNDER_REVIEW' then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;

  if closure_row.created_by_account_id = actor then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.financial_period_closures
  set status = 'APPROVED',
      approved_by_account_id = actor,
      approved_at = statement_timestamp()
  where id = target_closure_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event(
    'FINANCIAL_PERIOD_CLOSE_APPROVED',
    actor,
    operation_key,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('financialPeriodClosureId', target_closure_id),
    correlation
  );
  perform finance.complete_financial_command(actor, 'APPROVE_FINANCIAL_PERIOD_CLOSE', operation_key, 'FINANCIAL_PERIOD_CLOSE', target_closure_id);
  return query select target_closure_id, 'APPROVED';
end;
$$;

create function finance.supersede_financial_period_close(
  target_closure_id uuid,
  requested_business_date date,
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
  closure_row finance.financial_period_closures%rowtype;
  snapshot record;
  created uuid;
begin
  actor := finance.require_financial_reports_permission('finance.period-close.approve', true);
  prior := finance.begin_financial_command(actor, 'SUPERSEDE_FINANCIAL_PERIOD_CLOSE', operation_key, jsonb_build_object('closureId', target_closure_id, 'businessDate', requested_business_date));
  if prior is not null then
    return query select prior, (select closures.status::text from finance.financial_period_closures closures where closures.id = prior);
    return;
  end if;

  select * into closure_row
  from finance.financial_period_closures
  where id = target_closure_id
  for update;

  if closure_row.id is null or closure_row.status <> 'APPROVED' then
    raise exception 'FINANCE_OPERATION_FAILED';
  end if;

  if exists (
    select 1
    from finance.financial_period_closures closures
    where closures.academic_period_id = closure_row.academic_period_id
      and closures.business_date = requested_business_date
      and closures.status in ('DRAFT', 'UNDER_REVIEW', 'APPROVED')
      and closures.id <> closure_row.id
  ) then
    raise exception 'CONCURRENT_MODIFICATION';
  end if;

  select * into snapshot
  from finance.get_financial_snapshot(closure_row.academic_period_id, requested_business_date);

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.financial_period_closures
  set status = 'SUPERSEDED',
      superseded_at = statement_timestamp(),
      superseded_by_account_id = actor
  where id = closure_row.id;

  insert into finance.financial_period_closures(
    academic_period_id,
    business_date,
    status,
    version,
    supersedes_closure_id,
    gross_charges,
    credit_adjustments,
    discounts,
    waivers,
    scholarship_adjustments,
    net_charges,
    confirmed_payments,
    reversed_payments,
    net_collections,
    outstanding,
    overdue,
    cash_expected,
    cash_counted,
    cash_difference,
    created_by_account_id
  )
  values (
    closure_row.academic_period_id,
    requested_business_date,
    'UNDER_REVIEW',
    closure_row.version + 1,
    closure_row.id,
    snapshot.gross_charges,
    snapshot.credit_adjustments,
    snapshot.discounts,
    snapshot.waivers,
    snapshot.scholarship_adjustments,
    snapshot.net_charges,
    snapshot.confirmed_payments,
    snapshot.reversed_payments,
    snapshot.net_collections,
    snapshot.outstanding,
    snapshot.overdue,
    snapshot.cash_expected,
    snapshot.cash_counted,
    snapshot.cash_difference,
    actor
  )
  returning id into created;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event(
    'FINANCIAL_PERIOD_CLOSE_SUPERSEDED',
    actor,
    operation_key,
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object(
      'financialPeriodClosureId', created,
      'supersedesClosureId', closure_row.id
    ),
    correlation
  );
  perform finance.complete_financial_command(actor, 'SUPERSEDE_FINANCIAL_PERIOD_CLOSE', operation_key, 'FINANCIAL_PERIOD_CLOSE', created);
  return query select created, 'UNDER_REVIEW';
end;
$$;

create or replace function public.get_financial_period_summary(
  requested_academic_period_id uuid default null,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.get_financial_period_summary(requested_academic_period_id, requested_business_date) $$;

create or replace function public.report_charges(
  requested_academic_period_id uuid default null,
  date_from date default null,
  date_to date default null,
  requested_charge_concept_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_charge_status finance.student_charge_status default null,
  requested_business_date date default current_date,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_charges(requested_academic_period_id, date_from, date_to, requested_charge_concept_id, requested_semester_number, requested_group_id, requested_training_area_id, requested_charge_status, requested_business_date, requested_limit, requested_offset) $$;

create or replace function public.report_payments(
  date_from date default null,
  date_to date default null,
  requested_academic_period_id uuid default null,
  requested_payment_method finance.payment_method default null,
  requested_payment_status finance.payment_status default null,
  requested_cash_register_id uuid default null,
  requested_cashier_account_id uuid default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_payments(date_from, date_to, requested_academic_period_id, requested_payment_method, requested_payment_status, requested_cash_register_id, requested_cashier_account_id, requested_limit, requested_offset) $$;

create or replace function public.report_debt_summary(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_training_area_id uuid default null,
  requested_aging_bucket text default null,
  requested_collection_case_status finance.collection_case_status default null,
  requested_search_text text default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_debt_summary(requested_academic_period_id, requested_semester_number, requested_group_id, requested_training_area_id, requested_aging_bucket, requested_collection_case_status, requested_search_text, requested_limit, requested_offset, requested_business_date) $$;

create or replace function public.report_cash_operations(
  requested_business_date date default current_date,
  requested_cash_register_id uuid default null,
  requested_cashier_account_id uuid default null,
  requested_session_status finance.cash_session_status default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_cash_operations(requested_business_date, requested_cash_register_id, requested_cashier_account_id, requested_session_status, requested_limit, requested_offset) $$;

create or replace function public.report_financial_benefits(
  requested_academic_period_id uuid default null,
  date_from date default null,
  date_to date default null,
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_financial_benefits(requested_academic_period_id, date_from, date_to, requested_limit, requested_offset) $$;

create or replace function public.report_payment_agreements(
  requested_academic_period_id uuid default null,
  requested_limit integer default 50,
  requested_offset integer default 0,
  requested_business_date date default current_date
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.report_payment_agreements(requested_academic_period_id, requested_limit, requested_offset, requested_business_date) $$;

create or replace function public.list_financial_period_closures(
  requested_limit integer default 50,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.list_financial_period_closures(requested_limit, requested_offset) $$;

create or replace function public.get_financial_period_close(closure_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select finance.get_financial_period_close(closure_id) $$;

create or replace function public.create_financial_period_close(
  requested_academic_period_id uuid,
  requested_business_date date,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.create_financial_period_close(requested_academic_period_id, requested_business_date, operation_key, correlation_id) $$;

create or replace function public.approve_financial_period_close(
  target_closure_id uuid,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.approve_financial_period_close(target_closure_id, operation_key, correlation_id) $$;

create or replace function public.supersede_financial_period_close(
  target_closure_id uuid,
  requested_business_date date,
  operation_key text,
  correlation_id uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$ select * from finance.supersede_financial_period_close(target_closure_id, requested_business_date, operation_key, correlation_id) $$;

alter table finance.financial_period_closures owner to postgres;

do $$
begin
  execute 'alter function finance.require_financial_reports_permission(text, boolean) owner to postgres';
  execute 'alter function finance.guard_financial_period_closure_mutation() owner to postgres';
  execute 'alter function finance.report_csv_safe_cell(text) owner to postgres';
  execute 'alter function finance.report_page_size(integer) owner to postgres';
  execute 'alter function finance.report_offset(integer) owner to postgres';
  execute 'alter function finance.format_student_display_name(text) owner to postgres';
  execute 'alter function finance.get_financial_snapshot(uuid, date) owner to postgres';
  execute 'alter function finance.get_financial_period_summary(uuid, date) owner to postgres';
  execute 'alter function finance.report_charges(uuid, date, date, uuid, integer, uuid, uuid, finance.student_charge_status, date, integer, integer) owner to postgres';
  execute 'alter function finance.report_payments(date, date, uuid, finance.payment_method, finance.payment_status, uuid, uuid, integer, integer) owner to postgres';
  execute 'alter function finance.report_cash_operations(date, uuid, uuid, finance.cash_session_status, integer, integer) owner to postgres';
  execute 'alter function finance.report_financial_benefits(uuid, date, date, integer, integer) owner to postgres';
  execute 'alter function finance.report_payment_agreements(uuid, integer, integer, date) owner to postgres';
  execute 'alter function finance.report_debt_summary(uuid, integer, uuid, uuid, text, finance.collection_case_status, text, integer, integer, date) owner to postgres';
  execute 'alter function finance.list_financial_period_closures(integer, integer) owner to postgres';
  execute 'alter function finance.get_financial_period_close(uuid) owner to postgres';
  execute 'alter function finance.create_financial_period_close(uuid, date, text, uuid) owner to postgres';
  execute 'alter function finance.approve_financial_period_close(uuid, text, uuid) owner to postgres';
  execute 'alter function finance.supersede_financial_period_close(uuid, date, text, uuid) owner to postgres';
end;
$$;

alter table finance.financial_period_closures enable row level security;
revoke all on table finance.financial_period_closures from public, anon, authenticated;

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'finance.require_financial_reports_permission(text, boolean)',
    'finance.guard_financial_period_closure_mutation()',
    'finance.report_csv_safe_cell(text)',
    'finance.report_page_size(integer)',
    'finance.report_offset(integer)',
    'finance.format_student_display_name(text)',
    'finance.get_financial_snapshot(uuid, date)',
    'finance.get_financial_period_summary(uuid, date)',
    'finance.report_charges(uuid, date, date, uuid, integer, uuid, uuid, finance.student_charge_status, date, integer, integer)',
    'finance.report_payments(date, date, uuid, finance.payment_method, finance.payment_status, uuid, uuid, integer, integer)',
    'finance.report_cash_operations(date, uuid, uuid, finance.cash_session_status, integer, integer)',
    'finance.report_financial_benefits(uuid, date, date, integer, integer)',
    'finance.report_payment_agreements(uuid, integer, integer, date)',
    'finance.report_debt_summary(uuid, integer, uuid, uuid, text, finance.collection_case_status, text, integer, integer, date)',
    'finance.list_financial_period_closures(integer, integer)',
    'finance.get_financial_period_close(uuid)',
    'finance.create_financial_period_close(uuid, date, text, uuid)',
    'finance.approve_financial_period_close(uuid, text, uuid)',
    'finance.supersede_financial_period_close(uuid, date, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', signature);
  end loop;
end;
$$;

grant execute on function public.get_financial_period_summary(uuid, date) to authenticated;
grant execute on function public.report_charges(uuid, date, date, uuid, integer, uuid, uuid, finance.student_charge_status, date, integer, integer) to authenticated;
grant execute on function public.report_payments(date, date, uuid, finance.payment_method, finance.payment_status, uuid, uuid, integer, integer) to authenticated;
grant execute on function public.report_debt_summary(uuid, integer, uuid, uuid, text, finance.collection_case_status, text, integer, integer, date) to authenticated;
grant execute on function public.report_cash_operations(date, uuid, uuid, finance.cash_session_status, integer, integer) to authenticated;
grant execute on function public.report_financial_benefits(uuid, date, date, integer, integer) to authenticated;
grant execute on function public.report_payment_agreements(uuid, integer, integer, date) to authenticated;
grant execute on function public.list_financial_period_closures(integer, integer) to authenticated;
grant execute on function public.get_financial_period_close(uuid) to authenticated;
grant execute on function public.create_financial_period_close(uuid, date, text, uuid) to authenticated;
grant execute on function public.approve_financial_period_close(uuid, text, uuid) to authenticated;
grant execute on function public.supersede_financial_period_close(uuid, date, text, uuid) to authenticated;

commit;
