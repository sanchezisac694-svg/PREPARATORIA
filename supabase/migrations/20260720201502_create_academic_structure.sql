begin;

create schema academic;
revoke all on schema academic from public, anon, authenticated;
alter default privileges in schema academic revoke all on tables from public, anon, authenticated;
alter default privileges in schema academic revoke all on sequences from public, anon, authenticated;
alter default privileges in schema academic revoke execute on functions from public, anon, authenticated;

create type academic.structure_status as enum ('DRAFT', 'PLANNED', 'ACTIVE', 'CLOSING', 'CLOSED', 'CANCELLED');
create type academic.study_plan_status as enum ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'CANCELLED');
create type academic.catalog_status as enum ('ACTIVE', 'INACTIVE');
create type academic.subject_type as enum ('COMMON', 'AREA_SPECIFIC', 'INSTITUTIONAL', 'EXTRA_CURRICULAR');
create type academic.curriculum_status as enum ('ACTIVE', 'INACTIVE');
create type academic.group_status as enum ('DRAFT', 'PLANNED', 'OPEN', 'ACTIVE', 'CLOSED', 'CANCELLED');
create type academic.offering_status as enum ('DRAFT', 'PLANNED', 'ACTIVE', 'CLOSED', 'CANCELLED');
create type academic.assignment_type as enum ('PRIMARY', 'CO_TEACHER', 'TEMPORARY');
create type academic.assignment_status as enum ('PLANNED', 'ACTIVE', 'ENDED', 'CANCELLED');
create type academic.academic_entity_type as enum (
  'SCHOOL_CYCLE', 'ACADEMIC_PERIOD', 'STUDY_PLAN', 'TRAINING_AREA', 'SUBJECT',
  'CURRICULUM_SUBJECT', 'SUBJECT_UNITS', 'GROUP', 'ACADEMIC_OFFERING', 'TEACHING_ASSIGNMENT'
);
create type academic.academic_event_type as enum (
  'SCHOOL_CYCLE_CREATED', 'SCHOOL_CYCLE_ACTIVATED', 'SCHOOL_CYCLE_CLOSED',
  'ACADEMIC_PERIOD_CREATED', 'ACADEMIC_PERIOD_ACTIVATED', 'ACADEMIC_PERIOD_CLOSED',
  'STUDY_PLAN_CREATED', 'STUDY_PLAN_APPROVED', 'STUDY_PLAN_ACTIVATED',
  'TRAINING_AREA_ACTIVATED', 'SUBJECT_CREATED', 'SUBJECT_DEACTIVATED',
  'CURRICULUM_SUBJECT_ADDED', 'SUBJECT_UNITS_CREATED', 'GROUP_CREATED',
  'GROUP_ACTIVATED', 'ACADEMIC_OFFERING_CREATED', 'ACADEMIC_OFFERING_ACTIVATED',
  'TEACHER_ASSIGNED', 'TEACHER_ASSIGNMENT_ENDED', 'STRUCTURE_CHANGE_REJECTED'
);
create type academic.academic_reason_code as enum (
  'INITIAL_CONFIGURATION', 'INSTITUTIONAL_APPROVAL', 'PERIOD_OPERATION',
  'CATALOG_MAINTENANCE', 'TEACHING_OPERATION', 'RECORD_CORRECTION', 'VALIDATION_REJECTED'
);
revoke usage on type
  academic.structure_status,
  academic.study_plan_status,
  academic.catalog_status,
  academic.subject_type,
  academic.curriculum_status,
  academic.group_status,
  academic.offering_status,
  academic.assignment_type,
  academic.assignment_status,
  academic.academic_entity_type,
  academic.academic_event_type,
  academic.academic_reason_code
from public, anon, authenticated;
alter default privileges in schema academic revoke usage on types from public, anon, authenticated;

