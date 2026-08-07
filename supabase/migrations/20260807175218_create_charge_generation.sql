begin;

create type finance.charge_generation_type as enum (
  'INITIAL_ENROLLMENT',
  'REENROLLMENT',
  'REPEAT_SEMESTER',
  'REENTRY',
  'PERIODIC_TUITION',
  'DOCUMENT',
  'MANUAL_BATCH',
  'OTHER'
);

create type finance.charge_generation_rule_status as enum (
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
  'PENDING_INSTITUTIONAL_VALIDATION'
);

create type finance.charge_generation_rule_version_status as enum (
  'DRAFT',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'RETIRED',
  'PENDING_INSTITUTIONAL_VALIDATION'
);

create type finance.charge_generation_due_date_strategy as enum (
  'FIXED_DATE',
  'DAYS_AFTER_GENERATION',
  'MANUAL_REVIEW'
);

create type finance.charge_generation_batch_status as enum (
  'DRAFT',
  'PREVIEWED',
  'UNDER_REVIEW',
  'APPROVED',
  'PROCESSING',
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'REJECTED',
  'CANCELLED'
);

create type finance.charge_generation_item_status as enum (
  'PENDING',
  'GENERATED',
  'SKIPPED',
  'FAILED'
);

create type finance.charge_generation_eligibility_status as enum (
  'ELIGIBLE',
  'ALREADY_CHARGED',
  'ACCOUNT_NOT_ACTIVE',
  'ENROLLMENT_NOT_ELIGIBLE',
  'NO_APPLICABLE_RATE',
  'EXPLICITLY_EXCLUDED',
  'MANUAL_REVIEW_REQUIRED'
);

create type finance.charge_generation_reason_code as enum (
  'PENDING_INSTITUTIONAL_VALIDATION',
  'MANUAL_REVIEW_REQUIRED',
  'ACCOUNT_NOT_ACTIVE',
  'ENROLLMENT_NOT_ELIGIBLE',
  'NO_APPLICABLE_RATE',
  'EXPLICITLY_EXCLUDED',
  'ALREADY_CHARGED',
  'OTHER'
);

alter type finance.financial_command_type add value if not exists 'CREATE_CHARGE_GENERATION_RULE';
alter type finance.financial_command_type add value if not exists 'CREATE_CHARGE_GENERATION_RULE_VERSION';
alter type finance.financial_command_type add value if not exists 'APPROVE_CHARGE_GENERATION_RULE_VERSION';
alter type finance.financial_command_type add value if not exists 'ACTIVATE_CHARGE_GENERATION_RULE_VERSION';
alter type finance.financial_command_type add value if not exists 'PREVIEW_CHARGE_GENERATION';
alter type finance.financial_command_type add value if not exists 'CREATE_CHARGE_GENERATION_BATCH';
alter type finance.financial_command_type add value if not exists 'SUBMIT_CHARGE_GENERATION_BATCH';
alter type finance.financial_command_type add value if not exists 'APPROVE_CHARGE_GENERATION_BATCH';
alter type finance.financial_command_type add value if not exists 'EXECUTE_CHARGE_GENERATION_BATCH';
alter type finance.financial_command_type add value if not exists 'CREATE_CHARGE_GENERATION_EXCLUSION';

alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_RULE_CREATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_RULE_VERSION_CREATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_RULE_APPROVED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_RULE_ACTIVATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_PREVIEWED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_BATCH_CREATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_BATCH_SUBMITTED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_BATCH_APPROVED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_STARTED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_SKIPPED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_FAILED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_COMPLETED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_EXCLUSION_CREATED';
alter type finance.financial_event_type add value if not exists 'CHARGE_GENERATION_OPERATION_DENIED';

create table finance.charge_generation_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  charge_concept_id uuid not null references finance.charge_concepts(id) on delete restrict,
  generation_type finance.charge_generation_type not null,
  status finance.charge_generation_rule_status not null default 'DRAFT',
  is_system_rule boolean not null default false,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (code = upper(btrim(code)) and char_length(code) between 3 and 80),
  check (char_length(btrim(name)) between 3 and 160)
);

create table finance.charge_generation_rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references finance.charge_generation_rules(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status finance.charge_generation_rule_version_status not null default 'DRAFT',
  academic_period_id uuid references academic.academic_periods(id) on delete restrict,
  academic_plan_id uuid references academic.study_plans(id) on delete restrict,
  semester_number integer check (semester_number between 1 and 6),
  training_area_id uuid references academic.training_areas(id) on delete restrict,
  charge_rate_id uuid references finance.charge_rates(id) on delete restrict,
  due_date_strategy finance.charge_generation_due_date_strategy not null,
  fixed_due_date date,
  due_days_after_generation integer,
  installment_number integer check (installment_number is null or installment_number > 0),
  effective_from timestamptz,
  effective_until timestamptz,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (rule_id, version_number),
  check (effective_until is null or effective_from is null or effective_until > effective_from),
  check (
    (due_date_strategy = 'FIXED_DATE' and fixed_due_date is not null and due_days_after_generation is null)
    or
    (due_date_strategy = 'DAYS_AFTER_GENERATION' and fixed_due_date is null and due_days_after_generation is not null and due_days_after_generation >= 0)
    or
    (due_date_strategy = 'MANUAL_REVIEW' and fixed_due_date is null and due_days_after_generation is null)
  ),
  check (
    (approved_by_account_id is null and approved_at is null)
    or
    (approved_by_account_id is not null and approved_at is not null)
  )
);

create unique index charge_generation_one_active_version_per_rule
  on finance.charge_generation_rule_versions(rule_id)
  where status = 'ACTIVE';

create table finance.charge_generation_batches (
  id uuid primary key default gen_random_uuid(),
  rule_version_id uuid not null references finance.charge_generation_rule_versions(id) on delete restrict,
  academic_period_id uuid not null references academic.academic_periods(id) on delete restrict,
  status finance.charge_generation_batch_status not null default 'DRAFT',
  requested_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  requested_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  total_candidates integer not null default 0 check (total_candidates >= 0),
  total_eligible integer not null default 0 check (total_eligible >= 0),
  total_generated integer not null default 0 check (total_generated >= 0),
  total_skipped integer not null default 0 check (total_skipped >= 0),
  total_failed integer not null default 0 check (total_failed >= 0),
  estimated_total numeric(12,2) not null default 0 check (estimated_total >= 0),
  generated_total numeric(12,2) not null default 0 check (generated_total >= 0),
  idempotency_key text not null,
  request_fingerprint text not null check (char_length(request_fingerprint) >= 32),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (requested_by_account_id, idempotency_key),
  check (
    (approved_by_account_id is null and approved_at is null)
    or
    (approved_by_account_id is not null and approved_at is not null)
  )
);

