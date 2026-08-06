begin;

alter type academic.guardian_portal_command_type add value if not exists 'UPDATE_SCOPE';
alter type academic.guardian_portal_event_type add value if not exists 'GUARDIAN_SCOPE_UPDATED';

alter table academic.guardian_access_scopes
  add column if not exists can_view_documents boolean not null default false;

update academic.guardian_access_scopes
set can_view_documents = false
where code = 'STANDARD_ACADEMIC_READ';

create type academic.document_type_code as enum (
  'SEMESTER_REPORT',
  'ENROLLMENT_CERTIFICATE',
  'ACADEMIC_TRANSCRIPT',
  'ENROLLMENT_RECEIPT'
);
create type academic.document_type_status as enum ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED');
create type academic.document_template_status as enum ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED');
create type academic.document_template_version_status as enum (
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ACTIVE',
  'RETIRED'
);
create type academic.document_request_source as enum (
  'CONTROL_ESCOLAR',
  'ADMINISTRATIVE_REQUEST',
  'AUTOMATED_PERIOD_CLOSE'
);
create type academic.document_request_status as enum (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'ISSUED',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'MANUAL_REVIEW_REQUIRED'
);
create type academic.document_request_reason_code as enum (
  'MANUAL_REVIEW_REQUIRED',
  'CONTROL_ESCOLAR_REQUEST',
  'ADMINISTRATIVE_REQUEST',
  'AUTOMATED_PERIOD_CLOSE',
  'INSTITUTIONAL_VALIDATION_PENDING',
  'DATA_INCOMPLETE',
  'PUBLISHED_DATA_REQUIRED',
  'DOCUMENT_SCOPE_DENIED',
  'REVOKED_BY_INSTITUTION',
  'SUPERSEDED_BY_INSTITUTION'
);
create type academic.document_issuance_status as enum (
  'PREPARING',
  'GENERATED',
  'VALIDATED',
  'PUBLISHED',
  'REVOKED',
  'SUPERSEDED',
  'FAILED'
);
create type academic.document_file_provider as enum ('LOCAL_TEST');
create type academic.document_file_status as enum ('PENDING', 'ATTACHED', 'REVOKED');
create type academic.document_verification_status as enum ('ACTIVE', 'REVOKED', 'EXPIRED');
create type academic.document_event_type as enum (
  'DOCUMENT_REQUEST_CREATED',
  'DOCUMENT_REQUEST_SUBMITTED',
  'DOCUMENT_REVIEW_STARTED',
  'DOCUMENT_REQUEST_APPROVED',
  'DOCUMENT_REQUEST_REJECTED',
  'DOCUMENT_SNAPSHOT_CREATED',
  'DOCUMENT_ISSUANCE_CREATED',
  'DOCUMENT_FOLIO_ASSIGNED',
  'DOCUMENT_FILE_ATTACHED',
  'DOCUMENT_VALIDATED',
  'DOCUMENT_PUBLISHED',
  'DOCUMENT_REVOKED',
  'DOCUMENT_SUPERSEDED',
  'DOCUMENT_GENERATION_FAILED',
  'DOCUMENT_DOWNLOAD_AUTHORIZED',
  'DOCUMENT_DOWNLOAD_DENIED',
  'DOCUMENT_PUBLIC_VERIFICATION_SUCCEEDED',
  'DOCUMENT_PUBLIC_VERIFICATION_FAILED'
);
create type academic.document_command_type as enum (
  'CREATE_DOCUMENT_REQUEST',
  'SUBMIT_DOCUMENT_REQUEST',
  'BEGIN_DOCUMENT_REVIEW',
  'APPROVE_DOCUMENT_REQUEST',
  'REJECT_DOCUMENT_REQUEST',
  'GENERATE_DOCUMENT_SNAPSHOT',
  'CREATE_DOCUMENT_ISSUANCE',
  'ASSIGN_DOCUMENT_FOLIO',
  'ATTACH_DOCUMENT_FILE',
  'VALIDATE_DOCUMENT_ISSUANCE',
  'PUBLISH_DOCUMENT',
  'REVOKE_DOCUMENT',
  'SUPERSEDE_DOCUMENT',
  'FAIL_DOCUMENT_GENERATION',
  'UPDATE_GUARDIAN_SCOPE'
);
create type academic.document_command_status as enum ('IN_PROGRESS', 'COMPLETED', 'FAILED');
create type academic.document_entity_type as enum (
  'DOCUMENT_TYPE',
  'DOCUMENT_TEMPLATE',
  'DOCUMENT_TEMPLATE_VERSION',
  'DOCUMENT_REQUEST',
  'DOCUMENT_ISSUANCE',
  'DOCUMENT_SNAPSHOT',
  'DOCUMENT_FILE',
  'DOCUMENT_VERIFICATION_CODE'
);

create table academic.document_types (
  id uuid primary key default gen_random_uuid(),
  code academic.document_type_code not null unique,
  visible_name text not null,
  status academic.document_type_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic.document_templates (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references academic.document_types(id) on delete restrict,
  code academic.normalized_code not null unique,
  name text not null,
  status academic.document_template_status not null default 'DRAFT',
  active_version_id uuid,
  created_by_account_id uuid references core.accounts(id) on delete restrict,
  is_system_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (is_system_template and created_by_account_id is null)
    or (not is_system_template and created_by_account_id is not null)
  )
);

create table academic.document_template_versions (
  id uuid primary key default gen_random_uuid(),
  document_template_id uuid not null references academic.document_templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  schema_version text not null,
  rendering_engine text not null,
  template_checksum text not null check (template_checksum ~ '^[0-9a-f]{64}$'),
  status academic.document_template_version_status not null default 'DRAFT',
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(document_template_id, version_number),
  check (effective_until is null or effective_until >= effective_from)
);

alter table academic.document_templates
  add constraint document_templates_active_version_fk
  foreign key (active_version_id) references academic.document_template_versions(id) on delete restrict;

create unique index document_template_one_active_version
  on academic.document_template_versions(document_template_id)
  where status = 'ACTIVE';

create table academic.document_requests (
  id uuid primary key default gen_random_uuid(),
  document_type_id uuid not null references academic.document_types(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  requested_period_id uuid references academic.academic_periods(id) on delete restrict,
  requested_by_account_id uuid not null references core.accounts(id) on delete restrict,
  request_source academic.document_request_source not null,
  status academic.document_request_status not null default 'DRAFT',
  reason_code academic.document_request_reason_code not null default 'MANUAL_REVIEW_REQUIRED',
  idempotency_key academic.normalized_code not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default now(),
  reviewed_by_account_id uuid references core.accounts(id) on delete restrict,
  reviewed_at timestamptz,
  rejected_by_account_id uuid references core.accounts(id) on delete restrict,
  rejected_at timestamptz,
  rejection_reason_code academic.document_request_reason_code,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requested_by_account_id, idempotency_key)
);