create domain academic.normalized_code as text
  check (value = upper(btrim(value)) and value ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$');
revoke usage on type academic.normalized_code from public, anon, authenticated;

create table academic.school_cycles (
  id uuid primary key default gen_random_uuid(),
  code academic.normalized_code not null unique,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status academic.structure_status not null default 'DRAFT',
  starts_on date not null,
  ends_on date not null,
  enrollment_opens_on date,
  enrollment_closes_on date,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  activated_by_account_id uuid references core.accounts(id) on delete restrict,
  closed_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (starts_on < ends_on),
  check (enrollment_opens_on is null or enrollment_opens_on between starts_on and ends_on),
  check (enrollment_closes_on is null or enrollment_closes_on between starts_on and ends_on),
  check (enrollment_opens_on is null or enrollment_closes_on is null or enrollment_opens_on <= enrollment_closes_on)
);

create table academic.academic_periods (
  id uuid primary key default gen_random_uuid(),
  school_cycle_id uuid not null references academic.school_cycles(id) on delete restrict,
  code academic.normalized_code not null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  sequence_number smallint not null check (sequence_number > 0),
  starts_on date not null,
  ends_on date not null,
  status academic.structure_status not null default 'DRAFT',
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  activated_by_account_id uuid references core.accounts(id) on delete restrict,
  closed_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (school_cycle_id, code),
  unique (school_cycle_id, sequence_number),
  check (starts_on < ends_on)
);

create table academic.study_plans (
  id uuid primary key default gen_random_uuid(),
  code academic.normalized_code not null,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  version text not null check (char_length(btrim(version)) between 1 and 30),
  status academic.study_plan_status not null default 'DRAFT',
  valid_from date not null,
  valid_to date,
  total_semesters smallint not null default 6 check (total_semesters = 6),
  units_per_subject smallint not null default 3 check (units_per_subject = 3),
  fixed_subjects_only boolean not null default true check (fixed_subjects_only),
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  approved_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (code, version),
  check (valid_to is null or valid_to > valid_from)
);

create table academic.plan_semesters (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references academic.study_plans(id) on delete restrict,
  semester_number smallint not null check (semester_number between 1 and 6),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  specialization_required boolean not null,
  created_at timestamptz not null default now(),
  unique (study_plan_id, semester_number),
  check (specialization_required = (semester_number >= 5))
);

create table academic.training_areas (
  id uuid primary key default gen_random_uuid(),
  code academic.normalized_code not null unique,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  status academic.catalog_status not null default 'ACTIVE',
  starts_at_semester smallint not null default 5 check (starts_at_semester between 1 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic.subjects (
  id uuid primary key default gen_random_uuid(),
  code academic.normalized_code not null unique,
  name text not null check (char_length(btrim(name)) between 2 and 160),
  short_name text check (short_name is null or char_length(btrim(short_name)) between 2 and 60),
  status academic.catalog_status not null default 'ACTIVE',
  subject_type academic.subject_type not null,
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table academic.curriculum_subjects (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references academic.study_plans(id) on delete restrict,
  plan_semester_id uuid not null references academic.plan_semesters(id) on delete restrict,
  subject_id uuid not null references academic.subjects(id) on delete restrict,
  training_area_id uuid references academic.training_areas(id) on delete restrict,
  is_mandatory boolean not null default true check (is_mandatory),
  display_order smallint not null check (display_order > 0),
  weekly_hours numeric check (weekly_hours is null or weekly_hours > 0),
  credits numeric check (credits is null or credits > 0),
  status academic.curriculum_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index curriculum_subject_unique
  on academic.curriculum_subjects (study_plan_id, plan_semester_id, subject_id, coalesce(training_area_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table academic.subject_units (
  id uuid primary key default gen_random_uuid(),
  curriculum_subject_id uuid not null references academic.curriculum_subjects(id) on delete restrict,
  unit_number smallint not null check (unit_number between 1 and 3),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  display_order smallint not null check (display_order between 1 and 3),
  created_at timestamptz not null default now(),
  unique (curriculum_subject_id, unit_number),
  unique (curriculum_subject_id, display_order)
);

create table academic.groups (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references academic.academic_periods(id) on delete restrict,
  study_plan_id uuid not null references academic.study_plans(id) on delete restrict,
  semester_number smallint not null check (semester_number between 1 and 6),
  training_area_id uuid references academic.training_areas(id) on delete restrict,
  code academic.normalized_code not null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 120),
  capacity integer check (capacity is null or capacity > 0),
  status academic.group_status not null default 'DRAFT',
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_period_id, code),
  check ((semester_number < 5 and training_area_id is null) or semester_number >= 5)
);

create table academic.academic_offerings (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references academic.academic_periods(id) on delete restrict,
  group_id uuid not null references academic.groups(id) on delete restrict,
  curriculum_subject_id uuid not null references academic.curriculum_subjects(id) on delete restrict,
  status academic.offering_status not null default 'DRAFT',
  created_by_account_id uuid not null references core.accounts(id) on delete restrict,
  activated_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (group_id, curriculum_subject_id)
);

create table academic.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  academic_offering_id uuid not null references academic.academic_offerings(id) on delete restrict,
  teacher_account_id uuid not null references core.accounts(id) on delete restrict,
  assignment_type academic.assignment_type not null default 'PRIMARY',
  status academic.assignment_status not null default 'PLANNED',
  valid_from date not null,
  valid_to date,
  assigned_by_account_id uuid not null references core.accounts(id) on delete restrict,
  ended_by_account_id uuid references core.accounts(id) on delete restrict,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  updated_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);
create unique index one_active_primary_teacher
  on academic.teaching_assignments (academic_offering_id)
  where assignment_type = 'PRIMARY' and status in ('PLANNED', 'ACTIVE');
create index teaching_assignments_teacher_idx on academic.teaching_assignments (teacher_account_id, status);

create table academic.academic_structure_events (
  id uuid primary key default gen_random_uuid(),
  entity_type academic.academic_entity_type not null,
  entity_id uuid not null,
  event_type academic.academic_event_type not null,
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  previous_status text,
  resulting_status text,
  reason_code academic.academic_reason_code not null,
  idempotency_key academic.normalized_code not null unique,
  correlation_id uuid,
  occurred_at timestamptz not null default now()
);
create index academic_events_entity_idx on academic.academic_structure_events (entity_type, entity_id);
create index academic_events_occurred_idx on academic.academic_structure_events (occurred_at desc);
create index academic_period_dates_idx on academic.academic_periods (school_cycle_id, starts_on, ends_on);
create index curriculum_plan_semester_idx on academic.curriculum_subjects (study_plan_id, plan_semester_id, training_area_id);
create index groups_period_semester_idx on academic.groups (academic_period_id, semester_number, training_area_id);
create index offerings_group_idx on academic.academic_offerings (group_id, status);

create function academic.reject_academic_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'ACADEMIC_HISTORY_IMMUTABLE';
end;
$$;
revoke execute on function academic.reject_academic_event_mutation() from public, anon, authenticated;

create trigger academic_events_append_only
before update or delete on academic.academic_structure_events
for each row execute function academic.reject_academic_event_mutation();

insert into academic.training_areas (code, name, starts_at_semester)
values
  ('FISICO_MATEMATICOS', 'Físico-Matemáticos', 5),
  ('CIENCIAS_SOCIALES', 'Ciencias Sociales', 5),
  ('QUIMICO_BIOLOGOS', 'Químico-Biólogos', 5),
  ('ECONOMICO_ADMINISTRATIVOS', 'Económico-Administrativos', 5);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'school_cycles', 'academic_periods', 'study_plans', 'plan_semesters',
    'training_areas', 'subjects', 'curriculum_subjects', 'subject_units',
    'groups', 'academic_offerings', 'teaching_assignments', 'academic_structure_events'
  ]
  loop
    execute format('alter table academic.%I enable row level security', table_name);
    execute format('revoke all on table academic.%I from public, anon, authenticated', table_name);
  end loop;
end;
$$;

commit;