create table finance.charge_generation_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references finance.charge_generation_batches(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  student_account_id uuid references finance.student_accounts(id) on delete restrict,
  period_enrollment_id uuid references academic.period_enrollments(id) on delete restrict,
  resolved_charge_rate_id uuid references finance.charge_rates(id) on delete restrict,
  resolved_amount numeric(12,2),
  due_date date,
  eligibility_status finance.charge_generation_eligibility_status not null,
  processing_status finance.charge_generation_item_status not null default 'PENDING',
  exclusion_reason_code finance.charge_generation_reason_code,
  generated_charge_id uuid references finance.student_charges(id) on delete restrict,
  error_code text,
  student_identifier text,
  display_name text,
  group_name text,
  semester_number integer,
  installment_number integer check (installment_number is null or installment_number > 0),
  processed_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (batch_id, student_record_id),
  check (resolved_amount is null or resolved_amount >= 0)
);

create table finance.charge_generation_exclusions (
  id uuid primary key default gen_random_uuid(),
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  rule_id uuid references finance.charge_generation_rules(id) on delete restrict,
  rule_version_id uuid references finance.charge_generation_rule_versions(id) on delete restrict,
  academic_period_id uuid references academic.academic_periods(id) on delete restrict,
  reason_code finance.charge_generation_reason_code not null,
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_until is null or valid_until > valid_from),
  check (rule_id is not null or rule_version_id is not null or academic_period_id is not null)
);

create unique index charge_generation_batches_rule_period_unique
  on finance.charge_generation_batches(rule_version_id, academic_period_id)
  where status in ('PREVIEWED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING');