create table academic.document_issuances (
  id uuid primary key default gen_random_uuid(),
  document_request_id uuid not null unique references academic.document_requests(id) on delete restrict,
  document_type_id uuid not null references academic.document_types(id) on delete restrict,
  template_version_id uuid not null references academic.document_template_versions(id) on delete restrict,
  student_record_id uuid not null references academic.student_records(id) on delete restrict,
  requested_period_id uuid references academic.academic_periods(id) on delete restrict,
  institutional_folio text unique,
  status academic.document_issuance_status not null default 'PREPARING',
  supersedes_issuance_id uuid references academic.document_issuances(id) on delete restrict,
  superseded_by_issuance_id uuid unique references academic.document_issuances(id) on delete restrict,
  issued_by_account_id uuid not null references core.accounts(id) on delete restrict,
  issued_at timestamptz not null default now(),
  published_by_account_id uuid references core.accounts(id) on delete restrict,
  published_at timestamptz,
  revoked_by_account_id uuid references core.accounts(id) on delete restrict,
  revoked_at timestamptz,
  revocation_reason_code academic.document_request_reason_code,
  expires_at timestamptz,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  file_hash text check (file_hash is null or file_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create unique index document_one_visible_published
  on academic.document_issuances(student_record_id, document_type_id, requested_period_id)
  where status = 'PUBLISHED';

create table academic.document_snapshots (
  id uuid primary key default gen_random_uuid(),
  document_issuance_id uuid not null unique references academic.document_issuances(id) on delete restrict,
  schema_version text not null,
  snapshot_payload jsonb not null,
  snapshot_hash text not null check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table academic.document_files (
  id uuid primary key default gen_random_uuid(),
  document_issuance_id uuid not null unique references academic.document_issuances(id) on delete restrict,
  storage_provider academic.document_file_provider not null,
  bucket_name text not null,
  object_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  file_hash text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  status academic.document_file_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  check (mime_type = 'application/pdf'),
  check (position(':' in object_path) = 0),
  check (object_path !~ '^[A-Za-z]\\\\')
);

create table academic.document_verification_codes (
  id uuid primary key default gen_random_uuid(),
  document_issuance_id uuid not null unique references academic.document_issuances(id) on delete restrict,
  public_code_hash text not null check (public_code_hash ~ '^[0-9a-f]{64}$'),
  code_prefix text not null,
  status academic.document_verification_status not null default 'ACTIVE',
  valid_from timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (valid_until is null or valid_until >= valid_from)
);

create table academic.document_events (
  id uuid primary key default gen_random_uuid(),
  document_issuance_id uuid references academic.document_issuances(id) on delete restrict,
  document_request_id uuid references academic.document_requests(id) on delete restrict,
  student_record_id uuid references academic.student_records(id) on delete restrict,
  entity_type academic.document_entity_type not null,
  entity_id uuid not null,
  event_type academic.document_event_type not null,
  actor_account_id uuid references core.accounts(id) on delete restrict,
  previous_status text,
  resulting_status text,
  reason_code academic.document_request_reason_code,
  idempotency_key academic.normalized_code not null,
  correlation_id uuid,
  occurred_at timestamptz not null default now(),
  unique(event_type, idempotency_key)
);

create table academic.document_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key academic.normalized_code not null,
  command_type academic.document_command_type not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status academic.document_command_status not null default 'IN_PROGRESS',
  result_entity_type academic.document_entity_type,
  result_entity_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(actor_account_id, command_type, idempotency_key)
);

create table academic.document_folio_sequences (
  id uuid primary key default gen_random_uuid(),
  document_type_code academic.document_type_code not null,
  issue_year integer not null check (issue_year between 2000 and 2999),
  last_value bigint not null default 0 check (last_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_type_code, issue_year)
);

create index document_requests_student_idx on academic.document_requests(student_record_id, requested_at desc);
create index document_issuances_student_idx on academic.document_issuances(student_record_id, issued_at desc);
create index document_issuances_folio_idx on academic.document_issuances(institutional_folio);
create index document_events_student_idx on academic.document_events(student_record_id, occurred_at desc);
create index document_commands_created_idx on academic.document_commands(created_at);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'document_types',
    'document_templates',
    'document_template_versions',
    'document_requests',
    'document_issuances',
    'document_snapshots',
    'document_files',
    'document_verification_codes',
    'document_events',
    'document_commands'
  ] loop
    execute format('alter table academic.%I enable row level security', table_name);
    execute format('revoke all on table academic.%I from public, anon, authenticated', table_name);
  end loop;
end$$;

create function academic.document_hash(payload text)
returns text
language sql
immutable
strict
security invoker
set search_path=''
as $$ select encode(extensions.digest(convert_to(payload, 'UTF8'), 'sha256'), 'hex') $$;

create function academic.document_payload_hash(payload jsonb)
returns text
language sql
immutable
strict
security invoker
set search_path=''
as $$ select academic.document_hash(payload::text) $$;

create function academic.document_type_short(code academic.document_type_code)
returns text
language sql
immutable
strict
security invoker
set search_path=''
as $$
  select case code
    when 'SEMESTER_REPORT' then 'SRP'
    when 'ENROLLMENT_CERTIFICATE' then 'ECT'
    when 'ACADEMIC_TRANSCRIPT' then 'ATR'
    when 'ENROLLMENT_RECEIPT' then 'ERC'
  end
$$;

create function academic.require_document_permission(permission_code text)
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
  if auth.uid() is null then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  if permission_code not in (
    'documents.types.manage',
    'documents.templates.manage',
    'documents.requests.create',
    'documents.requests.review',
    'documents.requests.approve',
    'documents.generate',
    'documents.publish',
    'documents.revoke',
    'documents.supersede',
    'documents.verify.audit'
  ) then
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
  select * into actor
  from core.accounts
  where auth_user_id = auth.uid();
  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  select coalesce(array_agg(r.code), array[]::text[]) into role_codes
  from core.account_roles ar
  join core.roles r on r.id = ar.role_id and r.is_active
  where ar.account_id = actor.id
    and ar.revoked_at is null;
  if role_codes && array['SUPERADMIN'] then
    allowed := true;
  elsif role_codes && array['ADMINISTRATIVO','CONTROL_ESCOLAR'] then
    allowed := permission_code in (
      'documents.requests.create',
      'documents.requests.review',
      'documents.requests.approve',
      'documents.generate',
      'documents.publish',
      'documents.revoke',
      'documents.supersede',
      'documents.verify.audit',
      'documents.templates.manage',
      'documents.types.manage'
    );
  end if;
  if not allowed then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;
  return actor.id;
end$$;

create function academic.begin_document_command(
  actor uuid,
  kind academic.document_command_type,
  operation_key text,
  payload jsonb
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  fingerprint text := academic.document_payload_hash(payload);
  existing academic.document_commands%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text || kind::text || operation_key, 0));
  select * into existing
  from academic.document_commands
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
  insert into academic.document_commands(idempotency_key, command_type, actor_account_id, request_fingerprint)
  values(operation_key, kind, actor, fingerprint);
  return null;
end$$;

