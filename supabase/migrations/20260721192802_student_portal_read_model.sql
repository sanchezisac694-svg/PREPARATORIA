begin;

create or replace function academic.require_student_portal_context(requested_period_id uuid default null)
returns table(
  account_id uuid,
  person_id uuid,
  student_record_id uuid,
  student_status academic.student_record_status,
  selected_period_enrollment_id uuid,
  selected_academic_period_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_account core.accounts%rowtype;
  current_record academic.student_records%rowtype;
  current_enrollment academic.period_enrollments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1
    from core.get_current_identity_context() identity_context
    where identity_context.session_valid
      and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
  ) then
    raise exception 'APPLICATION_NOT_ALLOWED';
  end if;

  if not core.is_current_session_version_valid() then
    raise exception 'SESSION_VERSION_INVALID';
  end if;

  select *
  into current_account
  from core.accounts
  where auth_user_id = auth.uid();

  if current_account.id is null or current_account.account_status <> 'ACTIVE' then
    raise exception 'ACTOR_NOT_AUTHORIZED';
  end if;

  if not exists (
    select 1
    from core.account_roles assignments
    join core.roles roles on roles.id = assignments.role_id
    where assignments.account_id = current_account.id
      and assignments.revoked_at is null
      and roles.is_active
      and roles.code = 'ALUMNO'
  ) then
    raise exception 'STUDENT_ROLE_REQUIRED';
  end if;

  select *
  into current_record
  from academic.student_records
  where student_records.account_id = current_account.id
  order by created_at desc
  limit 1;

  if current_record.id is null then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;

  if requested_period_id is null then
    select period_enrollments.*
    into current_enrollment
    from academic.period_enrollments
    join academic.academic_periods on academic_periods.id = period_enrollments.academic_period_id
    where period_enrollments.student_record_id = current_record.id
      and period_enrollments.status <> 'CANCELLED'
    order by academic_periods.starts_on desc, period_enrollments.enrolled_at desc
    limit 1;
  else
    select *
    into current_enrollment
    from academic.period_enrollments
    where period_enrollments.student_record_id = current_record.id
      and period_enrollments.academic_period_id = requested_period_id
      and period_enrollments.status <> 'CANCELLED'
    limit 1;

    if current_enrollment.id is null then
      raise exception 'PERIOD_NOT_AVAILABLE';
    end if;
  end if;

  return query
  select
    current_account.id,
    current_account.person_id,
    current_record.id,
    current_record.status,
    current_enrollment.id,
    current_enrollment.academic_period_id;
end;
$$;

create or replace function academic.get_student_portal_record()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(null)
)
select jsonb_build_object(
  'studentStatus', context.student_status,
  'institutionalStudentCode', records.institutional_student_code,
  'currentSemesterNumber', records.current_semester_number,
  'studyPlan', jsonb_build_object(
    'code', plans.code,
    'name', plans.name,
    'version', plans.version,
    'status', plans.status
  ),
  'generation', jsonb_build_object(
    'code', generations.code,
    'name', generations.name,
    'status', generations.status
  ),
  'trainingArea', case
    when areas.id is null then null
    else jsonb_build_object('code', areas.code, 'name', areas.name)
  end,
  'firstEnrollmentPeriod', case
    when first_period.id is null then null
    else jsonb_build_object('id', first_period.id, 'code', first_period.code, 'name', first_period.name)
  end,
  'lastEnrollmentPeriod', case
    when last_period.id is null then null
    else jsonb_build_object('id', last_period.id, 'code', last_period.code, 'name', last_period.name)
  end
)
from context
join academic.student_records records on records.id = context.student_record_id
join academic.study_plans plans on plans.id = records.study_plan_id
join academic.student_generations generations on generations.id = records.generation_id
left join academic.training_areas areas on areas.id = records.current_training_area_id
left join academic.academic_periods first_period on first_period.id = records.first_enrollment_period_id
left join academic.academic_periods last_period on last_period.id = records.last_enrollment_period_id;
$$;