create unique index student_charges_equivalent_posted_global_unique
  on finance.student_charges (
    student_account_id,
    charge_concept_id,
    coalesce(academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('POSTED', 'PARTIALLY_PAID', 'PAID') and source <> 'ADJUSTMENT';

create index charge_generation_batch_items_batch_idx
  on finance.charge_generation_batch_items(batch_id, processing_status, eligibility_status);

create index charge_generation_exclusions_lookup_idx
  on finance.charge_generation_exclusions(student_record_id, academic_period_id, valid_from, valid_until);

create function finance.require_charge_generation_permission(permission_code text)
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
begin
  if permission_code not in (
    'finance.charge-generation.rules.manage',
    'finance.charge-generation.rules.approve',
    'finance.charge-generation.preview',
    'finance.charge-generation.batches.create',
    'finance.charge-generation.batches.review',
    'finance.charge-generation.batches.approve',
    'finance.charge-generation.batches.execute',
    'finance.charge-generation.batches.read',
    'finance.charge-generation.exclusions.manage'
  ) then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
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

  select * into actor from core.accounts where auth_user_id = auth.uid();
  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception using errcode='42501', message='SESSION_VERSION_INVALID';
  end if;
  if not core.is_current_aal2() or not core.is_current_mfa_policy_satisfied() then
    raise exception using errcode='42501', message='AAL2_REQUIRED';
  end if;

  select coalesce(array_agg(r.code), array[]::text[])
    into role_codes
  from core.account_roles ar
  join core.roles r on r.id = ar.role_id and r.is_active
  where ar.account_id = actor.id and ar.revoked_at is null;

  if role_codes && array['SUPERADMIN']::text[] then
    return actor.id;
  end if;

  if role_codes && array['ADMINISTRATIVO']::text[] then
    if permission_code in (
      'finance.charge-generation.rules.manage',
      'finance.charge-generation.rules.approve',
      'finance.charge-generation.preview',
      'finance.charge-generation.batches.create',
      'finance.charge-generation.batches.review',
      'finance.charge-generation.batches.approve',
      'finance.charge-generation.batches.execute',
      'finance.charge-generation.batches.read',
      'finance.charge-generation.exclusions.manage'
    ) then
      return actor.id;
    end if;
  end if;

  if role_codes && array['CONTROL_ESCOLAR']::text[] then
    if permission_code in (
      'finance.charge-generation.preview',
      'finance.charge-generation.batches.read'
    ) then
      return actor.id;
    end if;
  end if;

  raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
end;
$$;

create function finance.charge_generation_source_for(type_code finance.charge_generation_type)
returns finance.student_charge_source
language sql
immutable
security invoker
set search_path=''
as $$
  select case type_code
    when 'INITIAL_ENROLLMENT' then 'ENROLLMENT'::finance.student_charge_source
    when 'REENROLLMENT' then 'REENROLLMENT'::finance.student_charge_source
    when 'REPEAT_SEMESTER' then 'REENROLLMENT'::finance.student_charge_source
    when 'REENTRY' then 'REENROLLMENT'::finance.student_charge_source
    when 'PERIODIC_TUITION' then 'PERIODIC'::finance.student_charge_source
    when 'DOCUMENT' then 'DOCUMENT_REQUEST'::finance.student_charge_source
    when 'MANUAL_BATCH' then 'MANUAL'::finance.student_charge_source
    else 'MANUAL'::finance.student_charge_source
  end
$$;

create function finance.charge_generation_is_enrollment_allowed(
  generation_type finance.charge_generation_type,
  request_type academic.enrollment_request_type,
  enrollment_status academic.period_enrollment_status
)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $$
  select case generation_type
    when 'INITIAL_ENROLLMENT' then request_type = 'INITIAL_ENROLLMENT' and enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    when 'REENROLLMENT' then request_type = 'REENROLLMENT' and enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    when 'REPEAT_SEMESTER' then request_type = 'REPEAT_SEMESTER' and enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    when 'REENTRY' then request_type = 'REENTRY_AFTER_TEMPORARY_WITHDRAWAL' and enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    when 'PERIODIC_TUITION' then enrollment_status in ('PLANNED', 'ACTIVE', 'TEMPORARILY_SUSPENDED', 'COMPLETED')
    when 'DOCUMENT' then enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    when 'MANUAL_BATCH' then enrollment_status in ('PLANNED', 'ACTIVE', 'COMPLETED')
    else false
  end
$$;

create function finance.evaluate_charge_generation_eligibility(
  generation_type finance.charge_generation_type,
  student_record_status academic.student_record_status,
  request_type academic.enrollment_request_type,
  enrollment_status academic.period_enrollment_status,
  student_account_status finance.student_account_status,
  is_excluded boolean,
  already_charged boolean,
  resolved_charge_rate_id uuid,
  resolved_amount numeric,
  due_date_strategy finance.charge_generation_due_date_strategy,
  due_date date
)
returns finance.charge_generation_eligibility_status
language sql
immutable
security invoker
set search_path=''
as $$
  select case
    when generation_type = 'OTHER' then 'MANUAL_REVIEW_REQUIRED'::finance.charge_generation_eligibility_status
    when student_record_status <> 'ACTIVE' then 'MANUAL_REVIEW_REQUIRED'::finance.charge_generation_eligibility_status
    when not finance.charge_generation_is_enrollment_allowed(generation_type, request_type, enrollment_status) then 'ENROLLMENT_NOT_ELIGIBLE'::finance.charge_generation_eligibility_status
    when student_account_status <> 'ACTIVE' then 'ACCOUNT_NOT_ACTIVE'::finance.charge_generation_eligibility_status
    when is_excluded then 'EXPLICITLY_EXCLUDED'::finance.charge_generation_eligibility_status
    when already_charged then 'ALREADY_CHARGED'::finance.charge_generation_eligibility_status
    when resolved_charge_rate_id is null or resolved_amount is null then 'NO_APPLICABLE_RATE'::finance.charge_generation_eligibility_status
    when due_date_strategy = 'MANUAL_REVIEW' or due_date is null then 'MANUAL_REVIEW_REQUIRED'::finance.charge_generation_eligibility_status
    else 'ELIGIBLE'::finance.charge_generation_eligibility_status
  end
$$;

create function finance.resolve_charge_generation_due_date(
  strategy finance.charge_generation_due_date_strategy,
  fixed_due_date date,
  due_days_after_generation integer,
  base_date date
)
returns date
language sql
immutable
security invoker
set search_path=''
as $$
  select case strategy
    when 'FIXED_DATE' then fixed_due_date
    when 'DAYS_AFTER_GENERATION' then base_date + coalesce(due_days_after_generation, 0)
    else null
  end
$$;

create function finance.preview_charge_generation(
  target_rule_version_id uuid,
  target_academic_period_id uuid,
  correlation uuid default null
)
returns table(
  student_record_id uuid,
  student_account_id uuid,
  period_enrollment_id uuid,
  student_identifier text,
  display_name text,
  group_name text,
  semester_number integer,
  eligibility_status finance.charge_generation_eligibility_status,
  reason_code finance.charge_generation_reason_code,
  resolved_charge_rate_id uuid,
  resolved_amount numeric(12,2),
  due_date date,
  total_candidates integer,
  total_eligible integer,
  total_already_charged integer,
  total_excluded integer,
  total_manual_review integer,
  total_without_rate integer,
  estimated_total numeric(12,2)
)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  version_row finance.charge_generation_rule_versions%rowtype;
  rule_row finance.charge_generation_rules%rowtype;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.preview');

  select * into version_row
  from finance.charge_generation_rule_versions
  where id = target_rule_version_id;
  if version_row.id is null then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_FOUND';
  end if;

  select * into rule_row
  from finance.charge_generation_rules
  where id = version_row.rule_id;
  if rule_row.id is null then
    raise exception 'CHARGE_GENERATION_RULE_NOT_FOUND';
  end if;

  if version_row.status not in ('APPROVED', 'ACTIVE') then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_APPROVED';
  end if;

  return query
  with candidates as (
    select
      records.id as student_record_id,
      accounts.id as student_account_id,
      enrollments.id as period_enrollment_id,
      records.institutional_student_code as student_identifier,
      null::text as display_name,
      groups.display_name as group_name,
      enrollments.semester_number::integer,
      accounts.status as student_account_status,
      enrollments.status as enrollment_status,
      requests.request_type,
      records.status as student_record_status,
      version_row.charge_rate_id as resolved_charge_rate_id,
      rates.amount as resolved_amount,
      finance.resolve_charge_generation_due_date(
        version_row.due_date_strategy,
        version_row.fixed_due_date,
        version_row.due_days_after_generation,
        current_date
      ) as due_date,
      exists(
        select 1
        from finance.charge_generation_exclusions exclusions
        where exclusions.student_record_id = records.id
          and (exclusions.rule_id is null or exclusions.rule_id = rule_row.id)
          and (exclusions.rule_version_id is null or exclusions.rule_version_id = version_row.id)
          and (exclusions.academic_period_id is null or exclusions.academic_period_id = target_academic_period_id)
          and exclusions.valid_from <= statement_timestamp()
          and (exclusions.valid_until is null or exclusions.valid_until > statement_timestamp())
      ) as is_excluded,
      exists(
        select 1
        from finance.student_charges charges
        where charges.student_account_id = accounts.id
          and charges.charge_concept_id = rule_row.charge_concept_id
          and coalesce(charges.academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              coalesce(target_academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid)
          and coalesce(charges.enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              coalesce(enrollments.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID')
      ) as already_charged
    from academic.period_enrollments enrollments
    join academic.student_records records on records.id = enrollments.student_record_id
    join finance.student_accounts accounts on accounts.student_record_id = records.id
    join academic.groups groups on groups.id = enrollments.group_id
    join academic.enrollment_requests requests on requests.id = enrollments.enrollment_request_id
    left join finance.charge_rates rates
      on rates.id = version_row.charge_rate_id
    where enrollments.academic_period_id = target_academic_period_id
      and (version_row.academic_period_id is null or version_row.academic_period_id = target_academic_period_id)
      and (version_row.academic_plan_id is null or version_row.academic_plan_id = enrollments.study_plan_id)
      and (version_row.semester_number is null or version_row.semester_number = enrollments.semester_number)
      and (
        version_row.training_area_id is null
        or version_row.training_area_id = enrollments.training_area_id
      )
  ),
  evaluated as (
    select
      candidates.*,
      finance.evaluate_charge_generation_eligibility(
        rule_row.generation_type,
        candidates.student_record_status,
        candidates.request_type,
        candidates.enrollment_status,
        candidates.student_account_status,
        candidates.is_excluded,
        candidates.already_charged,
        candidates.resolved_charge_rate_id,
        candidates.resolved_amount,
        version_row.due_date_strategy,
        candidates.due_date
      ) as eligibility_status
    from candidates
  )
  select
    evaluated.student_record_id,
    evaluated.student_account_id,
    evaluated.period_enrollment_id,
    evaluated.student_identifier,
    evaluated.display_name,
    evaluated.group_name,
    evaluated.semester_number,
    evaluated.eligibility_status,
    case evaluated.eligibility_status
      when 'ALREADY_CHARGED' then 'ALREADY_CHARGED'::finance.charge_generation_reason_code
      when 'ACCOUNT_NOT_ACTIVE' then 'ACCOUNT_NOT_ACTIVE'::finance.charge_generation_reason_code
      when 'ENROLLMENT_NOT_ELIGIBLE' then 'ENROLLMENT_NOT_ELIGIBLE'::finance.charge_generation_reason_code
      when 'NO_APPLICABLE_RATE' then 'NO_APPLICABLE_RATE'::finance.charge_generation_reason_code
      when 'EXPLICITLY_EXCLUDED' then 'EXPLICITLY_EXCLUDED'::finance.charge_generation_reason_code
      when 'MANUAL_REVIEW_REQUIRED' then 'MANUAL_REVIEW_REQUIRED'::finance.charge_generation_reason_code
      else null::finance.charge_generation_reason_code
    end,
    evaluated.resolved_charge_rate_id,
    evaluated.resolved_amount,
    evaluated.due_date,
    count(*) over ()::integer,
    count(*) filter (where evaluated.eligibility_status = 'ELIGIBLE') over ()::integer,
    count(*) filter (where evaluated.eligibility_status = 'ALREADY_CHARGED') over ()::integer,
    count(*) filter (where evaluated.eligibility_status = 'EXPLICITLY_EXCLUDED') over ()::integer,
    count(*) filter (where evaluated.eligibility_status = 'MANUAL_REVIEW_REQUIRED') over ()::integer,
    count(*) filter (where evaluated.eligibility_status = 'NO_APPLICABLE_RATE') over ()::integer,
    coalesce(sum(evaluated.resolved_amount) filter (where evaluated.eligibility_status = 'ELIGIBLE') over (), 0)::numeric(12,2)
  from evaluated
  order by evaluated.student_identifier nulls last, evaluated.student_record_id;

  perform finance.append_financial_event(
    'CHARGE_GENERATION_PREVIEWED',
    actor,
    coalesce(correlation::text, 'preview:' || target_rule_version_id::text || ':' || target_academic_period_id::text),
    null,
    null,
    null,
    null,
    null,
    jsonb_build_object('ruleVersionId', target_rule_version_id, 'academicPeriodId', target_academic_period_id),
    correlation
  );
end;
$$;

create function finance.create_charge_generation_rule(
  requested_code text,
  requested_name text,
  requested_concept_id uuid,
  requested_generation_type finance.charge_generation_type,
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
  actor := finance.require_charge_generation_permission('finance.charge-generation.rules.manage');
  prior := finance.begin_financial_command(
    actor,
    'CREATE_CHARGE_GENERATION_RULE',
    operation_key,
    jsonb_build_object(
      'code', upper(btrim(requested_code)),
      'name', btrim(requested_name),
      'concept', requested_concept_id,
      'generationType', requested_generation_type
    )
  );
  if prior is not null then
    return query
    select prior, (select rules.status::text from finance.charge_generation_rules rules where rules.id = prior);
    return;
  end if;

  insert into finance.charge_generation_rules(
    code, name, charge_concept_id, generation_type, created_by_account_id
  ) values (
    upper(btrim(requested_code)), btrim(requested_name), requested_concept_id, requested_generation_type, actor
  ) returning id into created;

  perform finance.append_financial_event('CHARGE_GENERATION_RULE_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('ruleId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_GENERATION_RULE', operation_key, 'CHARGE_GENERATION_RULE', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.create_charge_generation_rule_version(
  target_rule_id uuid,
  target_academic_period_id uuid,
  target_academic_plan_id uuid,
  target_semester_number integer,
  target_training_area_id uuid,
  target_charge_rate_id uuid,
  target_due_date_strategy finance.charge_generation_due_date_strategy,
  target_fixed_due_date date,
  target_due_days_after_generation integer,
  target_installment_number integer,
  target_effective_from timestamptz,
  target_effective_until timestamptz,
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
  next_version integer;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.rules.manage');
  prior := finance.begin_financial_command(
    actor,
    'CREATE_CHARGE_GENERATION_RULE_VERSION',
    operation_key,
    jsonb_build_object(
      'rule', target_rule_id,
      'period', target_academic_period_id,
      'plan', target_academic_plan_id,
      'semester', target_semester_number,
      'area', target_training_area_id,
      'rate', target_charge_rate_id,
      'dueStrategy', target_due_date_strategy,
      'fixedDueDate', target_fixed_due_date,
      'dueDays', target_due_days_after_generation,
      'installment', target_installment_number,
      'effectiveFrom', target_effective_from,
      'effectiveUntil', target_effective_until
    )
  );
  if prior is not null then
    return query
    select prior, (select versions.status::text from finance.charge_generation_rule_versions versions where versions.id = prior);
    return;
  end if;

  perform 1
  from finance.charge_generation_rules
  where id = target_rule_id
  for update;

  select coalesce(max(version_number), 0) + 1
    into next_version
  from finance.charge_generation_rule_versions
  where rule_id = target_rule_id;

  insert into finance.charge_generation_rule_versions(
    rule_id, version_number, academic_period_id, academic_plan_id, semester_number,
    training_area_id, charge_rate_id, due_date_strategy, fixed_due_date,
    due_days_after_generation, installment_number, effective_from, effective_until,
    created_by_account_id
  ) values (
    target_rule_id, next_version, target_academic_period_id, target_academic_plan_id, target_semester_number,
    target_training_area_id, target_charge_rate_id, target_due_date_strategy, target_fixed_due_date,
    target_due_days_after_generation, target_installment_number, target_effective_from, target_effective_until,
    actor
  ) returning id into created;

  perform finance.append_financial_event('CHARGE_GENERATION_RULE_VERSION_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('ruleVersionId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_GENERATION_RULE_VERSION', operation_key, 'CHARGE_GENERATION_RULE_VERSION', created);
  return query select created, 'DRAFT';
end;
$$;

create function finance.approve_charge_generation_rule_version(
  target_rule_version_id uuid,
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
  version_row finance.charge_generation_rule_versions%rowtype;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.rules.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_CHARGE_GENERATION_RULE_VERSION', operation_key, jsonb_build_object('ruleVersionId', target_rule_version_id));
  if prior is not null then
    return query select prior, (select versions.status::text from finance.charge_generation_rule_versions versions where versions.id = prior);
    return;
  end if;

  select * into version_row from finance.charge_generation_rule_versions where id = target_rule_version_id for update;
  if version_row.id is null then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_FOUND';
  end if;
  if version_row.status <> 'DRAFT' then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_APPROVED';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_rule_versions
  set status = 'APPROVED',
      approved_by_account_id = actor,
      approved_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = target_rule_version_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_GENERATION_RULE_APPROVED', actor, operation_key, null, null, null, null, null, jsonb_build_object('ruleVersionId', target_rule_version_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_CHARGE_GENERATION_RULE_VERSION', operation_key, 'CHARGE_GENERATION_RULE_VERSION', target_rule_version_id);
  return query select target_rule_version_id, 'APPROVED';
end;
$$;

create function finance.activate_charge_generation_rule_version(
  target_rule_version_id uuid,
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
  version_row finance.charge_generation_rule_versions%rowtype;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.rules.approve');
  prior := finance.begin_financial_command(actor, 'ACTIVATE_CHARGE_GENERATION_RULE_VERSION', operation_key, jsonb_build_object('ruleVersionId', target_rule_version_id));
  if prior is not null then
    return query select prior, (select versions.status::text from finance.charge_generation_rule_versions versions where versions.id = prior);
    return;
  end if;

  select * into version_row from finance.charge_generation_rule_versions where id = target_rule_version_id for update;
  if version_row.id is null then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_FOUND';
  end if;
  if version_row.status <> 'APPROVED' then
    raise exception 'CHARGE_GENERATION_VERSION_NOT_APPROVED';
  end if;
  if exists(
    select 1 from finance.charge_generation_rule_versions versions
    where versions.rule_id = version_row.rule_id
      and versions.status = 'ACTIVE'
      and versions.id <> target_rule_version_id
  ) then
    raise exception 'CONCURRENT_MODIFICATION';
  end if;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_rule_versions
  set status = 'ACTIVE',
      updated_at = statement_timestamp()
  where id = target_rule_version_id;
  update finance.charge_generation_rules
  set status = 'ACTIVE',
      updated_at = statement_timestamp()
  where id = version_row.rule_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_GENERATION_RULE_ACTIVATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('ruleVersionId', target_rule_version_id), correlation);
  perform finance.complete_financial_command(actor, 'ACTIVATE_CHARGE_GENERATION_RULE_VERSION', operation_key, 'CHARGE_GENERATION_RULE_VERSION', target_rule_version_id);
  return query select target_rule_version_id, 'ACTIVE';
end;
$$;

create function finance.create_charge_generation_exclusion(
  target_student_record_id uuid,
  target_rule_id uuid,
  target_rule_version_id uuid,
  target_academic_period_id uuid,
  target_reason_code finance.charge_generation_reason_code,
  target_valid_from timestamptz,
  target_valid_until timestamptz,
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
  actor := finance.require_charge_generation_permission('finance.charge-generation.exclusions.manage');
  prior := finance.begin_financial_command(
    actor,
    'CREATE_CHARGE_GENERATION_EXCLUSION',
    operation_key,
    jsonb_build_object(
      'studentRecordId', target_student_record_id,
      'ruleId', target_rule_id,
      'ruleVersionId', target_rule_version_id,
      'academicPeriodId', target_academic_period_id,
      'reasonCode', target_reason_code,
      'validFrom', target_valid_from,
      'validUntil', target_valid_until
    )
  );
  if prior is not null then
    return query select prior, 'ACTIVE';
    return;
  end if;

  insert into finance.charge_generation_exclusions(
    student_record_id, rule_id, rule_version_id, academic_period_id, reason_code,
    valid_from, valid_until, created_by_account_id
  ) values (
    target_student_record_id, target_rule_id, target_rule_version_id, target_academic_period_id, target_reason_code,
    target_valid_from, target_valid_until, actor
  ) returning id into created;

  perform finance.append_financial_event('CHARGE_GENERATION_EXCLUSION_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('exclusionId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_GENERATION_EXCLUSION', operation_key, 'CHARGE_GENERATION_EXCLUSION', created);
  return query select created, 'ACTIVE';
end;
$$;

create function finance.create_charge_generation_batch(
  target_rule_version_id uuid,
  target_academic_period_id uuid,
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
  actor := finance.require_charge_generation_permission('finance.charge-generation.batches.create');
  prior := finance.begin_financial_command(actor, 'CREATE_CHARGE_GENERATION_BATCH', operation_key, jsonb_build_object('ruleVersionId', target_rule_version_id, 'academicPeriodId', target_academic_period_id));
  if prior is not null then
    return query select prior, (select batches.status::text from finance.charge_generation_batches batches where batches.id = prior);
    return;
  end if;

  insert into finance.charge_generation_batches(
    rule_version_id, academic_period_id, status, requested_by_account_id, idempotency_key, request_fingerprint
  )
  values(
    target_rule_version_id,
    target_academic_period_id,
    'PREVIEWED',
    actor,
    operation_key,
    finance.financial_fingerprint(jsonb_build_object('ruleVersionId', target_rule_version_id, 'academicPeriodId', target_academic_period_id))
  )
  returning id into created;

  insert into finance.charge_generation_batch_items(
    batch_id, student_record_id, student_account_id, period_enrollment_id,
    resolved_charge_rate_id, resolved_amount, due_date, eligibility_status,
    exclusion_reason_code, student_identifier, display_name, group_name, semester_number, installment_number
  )
  select
    created,
    preview.student_record_id,
    preview.student_account_id,
    preview.period_enrollment_id,
    preview.resolved_charge_rate_id,
    preview.resolved_amount,
    preview.due_date,
    preview.eligibility_status,
    preview.reason_code,
    preview.student_identifier,
    preview.display_name,
    preview.group_name,
    preview.semester_number,
    versions.installment_number
  from finance.preview_charge_generation(target_rule_version_id, target_academic_period_id, correlation) preview
  join finance.charge_generation_rule_versions versions on versions.id = target_rule_version_id;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_batches batches
  set
    total_candidates = stats.total_candidates,
    total_eligible = stats.total_eligible,
    total_generated = 0,
    total_skipped = 0,
    total_failed = 0,
    estimated_total = stats.estimated_total,
    generated_total = 0,
    updated_at = statement_timestamp()
  from (
    select
      count(*) as total_candidates,
      count(*) filter (where eligibility_status = 'ELIGIBLE') as total_eligible,
      coalesce(sum(resolved_amount) filter (where eligibility_status = 'ELIGIBLE'), 0)::numeric(12,2) as estimated_total
    from finance.charge_generation_batch_items
    where batch_id = created
  ) stats
  where batches.id = created;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_GENERATION_BATCH_CREATED', actor, operation_key, null, null, null, null, null, jsonb_build_object('batchId', created), correlation);
  perform finance.complete_financial_command(actor, 'CREATE_CHARGE_GENERATION_BATCH', operation_key, 'CHARGE_GENERATION_BATCH', created);
  return query select created, 'PREVIEWED';
end;
$$;

create function finance.submit_charge_generation_batch(
  target_batch_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid; prior uuid; batch_row finance.charge_generation_batches%rowtype;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.batches.review');
  prior := finance.begin_financial_command(actor, 'SUBMIT_CHARGE_GENERATION_BATCH', operation_key, jsonb_build_object('batchId', target_batch_id));
  if prior is not null then
    return query select prior, (select batches.status::text from finance.charge_generation_batches batches where batches.id = prior);
    return;
  end if;
  select * into batch_row from finance.charge_generation_batches where id = target_batch_id for update;
  if batch_row.id is null then raise exception 'CHARGE_GENERATION_BATCH_NOT_FOUND'; end if;
  if batch_row.status <> 'PREVIEWED' then raise exception 'CHARGE_GENERATION_BATCH_INVALID_STATE'; end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_batches set status='UNDER_REVIEW', submitted_at=statement_timestamp(), updated_at=statement_timestamp() where id=target_batch_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('CHARGE_GENERATION_BATCH_SUBMITTED', actor, operation_key, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id), correlation);
  perform finance.complete_financial_command(actor, 'SUBMIT_CHARGE_GENERATION_BATCH', operation_key, 'CHARGE_GENERATION_BATCH', target_batch_id);
  return query select target_batch_id, 'UNDER_REVIEW';
end;
$$;

create function finance.approve_charge_generation_batch(
  target_batch_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid; prior uuid; batch_row finance.charge_generation_batches%rowtype;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.batches.approve');
  prior := finance.begin_financial_command(actor, 'APPROVE_CHARGE_GENERATION_BATCH', operation_key, jsonb_build_object('batchId', target_batch_id));
  if prior is not null then
    return query select prior, (select batches.status::text from finance.charge_generation_batches batches where batches.id = prior);
    return;
  end if;
  select * into batch_row from finance.charge_generation_batches where id = target_batch_id for update;
  if batch_row.id is null then raise exception 'CHARGE_GENERATION_BATCH_NOT_FOUND'; end if;
  if batch_row.status <> 'UNDER_REVIEW' then raise exception 'CHARGE_GENERATION_BATCH_INVALID_STATE'; end if;
  if batch_row.requested_by_account_id = actor then raise exception 'CHARGE_GENERATION_SELF_APPROVAL_NOT_ALLOWED'; end if;
  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_batches
  set status='APPROVED', approved_by_account_id=actor, approved_at=statement_timestamp(), updated_at=statement_timestamp()
  where id=target_batch_id;
  perform set_config('finance.controlled_mutation', 'off', true);
  perform finance.append_financial_event('CHARGE_GENERATION_BATCH_APPROVED', actor, operation_key, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id), correlation);
  perform finance.complete_financial_command(actor, 'APPROVE_CHARGE_GENERATION_BATCH', operation_key, 'CHARGE_GENERATION_BATCH', target_batch_id);
  return query select target_batch_id, 'APPROVED';
end;
$$;

create function finance.execute_charge_generation_batch(
  target_batch_id uuid,
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
  batch_row finance.charge_generation_batches%rowtype;
  version_row finance.charge_generation_rule_versions%rowtype;
  rule_row finance.charge_generation_rules%rowtype;
  item_row finance.charge_generation_batch_items%rowtype;
  current_record_status academic.student_record_status;
  current_request_type academic.enrollment_request_type;
  current_enrollment_status academic.period_enrollment_status;
  current_account_status finance.student_account_status;
  current_is_excluded boolean;
  current_already_charged boolean;
  current_eligibility finance.charge_generation_eligibility_status;
  generated uuid;
  item_status text;
  item_create_key text;
  item_post_key text;
  current_due_date date;
begin
  actor := finance.require_charge_generation_permission('finance.charge-generation.batches.execute');
  prior := finance.begin_financial_command(actor, 'EXECUTE_CHARGE_GENERATION_BATCH', operation_key, jsonb_build_object('batchId', target_batch_id));
  if prior is not null then
    return query select prior, (select batches.status::text from finance.charge_generation_batches batches where batches.id = prior);
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('charge_generation_batch:' || target_batch_id::text, 0));

  select * into batch_row from finance.charge_generation_batches where id = target_batch_id for update;
  if batch_row.id is null then raise exception 'CHARGE_GENERATION_BATCH_NOT_FOUND'; end if;
  if batch_row.status = 'COMPLETED' then
    perform finance.complete_financial_command(actor, 'EXECUTE_CHARGE_GENERATION_BATCH', operation_key, 'CHARGE_GENERATION_BATCH', target_batch_id);
    return query select target_batch_id, 'COMPLETED';
  end if;
  if batch_row.status not in ('APPROVED', 'COMPLETED_WITH_ERRORS') then
    raise exception 'CHARGE_GENERATION_BATCH_NOT_APPROVED';
  end if;

  select * into version_row from finance.charge_generation_rule_versions where id = batch_row.rule_version_id;
  select * into rule_row from finance.charge_generation_rules where id = version_row.rule_id;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_batches
  set status='PROCESSING', started_at=coalesce(started_at, statement_timestamp()), updated_at=statement_timestamp()
  where id = target_batch_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_GENERATION_STARTED', actor, operation_key, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id), correlation);

  for item_row in
    select * from finance.charge_generation_batch_items
    where batch_id = target_batch_id
    order by created_at, id
    for update
  loop
    if item_row.processing_status = 'GENERATED' then
      continue;
    end if;

    if item_row.eligibility_status <> 'ELIGIBLE' then
      perform set_config('finance.controlled_mutation', 'on', true);
      update finance.charge_generation_batch_items
      set processing_status = 'SKIPPED', processed_at = statement_timestamp(), updated_at = statement_timestamp()
      where id = item_row.id;
      perform set_config('finance.controlled_mutation', 'off', true);
      perform finance.append_financial_event('CHARGE_GENERATION_SKIPPED', actor, operation_key || ':item:' || item_row.id::text, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id, 'batchItemId', item_row.id, 'eligibilityStatus', item_row.eligibility_status), correlation);
      continue;
    end if;

    select records.status, requests.request_type, enrollments.status, accounts.status
      into current_record_status, current_request_type, current_enrollment_status, current_account_status
    from academic.period_enrollments enrollments
    join academic.student_records records on records.id = enrollments.student_record_id
    join academic.enrollment_requests requests on requests.id = enrollments.enrollment_request_id
    join finance.student_accounts accounts on accounts.id = item_row.student_account_id
    where enrollments.id = item_row.period_enrollment_id
      and records.id = item_row.student_record_id
    for update of enrollments, records, accounts;

    if current_record_status is null then
      current_eligibility := 'ENROLLMENT_NOT_ELIGIBLE'::finance.charge_generation_eligibility_status;
    else
      select exists(
        select 1 from finance.charge_generation_exclusions exclusions
        where exclusions.student_record_id = item_row.student_record_id
          and (exclusions.rule_id is null or exclusions.rule_id = rule_row.id)
          and (exclusions.rule_version_id is null or exclusions.rule_version_id = version_row.id)
          and (exclusions.academic_period_id is null or exclusions.academic_period_id = batch_row.academic_period_id)
          and exclusions.valid_from <= statement_timestamp()
          and (exclusions.valid_until is null or exclusions.valid_until > statement_timestamp())
      ) into current_is_excluded;

      select exists(
        select 1
        from finance.student_charges charges
        where charges.student_account_id = item_row.student_account_id
          and charges.charge_concept_id = rule_row.charge_concept_id
          and coalesce(charges.academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              coalesce(batch_row.academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid)
          and coalesce(charges.enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid) =
              coalesce(item_row.period_enrollment_id, '00000000-0000-0000-0000-000000000000'::uuid)
          and charges.status in ('POSTED', 'PARTIALLY_PAID', 'PAID')
      ) into current_already_charged;

      current_eligibility := finance.evaluate_charge_generation_eligibility(
        rule_row.generation_type,
        current_record_status,
        current_request_type,
        current_enrollment_status,
        current_account_status,
        current_is_excluded,
        current_already_charged,
        item_row.resolved_charge_rate_id,
        item_row.resolved_amount,
        version_row.due_date_strategy,
        item_row.due_date
      );
    end if;

    if current_eligibility <> 'ELIGIBLE' then
      perform set_config('finance.controlled_mutation', 'on', true);
      update finance.charge_generation_batch_items
      set processing_status = 'SKIPPED',
          eligibility_status = current_eligibility,
          exclusion_reason_code = case current_eligibility
            when 'ACCOUNT_NOT_ACTIVE' then 'ACCOUNT_NOT_ACTIVE'::finance.charge_generation_reason_code
            when 'ENROLLMENT_NOT_ELIGIBLE' then 'ENROLLMENT_NOT_ELIGIBLE'::finance.charge_generation_reason_code
            when 'ALREADY_CHARGED' then 'ALREADY_CHARGED'::finance.charge_generation_reason_code
            when 'EXPLICITLY_EXCLUDED' then 'EXPLICITLY_EXCLUDED'::finance.charge_generation_reason_code
            when 'NO_APPLICABLE_RATE' then 'NO_APPLICABLE_RATE'::finance.charge_generation_reason_code
            when 'MANUAL_REVIEW_REQUIRED' then 'MANUAL_REVIEW_REQUIRED'::finance.charge_generation_reason_code
            else exclusion_reason_code
          end,
          processed_at = statement_timestamp(),
          updated_at = statement_timestamp()
      where id = item_row.id;
      perform set_config('finance.controlled_mutation', 'off', true);
      perform finance.append_financial_event('CHARGE_GENERATION_SKIPPED', actor, operation_key || ':item:' || item_row.id::text, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id, 'batchItemId', item_row.id, 'eligibilityStatus', current_eligibility), correlation);
      continue;
    end if;

    current_due_date := item_row.due_date;
    if current_due_date is null then
      perform set_config('finance.controlled_mutation', 'on', true);
      update finance.charge_generation_batch_items
      set processing_status = 'SKIPPED',
          eligibility_status = 'MANUAL_REVIEW_REQUIRED',
          exclusion_reason_code = 'MANUAL_REVIEW_REQUIRED',
          processed_at = statement_timestamp(),
          updated_at = statement_timestamp()
      where id = item_row.id;
      perform set_config('finance.controlled_mutation', 'off', true);
      continue;
    end if;

    item_create_key := operation_key || ':create:' || item_row.id::text;
    item_post_key := operation_key || ':post:' || item_row.id::text;
    begin
      select result.entity_id, result.status
        into generated, item_status
      from finance.create_student_charge(
        item_row.student_account_id,
        rule_row.charge_concept_id,
        null,
        batch_row.academic_period_id,
        item_row.period_enrollment_id,
        rule_row.name,
        item_row.resolved_amount,
        current_due_date,
        finance.charge_generation_source_for(rule_row.generation_type),
        'cg:' || target_batch_id::text || ':' || item_row.id::text,
        item_create_key,
        correlation
      ) result;

      perform set_config('finance.controlled_mutation', 'on', true);
      update finance.student_charges
      set charge_rate_id = item_row.resolved_charge_rate_id,
          updated_at = statement_timestamp()
      where id = generated;
      perform set_config('finance.controlled_mutation', 'off', true);

      perform finance.post_student_charge(generated, item_post_key, correlation);

      perform set_config('finance.controlled_mutation', 'on', true);
      update finance.charge_generation_batch_items
      set processing_status='GENERATED', generated_charge_id=generated, processed_at=statement_timestamp(), updated_at=statement_timestamp()
      where id=item_row.id;
      perform set_config('finance.controlled_mutation', 'off', true);
      perform finance.append_financial_event('CHARGE_GENERATED', actor, operation_key || ':item:' || item_row.id::text, item_row.student_account_id, generated, null, null, null, jsonb_build_object('batchId', target_batch_id, 'batchItemId', item_row.id), correlation);
    exception
      when unique_violation then
        perform set_config('finance.controlled_mutation', 'on', true);
        update finance.charge_generation_batch_items
        set processing_status='SKIPPED', eligibility_status='ALREADY_CHARGED', exclusion_reason_code='ALREADY_CHARGED', processed_at=statement_timestamp(), updated_at=statement_timestamp()
        where id=item_row.id;
        perform set_config('finance.controlled_mutation', 'off', true);
      when others then
        perform set_config('finance.controlled_mutation', 'on', true);
        update finance.charge_generation_batch_items
        set processing_status='FAILED', error_code=sqlerrm, processed_at=statement_timestamp(), updated_at=statement_timestamp()
        where id=item_row.id;
        perform set_config('finance.controlled_mutation', 'off', true);
        perform finance.append_financial_event('CHARGE_GENERATION_FAILED', actor, operation_key || ':item:' || item_row.id::text, item_row.student_account_id, null, null, null, null, jsonb_build_object('batchId', target_batch_id, 'batchItemId', item_row.id, 'errorCode', sqlerrm), correlation);
    end;
  end loop;

  perform set_config('finance.controlled_mutation', 'on', true);
  update finance.charge_generation_batches batches
  set
    total_generated = stats.total_generated,
    total_skipped = stats.total_skipped,
    total_failed = stats.total_failed,
    generated_total = stats.generated_total,
    completed_at = statement_timestamp(),
    status = case
      when stats.total_failed > 0 then 'COMPLETED_WITH_ERRORS'::finance.charge_generation_batch_status
      else 'COMPLETED'::finance.charge_generation_batch_status
    end,
    updated_at = statement_timestamp()
  from (
    select
      count(*) filter (where processing_status = 'GENERATED') as total_generated,
      count(*) filter (where processing_status = 'SKIPPED') as total_skipped,
      count(*) filter (where processing_status = 'FAILED') as total_failed,
      coalesce(sum(resolved_amount) filter (where processing_status = 'GENERATED'), 0)::numeric(12,2) as generated_total
    from finance.charge_generation_batch_items
    where batch_id = target_batch_id
  ) stats
  where batches.id = target_batch_id;
  perform set_config('finance.controlled_mutation', 'off', true);

  perform finance.append_financial_event('CHARGE_GENERATION_COMPLETED', actor, operation_key, null, null, null, null, null, jsonb_build_object('batchId', target_batch_id), correlation);
  perform finance.complete_financial_command(actor, 'EXECUTE_CHARGE_GENERATION_BATCH', operation_key, 'CHARGE_GENERATION_BATCH', target_batch_id);
  return query
  select target_batch_id, (
    select batches.status::text
    from finance.charge_generation_batches batches
    where batches.id = target_batch_id
  );
end;
$$;

create or replace function public.preview_charge_generation(
  target_rule_version_id uuid,
  target_academic_period_id uuid,
  correlation uuid default null
)
returns table(
  student_record_id uuid,
  student_account_id uuid,
  period_enrollment_id uuid,
  student_identifier text,
  display_name text,
  group_name text,
  semester_number integer,
  eligibility_status finance.charge_generation_eligibility_status,
  reason_code finance.charge_generation_reason_code,
  resolved_charge_rate_id uuid,
  resolved_amount numeric(12,2),
  due_date date,
  total_candidates integer,
  total_eligible integer,
  total_already_charged integer,
  total_excluded integer,
  total_manual_review integer,
  total_without_rate integer,
  estimated_total numeric(12,2)
)
language sql
security invoker
set search_path=''
as $$ select * from finance.preview_charge_generation(target_rule_version_id, target_academic_period_id, correlation) $$;

create or replace function public.create_charge_generation_batch(
  target_rule_version_id uuid,
  target_academic_period_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$ select * from finance.create_charge_generation_batch(target_rule_version_id, target_academic_period_id, operation_key, correlation) $$;

create or replace function public.submit_charge_generation_batch(
  target_batch_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$ select * from finance.submit_charge_generation_batch(target_batch_id, operation_key, correlation) $$;

create or replace function public.approve_charge_generation_batch(
  target_batch_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$ select * from finance.approve_charge_generation_batch(target_batch_id, operation_key, correlation) $$;

create or replace function public.execute_charge_generation_batch(
  target_batch_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security invoker
set search_path=''
as $$ select * from finance.execute_charge_generation_batch(target_batch_id, operation_key, correlation) $$;

create function finance.guard_charge_generation_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if current_setting('finance.controlled_mutation', true) = 'on' then
    return new;
  end if;
  raise exception using errcode='42501', message='HISTORICAL_RECORD_IMMUTABLE';
end;
$$;

create trigger charge_generation_rules_guard
before update or delete on finance.charge_generation_rules
for each row execute function finance.guard_charge_generation_mutation();

create trigger charge_generation_rule_versions_guard
before update or delete on finance.charge_generation_rule_versions
for each row execute function finance.guard_charge_generation_mutation();

create trigger charge_generation_batches_guard
before update or delete on finance.charge_generation_batches
for each row execute function finance.guard_charge_generation_mutation();

create trigger charge_generation_batch_items_guard
before update or delete on finance.charge_generation_batch_items
for each row execute function finance.guard_charge_generation_mutation();

create trigger charge_generation_exclusions_guard
before update or delete on finance.charge_generation_exclusions
for each row execute function finance.guard_charge_generation_mutation();

create trigger charge_generation_rules_touch
before update on finance.charge_generation_rules
for each row execute function finance.touch_updated_at();

create trigger charge_generation_rule_versions_touch
before update on finance.charge_generation_rule_versions
for each row execute function finance.touch_updated_at();

create trigger charge_generation_batches_touch
before update on finance.charge_generation_batches
for each row execute function finance.touch_updated_at();

create trigger charge_generation_batch_items_touch
before update on finance.charge_generation_batch_items
for each row execute function finance.touch_updated_at();

create trigger charge_generation_exclusions_touch
before update on finance.charge_generation_exclusions
for each row execute function finance.touch_updated_at();

alter table finance.charge_generation_rules enable row level security;
alter table finance.charge_generation_rule_versions enable row level security;
alter table finance.charge_generation_batches enable row level security;
alter table finance.charge_generation_batch_items enable row level security;
alter table finance.charge_generation_exclusions enable row level security;

revoke all on table finance.charge_generation_rules from public, anon, authenticated;
revoke all on table finance.charge_generation_rule_versions from public, anon, authenticated;
revoke all on table finance.charge_generation_batches from public, anon, authenticated;
revoke all on table finance.charge_generation_batch_items from public, anon, authenticated;
revoke all on table finance.charge_generation_exclusions from public, anon, authenticated;

revoke all on function finance.require_charge_generation_permission(text) from public, anon, authenticated;
revoke all on function finance.preview_charge_generation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function finance.create_charge_generation_rule(text, text, uuid, finance.charge_generation_type, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_charge_generation_rule_version(uuid, uuid, uuid, integer, uuid, uuid, finance.charge_generation_due_date_strategy, date, integer, integer, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_charge_generation_rule_version(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.activate_charge_generation_rule_version(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_charge_generation_exclusion(uuid, uuid, uuid, uuid, finance.charge_generation_reason_code, timestamptz, timestamptz, text, uuid) from public, anon, authenticated;
revoke all on function finance.create_charge_generation_batch(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.submit_charge_generation_batch(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.approve_charge_generation_batch(uuid, text, uuid) from public, anon, authenticated;
revoke all on function finance.execute_charge_generation_batch(uuid, text, uuid) from public, anon, authenticated;

grant execute on function public.preview_charge_generation(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_charge_generation_batch(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.submit_charge_generation_batch(uuid, text, uuid) to authenticated;
grant execute on function public.approve_charge_generation_batch(uuid, text, uuid) to authenticated;
grant execute on function public.execute_charge_generation_batch(uuid, text, uuid) to authenticated;

commit;
