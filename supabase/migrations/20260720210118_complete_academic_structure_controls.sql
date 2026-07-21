-- Phase 3 / Block 1 closure. This migration is intentionally additive.

alter type academic.academic_event_type add value if not exists 'SCHOOL_CYCLE_PLANNED';
alter type academic.academic_event_type add value if not exists 'SCHOOL_CYCLE_CLOSING_STARTED';
alter type academic.academic_event_type add value if not exists 'ACADEMIC_PERIOD_PLANNED';
alter type academic.academic_event_type add value if not exists 'ACADEMIC_PERIOD_CLOSING_STARTED';
alter type academic.academic_event_type add value if not exists 'STUDY_PLAN_SUBMITTED_FOR_REVIEW';
alter type academic.academic_event_type add value if not exists 'STUDY_PLAN_RETIRED';
alter type academic.academic_event_type add value if not exists 'GROUP_PLANNED';
alter type academic.academic_event_type add value if not exists 'GROUP_OPENED';
alter type academic.academic_event_type add value if not exists 'GROUP_CLOSED';
alter type academic.academic_event_type add value if not exists 'ACADEMIC_OFFERING_PLANNED';
alter type academic.academic_event_type add value if not exists 'ACADEMIC_OFFERING_CLOSED';
alter type academic.academic_event_type add value if not exists 'TEACHER_ASSIGNMENT_ACTIVATED';
alter type academic.academic_event_type add value if not exists 'ENTITY_CANCELLED';

begin;

create extension if not exists pgcrypto with schema extensions;

alter table academic.academic_commands drop constraint academic_commands_command_type_check;
alter table academic.academic_commands add constraint academic_commands_command_type_check check (command_type in (
  'CREATE_SCHOOL_CYCLE','PLAN_SCHOOL_CYCLE','ACTIVATE_SCHOOL_CYCLE','BEGIN_SCHOOL_CYCLE_CLOSING','CLOSE_SCHOOL_CYCLE','CANCEL_SCHOOL_CYCLE',
  'CREATE_ACADEMIC_PERIOD','PLAN_ACADEMIC_PERIOD','ACTIVATE_ACADEMIC_PERIOD','BEGIN_ACADEMIC_PERIOD_CLOSING','CLOSE_ACADEMIC_PERIOD','CANCEL_ACADEMIC_PERIOD',
  'CREATE_STUDY_PLAN','SUBMIT_STUDY_PLAN_FOR_REVIEW','APPROVE_STUDY_PLAN','ACTIVATE_STUDY_PLAN','RETIRE_STUDY_PLAN','CANCEL_STUDY_PLAN',
  'CREATE_SUBJECT','DEACTIVATE_SUBJECT','ADD_SUBJECT_TO_STUDY_PLAN','CREATE_SUBJECT_UNITS',
  'CREATE_GROUP','PLAN_GROUP','OPEN_GROUP','ACTIVATE_GROUP','CLOSE_GROUP','CANCEL_GROUP',
  'CREATE_ACADEMIC_OFFERING','PLAN_ACADEMIC_OFFERING','ACTIVATE_ACADEMIC_OFFERING','CLOSE_ACADEMIC_OFFERING','CANCEL_ACADEMIC_OFFERING',
  'ASSIGN_TEACHER','ACTIVATE_TEACHING_ASSIGNMENT','END_TEACHING_ASSIGNMENT','CANCEL_TEACHING_ASSIGNMENT'
));
alter table academic.academic_commands drop constraint academic_commands_request_fingerprint_check;
alter table academic.academic_commands add constraint academic_commands_request_fingerprint_check
  check (request_fingerprint ~ '^[0-9a-f]{32}$' or request_fingerprint ~ '^[0-9a-f]{64}$');

create or replace function academic.academic_request_fingerprint(payload jsonb)
returns text language sql immutable strict security invoker set search_path='' as $$
  select encode(extensions.digest(pg_catalog.convert_to(payload::text,'UTF8'),'sha256'),'hex')