create or replace function academic.get_student_portal_overview(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
),
period_data as (
  select
    enrollments.id as period_enrollment_id,
    enrollments.status as enrollment_status,
    enrollments.semester_number,
    periods.id as academic_period_id,
    periods.code as academic_period_code,
    periods.name as academic_period_name,
    periods.starts_on,
    periods.ends_on,
    groups.code as group_code,
    groups.display_name as group_name
  from context
  left join academic.period_enrollments enrollments on enrollments.id = context.selected_period_enrollment_id
  left join academic.academic_periods periods on periods.id = enrollments.academic_period_id
  left join academic.groups groups on groups.id = enrollments.group_id
),
subject_counts as (
  select count(*)::integer as total_subjects
  from context
  join academic.student_offering_enrollments enrollments
    on enrollments.period_enrollment_id = context.selected_period_enrollment_id
   and enrollments.status in ('ACTIVE', 'COMPLETED')
),
summary_data as (
  select
    summaries.evaluation_status,
    summaries.proposed_progress_decision,
    summaries.proposal_reason_code,
    summaries.total_subject_count,
    summaries.accredited_subject_count,
    summaries.non_accredited_subject_count,
    summaries.pending_subject_count
  from context
  left join academic.semester_evaluation_summaries summaries
    on summaries.period_enrollment_id = context.selected_period_enrollment_id
   and summaries.evaluation_status = 'CONFIRMED'
),
attendance_data as (
  select
    count(*)::integer as total_sessions,
    count(*) filter (where records.attendance_status = 'PRESENT')::integer as present_count,
    count(*) filter (where records.attendance_status = 'ABSENT')::integer as absent_count,
    count(*) filter (where records.attendance_status = 'LATE')::integer as late_count,
    count(*) filter (where records.attendance_status = 'EXCUSED')::integer as excused_count
  from context
  join academic.attendance_records records on records.student_record_id = context.student_record_id
  join academic.attendance_sessions sessions on sessions.id = records.attendance_session_id
  where context.selected_academic_period_id is not null
    and sessions.academic_period_id = context.selected_academic_period_id
    and sessions.status in ('CLOSED', 'LOCKED')
),
permission_data as (
  select count(*)::integer as active_permissions
  from context
  join academic.student_permissions permissions on permissions.student_record_id = context.student_record_id
  where context.selected_academic_period_id is not null
    and permissions.academic_period_id = context.selected_academic_period_id
    and permissions.status in ('APPROVED', 'APPLIED')
)
select jsonb_build_object(
  'record', academic.get_student_portal_record(),
  'selectedPeriod', case
    when period_data.academic_period_id is null then null
    else jsonb_build_object(
      'id', period_data.academic_period_id,
      'code', period_data.academic_period_code,
      'name', period_data.academic_period_name,
      'startsOn', period_data.starts_on,
      'endsOn', period_data.ends_on,
      'semesterNumber', period_data.semester_number,
      'enrollmentStatus', period_data.enrollment_status,
      'group', case
        when period_data.group_code is null then null
        else jsonb_build_object('code', period_data.group_code, 'name', period_data.group_name)
      end
    )
  end,
  'metrics', jsonb_build_object(
    'totalSubjects', coalesce(subject_counts.total_subjects, 0),
    'attendanceSessions', coalesce(attendance_data.total_sessions, 0),
    'approvedOrAppliedPermissions', coalesce(permission_data.active_permissions, 0)
  ),
  'attendance', jsonb_build_object(
    'presentCount', coalesce(attendance_data.present_count, 0),
    'absentCount', coalesce(attendance_data.absent_count, 0),
    'lateCount', coalesce(attendance_data.late_count, 0),
    'excusedCount', coalesce(attendance_data.excused_count, 0)
  ),
  'summary', case
    when summary_data.evaluation_status is null then null
    else jsonb_build_object(
      'evaluationStatus', summary_data.evaluation_status,
      'proposedProgressDecision', summary_data.proposed_progress_decision,
      'proposalReasonCode', summary_data.proposal_reason_code,
      'totalSubjectCount', summary_data.total_subject_count,
      'accreditedSubjectCount', summary_data.accredited_subject_count,
      'nonAccreditedSubjectCount', summary_data.non_accredited_subject_count,
      'pendingSubjectCount', summary_data.pending_subject_count
    )
  end
)
from period_data
left join subject_counts on true
left join summary_data on true
left join attendance_data on true
left join permission_data on true;
$$;

create or replace function academic.get_student_portal_subjects(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'offeringEnrollmentId', enrollments.id,
      'subjectCode', subjects.code,
      'subjectName', subjects.name,
      'groupCode', groups.code,
      'groupName', groups.display_name,
      'teacherName', 'Docente pendiente de asignación',
      'teacherAssignmentStatus', assignments.status,
      'result', case
        when results.id is null then null
        else jsonb_build_object(
          'resultCode', results.result_code,
          'roundedFinalGrade', results.rounded_final_grade,
          'status', results.status
        )
      end
    )
    order by subjects.name
  ),
  '[]'::jsonb
)
from context
join academic.student_offering_enrollments enrollments
  on enrollments.period_enrollment_id = context.selected_period_enrollment_id
 and enrollments.status in ('ACTIVE', 'COMPLETED')
