begin;

create table academic.academic_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key academic.normalized_code not null,
  command_type text not null check (command_type in (
    'CREATE_SCHOOL_CYCLE','ACTIVATE_SCHOOL_CYCLE','CLOSE_SCHOOL_CYCLE',
    'CREATE_ACADEMIC_PERIOD','ACTIVATE_ACADEMIC_PERIOD','CLOSE_ACADEMIC_PERIOD',
    'CREATE_STUDY_PLAN','APPROVE_STUDY_PLAN','ACTIVATE_STUDY_PLAN',
    'CREATE_SUBJECT','DEACTIVATE_SUBJECT','ADD_SUBJECT_TO_STUDY_PLAN','CREATE_SUBJECT_UNITS',
    'CREATE_GROUP','ACTIVATE_GROUP','CREATE_ACADEMIC_OFFERING','ACTIVATE_ACADEMIC_OFFERING',
    'ASSIGN_TEACHER','END_TEACHING_ASSIGNMENT'
  )),
  actor_account_id uuid not null references core.accounts(id) on delete restrict,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{32}$'),
  resulting_entity_type text,
  resulting_entity_id uuid,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (actor_account_id, command_type, idempotency_key),
  check ((status = 'COMPLETED') = (completed_at is not null))
);
alter table academic.academic_commands enable row level security;
revoke all on table academic.academic_commands from public, anon, authenticated;
create index academic_commands_created_idx on academic.academic_commands(created_at);