$$;

create or replace function academic.begin_academic_command(actor_id uuid, command_name text, operation_key text, fingerprint text)
returns uuid language plpgsql security definer set search_path='' as $$
declare existing academic.academic_commands%rowtype; command_id uuid;
begin
  if fingerprint !~ '^[0-9a-f]{64}$' and command_name in (
    'PLAN_SCHOOL_CYCLE','BEGIN_SCHOOL_CYCLE_CLOSING','CANCEL_SCHOOL_CYCLE',
    'PLAN_ACADEMIC_PERIOD','BEGIN_ACADEMIC_PERIOD_CLOSING','CANCEL_ACADEMIC_PERIOD',
    'SUBMIT_STUDY_PLAN_FOR_REVIEW','RETIRE_STUDY_PLAN','CANCEL_STUDY_PLAN',
    'PLAN_GROUP','OPEN_GROUP','CLOSE_GROUP','CANCEL_GROUP',
    'PLAN_ACADEMIC_OFFERING','CLOSE_ACADEMIC_OFFERING','CANCEL_ACADEMIC_OFFERING',
    'ACTIVATE_TEACHING_ASSIGNMENT','CANCEL_TEACHING_ASSIGNMENT'
  ) then raise exception 'INVALID_REQUEST_FINGERPRINT'; end if;
  perform set_config('academic.command_type',command_name,true);
  perform set_config('academic.operation_key',operation_key,true);
  perform set_config('academic.actor_account_id',actor_id::text,true);
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

create or replace function academic.valid_group_transition(old_status academic.group_status,new_status academic.group_status)
returns boolean language sql immutable security invoker set search_path='' as $$
 select (old_status,new_status) in (('DRAFT','PLANNED'),('PLANNED','OPEN'),('OPEN','ACTIVE'),('ACTIVE','CLOSED'),('DRAFT','CANCELLED'),('PLANNED','CANCELLED'),('OPEN','CANCELLED'))
$$;
create or replace function academic.valid_offering_transition(old_status academic.offering_status,new_status academic.offering_status)
returns boolean language sql immutable security invoker set search_path='' as $$
 select (old_status,new_status) in (('DRAFT','PLANNED'),('PLANNED','ACTIVE'),('ACTIVE','CLOSED'),('DRAFT','CANCELLED'),('PLANNED','CANCELLED'))
$$;
create or replace function academic.valid_assignment_transition(old_status academic.assignment_status,new_status academic.assignment_status)
returns boolean language sql immutable security invoker set search_path='' as $$
 select (old_status,new_status) in (('PLANNED','ACTIVE'),('ACTIVE','ENDED'),('PLANNED','CANCELLED'))
$$;

create or replace function academic.guard_academic_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_setting('academic.controlled_mutation',true)='on' then return new; end if;
 if tg_op='DELETE' then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if;
 if tg_table_name='training_areas' then if new.code<>old.code then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 if tg_table_name='study_plans' then if old.status::text in ('APPROVED','ACTIVE','RETIRED') and new is distinct from old then raise exception 'STUDY_PLAN_IMMUTABLE'; end if; end if;
 if tg_table_name in ('school_cycles','academic_periods') then if old.status::text='CLOSED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 if tg_table_name='groups' then if old.status::text='CLOSED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 if tg_table_name='academic_offerings' then if old.status::text='CLOSED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 if tg_table_name='teaching_assignments' then if old.status::text='ENDED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 if tg_table_name='academic_commands' then if old.status='COMPLETED' and new is distinct from old then raise exception 'HISTORICAL_RECORD_IMMUTABLE'; end if; end if;
 return new;
end $$;

do $$ declare table_name text; begin
 foreach table_name in array array['plan_semesters','subjects','curriculum_subjects','subject_units','groups','academic_offerings','academic_commands'] loop
  execute format('drop trigger if exists %I_history on academic.%I',table_name,table_name);
  execute format('create trigger %I_history before update or delete on academic.%I for each row execute function academic.guard_academic_history()',table_name,table_name);
 end loop;