join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
join academic.groups groups on groups.id = offerings.group_id
join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
join academic.subjects subjects on subjects.id = curriculum.subject_id
left join academic.teaching_assignments assignments
  on assignments.academic_offering_id = offerings.id
 and assignments.assignment_type = 'PRIMARY'
 and assignments.status = 'ACTIVE'
left join academic.subject_final_results results
  on results.student_offering_enrollment_id = enrollments.id
 and results.status = 'CONFIRMED';
$$;

create or replace function academic.get_student_portal_schedule(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'weekday', sessions.weekday,
      'timeBlock', blocks.display_name,
      'startsAt', blocks.starts_at,
      'endsAt', blocks.ends_at,
      'subjectCode', subjects.code,
      'subjectName', subjects.name,
      'groupCode', groups.code,
      'groupName', groups.display_name,
      'teacherName', 'Docente pendiente de asignación',
      'spaceName', spaces.name,
      'spaceCode', spaces.code,
      'sessionType', sessions.session_type
    )
    order by sessions.weekday, blocks.sequence_number, subjects.name
  ),
  '[]'::jsonb
)
from context
join academic.student_offering_enrollments enrollments
  on enrollments.period_enrollment_id = context.selected_period_enrollment_id
 and enrollments.status in ('ACTIVE', 'COMPLETED')
join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
join academic.class_sessions sessions on sessions.academic_offering_id = offerings.id and sessions.status = 'ACTIVE'
join academic.group_schedules schedules
  on schedules.id = sessions.group_schedule_id
 and schedules.status = 'PUBLISHED'
join academic.schedule_time_blocks blocks on blocks.id = sessions.time_block_id
join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
join academic.subjects subjects on subjects.id = curriculum.subject_id
join academic.groups groups on groups.id = offerings.group_id
join academic.academic_spaces spaces on spaces.id = sessions.academic_space_id;
$$;

create or replace function academic.get_student_portal_attendance(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
),
records as (
  select
    sessions.session_date,
    sessions.status as session_status,
    attendance.attendance_status,
    attendance.lateness_minutes,
    subjects.code as subject_code,
    subjects.name as subject_name,
    blocks.display_name as time_block_name,
    blocks.starts_at,
    blocks.ends_at
  from context
  join academic.attendance_records attendance on attendance.student_record_id = context.student_record_id
  join academic.attendance_sessions sessions on sessions.id = attendance.attendance_session_id
  join academic.student_offering_enrollments enrollments on enrollments.id = attendance.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  join academic.class_sessions class_sessions on class_sessions.id = sessions.class_session_id
  join academic.schedule_time_blocks blocks on blocks.id = class_sessions.time_block_id
  where context.selected_academic_period_id is not null
    and sessions.academic_period_id = context.selected_academic_period_id
    and sessions.status in ('CLOSED', 'LOCKED')
),
lateness as (
  select
    coalesce(counters.current_count, 0) as current_count,
    coalesce(counters.lifetime_count, 0) as lifetime_count,
    coalesce(counters.alert_sequence, 0) as alert_sequence,
    coalesce(
      (
        select count(*)::integer
        from academic.lateness_alerts alerts
        where alerts.student_record_id = context.student_record_id
          and alerts.academic_period_id = context.selected_academic_period_id
          and alerts.status in ('PENDING_NOTIFICATION', 'NOTIFICATION_RECORDED', 'ACKNOWLEDGED')
      ),
      0
    ) as visible_alert_count
  from context
  left join academic.student_lateness_counters counters
    on counters.student_record_id = context.student_record_id
   and counters.academic_period_id = context.selected_academic_period_id
   and counters.counter_type = 'FIRST_PERIOD_VALIDATED'
)
select jsonb_build_object(
  'records', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'sessionDate', records.session_date,
          'sessionStatus', records.session_status,
          'attendanceStatus', records.attendance_status,
          'latenessMinutes', records.lateness_minutes,
          'subjectCode', records.subject_code,
          'subjectName', records.subject_name,
          'timeBlockName', records.time_block_name,
          'startsAt', records.starts_at,
          'endsAt', records.ends_at
        )
        order by records.session_date desc, records.starts_at asc, records.subject_name
      )
      from records
    ),
    '[]'::jsonb
  ),
  'lateness', jsonb_build_object(
    'currentCount', lateness.current_count,
    'lifetimeCount', lateness.lifetime_count,
    'alertSequence', lateness.alert_sequence,
    'visibleAlertCount', lateness.visible_alert_count
  )
)
from lateness;
$$;