create function academic.require_academic_permission(permission_code text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare actor core.accounts%rowtype; role_codes text[];
begin
  if permission_code not in ('academic.cycles.read','academic.cycles.manage','academic.periods.read','academic.periods.manage','academic.plans.read','academic.plans.manage','academic.plans.approve','academic.subjects.read','academic.subjects.manage','academic.groups.read','academic.groups.manage','academic.offerings.read','academic.offerings.manage','academic.assignments.read','academic.assignments.manage') then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  if auth.uid() is null then raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED'; end if;
  select * into actor from core.accounts where auth_user_id=auth.uid();
  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  if not core.is_current_session_version_valid() then
    raise exception using errcode='42501', message='SESSION_VERSION_INVALID';
  end if;
  if not core.is_current_aal2() or not core.is_current_mfa_policy_satisfied() then
    raise exception using errcode='42501', message='AAL2_REQUIRED';
  end if;
  select coalesce(array_agg(r.code),array[]::text[]) into role_codes
  from core.account_roles ar join core.roles r on r.id=ar.role_id and r.is_active
  where ar.account_id=actor.id and ar.revoked_at is null;
  if not (role_codes && array['SUPERADMIN','ADMINISTRATIVO','CONTROL_ESCOLAR']) then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  if 'CONTROL_ESCOLAR'=any(role_codes) and not (role_codes && array['SUPERADMIN','ADMINISTRATIVO'])
     and permission_code not in ('academic.plans.read','academic.subjects.read','academic.groups.read','academic.groups.manage','academic.offerings.read','academic.offerings.manage','academic.assignments.read','academic.assignments.manage') then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  if permission_code='academic.plans.approve' and not (role_codes && array['SUPERADMIN','ADMINISTRATIVO']) then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;
  return actor.id;
end $$;

create function academic.begin_academic_command(actor_id uuid, command_name text, operation_key text, fingerprint text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing academic.academic_commands%rowtype; command_id uuid;
begin
  select * into existing from academic.academic_commands
  where actor_account_id=actor_id and command_type=command_name and idempotency_key=operation_key for update;
  if existing.id is not null then
    if existing.request_fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return existing.resulting_entity_id;
  end if;
  begin
    insert into academic.academic_commands(idempotency_key,command_type,actor_account_id,request_fingerprint)
    values(operation_key,command_name,actor_id,fingerprint) returning id into command_id;
  exception when unique_violation then
    select * into existing from academic.academic_commands
    where actor_account_id=actor_id and command_type=command_name and idempotency_key=operation_key for update;
    if existing.request_fingerprint<>fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return existing.resulting_entity_id;
  end;
  return null;
end $$;

create function academic.complete_academic_command(actor_id uuid, command_name text, operation_key text, entity_type text, entity_id uuid)
returns void language sql security definer set search_path = '' as $$
  update academic.academic_commands set status='COMPLETED',resulting_entity_type=entity_type,
    resulting_entity_id=entity_id,completed_at=statement_timestamp()
  where actor_account_id=actor_id and command_type=command_name and idempotency_key=operation_key;
$$;

create function academic.valid_structure_transition(old_status academic.structure_status,new_status academic.structure_status)
returns boolean language sql immutable security invoker set search_path='' as $$
 select (old_status,new_status) in (('DRAFT','PLANNED'),('PLANNED','ACTIVE'),('ACTIVE','CLOSING'),
 ('CLOSING','CLOSED'),('DRAFT','CANCELLED'),('PLANNED','CANCELLED'));
$$;
create function academic.valid_plan_transition(old_status academic.study_plan_status,new_status academic.study_plan_status)
returns boolean language sql immutable security invoker set search_path='' as $$
 select (old_status,new_status) in (('DRAFT','UNDER_REVIEW'),('UNDER_REVIEW','APPROVED'),
 ('APPROVED','ACTIVE'),('ACTIVE','RETIRED'),('DRAFT','CANCELLED'),('UNDER_REVIEW','CANCELLED'));
$$;

create function academic.guard_academic_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('academic.controlled_mutation',true)='on' then return new; end if;
 if tg_op='DELETE' then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if;
 if tg_table_name='training_areas' and new.code<>old.code then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if;
 if tg_table_name='study_plans' and old.status::text in ('APPROVED','ACTIVE','RETIRED') and new is distinct from old then raise exception 'STUDY_PLAN_IMMUTABLE'; end if;
 if tg_table_name in ('school_cycles','academic_periods') and old.status::text='CLOSED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if;
 if tg_table_name='teaching_assignments' and old.status::text='ENDED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if;
 return new;
end $$;

create trigger school_cycles_history before update or delete on academic.school_cycles for each row execute function academic.guard_academic_history();
create trigger periods_history before update or delete on academic.academic_periods for each row execute function academic.guard_academic_history();
create trigger plans_history before update or delete on academic.study_plans for each row execute function academic.guard_academic_history();
create trigger areas_history before update or delete on academic.training_areas for each row execute function academic.guard_academic_history();
create trigger assignments_history before update or delete on academic.teaching_assignments for each row execute function academic.guard_academic_history();

create function academic.create_school_cycle(cycle_code text,cycle_name text,starts date,ends date,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; prior uuid; created uuid; fp text:=md5(upper(btrim(cycle_code))||'|'||cycle_name||'|'||starts||'|'||ends);
begin actor:=academic.require_academic_permission('academic.cycles.manage'); prior:=academic.begin_academic_command(actor,'CREATE_SCHOOL_CYCLE',operation_key,fp);
 if prior is not null then return query select prior,(select s.status::text from academic.school_cycles s where s.id=prior); return; end if;
 insert into academic.school_cycles(code,name,starts_on,ends_on,created_by_account_id) values(upper(btrim(cycle_code)),btrim(cycle_name),starts,ends,actor) returning id into created;
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,resulting_status,reason_code,idempotency_key,correlation_id)
 values('SCHOOL_CYCLE',created,'SCHOOL_CYCLE_CREATED',actor,'DRAFT','INITIAL_CONFIGURATION',operation_key,correlation);
 perform academic.complete_academic_command(actor,'CREATE_SCHOOL_CYCLE',operation_key,'SCHOOL_CYCLE',created); return query select created,'DRAFT'; end $$;

create function academic.change_cycle_status(cycle_id uuid,target academic.structure_status,permission text,command_name text,event_name academic.academic_event_type,operation_key text,correlation uuid)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; row_record academic.school_cycles%rowtype; prior uuid; fp text:=md5(cycle_id::text||'|'||target::text);
begin actor:=academic.require_academic_permission(permission); prior:=academic.begin_academic_command(actor,command_name,operation_key,fp);
 if prior is not null then return query select prior,(select s.status::text from academic.school_cycles s where s.id=prior); return; end if;
 select * into row_record from academic.school_cycles where id=cycle_id for update; if row_record.id is null then raise exception 'ACADEMIC_CYCLE_NOT_FOUND'; end if;
 if not academic.valid_structure_transition(row_record.status,target) then raise exception 'ACADEMIC_CYCLE_INVALID_STATE'; end if;
 if target='ACTIVE' and exists(select 1 from academic.school_cycles s where s.id<>cycle_id and s.status in ('PLANNED','ACTIVE') and daterange(s.starts_on,s.ends_on,'[]')&&daterange(row_record.starts_on,row_record.ends_on,'[]')) then raise exception 'ACADEMIC_CYCLE_DATE_CONFLICT'; end if;
 update academic.school_cycles set status=target,updated_at=statement_timestamp(),activated_at=case when target='ACTIVE' then statement_timestamp() else activated_at end,activated_by_account_id=case when target='ACTIVE' then actor else activated_by_account_id end,closed_at=case when target='CLOSED' then statement_timestamp() else closed_at end,closed_by_account_id=case when target='CLOSED' then actor else closed_by_account_id end where id=cycle_id;
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,previous_status,resulting_status,reason_code,idempotency_key,correlation_id) values('SCHOOL_CYCLE',cycle_id,event_name,actor,row_record.status::text,target::text,'PERIOD_OPERATION',operation_key,correlation);
 perform academic.complete_academic_command(actor,command_name,operation_key,'SCHOOL_CYCLE',cycle_id); return query select cycle_id,target::text; end $$;
create function academic.activate_school_cycle(cycle_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$ select * from academic.change_cycle_status(cycle_id,'ACTIVE','academic.cycles.manage','ACTIVATE_SCHOOL_CYCLE','SCHOOL_CYCLE_ACTIVATED',operation_key,correlation) $$;
create function academic.close_school_cycle(cycle_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$ select * from academic.change_cycle_status(cycle_id,'CLOSED','academic.cycles.manage','CLOSE_SCHOOL_CYCLE','SCHOOL_CYCLE_CLOSED',operation_key,correlation) $$;

create function academic.create_academic_period(cycle_id uuid,period_code text,period_name text,sequence smallint,starts date,ends date,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; prior uuid; created uuid; cycle academic.school_cycles%rowtype; fp text:=md5(cycle_id::text||period_code||sequence::text||starts::text||ends::text);
begin actor:=academic.require_academic_permission('academic.periods.manage'); prior:=academic.begin_academic_command(actor,'CREATE_ACADEMIC_PERIOD',operation_key,fp); if prior is not null then return query select prior,'DRAFT'; return; end if;
 select * into cycle from academic.school_cycles where id=cycle_id for update; if cycle.id is null or cycle.status in ('CLOSED','CANCELLED') or starts<cycle.starts_on or ends>cycle.ends_on then raise exception 'ACADEMIC_PERIOD_DATE_CONFLICT'; end if;
 if exists(select 1 from academic.academic_periods p where p.school_cycle_id=cycle_id and p.status<>'CANCELLED' and daterange(p.starts_on,p.ends_on,'[]')&&daterange(starts,ends,'[]')) then raise exception 'ACADEMIC_PERIOD_DATE_CONFLICT'; end if;
 insert into academic.academic_periods(school_cycle_id,code,name,sequence_number,starts_on,ends_on,created_by_account_id) values(cycle_id,upper(btrim(period_code)),btrim(period_name),sequence,starts,ends,actor) returning id into created;
 perform academic.complete_academic_command(actor,'CREATE_ACADEMIC_PERIOD',operation_key,'ACADEMIC_PERIOD',created); return query select created,'DRAFT'; end $$;

create function academic.change_period_status(period_id uuid,target academic.structure_status,command_name text,event_name academic.academic_event_type,operation_key text,correlation uuid)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$ declare actor uuid; p academic.academic_periods%rowtype; cycle_status academic.structure_status; prior uuid;
begin actor:=academic.require_academic_permission('academic.periods.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,md5(period_id::text||target::text)); if prior is not null then return query select prior,target::text; return; end if;
 select * into p from academic.academic_periods where id=period_id for update; if p.id is null then raise exception 'ACADEMIC_PERIOD_NOT_FOUND'; end if; select cycles.status into cycle_status from academic.school_cycles cycles where cycles.id=p.school_cycle_id for update;
 if not academic.valid_structure_transition(p.status,target) or (target='ACTIVE' and cycle_status in ('CLOSED','CANCELLED')) then raise exception 'ACADEMIC_PERIOD_DATE_CONFLICT'; end if;
 update academic.academic_periods set status=target,updated_at=statement_timestamp(),activated_at=case when target='ACTIVE' then statement_timestamp() else activated_at end,activated_by_account_id=case when target='ACTIVE' then actor else activated_by_account_id end,closed_at=case when target='CLOSED' then statement_timestamp() else closed_at end,closed_by_account_id=case when target='CLOSED' then actor else closed_by_account_id end where id=period_id;
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,previous_status,resulting_status,reason_code,idempotency_key,correlation_id) values('ACADEMIC_PERIOD',period_id,event_name,actor,p.status::text,target::text,'PERIOD_OPERATION',operation_key,correlation);
 perform academic.complete_academic_command(actor,command_name,operation_key,'ACADEMIC_PERIOD',period_id); return query select period_id,target::text; end $$;
create function academic.activate_academic_period(period_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_period_status(period_id,'ACTIVE','ACTIVATE_ACADEMIC_PERIOD','ACADEMIC_PERIOD_ACTIVATED',operation_key,correlation)$$;
create function academic.close_academic_period(period_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_period_status(period_id,'CLOSED','CLOSE_ACADEMIC_PERIOD','ACADEMIC_PERIOD_CLOSED',operation_key,correlation)$$;

create function academic.create_subject(subject_code text,subject_name text,kind academic.subject_type,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.subjects.manage'); prior:=academic.begin_academic_command(actor,'CREATE_SUBJECT',operation_key,md5(subject_code||subject_name||kind::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if;
 if kind not in ('COMMON','AREA_SPECIFIC') then raise exception 'SUBJECT_TYPE_AREA_MISMATCH'; end if; insert into academic.subjects(code,name,subject_type,created_by_account_id) values(upper(btrim(subject_code)),btrim(subject_name),kind,actor) returning id into created;
 perform academic.complete_academic_command(actor,'CREATE_SUBJECT',operation_key,'SUBJECT',created); return query select created,'ACTIVE'; end $$;
create function academic.deactivate_subject(subject_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.subjects.manage'); prior:=academic.begin_academic_command(actor,'DEACTIVATE_SUBJECT',operation_key,md5(subject_id::text)); if prior is not null then return query select prior,'INACTIVE'; return; end if; update academic.subjects subjects set status='INACTIVE',updated_at=statement_timestamp() where subjects.id=subject_id and subjects.status='ACTIVE'; if not found then raise exception 'SUBJECT_NOT_FOUND'; end if; perform academic.complete_academic_command(actor,'DEACTIVATE_SUBJECT',operation_key,'SUBJECT',subject_id); return query select subject_id,'INACTIVE'; end $$;

create function academic.create_study_plan(plan_code text,plan_name text,plan_version text,valid_from date,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid; semester smallint;
begin actor:=academic.require_academic_permission('academic.plans.manage'); prior:=academic.begin_academic_command(actor,'CREATE_STUDY_PLAN',operation_key,md5(plan_code||plan_name||plan_version||valid_from::text)); if prior is not null then return query select prior,'DRAFT'; return; end if;
 insert into academic.study_plans(code,name,version,valid_from,created_by_account_id) values(upper(btrim(plan_code)),btrim(plan_name),btrim(plan_version),valid_from,actor) returning id into created;
 for semester in 1..6 loop insert into academic.plan_semesters(study_plan_id,semester_number,name,specialization_required) values(created,semester,'Semestre '||semester,semester>=5); end loop;
 perform academic.complete_academic_command(actor,'CREATE_STUDY_PLAN',operation_key,'STUDY_PLAN',created); return query select created,'DRAFT'; end $$;

create function academic.approve_study_plan(plan_id uuid,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; p academic.study_plans%rowtype; prior uuid;
begin actor:=academic.require_academic_permission('academic.plans.approve'); prior:=academic.begin_academic_command(actor,'APPROVE_STUDY_PLAN',operation_key,md5(plan_id::text)); if prior is not null then return query select prior,'APPROVED'; return; end if;
 select * into p from academic.study_plans where id=plan_id for update; if p.id is null then raise exception 'STUDY_PLAN_NOT_FOUND'; end if; if p.status not in ('DRAFT','UNDER_REVIEW') or (select count(*) from academic.plan_semesters where study_plan_id=plan_id)<>6 then raise exception 'STUDY_PLAN_INVALID_STATE'; end if;
 update academic.study_plans set status='APPROVED',approved_by_account_id=actor,approved_at=statement_timestamp(),updated_at=statement_timestamp() where id=plan_id;
 perform academic.complete_academic_command(actor,'APPROVE_STUDY_PLAN',operation_key,'STUDY_PLAN',plan_id); return query select plan_id,'APPROVED'; end $$;
create function academic.activate_study_plan(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.plans.manage'); prior:=academic.begin_academic_command(actor,'ACTIVATE_STUDY_PLAN',operation_key,md5(plan_id::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if; perform set_config('academic.controlled_mutation','on',true); update academic.study_plans plans set status='ACTIVE',updated_at=statement_timestamp() where plans.id=plan_id and plans.status='APPROVED'; perform set_config('academic.controlled_mutation','off',true); if not found then raise exception 'STUDY_PLAN_INVALID_STATE'; end if; perform academic.complete_academic_command(actor,'ACTIVATE_STUDY_PLAN',operation_key,'STUDY_PLAN',plan_id); return query select plan_id,'ACTIVE'; end $$;

create function academic.add_subject_to_study_plan(plan_id uuid,semester_id uuid,subject_id uuid,area_id uuid,display_order smallint,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid; subject academic.subjects%rowtype; semester academic.plan_semesters%rowtype; plan_status academic.study_plan_status;
begin actor:=academic.require_academic_permission('academic.plans.manage'); prior:=academic.begin_academic_command(actor,'ADD_SUBJECT_TO_STUDY_PLAN',operation_key,md5(plan_id::text||semester_id::text||subject_id::text||coalesce(area_id::text,'')||display_order::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if;
 select plans.status into plan_status from academic.study_plans plans where plans.id=plan_id for update; if plan_status is null then raise exception 'STUDY_PLAN_NOT_FOUND'; end if; if plan_status not in ('DRAFT','UNDER_REVIEW') then raise exception 'STUDY_PLAN_IMMUTABLE'; end if;
 select * into semester from academic.plan_semesters semesters where semesters.id=semester_id and semesters.study_plan_id=plan_id; select * into subject from academic.subjects subjects where subjects.id=subject_id and subjects.status='ACTIVE'; if semester.id is null or subject.id is null then raise exception 'SUBJECT_NOT_FOUND'; end if;
 if (subject.subject_type='COMMON' and area_id is not null) or (subject.subject_type='AREA_SPECIFIC' and (area_id is null or semester.semester_number<5 or not exists(select 1 from academic.training_areas areas where areas.id=area_id and areas.status='ACTIVE' and areas.starts_at_semester<=semester.semester_number))) then raise exception 'SUBJECT_TYPE_AREA_MISMATCH'; end if;
 insert into academic.curriculum_subjects(study_plan_id,plan_semester_id,subject_id,training_area_id,display_order) values(plan_id,semester_id,subject_id,area_id,display_order) returning id into created;
 perform academic.complete_academic_command(actor,'ADD_SUBJECT_TO_STUDY_PLAN',operation_key,'CURRICULUM_SUBJECT',created); return query select created,'ACTIVE'; end $$;

create function academic.create_subject_units(curriculum_id uuid,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid; existing_count integer;
begin actor:=academic.require_academic_permission('academic.plans.manage'); prior:=academic.begin_academic_command(actor,'CREATE_SUBJECT_UNITS',operation_key,md5(curriculum_id::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if;
 perform 1 from academic.curriculum_subjects curricula where curricula.id=curriculum_id and curricula.status='ACTIVE' for update; if not found then raise exception 'SUBJECT_NOT_FOUND'; end if; select count(*) into existing_count from academic.subject_units units where units.curriculum_subject_id=curriculum_id; if existing_count not in (0,3) then raise exception 'SUBJECT_UNITS_INCOMPLETE'; end if;
 if existing_count=0 then insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order) select curriculum_id,n,'Unidad '||n,n from generate_series(1,3) n; end if;
 perform academic.complete_academic_command(actor,'CREATE_SUBJECT_UNITS',operation_key,'SUBJECT_UNITS',curriculum_id); return query select curriculum_id,'ACTIVE'; end $$;

create function academic.create_group(period_id uuid,plan_id uuid,semester smallint,area_id uuid,group_code text,group_name text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid; period_status academic.structure_status; plan_status academic.study_plan_status;
begin actor:=academic.require_academic_permission('academic.groups.manage'); prior:=academic.begin_academic_command(actor,'CREATE_GROUP',operation_key,md5(period_id::text||plan_id::text||semester::text||coalesce(area_id::text,'')||group_code)); if prior is not null then return query select prior,'DRAFT'; return; end if;
 select periods.status into period_status from academic.academic_periods periods where periods.id=period_id for update; select plans.status into plan_status from academic.study_plans plans where plans.id=plan_id; if period_status in ('CLOSED','CANCELLED') or plan_status not in ('APPROVED','ACTIVE') or semester not between 1 and 6 or (semester<5 and area_id is not null) or (semester>=5 and area_id is null) then raise exception 'GROUP_AREA_MISMATCH'; end if;
 insert into academic.groups(academic_period_id,study_plan_id,semester_number,training_area_id,code,display_name,created_by_account_id) values(period_id,plan_id,semester,area_id,upper(btrim(group_code)),btrim(group_name),actor) returning id into created;
 perform academic.complete_academic_command(actor,'CREATE_GROUP',operation_key,'GROUP',created); return query select created,'DRAFT'; end $$;
create function academic.activate_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.groups.manage'); prior:=academic.begin_academic_command(actor,'ACTIVATE_GROUP',operation_key,md5(group_id::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if; update academic.groups g set status='ACTIVE',updated_at=statement_timestamp() from academic.academic_periods p where g.id=group_id and p.id=g.academic_period_id and g.status in ('PLANNED','OPEN') and p.status not in ('CLOSED','CANCELLED'); if not found then raise exception 'GROUP_NOT_FOUND'; end if; perform academic.complete_academic_command(actor,'ACTIVATE_GROUP',operation_key,'GROUP',group_id); return query select group_id,'ACTIVE'; end $$;

create function academic.create_academic_offering(group_id uuid,curriculum_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid; g academic.groups%rowtype; c academic.curriculum_subjects%rowtype; semester smallint; subject_status academic.catalog_status;
begin actor:=academic.require_academic_permission('academic.offerings.manage'); prior:=academic.begin_academic_command(actor,'CREATE_ACADEMIC_OFFERING',operation_key,md5(group_id::text||curriculum_id::text)); if prior is not null then return query select prior,'DRAFT'; return; end if; select * into g from academic.groups groups where groups.id=group_id for update; select * into c from academic.curriculum_subjects curricula where curricula.id=curriculum_id and curricula.status='ACTIVE'; select semesters.semester_number into semester from academic.plan_semesters semesters where semesters.id=c.plan_semester_id; select subjects.status into subject_status from academic.subjects subjects where subjects.id=c.subject_id;
 if g.id is null or c.id is null or g.study_plan_id<>c.study_plan_id or g.semester_number<>semester or subject_status<>'ACTIVE' or (c.training_area_id is not null and c.training_area_id is distinct from g.training_area_id) or exists(select 1 from academic.academic_periods periods where periods.id=g.academic_period_id and periods.status in ('CLOSED','CANCELLED')) then raise exception 'ACADEMIC_OFFERING_PLAN_MISMATCH'; end if;
 insert into academic.academic_offerings(academic_period_id,group_id,curriculum_subject_id,created_by_account_id) values(g.academic_period_id,group_id,curriculum_id,actor) returning id into created; perform academic.complete_academic_command(actor,'CREATE_ACADEMIC_OFFERING',operation_key,'ACADEMIC_OFFERING',created); return query select created,'DRAFT'; end $$;
create function academic.activate_academic_offering(offering_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.offerings.manage'); prior:=academic.begin_academic_command(actor,'ACTIVATE_ACADEMIC_OFFERING',operation_key,md5(offering_id::text)); if prior is not null then return query select prior,'ACTIVE'; return; end if; update academic.academic_offerings o set status='ACTIVE',activated_at=statement_timestamp(),activated_by_account_id=actor,updated_at=statement_timestamp() from academic.academic_periods p,academic.groups g where o.id=offering_id and p.id=o.academic_period_id and g.id=o.group_id and o.status in ('DRAFT','PLANNED') and p.status not in ('CLOSED','CANCELLED') and g.status='ACTIVE'; if not found then raise exception 'ACADEMIC_OFFERING_CONFLICT'; end if; perform academic.complete_academic_command(actor,'ACTIVATE_ACADEMIC_OFFERING',operation_key,'ACADEMIC_OFFERING',offering_id); return query select offering_id,'ACTIVE'; end $$;

create function academic.assign_teacher(offering_id uuid,teacher_id uuid,kind academic.assignment_type,valid_from date,valid_to date,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; created uuid; prior uuid; period_start date; period_end date;
begin actor:=academic.require_academic_permission('academic.assignments.manage'); prior:=academic.begin_academic_command(actor,'ASSIGN_TEACHER',operation_key,md5(offering_id::text||teacher_id::text||kind::text||valid_from::text||coalesce(valid_to::text,''))); if prior is not null then return query select prior,'PLANNED'; return; end if;
 if not exists(select 1 from core.accounts a join core.account_roles ar on ar.account_id=a.id and ar.revoked_at is null join core.roles r on r.id=ar.role_id and r.is_active and r.code='DOCENTE' where a.id=teacher_id and a.person_id is not null and a.account_status='ACTIVE') then if exists(select 1 from core.accounts where id=teacher_id) then raise exception 'TEACHER_ROLE_REQUIRED'; else raise exception 'TEACHER_NOT_FOUND'; end if; end if;
 select p.starts_on,p.ends_on into period_start,period_end from academic.academic_offerings o join academic.academic_periods p on p.id=o.academic_period_id where o.id=offering_id; if period_start is null or valid_from<period_start or coalesce(valid_to,period_end)>period_end then raise exception 'INVALID_DATE_RANGE'; end if;
 insert into academic.teaching_assignments(academic_offering_id,teacher_account_id,assignment_type,valid_from,valid_to,assigned_by_account_id) values(offering_id,teacher_id,kind,valid_from,valid_to,actor) returning id into created; perform academic.complete_academic_command(actor,'ASSIGN_TEACHER',operation_key,'TEACHING_ASSIGNMENT',created); return query select created,'PLANNED'; end $$;
create function academic.end_teaching_assignment(assignment_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; prior uuid;
begin actor:=academic.require_academic_permission('academic.assignments.manage'); prior:=academic.begin_academic_command(actor,'END_TEACHING_ASSIGNMENT',operation_key,md5(assignment_id::text)); if prior is not null then return query select prior,'ENDED'; return; end if; update academic.teaching_assignments assignments set status='ENDED',valid_to=coalesce(assignments.valid_to,current_date),ended_at=statement_timestamp(),ended_by_account_id=actor,updated_at=statement_timestamp() where assignments.id=assignment_id and assignments.status in ('PLANNED','ACTIVE'); if not found then raise exception 'TEACHER_ASSIGNMENT_CONFLICT'; end if; perform academic.complete_academic_command(actor,'END_TEACHING_ASSIGNMENT',operation_key,'TEACHING_ASSIGNMENT',assignment_id); return query select assignment_id,'ENDED'; end $$;

create function academic.get_academic_structure_summary()
returns table(active_cycle_count bigint,active_period_count bigint,active_plan_count bigint,active_group_count bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 perform academic.require_academic_permission('academic.plans.read');
 return query select
   (select count(*) from academic.school_cycles where status='ACTIVE'),
   (select count(*) from academic.academic_periods where status='ACTIVE'),
   (select count(*) from academic.study_plans where status='ACTIVE'),
   (select count(*) from academic.groups where status='ACTIVE');
end $$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' loop execute format('alter function %s owner to postgres',f.signature); execute format('revoke execute on function %s from public, anon, authenticated',f.signature); end loop;
end $$;
revoke all on all tables in schema academic from public,anon,authenticated;
commit;