end $$;

create function academic.record_command_event() returns trigger language plpgsql security definer set search_path='' as $$
declare command text:=current_setting('academic.command_type',true); op_key text:=current_setting('academic.operation_key',true); actor uuid; event academic.academic_event_type; entity academic.academic_entity_type; prior text; result text;
begin
 if command is null or command='' or command in ('CREATE_SCHOOL_CYCLE','ACTIVATE_SCHOOL_CYCLE','CLOSE_SCHOOL_CYCLE','ACTIVATE_ACADEMIC_PERIOD','CLOSE_ACADEMIC_PERIOD') then return new; end if;
 actor:=current_setting('academic.actor_account_id',true)::uuid;
 event:=case command
  when 'CREATE_ACADEMIC_PERIOD' then 'ACADEMIC_PERIOD_CREATED' when 'CREATE_STUDY_PLAN' then 'STUDY_PLAN_CREATED'
  when 'CREATE_SUBJECT' then 'SUBJECT_CREATED' when 'DEACTIVATE_SUBJECT' then 'SUBJECT_DEACTIVATED'
  when 'ADD_SUBJECT_TO_STUDY_PLAN' then 'CURRICULUM_SUBJECT_ADDED' when 'CREATE_GROUP' then 'GROUP_CREATED'
  when 'CREATE_ACADEMIC_OFFERING' then 'ACADEMIC_OFFERING_CREATED' when 'ASSIGN_TEACHER' then 'TEACHER_ASSIGNED'
  when 'PLAN_SCHOOL_CYCLE' then 'SCHOOL_CYCLE_PLANNED' when 'BEGIN_SCHOOL_CYCLE_CLOSING' then 'SCHOOL_CYCLE_CLOSING_STARTED'
  when 'PLAN_ACADEMIC_PERIOD' then 'ACADEMIC_PERIOD_PLANNED' when 'BEGIN_ACADEMIC_PERIOD_CLOSING' then 'ACADEMIC_PERIOD_CLOSING_STARTED'
  when 'SUBMIT_STUDY_PLAN_FOR_REVIEW' then 'STUDY_PLAN_SUBMITTED_FOR_REVIEW' when 'APPROVE_STUDY_PLAN' then 'STUDY_PLAN_APPROVED'
  when 'ACTIVATE_STUDY_PLAN' then 'STUDY_PLAN_ACTIVATED' when 'RETIRE_STUDY_PLAN' then 'STUDY_PLAN_RETIRED'
  when 'PLAN_GROUP' then 'GROUP_PLANNED' when 'OPEN_GROUP' then 'GROUP_OPENED' when 'ACTIVATE_GROUP' then 'GROUP_ACTIVATED' when 'CLOSE_GROUP' then 'GROUP_CLOSED'
  when 'PLAN_ACADEMIC_OFFERING' then 'ACADEMIC_OFFERING_PLANNED' when 'ACTIVATE_ACADEMIC_OFFERING' then 'ACADEMIC_OFFERING_ACTIVATED' when 'CLOSE_ACADEMIC_OFFERING' then 'ACADEMIC_OFFERING_CLOSED'
  when 'ACTIVATE_TEACHING_ASSIGNMENT' then 'TEACHER_ASSIGNMENT_ACTIVATED' when 'END_TEACHING_ASSIGNMENT' then 'TEACHER_ASSIGNMENT_ENDED'
  when 'CANCEL_SCHOOL_CYCLE' then 'ENTITY_CANCELLED' when 'CANCEL_ACADEMIC_PERIOD' then 'ENTITY_CANCELLED' when 'CANCEL_STUDY_PLAN' then 'ENTITY_CANCELLED'
  when 'CANCEL_GROUP' then 'ENTITY_CANCELLED' when 'CANCEL_ACADEMIC_OFFERING' then 'ENTITY_CANCELLED' when 'CANCEL_TEACHING_ASSIGNMENT' then 'ENTITY_CANCELLED'
 end;
 if event is null then return new; end if;
 entity:=case tg_table_name when 'school_cycles' then 'SCHOOL_CYCLE' when 'academic_periods' then 'ACADEMIC_PERIOD' when 'study_plans' then 'STUDY_PLAN' when 'subjects' then 'SUBJECT' when 'curriculum_subjects' then 'CURRICULUM_SUBJECT' when 'groups' then 'GROUP' when 'academic_offerings' then 'ACADEMIC_OFFERING' when 'teaching_assignments' then 'TEACHING_ASSIGNMENT' end;
 prior:=case when tg_op='UPDATE' then old.status::text else null end;
 result:=case when tg_table_name='subjects' then new.status::text when tg_table_name='curriculum_subjects' then new.status::text else new.status::text end;
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,previous_status,resulting_status,reason_code,idempotency_key,correlation_id)
 values(entity,new.id,event,actor,prior,result,case when tg_table_name='teaching_assignments' then 'TEACHING_OPERATION'::academic.academic_reason_code else 'PERIOD_OPERATION'::academic.academic_reason_code end,op_key,null);
 return new;