create or replace function academic.get_student_portal_permissions(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'permissionType', permissions.permission_type,
      'status', permissions.status,
      'reasonCode', permissions.reason_code,
      'appliesToDate', permissions.applies_to_date,
      'startsAt', permissions.starts_at,
      'endsAt', permissions.ends_at,
      'visibleValidationStatus', (
        select validations.validation_status
        from academic.permission_validations validations
        where validations.permission_id = permissions.id
          and validations.validation_status in ('APPROVED', 'REJECTED', 'REVOKED')
        order by validations.validated_at desc
        limit 1
      )
    )
    order by permissions.applies_to_date desc, permissions.created_at desc
  ),
  '[]'::jsonb
)
from context
join academic.student_permissions permissions on permissions.student_record_id = context.student_record_id
where context.selected_academic_period_id is not null
  and permissions.academic_period_id = context.selected_academic_period_id
  and permissions.status in ('APPROVED', 'APPLIED');
$$;

create or replace function academic.get_student_portal_grades(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(requested_period_id)
),
unit_rows as (
  select
    subjects.code as subject_code,
    subjects.name as subject_name,
    grades.unit_number,
    grades.normalized_grade,
    grades.is_accredited,
    grades.status
  from context
  join academic.student_unit_grades grades on grades.student_record_id = context.student_record_id
  join academic.student_offering_enrollments enrollments on enrollments.id = grades.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  where context.selected_period_enrollment_id is not null
    and grades.period_enrollment_id = context.selected_period_enrollment_id
    and grades.status in ('FINALIZED', 'CORRECTED')
),
result_rows as (
  select
    subjects.code as subject_code,
    subjects.name as subject_name,
    results.result_code,
    results.rounded_final_grade,
    results.calculation_status,
    results.status
  from context
  join academic.subject_final_results results on results.student_record_id = context.student_record_id
  join academic.student_offering_enrollments enrollments on enrollments.id = results.student_offering_enrollment_id
  join academic.academic_offerings offerings on offerings.id = enrollments.academic_offering_id
  join academic.curriculum_subjects curriculum on curriculum.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum.subject_id
  where context.selected_period_enrollment_id is not null
    and results.period_enrollment_id = context.selected_period_enrollment_id
    and results.status = 'CONFIRMED'
),
summary_row as (
  select
    summaries.total_subject_count,
    summaries.accredited_subject_count,
    summaries.non_accredited_subject_count,
    summaries.pending_subject_count,
    summaries.evaluation_status,
    summaries.proposed_progress_decision,
    summaries.proposal_reason_code
  from context
  left join academic.semester_evaluation_summaries summaries
    on summaries.period_enrollment_id = context.selected_period_enrollment_id
   and summaries.evaluation_status = 'CONFIRMED'
)
select jsonb_build_object(
  'unitGrades', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'subjectCode', unit_rows.subject_code,
          'subjectName', unit_rows.subject_name,
          'unitNumber', unit_rows.unit_number,
          'normalizedGrade', unit_rows.normalized_grade,
          'isAccredited', unit_rows.is_accredited,
          'status', unit_rows.status
        )
        order by unit_rows.subject_name, unit_rows.unit_number
      )
      from unit_rows
    ),
    '[]'::jsonb
  ),
  'subjectResults', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'subjectCode', result_rows.subject_code,
          'subjectName', result_rows.subject_name,
          'resultCode', result_rows.result_code,
          'roundedFinalGrade', result_rows.rounded_final_grade,
          'calculationStatus', result_rows.calculation_status,
          'status', result_rows.status
        )
        order by result_rows.subject_name
      )
      from result_rows
    ),
    '[]'::jsonb
  ),
  'summary', (
    select case
      when summary_row.evaluation_status is null then null
      else jsonb_build_object(
        'evaluationStatus', summary_row.evaluation_status,
        'proposedProgressDecision', summary_row.proposed_progress_decision,
        'proposalReasonCode', summary_row.proposal_reason_code,
        'totalSubjectCount', summary_row.total_subject_count,
        'accreditedSubjectCount', summary_row.accredited_subject_count,
        'nonAccreditedSubjectCount', summary_row.non_accredited_subject_count,
        'pendingSubjectCount', summary_row.pending_subject_count
      )
    end
    from summary_row
  )
);
$$;

