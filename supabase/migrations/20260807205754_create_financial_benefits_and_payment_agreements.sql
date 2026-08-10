begin;

create type finance.scholarship_program_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED'
);

create type finance.scholarship_benefit_type as enum (
  'PERCENTAGE',
  'FIXED_AMOUNT'
);

create type finance.student_scholarship_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'REVOKED'
);

create type finance.student_scholarship_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'AUTHORIZED_DISCOUNT',
  'AUTHORIZED_WAIVER',
  'OTHER'
);

create type finance.payment_agreement_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'DEFAULTED'
);

create type finance.payment_agreement_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'OVERDUE_BALANCE',
  'AUTHORIZED_RESTRUCTURE',
  'OTHER'
);

create type finance.payment_agreement_installment_status as enum (
  'PENDING',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'PAST_DUE',
  'CANCELLED'
);

do $$
begin
  alter type finance.financial_command_type add value if not exists 'CREATE_SCHOLARSHIP_PROGRAM';
  alter type finance.financial_command_type add value if not exists 'SUBMIT_SCHOLARSHIP_PROGRAM';
  alter type finance.financial_command_type add value if not exists 'APPROVE_SCHOLARSHIP_PROGRAM';
  alter type finance.financial_command_type add value if not exists 'ACTIVATE_SCHOLARSHIP_PROGRAM';
  alter type finance.financial_command_type add value if not exists 'ASSIGN_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'SUBMIT_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'APPROVE_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'ACTIVATE_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'REVOKE_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'APPLY_STUDENT_SCHOLARSHIP';
  alter type finance.financial_command_type add value if not exists 'APPLY_AUTHORIZED_DISCOUNT';
  alter type finance.financial_command_type add value if not exists 'CREATE_AUTHORIZED_WAIVER';
  alter type finance.financial_command_type add value if not exists 'APPROVE_AUTHORIZED_WAIVER';
  alter type finance.financial_command_type add value if not exists 'APPLY_AUTHORIZED_WAIVER';
  alter type finance.financial_command_type add value if not exists 'REVERSE_FINANCIAL_BENEFIT';
  alter type finance.financial_command_type add value if not exists 'CREATE_PAYMENT_AGREEMENT';
  alter type finance.financial_command_type add value if not exists 'APPROVE_PAYMENT_AGREEMENT';
  alter type finance.financial_command_type add value if not exists 'CANCEL_PAYMENT_AGREEMENT';
  alter type finance.financial_command_type add value if not exists 'MARK_PAYMENT_AGREEMENT_DEFAULTED';
  alter type finance.financial_command_type add value if not exists 'RECONCILE_PAYMENT_AGREEMENT_INSTALLMENT';

  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_PROGRAM_CREATED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_PROGRAM_APPROVED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_ASSIGNED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_APPROVED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_ACTIVATED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_REVOKED';
  alter type finance.financial_event_type add value if not exists 'SCHOLARSHIP_APPLIED';
  alter type finance.financial_event_type add value if not exists 'DISCOUNT_APPLIED';
  alter type finance.financial_event_type add value if not exists 'WAIVER_CREATED';
  alter type finance.financial_event_type add value if not exists 'WAIVER_APPROVED';
  alter type finance.financial_event_type add value if not exists 'WAIVER_APPLIED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_BENEFIT_REVERSED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_CREATED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_APPROVED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_ACTIVATED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_RECONCILED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_CANCELLED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_DEFAULTED';
  alter type finance.financial_event_type add value if not exists 'PAYMENT_AGREEMENT_COMPLETED';
  alter type finance.financial_event_type add value if not exists 'FINANCIAL_BENEFIT_OPERATION_DENIED';
end;
$$;

create table finance.scholarship_programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status finance.scholarship_program_status not null default 'DRAFT',
  benefit_type finance.scholarship_benefit_type not null,
  percentage numeric,
  fixed_amount numeric(12,2),
  maximum_amount numeric(12,2),
  valid_from date,
  valid_until date,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (
      benefit_type = 'PERCENTAGE'
      and percentage is not null
      and percentage > 0
      and percentage <= 100
      and fixed_amount is null
    )
    or
    (
      benefit_type = 'FIXED_AMOUNT'
      and fixed_amount is not null
      and fixed_amount > 0
      and percentage is null
    )
  ),
  check (maximum_amount is null or maximum_amount > 0),
  check (valid_until is null or valid_from is null or valid_until >= valid_from)
);

create table finance.student_scholarships (
  id uuid primary key default gen_random_uuid(),
  scholarship_program_id uuid not null references finance.scholarship_programs(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  academic_period_id uuid references academic.academic_periods(id) on delete restrict,
  status finance.student_scholarship_status not null default 'DRAFT',
  authorized_percentage numeric,
  authorized_amount numeric(12,2),
  maximum_total_amount numeric(12,2),
  valid_from date not null,
  valid_until date,
  reason_code finance.student_scholarship_reason_code not null default 'PENDING_INSTITUTIONAL_VALIDATION',
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (authorized_percentage is null or (authorized_percentage > 0 and authorized_percentage <= 100))
    and (authorized_amount is null or authorized_amount > 0)
    and (maximum_total_amount is null or maximum_total_amount > 0)
  ),
  check (valid_until is null or valid_until >= valid_from),
  check (not (authorized_percentage is not null and authorized_amount is not null))
);