create function academic.complete_document_command(
  actor_id uuid,
  command_kind academic.document_command_type,
  operation_key text,
  result_type academic.document_entity_type,
  result_id uuid
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update academic.document_commands commands
  set status = 'COMPLETED',
      result_entity_type = result_type,
      result_entity_id = result_id,
      completed_at = statement_timestamp()
  where commands.actor_account_id = actor_id
    and commands.command_type = command_kind
    and commands.idempotency_key = operation_key;
end$$;

create function academic.append_document_event(
  issuance_id uuid,
  request_id uuid,
  student_id uuid,
  entity_type academic.document_entity_type,
  entity_id uuid,
  event_type academic.document_event_type,
  actor uuid,
  previous_status text,
  resulting_status text,
  reason academic.document_request_reason_code,
  operation_key text,
  correlation uuid default null
) returns void
language sql
security definer
set search_path=''
as $$
  insert into academic.document_events(
    document_issuance_id,
    document_request_id,
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
    issuance_id,
    request_id,
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
  on conflict(event_type, idempotency_key) do nothing
$$;

create function academic.guard_document_objects()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'DOCUMENT_OPERATION_FAILED';
  end if;
  if current_setting('academic.document_controlled_mutation', true) = 'on' then
    return new;
  end if;
  if tg_table_name in ('document_snapshots', 'document_events', 'document_verification_codes') then
    raise exception 'DOCUMENT_OPERATION_FAILED';
  end if;
  if tg_table_name = 'document_commands' then
    if to_jsonb(old)->>'status' = 'COMPLETED' and new is distinct from old then
      raise exception 'DOCUMENT_OPERATION_FAILED';
    end if;
  end if;
  if tg_table_name = 'document_issuances' then
    if coalesce(to_jsonb(old)->>'status', '') in ('PUBLISHED', 'REVOKED', 'SUPERSEDED') and new is distinct from old then
      raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
    end if;
    if (new.document_request_id, new.document_type_id, new.template_version_id, new.student_record_id, new.snapshot_hash, new.content_hash, new.institutional_folio)
       is distinct from
       (old.document_request_id, old.document_type_id, old.template_version_id, old.student_record_id, old.snapshot_hash, old.content_hash, old.institutional_folio) then
      raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
    end if;
  end if;
  if tg_table_name = 'document_files' then
    if to_jsonb(old)->>'status' = 'ATTACHED' and new is distinct from old then
      raise exception 'DOCUMENT_FILE_INVALID';
    end if;
  end if;
  if tg_table_name = 'document_requests' and coalesce(to_jsonb(old)->>'status', '') in ('ISSUED', 'REJECTED', 'CANCELLED', 'EXPIRED') and new is distinct from old then
    raise exception 'DOCUMENT_REQUEST_INVALID_STATE';
  end if;
  return new;
end$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'document_types',
    'document_templates',
    'document_template_versions',
    'document_requests',
    'document_issuances',
    'document_snapshots',
    'document_files',
    'document_verification_codes',
    'document_events',
    'document_commands',
    'document_folio_sequences'
  ] loop
    execute format(
      'create trigger %I_guard before update or delete on academic.%I for each row execute function academic.guard_document_objects()',
      table_name,
      table_name
    );
  end loop;
end$$;

create function academic.require_document_request_eligibility(
  document_type uuid,
  student_record uuid,
  requested_period uuid default null
) returns table(
  resolved_period_id uuid,
  resolved_period_enrollment_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  doc_type academic.document_types%rowtype;
  student academic.student_records%rowtype;
  period_row academic.period_enrollments%rowtype;
begin
  select * into doc_type from academic.document_types where id = document_type;
  if doc_type.id is null or doc_type.status <> 'ACTIVE' then
    raise exception 'DOCUMENT_TYPE_NOT_ACTIVE';
  end if;
  select * into student from academic.student_records where id = student_record;
  if student.id is null or student.status not in ('ACTIVE','COMPLETED','GRADUATED','ACADEMICALLY_BLOCKED','TEMPORARILY_WITHDRAWN') then
    raise exception 'DOCUMENT_ELIGIBILITY_FAILED';
  end if;
  if requested_period is null then
    select pe.*
    into period_row
    from academic.period_enrollments pe
    join academic.academic_periods ap on ap.id = pe.academic_period_id
    where pe.student_record_id = student_record
      and pe.status <> 'CANCELLED'
    order by ap.starts_on desc, pe.enrolled_at desc
    limit 1;
  else
    select * into period_row
    from academic.period_enrollments pe
    where pe.student_record_id = student_record
      and pe.academic_period_id = requested_period
      and pe.status <> 'CANCELLED'
    limit 1;
  end if;
  if period_row.id is null then
    raise exception 'DOCUMENT_DATA_INCOMPLETE';
  end if;
  return query select period_row.academic_period_id, period_row.id;
end$$;

create function academic.resolve_active_template_version(
  requested_document_type_id uuid
) returns uuid
language sql
stable
security definer
set search_path=''
as $$
  select versions.id
  from academic.document_templates templates
  join academic.document_template_versions versions
    on versions.document_template_id = templates.id
   and versions.status = 'ACTIVE'
  where templates.document_type_id = requested_document_type_id
    and templates.status = 'ACTIVE'
  order by versions.version_number desc
  limit 1
$$;

create function academic.build_document_snapshot(
  requested_document_type academic.document_type_code,
  requested_student_record uuid,
  requested_period uuid,
  issuance_folio text,
  issued_at_value timestamptz
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  record_row record;
  period_row record;
  summary_row jsonb := '{}'::jsonb;
  subjects_row jsonb := '[]'::jsonb;
begin
  select
    sr.id,
    sr.institutional_student_code,
    sr.current_semester_number,
    sr.status as student_status,
    plans.code as plan_code,
    plans.name as plan_name,
    generations.code as generation_code,
    generations.name as generation_name,
    groups.code as group_code,
    groups.display_name as group_name,
    areas.code as area_code,
    areas.name as area_name
  into record_row
  from academic.student_records sr
  join academic.study_plans plans on plans.id = sr.study_plan_id
  join academic.student_generations generations on generations.id = sr.generation_id
  left join academic.period_enrollments pe on pe.student_record_id = sr.id and pe.academic_period_id = requested_period and pe.status <> 'CANCELLED'
  left join academic.groups groups on groups.id = pe.group_id
  left join academic.training_areas areas on areas.id = coalesce(pe.training_area_id, sr.current_training_area_id)
  where sr.id = requested_student_record;

  select
    ap.id,
    ap.code,
    ap.name,
    ap.starts_on,
    ap.ends_on,
    pe.semester_number,
    pe.status as enrollment_status,
    pe.enrolled_at
  into period_row
  from academic.academic_periods ap
  join academic.period_enrollments pe on pe.academic_period_id = ap.id
  where ap.id = requested_period
    and pe.student_record_id = requested_student_record
    and pe.status <> 'CANCELLED'
  order by pe.enrolled_at desc
  limit 1;

  if requested_document_type = 'SEMESTER_REPORT' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'subjectCode', subjects.code,
          'subjectName', subjects.name,
          'finalGrade', results.rounded_final_grade,
          'resultCode', results.result_code,
          'status', results.status
        )
        order by subjects.name
      ),
      '[]'::jsonb
    )
    into subjects_row
    from academic.subject_final_results results
    join academic.student_offering_enrollments soe on soe.id = results.student_offering_enrollment_id
    join academic.academic_offerings offerings on offerings.id = soe.academic_offering_id
    join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
    join academic.subjects subjects on subjects.id = curriculum.subject_id
    where results.student_record_id = requested_student_record
      and results.period_enrollment_id = period_row.id
      and results.status = 'CONFIRMED';
  elsif requested_document_type = 'ACADEMIC_TRANSCRIPT' then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'academicPeriodCode', ap.code,
          'academicPeriodName', ap.name,
          'semesterNumber', pe.semester_number,
          'subjects', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'subjectCode', s.code,
                  'subjectName', s.name,
                  'finalGrade', r.rounded_final_grade,
                  'resultCode', r.result_code
                )
                order by s.name
              ),
              '[]'::jsonb
            )
            from academic.subject_final_results r
            join academic.student_offering_enrollments soe on soe.id = r.student_offering_enrollment_id
            join academic.academic_offerings ao on ao.id = soe.academic_offering_id
            join academic.curriculum_subjects cs on cs.id = ao.curriculum_subject_id
            join academic.subjects s on s.id = cs.subject_id
            where r.period_enrollment_id = pe.id
              and r.status = 'CONFIRMED'
          )
        )
        order by ap.starts_on
      ),
      '[]'::jsonb
    )
    into subjects_row
    from academic.period_enrollments pe
    join academic.academic_periods ap on ap.id = pe.academic_period_id
    where pe.student_record_id = requested_student_record
      and pe.status <> 'CANCELLED';
  end if;

  if requested_document_type in ('SEMESTER_REPORT', 'ACADEMIC_TRANSCRIPT') then
    select to_jsonb(summaries.*) - 'id' - 'student_record_id' - 'period_enrollment_id' - 'academic_period_id'
    into summary_row
    from academic.semester_evaluation_summaries summaries
    where summaries.period_enrollment_id = period_row.id
      and summaries.evaluation_status = 'CONFIRMED'
    limit 1;
  end if;

  return jsonb_build_object(
    'schemaVersion', 'academic-document-v1',
    'documentType', requested_document_type,
    'folio', issuance_folio,
    'issuedAt', issued_at_value,
    'disclaimer', 'Documento informativo generado por el sistema. Su validez institucional está pendiente de confirmación.',
    'student', jsonb_build_object(
      'institutionalStudentCode', record_row.institutional_student_code,
      'currentSemesterNumber', record_row.current_semester_number,
      'studentStatus', record_row.student_status
    ),
    'plan', jsonb_build_object(
      'code', record_row.plan_code,
      'name', record_row.plan_name
    ),
    'generation', jsonb_build_object(
      'code', record_row.generation_code,
      'name', record_row.generation_name
    ),
    'period', jsonb_build_object(
      'id', period_row.id,
      'code', period_row.code,
      'name', period_row.name,
      'startsOn', period_row.starts_on,
      'endsOn', period_row.ends_on,
      'semesterNumber', period_row.semester_number,
      'enrollmentStatus', period_row.enrollment_status,
      'enrolledAt', period_row.enrolled_at
    ),
    'group', jsonb_build_object(
      'code', record_row.group_code,
      'name', record_row.group_name
    ),
    'trainingArea', jsonb_build_object(
      'code', record_row.area_code,
      'name', record_row.area_name
    ),
    'summary', coalesce(summary_row, '{}'::jsonb),
    'subjects', subjects_row
  );