end $$;

do $$ declare table_name text; begin
 foreach table_name in array array['academic_periods','study_plans','subjects','curriculum_subjects','groups','academic_offerings','teaching_assignments'] loop
  execute format('create trigger %I_command_event after insert or update on academic.%I for each row execute function academic.record_command_event()',table_name,table_name);
 end loop;
end $$;

create function academic.record_units_command_event() returns trigger language plpgsql security definer set search_path='' as $$
declare op_key text:=current_setting('academic.operation_key',true); actor uuid:=current_setting('academic.actor_account_id',true)::uuid; curriculum uuid;
begin
 if current_setting('academic.command_type',true)<>'CREATE_SUBJECT_UNITS' then return null; end if;
 select curriculum_subject_id into curriculum from new_units limit 1;
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,resulting_status,reason_code,idempotency_key)
 values('SUBJECT_UNITS',curriculum,'SUBJECT_UNITS_CREATED',actor,'ACTIVE','INITIAL_CONFIGURATION',op_key);
 return null;
end $$;
create trigger subject_units_command_event after insert on academic.subject_units referencing new table as new_units for each statement execute function academic.record_units_command_event();

create function academic.change_school_cycle_status(cycle_id uuid,target academic.structure_status,command_name text,event_name academic.academic_event_type,operation_key text,correlation uuid)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; row_record academic.school_cycles%rowtype; prior uuid;
begin actor:=academic.require_academic_permission('academic.cycles.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('cycle_id',cycle_id,'target',target)));
 if prior is not null then return query select prior,(select s.status::text from academic.school_cycles s where s.id=prior); return; end if;
 select * into row_record from academic.school_cycles where id=cycle_id for update; if row_record.id is null then raise exception 'ACADEMIC_CYCLE_NOT_FOUND'; end if;
 if not academic.valid_structure_transition(row_record.status,target) then raise exception 'ACADEMIC_CYCLE_INVALID_STATE'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.school_cycles set status=target,updated_at=statement_timestamp(),activated_at=case when target='ACTIVE' then statement_timestamp() else activated_at end,activated_by_account_id=case when target='ACTIVE' then actor else activated_by_account_id end,closed_at=case when target='CLOSED' then statement_timestamp() else closed_at end,closed_by_account_id=case when target='CLOSED' then actor else closed_by_account_id end where id=cycle_id; perform set_config('academic.controlled_mutation','off',true);
 insert into academic.academic_structure_events(entity_type,entity_id,event_type,actor_account_id,previous_status,resulting_status,reason_code,idempotency_key,correlation_id) values('SCHOOL_CYCLE',cycle_id,event_name,actor,row_record.status::text,target::text,'PERIOD_OPERATION',operation_key,correlation);
 perform academic.complete_academic_command(actor,command_name,operation_key,'SCHOOL_CYCLE',cycle_id); return query select cycle_id,target::text; end $$;
create function academic.plan_school_cycle(cycle_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$begin return query select * from academic.change_school_cycle_status(cycle_id,'PLANNED','PLAN_SCHOOL_CYCLE',('SCHOOL_CYCLE_PLANNED'::text)::academic.academic_event_type,operation_key,correlation); end$$;
create function academic.begin_school_cycle_closing(cycle_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$begin return query select * from academic.change_school_cycle_status(cycle_id,'CLOSING','BEGIN_SCHOOL_CYCLE_CLOSING',('SCHOOL_CYCLE_CLOSING_STARTED'::text)::academic.academic_event_type,operation_key,correlation); end$$;
create function academic.cancel_school_cycle(cycle_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$begin return query select * from academic.change_school_cycle_status(cycle_id,'CANCELLED','CANCEL_SCHOOL_CYCLE',('ENTITY_CANCELLED'::text)::academic.academic_event_type,operation_key,correlation); end$$;

create function academic.change_period_status_strict(period_id uuid,target academic.structure_status,command_name text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; p academic.academic_periods%rowtype; prior uuid;
begin actor:=academic.require_academic_permission('academic.periods.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('period_id',period_id,'target',target)));
 if prior is not null then return query select prior,(select x.status::text from academic.academic_periods x where x.id=prior); return; end if;
 select * into p from academic.academic_periods where id=period_id for update; if p.id is null then raise exception 'ACADEMIC_PERIOD_NOT_FOUND'; end if;
 if not academic.valid_structure_transition(p.status,target) then raise exception 'ACADEMIC_PERIOD_DATE_CONFLICT'; end if;
 if target='CLOSING' and exists(select 1 from academic.academic_offerings o where o.academic_period_id=period_id and o.status='ACTIVE') then raise exception 'ACADEMIC_PERIOD_HAS_OPEN_OFFERINGS'; end if;
 if target='CLOSED' and exists(select 1 from academic.academic_offerings o where o.academic_period_id=period_id and o.status not in ('CLOSED','CANCELLED')) then raise exception 'ACADEMIC_PERIOD_HAS_OPEN_OFFERINGS'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.academic_periods set status=target,updated_at=statement_timestamp(),activated_at=case when target='ACTIVE' then statement_timestamp() else activated_at end,activated_by_account_id=case when target='ACTIVE' then actor else activated_by_account_id end,closed_at=case when target='CLOSED' then statement_timestamp() else closed_at end,closed_by_account_id=case when target='CLOSED' then actor else closed_by_account_id end where id=period_id; perform set_config('academic.controlled_mutation','off',true);
 perform academic.complete_academic_command(actor,command_name,operation_key,'ACADEMIC_PERIOD',period_id); return query select period_id,target::text; end $$;
create function academic.plan_academic_period(period_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_period_status_strict(period_id,'PLANNED','PLAN_ACADEMIC_PERIOD',operation_key,correlation)$$;
create function academic.begin_academic_period_closing(period_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_period_status_strict(period_id,'CLOSING','BEGIN_ACADEMIC_PERIOD_CLOSING',operation_key,correlation)$$;
create function academic.cancel_academic_period(period_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_period_status_strict(period_id,'CANCELLED','CANCEL_ACADEMIC_PERIOD',operation_key,correlation)$$;

create function academic.change_study_plan_status(plan_id uuid,target academic.study_plan_status,command_name text,permission text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$
declare actor uuid; p academic.study_plans%rowtype; prior uuid;
begin actor:=academic.require_academic_permission(permission); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('plan_id',plan_id,'target',target)));
 if prior is not null then return query select prior,(select x.status::text from academic.study_plans x where x.id=prior); return; end if;
 select * into p from academic.study_plans where id=plan_id for update; if p.id is null then raise exception 'STUDY_PLAN_NOT_FOUND'; end if;
 if not academic.valid_plan_transition(p.status,target) then raise exception 'STUDY_PLAN_INVALID_STATE'; end if;
 if target='APPROVED' and (select count(*) from academic.plan_semesters where study_plan_id=plan_id)<>6 then raise exception 'STUDY_PLAN_INVALID_STATE'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.study_plans set status=target,approved_by_account_id=case when target='APPROVED' then actor else approved_by_account_id end,approved_at=case when target='APPROVED' then statement_timestamp() else approved_at end,updated_at=statement_timestamp() where id=plan_id; perform set_config('academic.controlled_mutation','off',true);
 perform academic.complete_academic_command(actor,command_name,operation_key,'STUDY_PLAN',plan_id); return query select plan_id,target::text; end $$;
create function academic.submit_study_plan_for_review(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_study_plan_status(plan_id,'UNDER_REVIEW','SUBMIT_STUDY_PLAN_FOR_REVIEW','academic.plans.manage',operation_key,correlation)$$;
create function academic.retire_study_plan(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_study_plan_status(plan_id,'RETIRED','RETIRE_STUDY_PLAN','academic.plans.manage',operation_key,correlation)$$;
create function academic.cancel_study_plan(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_study_plan_status(plan_id,'CANCELLED','CANCEL_STUDY_PLAN','academic.plans.manage',operation_key,correlation)$$;
create or replace function academic.approve_study_plan(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_study_plan_status(plan_id,'APPROVED','APPROVE_STUDY_PLAN','academic.plans.approve',operation_key,correlation)$$;
create or replace function academic.activate_study_plan(plan_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_study_plan_status(plan_id,'ACTIVE','ACTIVATE_STUDY_PLAN','academic.plans.manage',operation_key,correlation)$$;

create function academic.change_group_status(group_id uuid,target academic.group_status,command_name text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; g academic.groups%rowtype; prior uuid; period_status academic.structure_status;
begin actor:=academic.require_academic_permission('academic.groups.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('group_id',group_id,'target',target)));
 if prior is not null then return query select prior,(select x.status::text from academic.groups x where x.id=prior); return; end if;
 select * into g from academic.groups where id=group_id for update; if g.id is null then raise exception 'GROUP_NOT_FOUND'; end if; select p.status into period_status from academic.academic_periods p where p.id=g.academic_period_id for update;
 if not academic.valid_group_transition(g.status,target) or (target in ('OPEN','ACTIVE') and period_status not in ('PLANNED','ACTIVE')) then raise exception 'GROUP_INVALID_STATE'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.groups set status=target,updated_at=statement_timestamp() where id=group_id; perform set_config('academic.controlled_mutation','off',true);
 perform academic.complete_academic_command(actor,command_name,operation_key,'GROUP',group_id); return query select group_id,target::text; end $$;
create function academic.plan_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_group_status(group_id,'PLANNED','PLAN_GROUP',operation_key,correlation)$$;
create function academic.open_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_group_status(group_id,'OPEN','OPEN_GROUP',operation_key,correlation)$$;
create or replace function academic.activate_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_group_status(group_id,'ACTIVE','ACTIVATE_GROUP',operation_key,correlation)$$;
create function academic.close_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_group_status(group_id,'CLOSED','CLOSE_GROUP',operation_key,correlation)$$;
create function academic.cancel_group(group_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_group_status(group_id,'CANCELLED','CANCEL_GROUP',operation_key,correlation)$$;

create function academic.change_offering_status(offering_id uuid,target academic.offering_status,command_name text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; o academic.academic_offerings%rowtype; prior uuid; period_status academic.structure_status; group_status academic.group_status;
begin actor:=academic.require_academic_permission('academic.offerings.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('offering_id',offering_id,'target',target)));
 if prior is not null then return query select prior,(select x.status::text from academic.academic_offerings x where x.id=prior); return; end if;
 select * into o from academic.academic_offerings where id=offering_id for update; if o.id is null then raise exception 'ACADEMIC_OFFERING_CONFLICT'; end if;
 select p.status into period_status from academic.academic_periods p where p.id=o.academic_period_id for update; select g.status into group_status from academic.groups g where g.id=o.group_id for update;
 if not academic.valid_offering_transition(o.status,target) or (target='ACTIVE' and (period_status<>'ACTIVE' or group_status<>'ACTIVE')) then raise exception 'ACADEMIC_OFFERING_CONFLICT'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.academic_offerings set status=target,activated_at=case when target='ACTIVE' then statement_timestamp() else activated_at end,activated_by_account_id=case when target='ACTIVE' then actor else activated_by_account_id end,closed_at=case when target='CLOSED' then statement_timestamp() else closed_at end,updated_at=statement_timestamp() where id=offering_id; perform set_config('academic.controlled_mutation','off',true);
 perform academic.complete_academic_command(actor,command_name,operation_key,'ACADEMIC_OFFERING',offering_id); return query select offering_id,target::text; end $$;
create function academic.plan_academic_offering(offering_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_offering_status(offering_id,'PLANNED','PLAN_ACADEMIC_OFFERING',operation_key,correlation)$$;
create or replace function academic.activate_academic_offering(offering_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_offering_status(offering_id,'ACTIVE','ACTIVATE_ACADEMIC_OFFERING',operation_key,correlation)$$;
create function academic.close_academic_offering(offering_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_offering_status(offering_id,'CLOSED','CLOSE_ACADEMIC_OFFERING',operation_key,correlation)$$;
create function academic.cancel_academic_offering(offering_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_offering_status(offering_id,'CANCELLED','CANCEL_ACADEMIC_OFFERING',operation_key,correlation)$$;

create function academic.change_assignment_status(assignment_id uuid,target academic.assignment_status,command_name text,operation_key text,correlation uuid default null)
returns table(entity_id uuid,status text) language plpgsql security definer set search_path='' as $$declare actor uuid; a academic.teaching_assignments%rowtype; prior uuid;
begin actor:=academic.require_academic_permission('academic.assignments.manage'); prior:=academic.begin_academic_command(actor,command_name,operation_key,academic.academic_request_fingerprint(jsonb_build_object('assignment_id',assignment_id,'target',target)));
 if prior is not null then return query select prior,(select x.status::text from academic.teaching_assignments x where x.id=prior); return; end if;
 select * into a from academic.teaching_assignments where id=assignment_id for update; if a.id is null or not academic.valid_assignment_transition(a.status,target) then raise exception 'TEACHER_ASSIGNMENT_CONFLICT'; end if;
 perform set_config('academic.controlled_mutation','on',true); update academic.teaching_assignments set status=target,valid_to=case when target='ENDED' then coalesce(valid_to,greatest(current_date,valid_from)) else valid_to end,ended_at=case when target='ENDED' then statement_timestamp() else ended_at end,ended_by_account_id=case when target='ENDED' then actor else ended_by_account_id end,updated_at=statement_timestamp() where id=assignment_id; perform set_config('academic.controlled_mutation','off',true);
 perform academic.complete_academic_command(actor,command_name,operation_key,'TEACHING_ASSIGNMENT',assignment_id); return query select assignment_id,target::text; end $$;
create function academic.activate_teaching_assignment(assignment_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_assignment_status(assignment_id,'ACTIVE','ACTIVATE_TEACHING_ASSIGNMENT',operation_key,correlation)$$;
create or replace function academic.end_teaching_assignment(assignment_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_assignment_status(assignment_id,'ENDED','END_TEACHING_ASSIGNMENT',operation_key,correlation)$$;
create function academic.cancel_teaching_assignment(assignment_id uuid,operation_key text,correlation uuid default null) returns table(entity_id uuid,status text) language sql security definer set search_path='' as $$select * from academic.change_assignment_status(assignment_id,'CANCELLED','CANCEL_TEACHING_ASSIGNMENT',operation_key,correlation)$$;

do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' loop
  execute format('alter function %s owner to postgres',f.signature);
  execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
 end loop;
end $$;
revoke all on all tables in schema academic from public,anon,authenticated;
commit;