create unique index student_scholarships_unique_active_assignment
  on finance.student_scholarships(student_record_id, scholarship_program_id, coalesce(academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('UNDER_REVIEW', 'APPROVED', 'ACTIVE');

create table finance.scholarship_applications (
  id uuid primary key default gen_random_uuid(),
  student_scholarship_id uuid not null references finance.student_scholarships(id) on delete restrict,
  charge_id uuid not null references finance.student_charges(id) on delete restrict,
  charge_adjustment_id uuid not null unique references finance.charge_adjustments(id) on delete restrict,
  benefit_amount numeric(12,2) not null check (benefit_amount > 0),
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (student_scholarship_id, charge_id)
);

create table finance.payment_agreements (
  id uuid primary key default gen_random_uuid(),
  student_account_id uuid not null references finance.student_accounts(id) on delete restrict,
  collection_case_id uuid references finance.collection_cases(id) on delete restrict,
  status finance.payment_agreement_status not null default 'DRAFT',
  original_outstanding_snapshot numeric(12,2) not null check (original_outstanding_snapshot >= 0),
  agreed_amount numeric(12,2) not null check (agreed_amount > 0),
  installment_count integer not null check (installment_count > 0),
  start_date date not null,
  reason_code finance.payment_agreement_reason_code not null default 'PENDING_INSTITUTIONAL_VALIDATION',
  notes text,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  activated_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create table finance.payment_agreement_installments (
  id uuid primary key default gen_random_uuid(),
  payment_agreement_id uuid not null references finance.payment_agreements(id) on delete restrict,
  installment_number integer not null check (installment_number > 0),
  scheduled_amount numeric(12,2) not null check (scheduled_amount > 0),
  due_date date not null,
  status finance.payment_agreement_installment_status not null default 'PENDING',
  fulfilled_amount numeric(12,2) not null default 0 check (fulfilled_amount >= 0),
  fulfilled_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (payment_agreement_id, installment_number)
);

create table finance.payment_agreement_allocations (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references finance.payment_agreement_installments(id) on delete restrict,
  payment_allocation_id uuid not null references finance.payment_allocations(id) on delete restrict,
  amount_applied_to_installment numeric(12,2) not null check (amount_applied_to_installment > 0),
  created_at timestamptz not null default statement_timestamp(),
  unique (installment_id, payment_allocation_id)
);

create function finance.require_financial_benefit_permission(permission_code text)
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
    allowed := permission_code in (
      'finance.scholarships.programs.manage',
      'finance.scholarships.assign',
      'finance.scholarships.approve',
      'finance.scholarships.apply',
      'finance.discounts.apply',
      'finance.waivers.create',
      'finance.waivers.approve',
      'finance.payment-agreements.create',
      'finance.payment-agreements.approve',
      'finance.payment-agreements.manage',
      'finance.payment-agreements.read'
    );
  elsif role_codes && array['ADMINISTRATIVO']::text[] then
    allowed := permission_code in (
      'finance.scholarships.programs.manage',
      'finance.scholarships.assign',
      'finance.scholarships.approve',
      'finance.scholarships.apply',
      'finance.discounts.apply',
      'finance.waivers.create',
      'finance.waivers.approve',
      'finance.payment-agreements.create',
      'finance.payment-agreements.approve',
      'finance.payment-agreements.manage',
      'finance.payment-agreements.read'
    );
  elsif role_codes && array['CONTROL_ESCOLAR']::text[] then
    allowed := permission_code in ('finance.payment-agreements.read');
  end if;

  if not allowed then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  return actor.id;
end;
$$;

create function finance.calculate_scholarship_benefit(
  program_row finance.scholarship_programs,
  scholarship_row finance.student_scholarships,
  outstanding_amount numeric
)
returns numeric
language plpgsql
immutable
security definer
set search_path=''
as $$
declare
  resolved numeric;
  percentage_value numeric;
begin
  if outstanding_amount <= 0 then
    return 0;
  end if;

  if program_row.benefit_type = 'PERCENTAGE' then
    percentage_value := coalesce(scholarship_row.authorized_percentage, program_row.percentage);
    if percentage_value is null or percentage_value <= 0 or percentage_value > 100 then
      raise exception 'SCHOLARSHIP_PERCENTAGE_INVALID';
    end if;
    resolved := round((outstanding_amount * percentage_value) / 100.0, 2);
  else
    resolved := coalesce(scholarship_row.authorized_amount, program_row.fixed_amount);
    if resolved is null or resolved <= 0 then
      raise exception 'SCHOLARSHIP_AMOUNT_INVALID';
    end if;
  end if;

  resolved := least(
    outstanding_amount,
    resolved,
    coalesce(scholarship_row.maximum_total_amount, program_row.maximum_amount, resolved)
  );

  return resolved;
end;
$$;

create function finance.record_financial_benefit_denied(
  actor uuid,
  operation_key text,
  student_account_id uuid,
  charge_id uuid,
  details jsonb,
  correlation uuid default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  perform finance.append_financial_event(
    'FINANCIAL_BENEFIT_OPERATION_DENIED',
    actor,
    operation_key,
    student_account_id,
    charge_id,
    null,
    null,
    null,
    details,
    correlation
  );
end;
$$;

create function finance.reverse_financial_benefit(
  target_adjustment_id uuid,
  requested_reason_code finance.charge_adjustment_reason_code,
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
  adjustment_row finance.charge_adjustments%rowtype;
  charge_row finance.student_charges%rowtype;
  created uuid;
begin
  actor := finance.require_financial_benefit_permission('finance.waivers.approve');
  prior := finance.begin_financial_command(
    actor,
    'REVERSE_FINANCIAL_BENEFIT',
    operation_key,
    jsonb_build_object('adjustment', target_adjustment_id, 'reason', requested_reason_code, 'description', requested_description)
  );
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;

  select * into adjustment_row from finance.charge_adjustments where id = target_adjustment_id for update;
  if adjustment_row.id is null or adjustment_row.status <> 'APPLIED' then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  if adjustment_row.adjustment_type not in ('DISCOUNT', 'WAIVER', 'CREDIT_ADJUSTMENT') then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  if adjustment_row.reversed_by_adjustment_id is not null then
    raise exception 'ADJUSTMENT_ALREADY_REVERSED';
  end if;

  select * into charge_row from finance.student_charges where id = adjustment_row.student_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;

  insert into finance.charge_adjustments(
    student_charge_id,
    adjustment_type,
    amount,
    reason_code,
    description,
    status,
    effective_at,
    created_by_account_id,
    approved_by_account_id,
    approved_at,
    idempotency_key,
    request_fingerprint
  ) values (
    charge_row.id,
    'DEBIT_ADJUSTMENT',
    adjustment_row.amount,
    requested_reason_code,
    requested_description,
    'APPLIED',
    statement_timestamp(),
    actor,
    actor,
    statement_timestamp(),
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('adjustment', target_adjustment_id, 'reason', requested_reason_code, 'description', requested_description, 'reversal', true))
  ) returning id into created;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_adjustments
  set reversed_by_adjustment_id = created,
      status = 'REVERSED'
  where id = target_adjustment_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.recompute_charge_status(charge_row.id);
  perform finance.append_financial_event('FINANCIAL_BENEFIT_REVERSED', actor, operation_key, charge_row.student_account_id, charge_row.id, created, null, null, jsonb_build_object('reversedAdjustmentId', target_adjustment_id, 'reversalAdjustmentId', created), correlation);
  perform finance.complete_financial_command(actor, 'REVERSE_FINANCIAL_BENEFIT', operation_key, 'CHARGE_ADJUSTMENT', created);
  return query select created, 'APPLIED';
end;
$$;

create function finance.create_scholarship_program(
  requested_code text,
  requested_name text,
  requested_benefit_type finance.scholarship_benefit_type,
  requested_percentage numeric default null,
  requested_fixed_amount numeric default null,
  requested_maximum_amount numeric default null,
  requested_valid_from date default null,
  requested_valid_until date default null,
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
  created uuid;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.programs.manage');
  prior := finance.begin_financial_command(
    actor,
    'CREATE_SCHOLARSHIP_PROGRAM',
    operation_key,
    jsonb_build_object('code', requested_code, 'name', requested_name, 'benefitType', requested_benefit_type)
  );
  if prior is not null then
    return query select prior, (select programs.status::text from finance.scholarship_programs programs where programs.id = prior);
    return;
  end if;

  insert into finance.scholarship_programs(
    code, name, status, benefit_type, percentage, fixed_amount, maximum_amount,
    valid_from, valid_until, created_by_account_id
  ) values (
    requested_code, requested_name, 'DRAFT', requested_benefit_type, requested_percentage, requested_fixed_amount, requested_maximum_amount,
    requested_valid_from, requested_valid_until, actor
  ) returning id into created;

  perform finance.append_financial_event('SCHOLARSHIP_PROGRAM_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('scholarshipProgramId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_SCHOLARSHIP_PROGRAM', operation_key, 'SCHOLARSHIP_PROGRAM', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.submit_scholarship_program(
  target_program_id uuid,
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
  program_row finance.scholarship_programs%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.programs.manage');
  prior := finance.begin_financial_command(actor, 'SUBMIT_SCHOLARSHIP_PROGRAM', operation_key, jsonb_build_object('program', target_program_id));
  if prior is not null then
    return query select prior, (select programs.status::text from finance.scholarship_programs programs where programs.id = prior);
    return;
  end if;
  select * into program_row from finance.scholarship_programs where id = target_program_id for update;
  if program_row.id is null or program_row.status <> 'DRAFT' then
    raise exception 'SCHOLARSHIP_PROGRAM_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.scholarship_programs set status='UNDER_REVIEW' where id = target_program_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.complete_financial_command(actor, 'SUBMIT_SCHOLARSHIP_PROGRAM', operation_key, 'SCHOLARSHIP_PROGRAM', target_program_id);
  return query select target_program_id, 'UNDER_REVIEW';
end;
$$;

create function finance.approve_scholarship_program(
  target_program_id uuid,
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
  program_row finance.scholarship_programs%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_SCHOLARSHIP_PROGRAM', operation_key, jsonb_build_object('program', target_program_id));
  if prior is not null then
    return query select prior, (select programs.status::text from finance.scholarship_programs programs where programs.id = prior);
    return;
  end if;
  select * into program_row from finance.scholarship_programs where id = target_program_id for update;
  if program_row.id is null or program_row.status <> 'UNDER_REVIEW' then
    raise exception 'SCHOLARSHIP_PROGRAM_INVALID_STATE';
  end if;
  if program_row.created_by_account_id = actor then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.scholarship_programs
    set status='APPROVED', approved_by_account_id=actor, approved_at=statement_timestamp()
  where id = target_program_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('SCHOLARSHIP_PROGRAM_APPROVED', actor, operation_key, null, null, null, null, null, jsonb_build_object('scholarshipProgramId', target_program_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_SCHOLARSHIP_PROGRAM', operation_key, 'SCHOLARSHIP_PROGRAM', target_program_id);
  return query select target_program_id, 'APPROVED';
end;
$$;

create function finance.activate_scholarship_program(
  target_program_id uuid,
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
  program_row finance.scholarship_programs%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.approve');
  prior := finance.begin_financial_command(actor, 'ACTIVATE_SCHOLARSHIP_PROGRAM', operation_key, jsonb_build_object('program', target_program_id));
  if prior is not null then
    return query select prior, (select programs.status::text from finance.scholarship_programs programs where programs.id = prior);
    return;
  end if;
  select * into program_row from finance.scholarship_programs where id = target_program_id for update;
  if program_row.id is null or program_row.status not in ('APPROVED', 'SUSPENDED') then
    raise exception 'SCHOLARSHIP_PROGRAM_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.scholarship_programs set status='ACTIVE' where id = target_program_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.complete_financial_command(actor, 'ACTIVATE_SCHOLARSHIP_PROGRAM', operation_key, 'SCHOLARSHIP_PROGRAM', target_program_id);
  return query select target_program_id, 'ACTIVE';
end;
$$;

create function finance.assign_student_scholarship(
  target_program_id uuid,
  target_student_record_id uuid,
  target_student_account_id uuid,
  target_academic_period_id uuid default null,
  requested_authorized_percentage numeric default null,
  requested_authorized_amount numeric default null,
  requested_maximum_total_amount numeric default null,
  requested_valid_from date default current_date,
  requested_valid_until date default null,
  requested_reason_code finance.student_scholarship_reason_code default 'PENDING_INSTITUTIONAL_VALIDATION',
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
  created uuid;
  program_row finance.scholarship_programs%rowtype;
  account_row finance.student_accounts%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.assign');
  prior := finance.begin_financial_command(actor, 'ASSIGN_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('program', target_program_id, 'studentRecord', target_student_record_id, 'studentAccount', target_student_account_id, 'period', target_academic_period_id));
  if prior is not null then
    return query select prior, (select scholarships.status::text from finance.student_scholarships scholarships where scholarships.id = prior);
    return;
  end if;
  select * into program_row from finance.scholarship_programs where id = target_program_id;
  if program_row.id is null or program_row.status not in ('APPROVED', 'ACTIVE', 'SUSPENDED') then
    raise exception 'SCHOLARSHIP_PROGRAM_INVALID_STATE';
  end if;
  select * into account_row from finance.student_accounts where id = target_student_account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' or account_row.student_record_id <> target_student_record_id then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;

  insert into finance.student_scholarships(
    scholarship_program_id, student_record_id, student_account_id, academic_period_id, status,
    authorized_percentage, authorized_amount, maximum_total_amount,
    valid_from, valid_until, reason_code, created_by_account_id
  ) values (
    target_program_id, target_student_record_id, target_student_account_id, target_academic_period_id, 'DRAFT',
    requested_authorized_percentage, requested_authorized_amount, requested_maximum_total_amount,
    requested_valid_from, requested_valid_until, requested_reason_code, actor
  ) returning id into created;

  perform finance.append_financial_event('SCHOLARSHIP_ASSIGNED', actor, operation_key, target_student_account_id, null, null, null, null, jsonb_build_object('studentScholarshipId', created), correlation);
  perform finance.complete_financial_command(actor, 'ASSIGN_STUDENT_SCHOLARSHIP', operation_key, 'STUDENT_SCHOLARSHIP', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.submit_student_scholarship(
  target_student_scholarship_id uuid,
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
  scholarship_row finance.student_scholarships%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.assign');
  prior := finance.begin_financial_command(actor, 'SUBMIT_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('scholarship', target_student_scholarship_id));
  if prior is not null then
    return query select prior, (select scholarships.status::text from finance.student_scholarships scholarships where scholarships.id = prior);
    return;
  end if;
  select * into scholarship_row from finance.student_scholarships where id = target_student_scholarship_id for update;
  if scholarship_row.id is null or scholarship_row.status <> 'DRAFT' then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_scholarships set status='UNDER_REVIEW' where id = target_student_scholarship_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.complete_financial_command(actor, 'SUBMIT_STUDENT_SCHOLARSHIP', operation_key, 'STUDENT_SCHOLARSHIP', target_student_scholarship_id);
  return query select target_student_scholarship_id, 'UNDER_REVIEW';
end;
$$;

create function finance.approve_student_scholarship(
  target_student_scholarship_id uuid,
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
  scholarship_row finance.student_scholarships%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('scholarship', target_student_scholarship_id));
  if prior is not null then
    return query select prior, (select scholarships.status::text from finance.student_scholarships scholarships where scholarships.id = prior);
    return;
  end if;
  select * into scholarship_row from finance.student_scholarships where id = target_student_scholarship_id for update;
  if scholarship_row.id is null or scholarship_row.status <> 'UNDER_REVIEW' then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;
  if scholarship_row.created_by_account_id = actor then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_scholarships
    set status='APPROVED', approved_by_account_id=actor, approved_at=statement_timestamp()
  where id = target_student_scholarship_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('SCHOLARSHIP_APPROVED', actor, operation_key, scholarship_row.student_account_id, null, null, null, null, jsonb_build_object('studentScholarshipId', target_student_scholarship_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_STUDENT_SCHOLARSHIP', operation_key, 'STUDENT_SCHOLARSHIP', target_student_scholarship_id);
  return query select target_student_scholarship_id, 'APPROVED';
end;
$$;

create function finance.activate_student_scholarship(
  target_student_scholarship_id uuid,
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
  scholarship_row finance.student_scholarships%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.approve');
  prior := finance.begin_financial_command(actor, 'ACTIVATE_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('scholarship', target_student_scholarship_id));
  if prior is not null then
    return query select prior, (select scholarships.status::text from finance.student_scholarships scholarships where scholarships.id = prior);
    return;
  end if;
  select * into scholarship_row from finance.student_scholarships where id = target_student_scholarship_id for update;
  if scholarship_row.id is null or scholarship_row.status not in ('APPROVED', 'SUSPENDED') then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_scholarships
    set status='ACTIVE', activated_at=coalesce(activated_at, statement_timestamp())
  where id = target_student_scholarship_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('SCHOLARSHIP_ACTIVATED', actor, operation_key, scholarship_row.student_account_id, null, null, null, null, jsonb_build_object('studentScholarshipId', target_student_scholarship_id), correlation);
  perform finance.complete_financial_command(actor, 'ACTIVATE_STUDENT_SCHOLARSHIP', operation_key, 'STUDENT_SCHOLARSHIP', target_student_scholarship_id);
  return query select target_student_scholarship_id, 'ACTIVE';
end;
$$;

create function finance.revoke_student_scholarship(
  target_student_scholarship_id uuid,
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
  scholarship_row finance.student_scholarships%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.approve');
  prior := finance.begin_financial_command(actor, 'REVOKE_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('scholarship', target_student_scholarship_id));
  if prior is not null then
    return query select prior, (select scholarships.status::text from finance.student_scholarships scholarships where scholarships.id = prior);
    return;
  end if;
  select * into scholarship_row from finance.student_scholarships where id = target_student_scholarship_id for update;
  if scholarship_row.id is null or scholarship_row.status not in ('ACTIVE', 'APPROVED', 'SUSPENDED') then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.student_scholarships
    set status='REVOKED', revoked_at=statement_timestamp()
  where id = target_student_scholarship_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('SCHOLARSHIP_REVOKED', actor, operation_key, scholarship_row.student_account_id, null, null, null, null, jsonb_build_object('studentScholarshipId', target_student_scholarship_id), correlation);
  perform finance.complete_financial_command(actor, 'REVOKE_STUDENT_SCHOLARSHIP', operation_key, 'STUDENT_SCHOLARSHIP', target_student_scholarship_id);
  return query select target_student_scholarship_id, 'REVOKED';
end;
$$;

create function finance.apply_student_scholarship(
  target_student_scholarship_id uuid,
  target_charge_id uuid,
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
  scholarship_row finance.student_scholarships%rowtype;
  program_row finance.scholarship_programs%rowtype;
  charge_row finance.student_charges%rowtype;
  outstanding_amount numeric(12,2);
  benefit_amount numeric(12,2);
  created_adjustment uuid;
begin
  actor := finance.require_financial_benefit_permission('finance.scholarships.apply');
  prior := finance.begin_financial_command(actor, 'APPLY_STUDENT_SCHOLARSHIP', operation_key, jsonb_build_object('scholarship', target_student_scholarship_id, 'charge', target_charge_id));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;

  select * into scholarship_row from finance.student_scholarships where id = target_student_scholarship_id for update;
  if scholarship_row.id is null or scholarship_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;
  if scholarship_row.valid_until is not null and scholarship_row.valid_until < current_date then
    raise exception 'STUDENT_SCHOLARSHIP_INVALID_STATE';
  end if;

  select * into program_row from finance.scholarship_programs where id = scholarship_row.scholarship_program_id for update;
  if program_row.id is null or program_row.status <> 'ACTIVE' then
    raise exception 'SCHOLARSHIP_PROGRAM_INVALID_STATE';
  end if;

  select * into charge_row from finance.student_charges where id = target_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if charge_row.student_account_id <> scholarship_row.student_account_id then
    raise exception 'FINANCE_ACCESS_DENIED';
  end if;
  if scholarship_row.academic_period_id is not null and charge_row.academic_period_id is distinct from scholarship_row.academic_period_id then
    raise exception 'SCHOLARSHIP_PERIOD_NOT_ALLOWED';
  end if;

  if exists (
    select 1 from finance.scholarship_applications
    where student_scholarship_id = scholarship_row.id and charge_id = charge_row.id
  ) then
    raise exception 'SCHOLARSHIP_ALREADY_APPLIED';
  end if;

  outstanding_amount := finance.get_charge_balance(charge_row.id);
  if outstanding_amount <= 0 then
    perform finance.record_financial_benefit_denied(actor, operation_key, charge_row.student_account_id, charge_row.id, jsonb_build_object('errorCode', 'ADJUSTMENT_EXCEEDS_BALANCE', 'operation', 'APPLY_STUDENT_SCHOLARSHIP'), correlation);
    raise exception 'ADJUSTMENT_EXCEEDS_BALANCE';
  end if;

  benefit_amount := finance.calculate_scholarship_benefit(program_row, scholarship_row, outstanding_amount);
  if benefit_amount <= 0 then
    raise exception 'ADJUSTMENT_EXCEEDS_BALANCE';
  end if;

  insert into finance.charge_adjustments(
    student_charge_id, adjustment_type, amount, reason_code, description, status,
    effective_at, created_by_account_id, approved_by_account_id, approved_at, idempotency_key, request_fingerprint
  ) values (
    charge_row.id,
    'DISCOUNT',
    benefit_amount,
    'PENDING_INSTITUTIONAL_VALIDATION',
    'Aplicación controlada de beca',
    'APPLIED',
    statement_timestamp(),
    actor,
    actor,
    statement_timestamp(),
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('studentScholarshipId', scholarship_row.id, 'chargeId', charge_row.id, 'benefitAmount', benefit_amount))
  ) returning id into created_adjustment;

  insert into finance.scholarship_applications(
    student_scholarship_id, charge_id, charge_adjustment_id, benefit_amount, created_by_account_id
  ) values (
    scholarship_row.id, charge_row.id, created_adjustment, benefit_amount, actor
  );

  perform finance.recompute_charge_status(charge_row.id);
  perform finance.append_financial_event('SCHOLARSHIP_APPLIED', actor, operation_key, charge_row.student_account_id, charge_row.id, created_adjustment, null, null, jsonb_build_object('studentScholarshipId', scholarship_row.id, 'benefitAmount', finance.format_money(benefit_amount)), correlation);
  perform finance.complete_financial_command(actor, 'APPLY_STUDENT_SCHOLARSHIP', operation_key, 'CHARGE_ADJUSTMENT', created_adjustment);
  return query select created_adjustment, 'APPLIED';
end;
$$;

create function finance.apply_authorized_discount(
  target_charge_id uuid,
  requested_amount numeric,
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
  created_adjustment uuid;
begin
  actor := finance.require_financial_benefit_permission('finance.discounts.apply');
  prior := finance.begin_financial_command(actor, 'APPLY_AUTHORIZED_DISCOUNT', operation_key, jsonb_build_object('charge', target_charge_id, 'amount', requested_amount, 'description', requested_description));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  if requested_amount <= 0 then
    raise exception 'CHARGE_AMOUNT_INVALID';
  end if;
  select * into charge_row from finance.student_charges where id = target_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if requested_amount > finance.get_charge_balance(target_charge_id) then
    perform finance.record_financial_benefit_denied(actor, operation_key, charge_row.student_account_id, charge_row.id, jsonb_build_object('errorCode', 'ADJUSTMENT_EXCEEDS_BALANCE', 'operation', 'APPLY_AUTHORIZED_DISCOUNT'), correlation);
    raise exception 'ADJUSTMENT_EXCEEDS_BALANCE';
  end if;

  insert into finance.charge_adjustments(
    student_charge_id, adjustment_type, amount, reason_code, description, status,
    effective_at, created_by_account_id, approved_by_account_id, approved_at, idempotency_key, request_fingerprint
  ) values (
    target_charge_id,
    'DISCOUNT',
    requested_amount,
    'AUTHORIZED_DISCOUNT',
    requested_description,
    'APPLIED',
    statement_timestamp(),
    actor,
    actor,
    statement_timestamp(),
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('charge', target_charge_id, 'amount', requested_amount, 'description', requested_description, 'authorizedDiscount', true))
  ) returning id into created_adjustment;

  perform finance.recompute_charge_status(target_charge_id);
  perform finance.append_financial_event('DISCOUNT_APPLIED', actor, operation_key, charge_row.student_account_id, charge_row.id, created_adjustment, null, null, jsonb_build_object('adjustmentId', created_adjustment), correlation);
  perform finance.complete_financial_command(actor, 'APPLY_AUTHORIZED_DISCOUNT', operation_key, 'CHARGE_ADJUSTMENT', created_adjustment);
  return query select created_adjustment, 'APPLIED';
end;
$$;

create function finance.create_authorized_waiver(
  target_charge_id uuid,
  requested_amount numeric,
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
  created_adjustment uuid;
begin
  actor := finance.require_financial_benefit_permission('finance.waivers.create');
  prior := finance.begin_financial_command(actor, 'CREATE_AUTHORIZED_WAIVER', operation_key, jsonb_build_object('charge', target_charge_id, 'amount', requested_amount, 'description', requested_description));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  if requested_amount <= 0 then
    raise exception 'CHARGE_AMOUNT_INVALID';
  end if;
  select * into charge_row from finance.student_charges where id = target_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  insert into finance.charge_adjustments(
    student_charge_id, adjustment_type, amount, reason_code, description, status,
    created_by_account_id, idempotency_key, request_fingerprint
  ) values (
    target_charge_id,
    'WAIVER',
    requested_amount,
    'AUTHORIZED_WAIVER',
    requested_description,
    'DRAFT',
    actor,
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('charge', target_charge_id, 'amount', requested_amount, 'description', requested_description, 'authorizedWaiver', true))
  ) returning id into created_adjustment;
  perform finance.append_financial_event('WAIVER_CREATED', actor, operation_key, charge_row.student_account_id, charge_row.id, created_adjustment, null, null, jsonb_build_object('adjustmentId', created_adjustment), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_AUTHORIZED_WAIVER', operation_key, 'CHARGE_ADJUSTMENT', created_adjustment);
  return query select created_adjustment, 'DRAFT';
end;
$$;

create function finance.approve_authorized_waiver(
  target_adjustment_id uuid,
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
  adjustment_row finance.charge_adjustments%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.waivers.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_AUTHORIZED_WAIVER', operation_key, jsonb_build_object('adjustment', target_adjustment_id));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  select * into adjustment_row from finance.charge_adjustments where id = target_adjustment_id for update;
  if adjustment_row.id is null or adjustment_row.status <> 'DRAFT' or adjustment_row.adjustment_type <> 'WAIVER' then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  if adjustment_row.created_by_account_id = actor then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_adjustments
  set status='APPROVED', approved_by_account_id=actor, approved_at=statement_timestamp()
  where id = target_adjustment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('WAIVER_APPROVED', actor, operation_key, null, adjustment_row.student_charge_id, target_adjustment_id, null, null, jsonb_build_object('adjustmentId', target_adjustment_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_AUTHORIZED_WAIVER', operation_key, 'CHARGE_ADJUSTMENT', target_adjustment_id);
  return query select target_adjustment_id, 'APPROVED';
end;
$$;

create function finance.apply_authorized_waiver(
  target_adjustment_id uuid,
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
  adjustment_row finance.charge_adjustments%rowtype;
  charge_row finance.student_charges%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.waivers.approve');
  prior := finance.begin_financial_command(actor, 'APPLY_AUTHORIZED_WAIVER', operation_key, jsonb_build_object('adjustment', target_adjustment_id));
  if prior is not null then
    return query select prior, (select adjustments.status::text from finance.charge_adjustments adjustments where adjustments.id = prior);
    return;
  end if;
  select * into adjustment_row from finance.charge_adjustments where id = target_adjustment_id for update;
  if adjustment_row.id is null or adjustment_row.status <> 'APPROVED' or adjustment_row.adjustment_type <> 'WAIVER' then
    raise exception 'ADJUSTMENT_INVALID_STATE';
  end if;
  select * into charge_row from finance.student_charges where id = adjustment_row.student_charge_id for update;
  if charge_row.id is null or charge_row.status in ('CANCELLED', 'REVERSED') then
    raise exception 'CHARGE_INVALID_STATE';
  end if;
  if adjustment_row.amount > finance.get_charge_balance(charge_row.id) then
    perform finance.record_financial_benefit_denied(actor, operation_key, charge_row.student_account_id, charge_row.id, jsonb_build_object('errorCode', 'ADJUSTMENT_EXCEEDS_BALANCE', 'operation', 'APPLY_AUTHORIZED_WAIVER'), correlation);
    raise exception 'ADJUSTMENT_EXCEEDS_BALANCE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_adjustments
  set status='APPLIED', effective_at=statement_timestamp()
  where id = target_adjustment_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.recompute_charge_status(charge_row.id);
  perform finance.append_financial_event('WAIVER_APPLIED', actor, operation_key, charge_row.student_account_id, charge_row.id, target_adjustment_id, null, null, jsonb_build_object('adjustmentId', target_adjustment_id), correlation);
  perform finance.complete_financial_command(actor, 'APPLY_AUTHORIZED_WAIVER', operation_key, 'CHARGE_ADJUSTMENT', target_adjustment_id);
  return query select target_adjustment_id, 'APPLIED';
end;
$$;

create function finance.create_payment_agreement(
  target_student_account_id uuid,
  target_collection_case_id uuid,
  requested_agreed_amount numeric,
  requested_installment_count integer,
  requested_start_date date,
  requested_reason_code finance.payment_agreement_reason_code,
  requested_installment_dates date[],
  requested_installment_amounts numeric[],
  requested_notes text,
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
  current_outstanding numeric(12,2);
  created uuid;
  total_scheduled numeric(12,2);
  idx integer;
begin
  actor := finance.require_financial_benefit_permission('finance.payment-agreements.create');
  prior := finance.begin_financial_command(actor, 'CREATE_PAYMENT_AGREEMENT', operation_key, jsonb_build_object('studentAccount', target_student_account_id, 'amount', requested_agreed_amount, 'installmentCount', requested_installment_count, 'startDate', requested_start_date));
  if prior is not null then
    return query select prior, (select agreements.status::text from finance.payment_agreements agreements where agreements.id = prior);
    return;
  end if;
  if requested_agreed_amount <= 0 or requested_installment_count <= 0 then
    raise exception 'PAYMENT_AGREEMENT_INVALID';
  end if;
  if coalesce(array_length(requested_installment_dates, 1), 0) <> requested_installment_count
     or coalesce(array_length(requested_installment_amounts, 1), 0) <> requested_installment_count then
    raise exception 'PAYMENT_AGREEMENT_INVALID';
  end if;
  select * into account_row from finance.student_accounts where id = target_student_account_id for update;
  if account_row.id is null or account_row.status <> 'ACTIVE' then
    raise exception 'STUDENT_ACCOUNT_NOT_ACTIVE';
  end if;
  select coalesce(sum(finance.get_charge_balance(charges.id)), 0)::numeric(12,2)
    into current_outstanding
  from finance.student_charges charges
  where charges.student_account_id = target_student_account_id
    and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID');
  if current_outstanding <= 0 then
    raise exception 'PAYMENT_AGREEMENT_INVALID';
  end if;
  if requested_agreed_amount > current_outstanding then
    raise exception 'PAYMENT_AGREEMENT_INVALID';
  end if;
  select coalesce(sum(amount), 0)::numeric(12,2) into total_scheduled
  from unnest(requested_installment_amounts) as amount;
  if round(total_scheduled, 2) <> round(requested_agreed_amount, 2) then
    raise exception 'PAYMENT_AGREEMENT_INVALID';
  end if;

  insert into finance.payment_agreements(
    student_account_id, collection_case_id, status, original_outstanding_snapshot, agreed_amount, installment_count,
    start_date, reason_code, notes, created_by_account_id
  ) values (
    target_student_account_id, target_collection_case_id, 'DRAFT', current_outstanding, requested_agreed_amount, requested_installment_count,
    requested_start_date, requested_reason_code, requested_notes, actor
  ) returning id into created;

  for idx in 1..requested_installment_count loop
    insert into finance.payment_agreement_installments(
      payment_agreement_id, installment_number, scheduled_amount, due_date, status
    ) values (
      created, idx, requested_installment_amounts[idx], requested_installment_dates[idx], 'PENDING'
    );
  end loop;

  perform finance.append_financial_event('PAYMENT_AGREEMENT_CREATED', actor, operation_key, target_student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', created, 'collectionCaseId', target_collection_case_id), correlation);
  if target_collection_case_id is not null then
    perform finance.append_financial_event('COLLECTION_ACTION_CREATED', actor, operation_key || ':collection', target_student_account_id, null, null, null, null, jsonb_build_object('collectionCaseId', target_collection_case_id, 'actionType', 'PAYMENT_AGREEMENT_CREATED'), correlation);
  end if;
  perform finance.complete_financial_command(actor, 'CREATE_PAYMENT_AGREEMENT', operation_key, 'PAYMENT_AGREEMENT', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.approve_payment_agreement(
  target_payment_agreement_id uuid,
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
  agreement_row finance.payment_agreements%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.payment-agreements.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_PAYMENT_AGREEMENT', operation_key, jsonb_build_object('agreement', target_payment_agreement_id));
  if prior is not null then
    return query select prior, (select agreements.status::text from finance.payment_agreements agreements where agreements.id = prior);
    return;
  end if;
  select * into agreement_row from finance.payment_agreements where id = target_payment_agreement_id for update;
  if agreement_row.id is null or agreement_row.status <> 'DRAFT' then
    raise exception 'PAYMENT_AGREEMENT_INVALID_STATE';
  end if;
  if agreement_row.created_by_account_id = actor then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_agreements
  set status='ACTIVE',
      approved_by_account_id=actor,
      approved_at=statement_timestamp(),
      activated_at=statement_timestamp()
  where id = target_payment_agreement_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('PAYMENT_AGREEMENT_APPROVED', actor, operation_key, agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', target_payment_agreement_id), correlation);
  perform finance.append_financial_event('PAYMENT_AGREEMENT_ACTIVATED', actor, operation_key || ':active', agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', target_payment_agreement_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_PAYMENT_AGREEMENT', operation_key, 'PAYMENT_AGREEMENT', target_payment_agreement_id);
  return query select target_payment_agreement_id, 'ACTIVE';
end;
$$;

create function finance.evaluate_payment_agreement(
  target_payment_agreement_id uuid,
  evaluation_date date default current_date
)
returns table(
  total_scheduled text,
  total_fulfilled text,
  remaining_agreement_amount text,
  next_installment_date date,
  installments_due integer,
  installments_past_due integer,
  evaluation_status text
)
language sql
security definer
set search_path=''
as $$
  with installment_summary as (
    select
      installments.payment_agreement_id,
      coalesce(sum(installments.scheduled_amount), 0)::numeric(12,2) as total_scheduled_value,
      coalesce(sum(least(installments.fulfilled_amount, installments.scheduled_amount)), 0)::numeric(12,2) as total_fulfilled_value,
      count(*) filter (where installments.due_date <= evaluation_date and installments.status <> 'FULFILLED')::integer as due_count,
      count(*) filter (where installments.due_date < evaluation_date and installments.status <> 'FULFILLED')::integer as past_due_count,
      min(installments.due_date) filter (where installments.status <> 'FULFILLED' and installments.status <> 'CANCELLED') as next_due_date
    from finance.payment_agreement_installments installments
    where installments.payment_agreement_id = target_payment_agreement_id
    group by installments.payment_agreement_id
  )
  select
    finance.format_money(summary.total_scheduled_value),
    finance.format_money(summary.total_fulfilled_value),
    finance.format_money(greatest(agreement.agreed_amount - summary.total_fulfilled_value, 0)),
    summary.next_due_date,
    summary.due_count,
    summary.past_due_count,
    case
      when agreement.status = 'COMPLETED' or summary.total_fulfilled_value >= agreement.agreed_amount then 'COMPLETED'
      when summary.past_due_count > 0 then 'PAST_DUE'
      when summary.due_count > 0 then 'DUE'
      else 'ON_TRACK'
    end
  from finance.payment_agreements agreement
  join installment_summary summary on summary.payment_agreement_id = agreement.id
  where agreement.id = target_payment_agreement_id
$$;

create function finance.reconcile_payment_agreement_installment(
  target_installment_id uuid,
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
  installment_row finance.payment_agreement_installments%rowtype;
  agreement_row finance.payment_agreements%rowtype;
  allocated_amount numeric(12,2);
  new_status finance.payment_agreement_installment_status;
  total_fulfilled numeric(12,2);
begin
  actor := finance.require_financial_benefit_permission('finance.payment-agreements.manage');
  prior := finance.begin_financial_command(actor, 'RECONCILE_PAYMENT_AGREEMENT_INSTALLMENT', operation_key, jsonb_build_object('installment', target_installment_id));
  if prior is not null then
    return query select prior, (select installments.status::text from finance.payment_agreement_installments installments where installments.id = prior);
    return;
  end if;
  select * into installment_row from finance.payment_agreement_installments where id = target_installment_id for update;
  if installment_row.id is null then
    raise exception 'PAYMENT_AGREEMENT_INSTALLMENT_NOT_FOUND';
  end if;
  select * into agreement_row from finance.payment_agreements where id = installment_row.payment_agreement_id for update;
  if agreement_row.id is null or agreement_row.status not in ('ACTIVE', 'APPROVED', 'COMPLETED', 'DEFAULTED') then
    raise exception 'PAYMENT_AGREEMENT_INVALID_STATE';
  end if;

  select coalesce(sum(paa.amount_applied_to_installment), 0)::numeric(12,2)
    into allocated_amount
  from finance.payment_agreement_allocations paa
  join finance.payment_allocations allocations on allocations.id = paa.payment_allocation_id
  join finance.payments payments on payments.id = allocations.payment_id
  where paa.installment_id = target_installment_id
    and allocations.status = 'APPLIED'
    and payments.status in ('CONFIRMED', 'PARTIALLY_APPLIED', 'APPLIED');

  if allocated_amount >= installment_row.scheduled_amount then
    new_status := 'FULFILLED';
  elsif allocated_amount > 0 then
    new_status := 'PARTIALLY_FULFILLED';
  elsif installment_row.due_date < current_date then
    new_status := 'PAST_DUE';
  else
    new_status := 'PENDING';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_agreement_installments
  set fulfilled_amount = allocated_amount,
      fulfilled_at = case when allocated_amount >= installment_row.scheduled_amount then statement_timestamp() else null end,
      status = new_status
  where id = target_installment_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  select coalesce(sum(least(fulfilled_amount, scheduled_amount)), 0)::numeric(12,2)
    into total_fulfilled
  from finance.payment_agreement_installments
  where payment_agreement_id = agreement_row.id;

  if total_fulfilled >= agreement_row.agreed_amount and agreement_row.status <> 'COMPLETED' then
    perform set_config('finance.controlled_mutation', 'on', true);
    update finance.payment_agreements
      set status='COMPLETED', completed_at=statement_timestamp()
    where id = agreement_row.id;
    perform set_config('finance.controlled_mutation', 'off', true);
    perform finance.append_financial_event('PAYMENT_AGREEMENT_COMPLETED', actor, operation_key || ':completed', agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', agreement_row.id), correlation);
  end if;

  perform finance.append_financial_event('PAYMENT_AGREEMENT_RECONCILED', actor, operation_key, agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', agreement_row.id, 'installmentId', target_installment_id, 'fulfilledAmount', finance.format_money(allocated_amount)), correlation);
  perform finance.complete_financial_command(actor, 'RECONCILE_PAYMENT_AGREEMENT_INSTALLMENT', operation_key, 'PAYMENT_AGREEMENT_INSTALLMENT', target_installment_id);
  return query select target_installment_id, new_status::text;
end;
$$;

create function finance.cancel_payment_agreement(
  target_payment_agreement_id uuid,
  requested_reason text,
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
  agreement_row finance.payment_agreements%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.payment-agreements.manage');
  prior := finance.begin_financial_command(actor, 'CANCEL_PAYMENT_AGREEMENT', operation_key, jsonb_build_object('agreement', target_payment_agreement_id, 'reason', requested_reason));
  if prior is not null then
    return query select prior, (select agreements.status::text from finance.payment_agreements agreements where agreements.id = prior);
    return;
  end if;
  select * into agreement_row from finance.payment_agreements where id = target_payment_agreement_id for update;
  if agreement_row.id is null or agreement_row.status not in ('DRAFT', 'APPROVED', 'ACTIVE', 'UNDER_REVIEW', 'DEFAULTED') then
    raise exception 'PAYMENT_AGREEMENT_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_agreements
    set status='CANCELLED', cancelled_at=statement_timestamp(), notes=coalesce(notes, requested_reason)
  where id = target_payment_agreement_id;
  update finance.payment_agreement_installments
    set status='CANCELLED'
  where payment_agreement_installments.payment_agreement_id = target_payment_agreement_id
    and payment_agreement_installments.status not in ('FULFILLED');
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('PAYMENT_AGREEMENT_CANCELLED', actor, operation_key, agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', target_payment_agreement_id), correlation);
  perform finance.complete_financial_command(actor, 'CANCEL_PAYMENT_AGREEMENT', operation_key, 'PAYMENT_AGREEMENT', target_payment_agreement_id);
  return query select target_payment_agreement_id, 'CANCELLED';
end;
$$;

create function finance.mark_payment_agreement_defaulted(
  target_payment_agreement_id uuid,
  requested_reason text,
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
  agreement_row finance.payment_agreements%rowtype;
begin
  actor := finance.require_financial_benefit_permission('finance.payment-agreements.manage');
  prior := finance.begin_financial_command(actor, 'MARK_PAYMENT_AGREEMENT_DEFAULTED', operation_key, jsonb_build_object('agreement', target_payment_agreement_id, 'reason', requested_reason));
  if prior is not null then
    return query select prior, (select agreements.status::text from finance.payment_agreements agreements where agreements.id = prior);
    return;
  end if;
  select * into agreement_row from finance.payment_agreements where id = target_payment_agreement_id for update;
  if agreement_row.id is null or agreement_row.status <> 'ACTIVE' then
    raise exception 'PAYMENT_AGREEMENT_INVALID_STATE';
  end if;
  if not exists (
    select 1
    from finance.payment_agreement_installments installments
    where installments.payment_agreement_id = agreement_row.id
      and installments.due_date < current_date
      and installments.status <> 'FULFILLED'
  ) then
    raise exception 'PAYMENT_AGREEMENT_INVALID_STATE';
  end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.payment_agreements
    set status='DEFAULTED', notes=coalesce(notes, requested_reason)
  where id = target_payment_agreement_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('PAYMENT_AGREEMENT_DEFAULTED', actor, operation_key, agreement_row.student_account_id, null, null, null, null, jsonb_build_object('paymentAgreementId', target_payment_agreement_id), correlation);
  perform finance.complete_financial_command(actor, 'MARK_PAYMENT_AGREEMENT_DEFAULTED', operation_key, 'PAYMENT_AGREEMENT', target_payment_agreement_id);
  return query select target_payment_agreement_id, 'DEFAULTED';
end;
$$;

create or replace function public.create_payment_agreement(
  target_student_account_id uuid,
  target_collection_case_id uuid,
  requested_agreed_amount numeric,
  requested_installment_count integer,
  requested_start_date date,
  requested_reason_code finance.payment_agreement_reason_code,
  requested_installment_dates date[],
  requested_installment_amounts numeric[],
  requested_notes text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$
  select * from finance.create_payment_agreement(
    target_student_account_id,
    target_collection_case_id,
    requested_agreed_amount,
    requested_installment_count,
    requested_start_date,
    requested_reason_code,
    requested_installment_dates,
    requested_installment_amounts,
    requested_notes,
    operation_key,
    correlation
  )
$$;

create or replace function public.approve_payment_agreement(
  target_payment_agreement_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$
  select * from finance.approve_payment_agreement(target_payment_agreement_id, operation_key, correlation)
$$;

create or replace function public.reconcile_payment_agreement_installment(
  target_installment_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$
  select * from finance.reconcile_payment_agreement_installment(target_installment_id, operation_key, correlation)
$$;

create or replace function public.evaluate_payment_agreement(
  target_payment_agreement_id uuid,
  evaluation_date date default current_date
)
returns table(
  total_scheduled text,
  total_fulfilled text,
  remaining_agreement_amount text,
  next_installment_date date,
  installments_due integer,
  installments_past_due integer,
  evaluation_status text
)
language sql
security invoker
set search_path=''
as $$
  select * from finance.evaluate_payment_agreement(target_payment_agreement_id, evaluation_date)
$$;

create or replace function public.cancel_payment_agreement(
  target_payment_agreement_id uuid,
  requested_reason text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$
  select * from finance.cancel_payment_agreement(target_payment_agreement_id, requested_reason, operation_key, correlation)
$$;

create or replace function public.mark_payment_agreement_defaulted(
  target_payment_agreement_id uuid,
  requested_reason text,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$
  select * from finance.mark_payment_agreement_defaulted(target_payment_agreement_id, requested_reason, operation_key, correlation)
$$;

revoke all on function finance.require_financial_benefit_permission(text) from public, anon, authenticated;
revoke all on function finance.calculate_scholarship_benefit(finance.scholarship_programs, finance.student_scholarships, numeric) from public, anon, authenticated;
revoke all on function finance.record_financial_benefit_denied(uuid, text, uuid, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function finance.reverse_financial_benefit(uuid, finance.charge_adjustment_reason_code, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_scholarship_program(text, text, finance.scholarship_benefit_type, numeric, numeric, numeric, date, date, text, uuid) from public, anon, authenticated;
revoke all on function finance.submit_scholarship_program(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_scholarship_program(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.activate_scholarship_program(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.assign_student_scholarship(uuid, uuid, uuid, uuid, numeric, numeric, numeric, date, date, finance.student_scholarship_reason_code, text, uuid) from public, anon, authenticated;
revoke all on function finance.submit_student_scholarship(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_student_scholarship(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.activate_student_scholarship(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.revoke_student_scholarship(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.apply_student_scholarship(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.apply_authorized_discount(uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_authorized_waiver(uuid, numeric, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_authorized_waiver(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.apply_authorized_waiver(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_payment_agreement(uuid, uuid, numeric, integer, date, finance.payment_agreement_reason_code, date[], numeric[], text, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_payment_agreement(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.evaluate_payment_agreement(uuid, date) from public, anon, authenticated;
revoke all on function finance.reconcile_payment_agreement_installment(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.cancel_payment_agreement(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function finance.mark_payment_agreement_defaulted(uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.create_payment_agreement(uuid, uuid, numeric, integer, date, finance.payment_agreement_reason_code, date[], numeric[], text, text, uuid) to authenticated;
grant execute on function public.approve_payment_agreement(uuid, text, uuid) to authenticated;
grant execute on function public.reconcile_payment_agreement_installment(uuid, text, uuid) to authenticated;
grant execute on function public.evaluate_payment_agreement(uuid, date) to authenticated;
grant execute on function public.cancel_payment_agreement(uuid, text, text, uuid) to authenticated;
grant execute on function public.mark_payment_agreement_defaulted(uuid, text, text, uuid) to authenticated;

alter table finance.scholarship_programs owner to postgres;
alter table finance.student_scholarships owner to postgres;
alter table finance.scholarship_applications owner to postgres;
alter table finance.payment_agreements owner to postgres;
alter table finance.payment_agreement_installments owner to postgres;
alter table finance.payment_agreement_allocations owner to postgres;

alter table finance.scholarship_programs enable row level security;
alter table finance.student_scholarships enable row level security;
alter table finance.scholarship_applications enable row level security;
alter table finance.payment_agreements enable row level security;
alter table finance.payment_agreement_installments enable row level security;
alter table finance.payment_agreement_allocations enable row level security;

revoke all on table finance.scholarship_programs from public, anon, authenticated;
revoke all on table finance.student_scholarships from public, anon, authenticated;
revoke all on table finance.scholarship_applications from public, anon, authenticated;
revoke all on table finance.payment_agreements from public, anon, authenticated;
revoke all on table finance.payment_agreement_installments from public, anon, authenticated;
revoke all on table finance.payment_agreement_allocations from public, anon, authenticated;

create trigger scholarship_programs_touch_updated_at
before update on finance.scholarship_programs
for each row execute function finance.touch_updated_at();

create trigger student_scholarships_touch_updated_at
before update on finance.student_scholarships
for each row execute function finance.touch_updated_at();

create trigger payment_agreements_touch_updated_at
before update on finance.payment_agreements
for each row execute function finance.touch_updated_at();

create function finance.financial_benefits_mutation_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  agreement_status finance.payment_agreement_status;
begin
  if tg_op = 'DELETE' then
    raise exception 'HISTORICAL_RECORD_IMMUTABLE';
  end if;
  if current_setting('finance.controlled_mutation', true) = 'on' then
    return new;
  end if;
  if tg_table_name = 'payment_agreement_installments' then
    select agreements.status
      into agreement_status
    from finance.payment_agreements agreements
    where agreements.id = old.payment_agreement_id;
    if old.status in ('FULFILLED', 'CANCELLED')
       or agreement_status in ('APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED') then
      raise exception 'HISTORICAL_RECORD_IMMUTABLE';
    end if;
  end if;
  raise exception 'HISTORICAL_RECORD_IMMUTABLE';
end;
$$;

create trigger scholarship_programs_mutation_guard
before update or delete on finance.scholarship_programs
for each row
when (old.status in ('APPROVED', 'ACTIVE'))
execute function finance.financial_benefits_mutation_guard();

create trigger student_scholarships_mutation_guard
before update or delete on finance.student_scholarships
for each row
when (old.status in ('APPROVED', 'ACTIVE', 'REVOKED'))
execute function finance.financial_benefits_mutation_guard();

create trigger payment_agreements_mutation_guard
before update or delete on finance.payment_agreements
for each row
when (old.status in ('APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED'))
execute function finance.financial_benefits_mutation_guard();

create trigger payment_agreement_installments_mutation_guard
before update or delete on finance.payment_agreement_installments
for each row
execute function finance.financial_benefits_mutation_guard();

commit;