end$$;

create function academic.create_document_request(
  requested_document_type_id uuid,
  requested_student_record_id uuid,
  requested_period_id uuid,
  request_source academic.document_request_source,
  reason_code academic.document_request_reason_code,
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
  eligibility record;
begin
  actor := academic.require_document_permission('documents.requests.create');
  prior := academic.begin_document_command(
    actor,
    'CREATE_DOCUMENT_REQUEST',
    operation_key,
    jsonb_build_object(
      'documentType', requested_document_type_id,
      'studentRecord', requested_student_record_id,
      'period', requested_period_id,
      'source', request_source,
      'reason', reason_code
    )
  );
  if prior is not null then
    return query select prior, 'DRAFT';
    return;
  end if;
  select * into eligibility
  from academic.require_document_request_eligibility(
    requested_document_type_id,
    requested_student_record_id,
    requested_period_id
  );
  insert into academic.document_requests(
    document_type_id,
    student_record_id,
    requested_period_id,
    requested_by_account_id,
    request_source,
    status,
    reason_code,
    idempotency_key,
    request_fingerprint
  )
  values(
    requested_document_type_id,
    requested_student_record_id,
    eligibility.resolved_period_id,
    actor,
    request_source,
    'DRAFT',
    reason_code,
    operation_key,
    academic.document_payload_hash(
      jsonb_build_object(
        'documentType', requested_document_type_id,
        'studentRecord', requested_student_record_id,
        'period', eligibility.resolved_period_id,
        'source', request_source,
        'reason', reason_code
      )
    )
  )
  returning id into created;
  perform academic.append_document_event(
    null,
    created,
    requested_student_record_id,
    'DOCUMENT_REQUEST',
    created,
    'DOCUMENT_REQUEST_CREATED',
    actor,
    null,
    'DRAFT',
    reason_code,
    operation_key,
    correlation
  );
  perform academic.complete_document_command(actor, 'CREATE_DOCUMENT_REQUEST', operation_key, 'DOCUMENT_REQUEST', created);
  return query select created, 'DRAFT';
end$$;

create function academic.change_document_request_status(
  request_id uuid,
  target academic.document_request_status,
  command_name academic.document_command_type,
  permission_code text,
  event_name academic.document_event_type,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  request_row academic.document_requests%rowtype;
  prior uuid;
begin
  actor := academic.require_document_permission(permission_code);
  prior := academic.begin_document_command(
    actor,
    command_name,
    operation_key,
    jsonb_build_object('request', request_id, 'target', target)
  );
  if prior is not null then
    return query select prior, target::text;
    return;
  end if;
  select * into request_row
  from academic.document_requests
  where id = request_id
  for update;
  if request_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;
  if request_row.status = target then
    return query select request_row.id, target::text;
    return;
  end if;
  if (request_row.status, target) not in (
    ('DRAFT','SUBMITTED'),
    ('SUBMITTED','UNDER_REVIEW'),
    ('UNDER_REVIEW','APPROVED'),
    ('UNDER_REVIEW','REJECTED'),
    ('APPROVED','PROCESSING'),
    ('PROCESSING','ISSUED'),
    ('SUBMITTED','CANCELLED'),
    ('UNDER_REVIEW','CANCELLED'),
    ('SUBMITTED','EXPIRED'),
    ('UNDER_REVIEW','EXPIRED'),
    ('PROCESSING','FAILED'),
    ('APPROVED','MANUAL_REVIEW_REQUIRED'),
    ('PROCESSING','MANUAL_REVIEW_REQUIRED')
  ) then
    raise exception 'DOCUMENT_REQUEST_INVALID_STATE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_requests
  set status = target,
      reviewed_by_account_id = case when target in ('UNDER_REVIEW','APPROVED') then actor else reviewed_by_account_id end,
      reviewed_at = case when target in ('UNDER_REVIEW','APPROVED') then statement_timestamp() else reviewed_at end,
      rejected_by_account_id = case when target = 'REJECTED' then actor else rejected_by_account_id end,
      rejected_at = case when target = 'REJECTED' then statement_timestamp() else rejected_at end,
      updated_at = statement_timestamp()
  where id = request_id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(
    null,
    request_row.id,
    request_row.student_record_id,
    'DOCUMENT_REQUEST',
    request_row.id,
    event_name,
    actor,
    request_row.status::text,
    target::text,
    request_row.reason_code,
    operation_key,
    correlation
  );
  perform academic.complete_document_command(actor, command_name, operation_key, 'DOCUMENT_REQUEST', request_row.id);
  return query select request_row.id, target::text;
end$$;

create function academic.submit_document_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language sql security definer set search_path='' as
$$ select * from academic.change_document_request_status(request_id, 'SUBMITTED', 'SUBMIT_DOCUMENT_REQUEST', 'documents.requests.create', 'DOCUMENT_REQUEST_SUBMITTED', operation_key, correlation) $$;
create function academic.begin_document_review(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language sql security definer set search_path='' as
$$ select * from academic.change_document_request_status(request_id, 'UNDER_REVIEW', 'BEGIN_DOCUMENT_REVIEW', 'documents.requests.review', 'DOCUMENT_REVIEW_STARTED', operation_key, correlation) $$;
create function academic.approve_document_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language sql security definer set search_path='' as
$$ select * from academic.change_document_request_status(request_id, 'APPROVED', 'APPROVE_DOCUMENT_REQUEST', 'documents.requests.approve', 'DOCUMENT_REQUEST_APPROVED', operation_key, correlation) $$;
create function academic.reject_document_request(request_id uuid, operation_key text, correlation uuid default null)
returns table(entity_id uuid, status text)
language sql security definer set search_path='' as
$$ select * from academic.change_document_request_status(request_id, 'REJECTED', 'REJECT_DOCUMENT_REQUEST', 'documents.requests.review', 'DOCUMENT_REQUEST_REJECTED', operation_key, correlation) $$;

create function academic.create_document_issuance(
  request_id uuid,
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
  request_row academic.document_requests%rowtype;
  version_id uuid;
  created uuid;
begin
  actor := academic.require_document_permission('documents.generate');
  prior := academic.begin_document_command(actor, 'CREATE_DOCUMENT_ISSUANCE', operation_key, jsonb_build_object('request', request_id));
  if prior is not null then
    return query select prior, 'PREPARING';
    return;
  end if;
  select * into request_row from academic.document_requests where id = request_id for update;
  if request_row.id is null or request_row.status <> 'APPROVED' then
    raise exception 'DOCUMENT_REQUEST_INVALID_STATE';
  end if;
  version_id := academic.resolve_active_template_version(request_row.document_type_id);
  if version_id is null then
    raise exception 'DOCUMENT_TEMPLATE_NOT_ACTIVE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_requests set status = 'PROCESSING', updated_at = statement_timestamp() where id = request_row.id;
  insert into academic.document_issuances(
    document_request_id,
    document_type_id,
    template_version_id,
    student_record_id,
    requested_period_id,
    status,
    issued_by_account_id,
    content_hash,
    snapshot_hash
  )
  values(
    request_row.id,
    request_row.document_type_id,
    version_id,
    request_row.student_record_id,
    request_row.requested_period_id,
    'PREPARING',
    actor,
    repeat('0', 64),
    repeat('0', 64)
  )
  returning id into created;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(created, request_row.id, request_row.student_record_id, 'DOCUMENT_ISSUANCE', created, 'DOCUMENT_ISSUANCE_CREATED', actor, null, 'PREPARING', request_row.reason_code, operation_key, correlation);
  perform academic.complete_document_command(actor, 'CREATE_DOCUMENT_ISSUANCE', operation_key, 'DOCUMENT_ISSUANCE', created);
  return query select created, 'PREPARING';
end$$;

create function academic.assign_document_folio(
  issuance_id uuid,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, institutional_folio text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  issuance_row academic.document_issuances%rowtype;
  document_code academic.document_type_code;
  issue_year_value integer := extract(year from statement_timestamp())::integer;
  next_value bigint;
  folio_value text;
begin
  actor := academic.require_document_permission('documents.generate');
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  if issuance_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;
  if issuance_row.institutional_folio is not null then
    return query select issuance_row.id, issuance_row.institutional_folio;
    return;
  end if;
  prior := academic.begin_document_command(actor, 'ASSIGN_DOCUMENT_FOLIO', operation_key, jsonb_build_object('issuance', issuance_id));
  if prior is not null then
    return query
    select prior, (select issuances.institutional_folio from academic.document_issuances issuances where issuances.id = prior);
    return;
  end if;
  if issuance_row.id is null or issuance_row.status <> 'PREPARING' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  select code into document_code from academic.document_types where id = issuance_row.document_type_id;
  insert into academic.document_folio_sequences(document_type_code, issue_year, last_value)
  values(document_code, issue_year_value, 0)
  on conflict(document_type_code, issue_year) do nothing;
  update academic.document_folio_sequences
  set last_value = last_value + 1,
      updated_at = statement_timestamp()
  where document_type_code = document_code
    and issue_year = issue_year_value
  returning last_value into next_value;
  folio_value := format('DOC-%s-%s-%s', academic.document_type_short(document_code), issue_year_value, lpad(next_value::text, 6, '0'));
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_issuances
  set institutional_folio = folio_value
  where id = issuance_row.id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_ISSUANCE', issuance_row.id, 'DOCUMENT_FOLIO_ASSIGNED', actor, 'PREPARING', 'PREPARING', 'INSTITUTIONAL_VALIDATION_PENDING', operation_key, correlation);
  perform academic.complete_document_command(actor, 'ASSIGN_DOCUMENT_FOLIO', operation_key, 'DOCUMENT_ISSUANCE', issuance_row.id);
  return query select issuance_row.id, folio_value;
end$$;

create function academic.generate_document_snapshot(
  issuance_id uuid,
  operation_key text,
  correlation uuid default null
) returns table(entity_id uuid, snapshot_hash text)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid;
  prior uuid;
  issuance_row academic.document_issuances%rowtype;
  document_code academic.document_type_code;
  payload jsonb;
  payload_hash text;
begin
  actor := academic.require_document_permission('documents.generate');
  prior := academic.begin_document_command(actor, 'GENERATE_DOCUMENT_SNAPSHOT', operation_key, jsonb_build_object('issuance', issuance_id));
  if prior is not null then
    return query select prior, (select issuances.snapshot_hash from academic.document_issuances issuances where issuances.id = prior);
    return;
  end if;
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  if issuance_row.id is null or issuance_row.institutional_folio is null or issuance_row.status <> 'PREPARING' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  select code into document_code from academic.document_types where id = issuance_row.document_type_id;
  payload := academic.build_document_snapshot(
    document_code,
    issuance_row.student_record_id,
    issuance_row.requested_period_id,
    issuance_row.institutional_folio,
    issuance_row.issued_at
  );
  payload_hash := academic.document_payload_hash(payload);
  perform set_config('academic.document_controlled_mutation', 'on', true);
  insert into academic.document_snapshots(document_issuance_id, schema_version, snapshot_payload, snapshot_hash)
  values(issuance_row.id, 'academic-document-v1', payload, payload_hash);
  update academic.document_issuances
  set snapshot_hash = payload_hash,
      content_hash = payload_hash,
      status = 'GENERATED'
  where id = issuance_row.id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_SNAPSHOT', issuance_row.id, 'DOCUMENT_SNAPSHOT_CREATED', actor, 'PREPARING', 'GENERATED', 'INSTITUTIONAL_VALIDATION_PENDING', operation_key, correlation);
  perform academic.complete_document_command(actor, 'GENERATE_DOCUMENT_SNAPSHOT', operation_key, 'DOCUMENT_SNAPSHOT', issuance_row.id);
  return query select issuance_row.id, payload_hash;
end$$;

create function academic.attach_document_file(
  issuance_id uuid,
  provider academic.document_file_provider,
  bucket_name text,
  object_path text,
  mime_type text,
  size_bytes bigint,
  file_hash text,
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
  issuance_row academic.document_issuances%rowtype;
begin
  actor := academic.require_document_permission('documents.generate');
  prior := academic.begin_document_command(actor, 'ATTACH_DOCUMENT_FILE', operation_key, jsonb_build_object('issuance', issuance_id, 'path', object_path, 'hash', file_hash));
  if prior is not null then
    return query select prior, 'ATTACHED';
    return;
  end if;
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  if issuance_row.id is null or issuance_row.status <> 'GENERATED' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  insert into academic.document_files(
    document_issuance_id,
    storage_provider,
    bucket_name,
    object_path,
    mime_type,
    size_bytes,
    file_hash,
    status
  ) values (
    issuance_row.id,
    provider,
    bucket_name,
    object_path,
    mime_type,
    size_bytes,
    file_hash,
    'ATTACHED'
  );
  update academic.document_issuances
  set file_hash = attach_document_file.file_hash
  where id = issuance_row.id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_FILE', issuance_row.id, 'DOCUMENT_FILE_ATTACHED', actor, 'GENERATED', 'GENERATED', 'INSTITUTIONAL_VALIDATION_PENDING', operation_key, correlation);
  perform academic.complete_document_command(actor, 'ATTACH_DOCUMENT_FILE', operation_key, 'DOCUMENT_FILE', issuance_row.id);
  return query select issuance_row.id, 'ATTACHED';
end$$;

create function academic.validate_document_issuance(
  issuance_id uuid,
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
  issuance_row academic.document_issuances%rowtype;
  file_row academic.document_files%rowtype;
begin
  actor := academic.require_document_permission('documents.generate');
  prior := academic.begin_document_command(actor, 'VALIDATE_DOCUMENT_ISSUANCE', operation_key, jsonb_build_object('issuance', issuance_id));
  if prior is not null then
    return query select prior, 'VALIDATED';
    return;
  end if;
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  select * into file_row from academic.document_files where document_issuance_id = issuance_id;
  if issuance_row.id is null or issuance_row.status <> 'GENERATED' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  if file_row.id is null or issuance_row.file_hash is null or issuance_row.file_hash <> file_row.file_hash then
    raise exception 'DOCUMENT_HASH_MISMATCH';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_issuances set status = 'VALIDATED' where id = issuance_id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_ISSUANCE', issuance_row.id, 'DOCUMENT_VALIDATED', actor, 'GENERATED', 'VALIDATED', 'INSTITUTIONAL_VALIDATION_PENDING', operation_key, correlation);
  perform academic.complete_document_command(actor, 'VALIDATE_DOCUMENT_ISSUANCE', operation_key, 'DOCUMENT_ISSUANCE', issuance_row.id);
  return query select issuance_row.id, 'VALIDATED';
end$$;

create function academic.publish_document(
  issuance_id uuid,
  public_code_hash text,
  code_prefix text,
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
  issuance_row academic.document_issuances%rowtype;
begin
  actor := academic.require_document_permission('documents.publish');
  prior := academic.begin_document_command(actor, 'PUBLISH_DOCUMENT', operation_key, jsonb_build_object('issuance', issuance_id, 'prefix', code_prefix));
  if prior is not null then
    return query select prior, 'PUBLISHED';
    return;
  end if;
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  if issuance_row.id is null or issuance_row.status <> 'VALIDATED' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  insert into academic.document_verification_codes(document_issuance_id, public_code_hash, code_prefix, valid_from)
  values(issuance_row.id, public_code_hash, code_prefix, statement_timestamp());
  update academic.document_issuances
  set status = 'PUBLISHED',
      published_by_account_id = actor,
      published_at = statement_timestamp()
  where id = issuance_id;
  update academic.document_requests
  set status = 'ISSUED',
      updated_at = statement_timestamp()
  where id = issuance_row.document_request_id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_ISSUANCE', issuance_row.id, 'DOCUMENT_PUBLISHED', actor, 'VALIDATED', 'PUBLISHED', 'INSTITUTIONAL_VALIDATION_PENDING', operation_key, correlation);
  perform academic.complete_document_command(actor, 'PUBLISH_DOCUMENT', operation_key, 'DOCUMENT_ISSUANCE', issuance_row.id);
  return query select issuance_row.id, 'PUBLISHED';
end$$;

create function academic.revoke_document(
  issuance_id uuid,
  reason_code academic.document_request_reason_code,
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
  issuance_row academic.document_issuances%rowtype;
begin
  actor := academic.require_document_permission('documents.revoke');
  prior := academic.begin_document_command(actor, 'REVOKE_DOCUMENT', operation_key, jsonb_build_object('issuance', issuance_id, 'reason', reason_code));
  if prior is not null then
    return query select prior, 'REVOKED';
    return;
  end if;
  select * into issuance_row from academic.document_issuances where id = issuance_id for update;
  if issuance_row.id is null or issuance_row.status <> 'PUBLISHED' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_issuances
  set status = 'REVOKED',
      revoked_by_account_id = actor,
      revoked_at = statement_timestamp(),
      revocation_reason_code = reason_code
  where id = issuance_id;
  update academic.document_verification_codes
  set status = 'REVOKED',
      revoked_at = statement_timestamp()
  where document_issuance_id = issuance_id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(issuance_row.id, issuance_row.document_request_id, issuance_row.student_record_id, 'DOCUMENT_ISSUANCE', issuance_row.id, 'DOCUMENT_REVOKED', actor, 'PUBLISHED', 'REVOKED', reason_code, operation_key, correlation);
  perform academic.complete_document_command(actor, 'REVOKE_DOCUMENT', operation_key, 'DOCUMENT_ISSUANCE', issuance_row.id);
  return query select issuance_row.id, 'REVOKED';
end$$;

create function academic.supersede_document(
  previous_issuance_id uuid,
  replacement_issuance_id uuid,
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
  previous_row academic.document_issuances%rowtype;
  replacement_row academic.document_issuances%rowtype;
begin
  actor := academic.require_document_permission('documents.supersede');
  prior := academic.begin_document_command(actor, 'SUPERSEDE_DOCUMENT', operation_key, jsonb_build_object('previous', previous_issuance_id, 'replacement', replacement_issuance_id));
  if prior is not null then
    return query select prior, 'SUPERSEDED';
    return;
  end if;
  select * into previous_row from academic.document_issuances where id = previous_issuance_id for update;
  select * into replacement_row from academic.document_issuances where id = replacement_issuance_id for update;
  if previous_row.id is null or replacement_row.id is null or previous_row.status <> 'PUBLISHED' or replacement_row.status <> 'PUBLISHED' then
    raise exception 'DOCUMENT_ISSUANCE_INVALID_STATE';
  end if;
  perform set_config('academic.document_controlled_mutation', 'on', true);
  update academic.document_issuances
  set status = 'SUPERSEDED',
      superseded_by_issuance_id = replacement_row.id
  where id = previous_row.id;
  update academic.document_issuances
  set supersedes_issuance_id = previous_row.id
  where id = replacement_row.id;
  update academic.document_verification_codes
  set status = 'REVOKED',
      revoked_at = statement_timestamp()
  where document_issuance_id = previous_row.id;
  perform set_config('academic.document_controlled_mutation', 'off', true);
  perform academic.append_document_event(previous_row.id, previous_row.document_request_id, previous_row.student_record_id, 'DOCUMENT_ISSUANCE', previous_row.id, 'DOCUMENT_SUPERSEDED', actor, 'PUBLISHED', 'SUPERSEDED', 'SUPERSEDED_BY_INSTITUTION', operation_key, correlation);
  perform academic.complete_document_command(actor, 'SUPERSEDE_DOCUMENT', operation_key, 'DOCUMENT_ISSUANCE', previous_row.id);
  return query select previous_row.id, 'SUPERSEDED';
end$$;

create function academic.get_my_documents()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (
  select * from academic.require_student_portal_context(null)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'documentId', issuances.id,
      'folio', issuances.institutional_folio,
      'typeCode', types.code,
      'typeName', types.visible_name,
      'issuedAt', issuances.issued_at,
      'publishedAt', issuances.published_at,
      'status', issuances.status,
      'requestedPeriodId', issuances.requested_period_id
    )
    order by issuances.issued_at desc, issuances.created_at desc
  ),
  '[]'::jsonb
)
from context
join academic.document_issuances issuances on issuances.student_record_id = context.student_record_id
join academic.document_types types on types.id = issuances.document_type_id
where issuances.status in ('PUBLISHED', 'REVOKED', 'SUPERSEDED')
$$;

create function academic.get_my_document(document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  context_row record;
  issuance_row record;
begin
  select * into context_row from academic.require_student_portal_context(null);
  select
    issuances.id,
    issuances.institutional_folio,
    issuances.status,
    issuances.issued_at,
    issuances.published_at,
    issuances.requested_period_id,
    issuances.supersedes_issuance_id,
    issuances.superseded_by_issuance_id,
    types.code as type_code,
    types.visible_name,
    files.object_path,
    files.mime_type,
    files.size_bytes
  into issuance_row
  from academic.document_issuances issuances
  join academic.document_types types on types.id = issuances.document_type_id
  left join academic.document_files files on files.document_issuance_id = issuances.id and files.status = 'ATTACHED'
  where issuances.id = document_id
    and issuances.student_record_id = context_row.student_record_id
    and issuances.status in ('PUBLISHED', 'REVOKED', 'SUPERSEDED');
  if issuance_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'documentId', issuance_row.id,
    'folio', issuance_row.institutional_folio,
    'status', issuance_row.status,
    'issuedAt', issuance_row.issued_at,
    'publishedAt', issuance_row.published_at,
    'requestedPeriodId', issuance_row.requested_period_id,
    'typeCode', issuance_row.type_code,
    'typeName', issuance_row.visible_name,
    'supersedesDocumentId', issuance_row.supersedes_issuance_id,
    'supersededByDocumentId', issuance_row.superseded_by_issuance_id,
    'downloadAvailable', issuance_row.status = 'PUBLISHED' and issuance_row.object_path is not null
  );
end$$;

create function academic.get_my_document_download(document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  context_row record;
  issuance_row record;
begin
  select * into context_row from academic.require_student_portal_context(null);
  select
    issuances.id,
    issuances.status,
    files.object_path,
    files.mime_type,
    files.size_bytes
  into issuance_row
  from academic.document_issuances issuances
  join academic.document_files files on files.document_issuance_id = issuances.id and files.status = 'ATTACHED'
  where issuances.id = document_id
    and issuances.student_record_id = context_row.student_record_id;
  if issuance_row.id is null then
    raise exception 'DOCUMENT_NOT_FOUND';
  end if;
  if issuance_row.status <> 'PUBLISHED' then
    raise exception 'DOCUMENT_NOT_AVAILABLE';
  end if;
  return jsonb_build_object(
    'documentId', issuance_row.id,
    'objectPath', issuance_row.object_path,
    'mimeType', issuance_row.mime_type,
    'sizeBytes', issuance_row.size_bytes
  );
end$$;

create function academic.get_my_guardian_student_documents(link_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with context as (select * from academic.require_guardian_portal_context(link_id, null)),
scope_data as (select * from academic.get_guardian_scope((select access_scope_id from context)))
select case
  when not (select can_view_documents from scope_data) then jsonb_build_object('error', 'DOCUMENT_SCOPE_DENIED')
  else coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'documentId', issuances.id,
          'folio', issuances.institutional_folio,
          'typeCode', types.code,
          'typeName', types.visible_name,
          'issuedAt', issuances.issued_at,
          'status', issuances.status
        )
        order by issuances.issued_at desc
      )
      from academic.document_issuances issuances
      join academic.document_types types on types.id = issuances.document_type_id
      where issuances.student_record_id = (select student_record_id from context)
        and issuances.status in ('PUBLISHED', 'REVOKED', 'SUPERSEDED')
    ),
    '[]'::jsonb
  )
end
$$;

create function academic.get_my_guardian_student_document(link_id uuid, document_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  context_row record;
  scope_row academic.guardian_access_scopes%rowtype;
  issuance_row record;
begin
  select * into context_row from academic.require_guardian_portal_context(link_id, null);
  select * into scope_row from academic.guardian_access_scopes where id = context_row.access_scope_id;
  if not scope_row.can_view_documents then
    raise exception 'DOCUMENT_SCOPE_DENIED';
  end if;
  select
    issuances.id,
    issuances.institutional_folio,
    issuances.status,
    issuances.issued_at,
    types.code as type_code,
    types.visible_name
  into issuance_row
  from academic.document_issuances issuances
  join academic.document_types types on types.id = issuances.document_type_id
  where issuances.id = document_id
    and issuances.student_record_id = context_row.student_record_id
    and issuances.status in ('PUBLISHED', 'REVOKED', 'SUPERSEDED');
  if issuance_row.id is null then
    raise exception 'DOCUMENT_ACCESS_DENIED';
  end if;
  return jsonb_build_object(
    'documentId', issuance_row.id,
    'folio', issuance_row.institutional_folio,
    'status', issuance_row.status,
    'issuedAt', issuance_row.issued_at,
    'typeCode', issuance_row.type_code,
    'typeName', issuance_row.visible_name,
    'downloadAvailable', false
  );
end$$;

create function academic.verify_document_public(folio text, verification_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  normalized_code text := upper(trim(verification_code));
  issuance_row record;
  verification_row record;
  result_status text := 'NO_VERIFICADO';
begin
  if folio is null or verification_code is null or length(trim(folio)) = 0 or length(normalized_code) = 0 then
    return jsonb_build_object(
      'verified', false,
      'status', result_status
    );
  end if;
  select
    issuances.id,
    issuances.institutional_folio,
    issuances.status,
    issuances.issued_at,
    issuances.expires_at,
    types.visible_name
  into issuance_row
  from academic.document_issuances issuances
  join academic.document_types types on types.id = issuances.document_type_id
  where issuances.institutional_folio = trim(folio)
  limit 1;
  if issuance_row.id is null then
    return jsonb_build_object('verified', false, 'status', result_status);
  end if;
  select *
  into verification_row
  from academic.document_verification_codes
  where document_issuance_id = issuance_row.id
    and status = 'ACTIVE'
  limit 1;
  if verification_row.id is null
     or verification_row.public_code_hash <> academic.document_hash(normalized_code) then
    return jsonb_build_object('verified', false, 'status', result_status);
  end if;
  if issuance_row.status = 'REVOKED' or verification_row.status = 'REVOKED' then
    result_status := 'REVOCADO';
  elsif issuance_row.status = 'SUPERSEDED' then
    result_status := 'SUSTITUIDO';
  elsif issuance_row.expires_at is not null and issuance_row.expires_at < statement_timestamp() then
    result_status := 'EXPIRADO';
  else
    result_status := 'VIGENTE';
  end if;
  return jsonb_build_object(
    'verified', result_status <> 'NO_VERIFICADO',
    'folio', issuance_row.institutional_folio,
    'typeName', issuance_row.visible_name,
    'issuedAt', issuance_row.issued_at,
    'status', result_status
  );
end$$;

create or replace function public.get_my_documents()
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_documents(); $$;
create or replace function public.get_my_document(document_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_document(document_id); $$;
create or replace function public.get_my_document_download(document_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_document_download(document_id); $$;
create or replace function public.get_my_guardian_student_documents(link_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_documents(link_id); $$;
create or replace function public.get_my_guardian_student_document(link_id uuid, document_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.get_my_guardian_student_document(link_id, document_id); $$;
create or replace function public.verify_document_public(folio text, verification_code text)
returns jsonb language sql stable security definer set search_path='' as $$ select academic.verify_document_public(folio, verification_code); $$;

insert into academic.document_types(code, visible_name, status)
values
  ('SEMESTER_REPORT', 'Boleta semestral informativa', 'ACTIVE'),
  ('ENROLLMENT_CERTIFICATE', 'Constancia informativa de inscripción', 'ACTIVE'),
  ('ACADEMIC_TRANSCRIPT', 'Trayectoria académica informativa', 'ACTIVE'),
  ('ENROLLMENT_RECEIPT', 'Comprobante informativo de inscripción', 'ACTIVE')
on conflict (code) do update
set visible_name = excluded.visible_name,
    status = excluded.status,
    updated_at = statement_timestamp();

with created_templates as (
  insert into academic.document_templates(document_type_id, code, name, status, created_by_account_id, is_system_template)
  select
    id,
    case code
      when 'SEMESTER_REPORT' then 'SYS_SEMESTER_REPORT'
      when 'ENROLLMENT_CERTIFICATE' then 'SYS_ENROLLMENT_CERTIFICATE'
      when 'ACADEMIC_TRANSCRIPT' then 'SYS_ACADEMIC_TRANSCRIPT'
      when 'ENROLLMENT_RECEIPT' then 'SYS_ENROLLMENT_RECEIPT'
    end::academic.normalized_code,
    visible_name,
    'ACTIVE',
    null,
    true
  from academic.document_types
  on conflict (code) do nothing
  returning id, document_type_id
), all_templates as (
  select id, document_type_id from created_templates
  union all
  select id, document_type_id from academic.document_templates where is_system_template
)
insert into academic.document_template_versions(
  document_template_id,
  version_number,
  schema_version,
  rendering_engine,
  template_checksum,
  status,
  effective_from
)
select
  templates.id,
  1,
  'academic-document-v1',
  'LOCAL_TEST_DETERMINISTIC',
  academic.document_hash(types.code::text || ':v1'),
  'ACTIVE',
  statement_timestamp()
from all_templates templates
join academic.document_types types on types.id = templates.document_type_id
where not exists (
  select 1
  from academic.document_template_versions versions
  where versions.document_template_id = templates.id
    and versions.version_number = 1
);

update academic.document_templates templates
set active_version_id = versions.id
from academic.document_template_versions versions
where versions.document_template_id = templates.id
  and versions.version_number = 1
  and versions.status = 'ACTIVE';

alter table academic.document_types owner to postgres;
alter table academic.document_templates owner to postgres;
alter table academic.document_template_versions owner to postgres;
alter table academic.document_requests owner to postgres;
alter table academic.document_issuances owner to postgres;
alter table academic.document_snapshots owner to postgres;
alter table academic.document_files owner to postgres;
alter table academic.document_verification_codes owner to postgres;
alter table academic.document_events owner to postgres;
alter table academic.document_commands owner to postgres;
alter table academic.document_folio_sequences owner to postgres;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('academic', 'public')
      and p.proname in (
        'document_hash',
        'document_payload_hash',
        'document_type_short',
        'require_document_permission',
        'begin_document_command',
        'complete_document_command',
        'append_document_event',
        'guard_document_objects',
        'require_document_request_eligibility',
        'resolve_active_template_version',
        'build_document_snapshot',
        'create_document_request',
        'change_document_request_status',
        'submit_document_request',
        'begin_document_review',
        'approve_document_request',
        'reject_document_request',
        'create_document_issuance',
        'assign_document_folio',
        'generate_document_snapshot',
        'attach_document_file',
        'validate_document_issuance',
        'publish_document',
        'revoke_document',
        'supersede_document',
        'get_my_documents',
        'get_my_document',
        'get_my_document_download',
        'get_my_guardian_student_documents',
        'get_my_guardian_student_document',
        'verify_document_public'
      )
  loop
    execute format('alter function %s owner to postgres', f.signature);
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
  end loop;
end$$;

revoke execute on function public.get_my_documents() from public, anon;
revoke execute on function public.get_my_document(uuid) from public, anon;
revoke execute on function public.get_my_document_download(uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_documents(uuid) from public, anon;
revoke execute on function public.get_my_guardian_student_document(uuid, uuid) from public, anon;
revoke execute on function public.verify_document_public(text, text) from public;

grant execute on function public.get_my_documents() to authenticated;
grant execute on function public.get_my_document(uuid) to authenticated;
grant execute on function public.get_my_document_download(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_documents(uuid) to authenticated;
grant execute on function public.get_my_guardian_student_document(uuid, uuid) to authenticated;
grant execute on function public.verify_document_public(text, text) to anon;

alter default privileges in schema academic revoke all on tables from public, anon, authenticated;
alter default privileges in schema academic revoke execute on functions from public, anon, authenticated;

commit;
