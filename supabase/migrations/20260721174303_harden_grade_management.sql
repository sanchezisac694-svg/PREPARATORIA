begin;

-- Uniform idempotency and source-version locking for grade-management mutations.

create or replace function academic.begin_grade_command(
  actor uuid,
  kind academic.grade_command_type,
  operation_key text,
  payload jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fingerprint text := academic.grade_fingerprint(payload);
  existing academic.grade_commands%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text || kind::text || operation_key, 0));
  select * into existing
  from academic.grade_commands
  where actor_account_id = actor
    and command_type = kind
    and idempotency_key = operation_key
  for update;

  if existing.id is not null then
    if existing.request_fingerprint <> fingerprint then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    if existing.status = 'COMPLETED' and existing.resulting_entity_id is not null then
      return existing.resulting_entity_id;
    end if;
    raise exception 'CONCURRENT_MODIFICATION';
  end if;

  insert into academic.grade_commands(idempotency_key, command_type, actor_account_id, request_fingerprint)
  values(operation_key, kind, actor, fingerprint);
  return null;
end
$$;

create or replace function academic.complete_grade_command(
  actor uuid,
  kind academic.grade_command_type,
  operation_key text,
  entity_type academic.grade_entity_type,
  entity_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('academic.grade_command_controlled_mutation', 'on', true);
  update academic.grade_commands
  set status = 'COMPLETED', resulting_entity_type = entity_type,
      resulting_entity_id = entity_id, completed_at = statement_timestamp()
  where actor_account_id = actor and command_type = kind and idempotency_key = operation_key;
  perform set_config('academic.grade_command_controlled_mutation', 'off', true);
end
$$;

create function academic.fail_grade_command(
  actor uuid,
  kind academic.grade_command_type,
  operation_key text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('academic.grade_command_controlled_mutation', 'on', true);
  update academic.grade_commands
  set status = 'FAILED', completed_at = statement_timestamp()
  where actor_account_id = actor and command_type = kind and idempotency_key = operation_key;
  perform set_config('academic.grade_command_controlled_mutation', 'off', true);
end
$$;

create function academic.guard_grade_command_immutable() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'HISTORICAL_GRADE_IMMUTABLE'; end if;
  if current_setting('academic.grade_command_controlled_mutation', true) <> 'on'
     and old is distinct from new then
    raise exception 'HISTORICAL_GRADE_IMMUTABLE';
  end if;
  return new;
end
$$;

drop trigger grade_commands_immutable on academic.grade_commands;
create trigger grade_commands_immutable
before update or delete on academic.grade_commands
for each row execute function academic.guard_grade_command_immutable();

create or replace function academic.calculate_subject_final_result(
  offering_enrollment_id uuid, operation_key text, correlation uuid default null
) returns table(entity_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; data record; created uuid; ac smallint; na smallint; prior_result academic.subject_final_results%rowtype;
begin
  actor:=academic.require_grade_permission('academic.subject_results.calculate');
  prior:=academic.begin_grade_command(actor,'CALCULATE_SUBJECT_RESULT',operation_key,jsonb_build_object('enrollment',offering_enrollment_id));
  if prior is not null then return query select prior,'CALCULATED'; return; end if;
  select soe.academic_offering_id,pe.id period_enrollment_id,pe.student_record_id into data
    from academic.student_offering_enrollments soe join academic.period_enrollments pe on pe.id=soe.period_enrollment_id
    where soe.id=offering_enrollment_id for update of soe,pe;
  perform 1 from academic.student_unit_grades where student_offering_enrollment_id=offering_enrollment_id for update;
  select count(*) filter(where g.is_accredited)::smallint,count(*) filter(where not g.is_accredited)::smallint into ac,na
    from academic.student_unit_grades g where g.student_offering_enrollment_id=offering_enrollment_id and g.status in ('FINALIZED','CORRECTED');
  if ac+na<>3 then raise exception 'UNIT_GRADES_INCOMPLETE'; end if;
  select * into prior_result from academic.subject_final_results where student_offering_enrollment_id=offering_enrollment_id for update;
  perform set_config('academic.grade_controlled_mutation','on',true);
  if prior_result.id is null then
    insert into academic.subject_final_results(student_record_id,period_enrollment_id,student_offering_enrollment_id,academic_offering_id,accredited_unit_count,non_accredited_unit_count,result_code,calculation_status,status,calculated_by_account_id,calculated_at)
    values(data.student_record_id,data.period_enrollment_id,offering_enrollment_id,data.academic_offering_id,ac,na,case when ac>=2 then 'AC'::academic.subject_result_code else 'NA'::academic.subject_result_code end,'MANUAL_REVIEW_REQUIRED','CALCULATED',actor,statement_timestamp()) returning id into created;
  else
    update academic.subject_final_results set accredited_unit_count=ac,non_accredited_unit_count=na,result_code=case when ac>=2 then 'AC'::academic.subject_result_code else 'NA'::academic.subject_result_code end,calculation_status='MANUAL_REVIEW_REQUIRED',status='CALCULATED',calculated_by_account_id=actor,calculated_at=statement_timestamp(),confirmed_by_account_id=null,confirmed_at=null,updated_at=statement_timestamp() where id=prior_result.id returning id into created;
  end if;
  perform set_config('academic.grade_controlled_mutation','off',true);
  insert into academic.subject_result_history(subject_final_result_id,previous_result,resulting_result,previous_status,resulting_status,actor_account_id)
    values(created,prior_result.result_code,case when ac>=2 then 'AC'::academic.subject_result_code else 'NA'::academic.subject_result_code end,prior_result.status,'CALCULATED',actor);
  perform academic.complete_grade_command(actor,'CALCULATE_SUBJECT_RESULT',operation_key,'SUBJECT_RESULT',created);
  perform academic.append_grade_event(data.student_record_id,'SUBJECT_RESULT',created,'SUBJECT_RESULT_CALCULATED',actor,prior_result.status::text,'CALCULATED',operation_key,correlation);
  return query select created,'CALCULATED';
end $$;

create or replace function academic.confirm_subject_final_result(
  result_id uuid, operation_key text, correlation uuid default null
) returns table(entity_id uuid, status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; r academic.subject_final_results%rowtype;
begin
  actor := academic.require_grade_permission('academic.subject_results.confirm');
  prior := academic.begin_grade_command(actor, 'CONFIRM_SUBJECT_RESULT', operation_key,
    jsonb_build_object('result', result_id));
  if prior is not null then return query select prior, 'CONFIRMED'; return; end if;
  select * into r from academic.subject_final_results where id = result_id for update;
  if r.id is null or r.status <> 'CALCULATED' then raise exception 'SUBJECT_RESULT_INVALID_STATE'; end if;
  perform 1 from academic.student_unit_grades
    where student_offering_enrollment_id = r.student_offering_enrollment_id for update;
  if exists(select 1 from academic.student_unit_grades
    where student_offering_enrollment_id = r.student_offering_enrollment_id
      and updated_at > r.calculated_at) then raise exception 'SUBJECT_RESULT_INVALID_STATE'; end if;
  perform set_config('academic.grade_controlled_mutation', 'on', true);
  update academic.subject_final_results set status='CONFIRMED', confirmed_by_account_id=actor,
    confirmed_at=statement_timestamp(), updated_at=statement_timestamp() where id=r.id;
  perform set_config('academic.grade_controlled_mutation', 'off', true);
  insert into academic.subject_result_history(subject_final_result_id,previous_result,resulting_result,previous_status,resulting_status,actor_account_id)
    values(r.id,r.result_code,r.result_code,r.status,'CONFIRMED',actor);
  perform academic.append_grade_event(r.student_record_id,'SUBJECT_RESULT',r.id,'SUBJECT_RESULT_CONFIRMED',actor,'CALCULATED','CONFIRMED',operation_key,correlation);
  perform academic.complete_grade_command(actor,'CONFIRM_SUBJECT_RESULT',operation_key,'SUBJECT_RESULT',r.id);
  return query select r.id, 'CONFIRMED';
end $$;

create or replace function academic.calculate_semester_evaluation_summary(
  enrollment_id uuid, operation_key text, correlation uuid default null
) returns table(entity_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; pe academic.period_enrollments%rowtype; total integer; ac integer; na integer; pending integer; created uuid; resulting text;
begin
  actor:=academic.require_grade_permission('academic.semester_evaluations.calculate');
  prior:=academic.begin_grade_command(actor,'CALCULATE_SEMESTER',operation_key,jsonb_build_object('enrollment',enrollment_id));
  if prior is not null then select evaluation_status::text into resulting from academic.semester_evaluation_summaries where id=prior; return query select prior,resulting; return; end if;
  select * into pe from academic.period_enrollments where id=enrollment_id for update;
  if pe.id is null then raise exception 'STUDENT_NOT_ENROLLED'; end if;
  perform 1 from academic.subject_final_results r where r.period_enrollment_id=pe.id for update;
  select count(*) into total from academic.student_offering_enrollments soe_total where soe_total.period_enrollment_id=pe.id and soe_total.status in ('ACTIVE','COMPLETED');
  select count(*) filter(where r.result_code='AC'),count(*) filter(where r.result_code='NA') into ac,na
    from academic.student_offering_enrollments soe left join academic.subject_final_results r on r.student_offering_enrollment_id=soe.id and r.status in ('CALCULATED','CONFIRMED','CORRECTED')
    where soe.period_enrollment_id=pe.id and soe.status in ('ACTIVE','COMPLETED');
  pending:=total-ac-na; resulting:=case when pending>0 then 'INCOMPLETE' else 'MANUAL_REVIEW_REQUIRED' end;
  perform set_config('academic.grade_controlled_mutation','on',true);
  insert into academic.semester_evaluation_summaries(student_record_id,period_enrollment_id,academic_period_id,semester_number,total_subject_count,accredited_subject_count,non_accredited_subject_count,pending_subject_count,evaluation_status,proposed_progress_decision,proposal_reason_code,calculated_by_account_id)
  values(pe.student_record_id,pe.id,pe.academic_period_id,pe.semester_number,total,ac,na,pending,resulting::academic.semester_evaluation_status,'MANUAL_REVIEW_REQUIRED',case when pending>0 then 'SUBJECT_RESULTS_PENDING'::academic.grade_proposal_reason when na>0 then 'NON_ACCREDITED_SUBJECTS_REQUIRE_POLICY'::academic.grade_proposal_reason else 'INSTITUTIONAL_REVIEW'::academic.grade_proposal_reason end,actor)
  on conflict(period_enrollment_id) do update set total_subject_count=excluded.total_subject_count,accredited_subject_count=excluded.accredited_subject_count,non_accredited_subject_count=excluded.non_accredited_subject_count,pending_subject_count=excluded.pending_subject_count,evaluation_status=excluded.evaluation_status,proposed_progress_decision=excluded.proposed_progress_decision,proposal_reason_code=excluded.proposal_reason_code,calculated_by_account_id=actor,calculated_at=statement_timestamp(),updated_at=statement_timestamp() returning id into created;
  perform set_config('academic.grade_controlled_mutation','off',true);
  perform academic.append_grade_event(pe.student_record_id,'SEMESTER_SUMMARY',created,'SEMESTER_EVALUATION_CALCULATED',actor,null,resulting,operation_key,correlation);
  perform academic.complete_grade_command(actor,'CALCULATE_SEMESTER',operation_key,'SEMESTER_SUMMARY',created);
  return query select created,resulting;
end $$;

create or replace function academic.confirm_semester_progress_decision(
  summary_id uuid, operation_key text, correlation uuid default null
) returns table(entity_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; s academic.semester_evaluation_summaries%rowtype; pe academic.period_enrollments%rowtype; decision_id uuid;
begin
  actor:=academic.require_grade_permission('academic.progress_decisions.confirm');
  prior:=academic.begin_grade_command(actor,'CONFIRM_PROGRESS',operation_key,jsonb_build_object('summary',summary_id));
  if prior is not null then return query select prior,'CONFIRMED'; return; end if;
  select * into s from academic.semester_evaluation_summaries where id=summary_id for update;
  if s.evaluation_status='CONFIRMED' then raise exception 'PROGRESS_DECISION_CONFLICT'; end if;
  if s.id is null or s.evaluation_status not in ('COMPLETE','MANUAL_REVIEW_REQUIRED') then raise exception 'SEMESTER_EVALUATION_INCOMPLETE'; end if;
  if s.proposed_progress_decision='MANUAL_REVIEW_REQUIRED' then raise exception 'PROGRESS_DECISION_REQUIRES_REVIEW'; end if;
  perform pg_advisory_xact_lock(hashtextextended(s.student_record_id::text||s.academic_period_id::text,0));
  if exists(select 1 from academic.academic_progress_decisions where student_record_id=s.student_record_id and source_academic_period_id=s.academic_period_id and decision_status='CONFIRMED') then raise exception 'PROGRESS_DECISION_CONFLICT'; end if;
  select * into pe from academic.period_enrollments where id=s.period_enrollment_id for update;
  insert into academic.academic_progress_decisions(student_record_id,source_period_enrollment_id,source_academic_period_id,decision_type,resulting_semester_number,resulting_training_area_id,decision_status,reason_code,decided_by_account_id,approved_by_account_id,idempotency_key,request_fingerprint)
  values(s.student_record_id,s.period_enrollment_id,s.academic_period_id,s.proposed_progress_decision::text::academic.progress_decision_type,case when s.proposed_progress_decision='ADVANCE' then least(pe.semester_number+1,6) else pe.semester_number end,pe.training_area_id,'CONFIRMED','INSTITUTIONAL_VALIDATION_PENDING',actor,actor,operation_key,academic.grade_fingerprint(jsonb_build_object('summary',summary_id,'proposal',s.proposed_progress_decision))) returning id into decision_id;
  perform set_config('academic.grade_controlled_mutation','on',true);
  update academic.semester_evaluation_summaries set evaluation_status='CONFIRMED',confirmed_by_account_id=actor,confirmed_at=statement_timestamp(),progress_decision_id=decision_id,updated_at=statement_timestamp() where id=s.id;
  perform set_config('academic.grade_controlled_mutation','off',true);
  perform academic.append_grade_event(s.student_record_id,'PROGRESS_DECISION',decision_id,'PROGRESS_DECISION_CONFIRMED',actor,s.evaluation_status::text,'CONFIRMED',operation_key,correlation);
  perform academic.complete_grade_command(actor,'CONFIRM_PROGRESS',operation_key,'PROGRESS_DECISION',decision_id);
  return query select decision_id,'CONFIRMED';
end $$;

create or replace function academic.create_grade_correction(
  grade_id uuid, proposed numeric, reason academic.grade_correction_reason,
  operation_key text, correlation uuid default null
) returns table(entity_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; g academic.student_unit_grades%rowtype; created uuid;
begin
  actor:=academic.require_grade_permission('academic.grades.correct');
  prior:=academic.begin_grade_command(actor,'CREATE_CORRECTION',operation_key,jsonb_build_object('grade',grade_id,'proposed',proposed,'reason',reason));
  if prior is not null then return query select prior,'DRAFT'; return; end if;
  if proposed<0 or proposed>10 then raise exception 'INVALID_GRADE_VALUE'; end if;
  select * into g from academic.student_unit_grades where id=grade_id for update;
  if g.id is null or g.status not in ('FINALIZED','CORRECTED') then raise exception 'GRADE_CORRECTION_INVALID_STATE'; end if;
  insert into academic.grade_corrections(student_unit_grade_id,previous_raw_grade,proposed_raw_grade,reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
  values(g.id,g.raw_grade,proposed,reason,actor,operation_key,academic.grade_fingerprint(jsonb_build_object('grade',grade_id,'proposed',proposed,'reason',reason))) returning id into created;
  perform academic.append_grade_event(g.student_record_id,'GRADE_CORRECTION',created,'GRADE_CORRECTION_CREATED',actor,null,'DRAFT',operation_key,correlation);
  perform academic.complete_grade_command(actor,'CREATE_CORRECTION',operation_key,'GRADE_CORRECTION',created);
  return query select created,'DRAFT';
end $$;

create or replace function academic.change_grade_correction_status(
  correction_id uuid, target academic.grade_correction_status,
  operation_key text, correlation uuid
) returns table(entity_id uuid,status text)
language plpgsql security definer set search_path = '' as $$
declare actor uuid; prior uuid; kind academic.grade_command_type; c academic.grade_corrections%rowtype; g academic.student_unit_grades%rowtype; r academic.subject_final_results%rowtype; valid boolean;
begin
  actor:=academic.require_grade_permission('academic.grades.correct');
  kind:=case target when 'SUBMITTED' then 'SUBMIT_CORRECTION' when 'UNDER_REVIEW' then 'BEGIN_CORRECTION_REVIEW' when 'APPROVED' then 'APPROVE_CORRECTION' when 'REJECTED' then 'REJECT_CORRECTION' when 'APPLIED' then 'APPLY_CORRECTION' when 'CANCELLED' then 'CANCEL_CORRECTION' end;
  prior:=academic.begin_grade_command(actor,kind,operation_key,jsonb_build_object('correction',correction_id,'target',target));
  if prior is not null then return query select prior,target::text; return; end if;
  select * into c from academic.grade_corrections where id=correction_id for update;
  valid:=(c.status='DRAFT' and target in ('SUBMITTED','CANCELLED')) or (c.status='SUBMITTED' and target in ('UNDER_REVIEW','CANCELLED')) or (c.status='UNDER_REVIEW' and target in ('APPROVED','REJECTED')) or (c.status='APPROVED' and target='APPLIED');
  if c.id is null or not valid then raise exception 'GRADE_CORRECTION_INVALID_STATE'; end if;
  select * into g from academic.student_unit_grades where id=c.student_unit_grade_id for update;
  select * into r from academic.subject_final_results where student_offering_enrollment_id=g.student_offering_enrollment_id for update;
  if target='APPLIED' and r.status='CONFIRMED' then raise exception 'HISTORICAL_GRADE_IMMUTABLE'; end if;
  perform set_config('academic.grade_controlled_mutation','on',true);
  update academic.grade_corrections set status=target,reviewed_by_account_id=case when target='UNDER_REVIEW' then actor else reviewed_by_account_id end,approved_by_account_id=case when target='APPROVED' then actor else approved_by_account_id end,applied_by_account_id=case when target='APPLIED' then actor else applied_by_account_id end,reviewed_at=case when target='UNDER_REVIEW' then statement_timestamp() else reviewed_at end,approved_at=case when target='APPROVED' then statement_timestamp() else approved_at end,applied_at=case when target='APPLIED' then statement_timestamp() else applied_at end,rejected_at=case when target='REJECTED' then statement_timestamp() else rejected_at end,cancelled_at=case when target='CANCELLED' then statement_timestamp() else cancelled_at end,updated_at=statement_timestamp() where id=c.id;
  if target='APPLIED' then
    update academic.student_unit_grades set raw_grade=c.proposed_raw_grade,normalized_grade=academic.apply_institutional_grade_rounding(c.proposed_raw_grade),is_accredited=c.proposed_raw_grade>=6,status='CORRECTED',updated_at=statement_timestamp() where id=g.id;
    insert into academic.student_unit_grade_history(student_unit_grade_id,previous_raw_grade,resulting_raw_grade,previous_status,resulting_status,actor_account_id,reason_code,correction_id) values(g.id,g.raw_grade,c.proposed_raw_grade,g.status,'CORRECTED',actor,c.reason_code::text,c.id);
    if r.id is not null then update academic.subject_final_results set status='CORRECTED',updated_at=statement_timestamp() where id=r.id; end if;
  end if;
  perform set_config('academic.grade_controlled_mutation','off',true);
  if target in ('APPROVED','APPLIED') then perform academic.append_grade_event(g.student_record_id,'GRADE_CORRECTION',c.id,case when target='APPROVED' then 'GRADE_CORRECTION_APPROVED'::academic.grade_event_type else 'GRADE_CORRECTION_APPLIED'::academic.grade_event_type end,actor,c.status::text,target::text,operation_key,correlation); end if;
  perform academic.complete_grade_command(actor,kind,operation_key,'GRADE_CORRECTION',c.id);
  return query select c.id,target::text;
end $$;

revoke all on function academic.fail_grade_command(uuid,academic.grade_command_type,text) from public, anon, authenticated;
revoke all on function academic.guard_grade_command_immutable() from public, anon, authenticated;

commit;