create or replace function academic.get_student_portal_trajectory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with context as (
  select * from academic.require_student_portal_context(null)
)
select jsonb_build_object(
  'periods', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'academicPeriodId', periods.id,
          'academicPeriodCode', periods.code,
          'academicPeriodName', periods.name,
          'semesterNumber', enrollments.semester_number,
          'enrollmentStatus', enrollments.status,
          'groupCode', groups.code,
          'groupName', groups.display_name,
          'startedOn', periods.starts_on,
          'endedOn', periods.ends_on
        )
        order by periods.starts_on desc
      )
      from academic.period_enrollments enrollments
      join academic.academic_periods periods on periods.id = enrollments.academic_period_id
      left join academic.groups groups on groups.id = enrollments.group_id
      where enrollments.student_record_id = (select student_record_id from context)
        and enrollments.status <> 'CANCELLED'
    ),
    '[]'::jsonb
  ),
  'progressDecisions', coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'sourceAcademicPeriodId', periods.id,
          'sourceAcademicPeriodCode', periods.code,
          'sourceAcademicPeriodName', periods.name,
          'decisionType', decisions.decision_type,
          'decisionStatus', decisions.decision_status,
          'resultingSemesterNumber', decisions.resulting_semester_number,
          'reasonCode', decisions.reason_code
        )
        order by periods.starts_on desc, decisions.created_at desc
      )
      from academic.academic_progress_decisions decisions
      join academic.academic_periods periods on periods.id = decisions.source_academic_period_id
      where decisions.student_record_id = (select student_record_id from context)
        and decisions.decision_status = 'CONFIRMED'
    ),
    '[]'::jsonb
  )
);
$$;

create or replace function public.get_my_student_portal_record()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_record();
$$;

create or replace function public.get_my_student_portal_overview(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_overview(requested_period_id);
$$;

create or replace function public.get_my_student_portal_subjects(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_subjects(requested_period_id);
$$;

create or replace function public.get_my_student_portal_schedule(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_schedule(requested_period_id);
$$;

create or replace function public.get_my_student_portal_attendance(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_attendance(requested_period_id);
$$;

create or replace function public.get_my_student_portal_permissions(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_permissions(requested_period_id);
$$;

create or replace function public.get_my_student_portal_grades(requested_period_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_grades(requested_period_id);
$$;

create or replace function public.get_my_student_portal_trajectory()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select academic.get_student_portal_trajectory();
$$;

alter function academic.require_student_portal_context(uuid) owner to postgres;
alter function academic.get_student_portal_record() owner to postgres;
alter function academic.get_student_portal_overview(uuid) owner to postgres;
alter function academic.get_student_portal_subjects(uuid) owner to postgres;
alter function academic.get_student_portal_schedule(uuid) owner to postgres;
alter function academic.get_student_portal_attendance(uuid) owner to postgres;
alter function academic.get_student_portal_permissions(uuid) owner to postgres;
alter function academic.get_student_portal_grades(uuid) owner to postgres;
alter function academic.get_student_portal_trajectory() owner to postgres;
alter function public.get_my_student_portal_record() owner to postgres;
alter function public.get_my_student_portal_overview(uuid) owner to postgres;
alter function public.get_my_student_portal_subjects(uuid) owner to postgres;
alter function public.get_my_student_portal_schedule(uuid) owner to postgres;
alter function public.get_my_student_portal_attendance(uuid) owner to postgres;
alter function public.get_my_student_portal_permissions(uuid) owner to postgres;
alter function public.get_my_student_portal_grades(uuid) owner to postgres;
alter function public.get_my_student_portal_trajectory() owner to postgres;

revoke execute on function academic.require_student_portal_context(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_record() from public, anon, authenticated;
revoke execute on function academic.get_student_portal_overview(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_subjects(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_schedule(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_attendance(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_permissions(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_grades(uuid) from public, anon, authenticated;
revoke execute on function academic.get_student_portal_trajectory() from public, anon, authenticated;

revoke execute on function public.get_my_student_portal_record() from public, anon;
revoke execute on function public.get_my_student_portal_overview(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_subjects(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_schedule(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_attendance(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_permissions(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_grades(uuid) from public, anon;
revoke execute on function public.get_my_student_portal_trajectory() from public, anon;

grant execute on function public.get_my_student_portal_record() to authenticated;
grant execute on function public.get_my_student_portal_overview(uuid) to authenticated;
grant execute on function public.get_my_student_portal_subjects(uuid) to authenticated;
grant execute on function public.get_my_student_portal_schedule(uuid) to authenticated;
grant execute on function public.get_my_student_portal_attendance(uuid) to authenticated;
grant execute on function public.get_my_student_portal_permissions(uuid) to authenticated;
grant execute on function public.get_my_student_portal_grades(uuid) to authenticated;
grant execute on function public.get_my_student_portal_trajectory() to authenticated;

commit;
