begin;

create function academic.require_control_school_application_context()
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  current_identity record;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  select *
    into current_identity
    from core.get_current_identity_context()
   where session_valid
     and mfa_satisfied
     and 'SISTEMA_ADMINISTRATIVO' = any(allowed_applications);

  if current_identity.account_id is null then
    raise exception using errcode='42501', message='APPLICATION_NOT_ALLOWED';
  end if;

  return current_identity.account_id;
end;
$$;

create function academic.require_control_school_catalog_permission(permission_code text)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor core.accounts%rowtype;
  role_codes text[];
begin
  if permission_code not in (
    'academic.cycles.read',
    'academic.periods.read',
    'academic.plans.read',
    'academic.subjects.read',
    'academic.groups.read'
  ) then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  if auth.uid() is null then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  select *
    into actor
    from core.accounts
   where auth_user_id = auth.uid();

  if actor.id is null or actor.account_status <> 'ACTIVE' then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  if not core.is_current_session_version_valid() then
    raise exception using errcode='42501', message='SESSION_VERSION_INVALID';
  end if;

  if not core.is_current_aal2() or not core.is_current_mfa_policy_satisfied() then
    raise exception using errcode='42501', message='AAL2_REQUIRED';
  end if;

  select coalesce(array_agg(roles.code), array[]::text[])
    into role_codes
    from core.account_roles account_roles
    join core.roles roles
      on roles.id = account_roles.role_id
     and roles.is_active
   where account_roles.account_id = actor.id
     and account_roles.revoked_at is null;

  if not (role_codes && array['SUPERADMIN', 'ADMINISTRATIVO', 'CONTROL_ESCOLAR']) then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  if role_codes && array['CONTROL_ESCOLAR'] and not (role_codes && array['SUPERADMIN', 'ADMINISTRATIVO']) then
    if permission_code not in (
      'academic.cycles.read',
      'academic.periods.read',
      'academic.plans.read',
      'academic.subjects.read',
      'academic.groups.read'
    ) then
      raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
    end if;
  end if;

  return actor.id;
end;
$$;

create function academic.clamp_control_school_limit(requested_limit integer)
returns integer
language sql
immutable
set search_path=''
as $$
  select least(greatest(coalesce(requested_limit, 25), 1), 100);
$$;

create function academic.list_control_school_students(
  requested_search_text text default null,
  requested_student_status academic.student_record_status default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_academic_period_id uuid default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  page_limit integer := academic.clamp_control_school_limit(requested_limit);
  page_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  perform academic.require_control_school_application_context();
  perform academic.require_student_enrollment_permission('academic.students.read');

  return (
    with filtered as (
      select
        records.id as student_record_id,
        records.institutional_student_code,
        records.status as student_status,
        coalesce(current_enrollment.semester_number, records.current_semester_number) as semester_number,
        current_group.id as group_id,
        current_group.code as group_code,
        current_group.display_name as group_name,
        current_area.id as training_area_id,
        current_area.code as training_area_code,
        current_area.name as training_area_name,
        current_period.id as academic_period_id,
        current_period.code as academic_period_code,
        current_period.name as academic_period_name,
        current_enrollment.status as enrollment_status
      from academic.student_records records
      left join lateral (
        select enrollments.*
          from academic.period_enrollments enrollments
          join academic.academic_periods periods
            on periods.id = enrollments.academic_period_id
         where enrollments.student_record_id = records.id
         order by
           case enrollments.status
             when 'ACTIVE' then 0
             when 'COMPLETED' then 1
             when 'CANCELLED' then 2
             else 3
           end,
           periods.starts_on desc,
           enrollments.created_at desc
         limit 1
      ) current_enrollment on true
      left join academic.groups current_group
        on current_group.id = current_enrollment.group_id
      left join academic.training_areas current_area
        on current_area.id = coalesce(
          current_enrollment.training_area_id,
          records.current_training_area_id
        )
      left join academic.academic_periods current_period
        on current_period.id = current_enrollment.academic_period_id
      where (
          requested_search_text is null
          or requested_search_text = ''
          or records.institutional_student_code ilike '%' || btrim(requested_search_text) || '%'
        )
        and (
          requested_student_status is null
          or records.status = requested_student_status
        )
        and (
          requested_semester_number is null
          or coalesce(current_enrollment.semester_number, records.current_semester_number) = requested_semester_number
        )
        and (
          requested_group_id is null
          or current_enrollment.group_id = requested_group_id
        )
        and (
          requested_academic_period_id is null
          or current_enrollment.academic_period_id = requested_academic_period_id
        )
    ),
    counted as (
      select count(*)::integer as total_rows from filtered
    ),
    paged as (
      select *
        from filtered
       order by institutional_student_code, student_record_id
       limit page_limit
      offset page_offset
    )
    select jsonb_build_object(
      'offset', page_offset,
      'pageSize', page_limit,
      'totalRows', (select total_rows from counted),
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'studentRecordId', paged.student_record_id,
            'studentIdentifier', paged.institutional_student_code,
            'studentDisplayName', null,
            'studentStatus', paged.student_status,
            'semesterNumber', paged.semester_number,
            'group', case
              when paged.group_id is null then null
              else jsonb_build_object(
                'groupId', paged.group_id,
                'code', paged.group_code,
                'name', paged.group_name
              )
            end,
            'trainingArea', case
              when paged.training_area_id is null then null
              else jsonb_build_object(
                'trainingAreaId', paged.training_area_id,
                'code', paged.training_area_code,
                'name', paged.training_area_name
              )
            end,
            'academicPeriod', case
              when paged.academic_period_id is null then null
              else jsonb_build_object(
                'academicPeriodId', paged.academic_period_id,
                'code', paged.academic_period_code,
                'name', paged.academic_period_name
              )
            end,
            'enrollmentStatus', paged.enrollment_status
          )
          order by paged.institutional_student_code, paged.student_record_id
        ),
        '[]'::jsonb
      )
    )
    from paged
  );
end;
$$;

create function academic.get_control_school_student_detail(target_student_record_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  result jsonb;
begin
  perform academic.require_control_school_application_context();
  perform academic.require_student_enrollment_permission('academic.students.read');
  perform academic.require_student_enrollment_permission('academic.enrollments.read');

  if target_student_record_id is null then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;

  with target_record as (
    select
      records.id as student_record_id,
      records.institutional_student_code,
      records.status as student_status,
      records.current_semester_number,
      records.activated_at,
      records.graduated_at,
      records.withdrawn_at,
      plans.id as study_plan_id,
      plans.code as study_plan_code,
      plans.name as study_plan_name,
      plans.version as study_plan_version,
      generations.id as generation_id,
      generations.code as generation_code,
      generations.name as generation_name,
      current_enrollment.id as period_enrollment_id,
      current_enrollment.status as enrollment_status,
      current_enrollment.enrollment_number,
      current_enrollment.enrolled_at,
      current_enrollment.completed_at,
      current_enrollment.cancelled_at,
      current_group.id as group_id,
      current_group.code as group_code,
      current_group.display_name as group_name,
      current_period.id as academic_period_id,
      current_period.code as academic_period_code,
      current_period.name as academic_period_name,
      current_area.id as training_area_id,
      current_area.code as training_area_code,
      current_area.name as training_area_name
    from academic.student_records records
    join academic.study_plans plans
      on plans.id = records.study_plan_id
    join academic.student_generations generations
      on generations.id = records.generation_id
    left join lateral (
      select enrollments.*
        from academic.period_enrollments enrollments
        join academic.academic_periods periods
          on periods.id = enrollments.academic_period_id
       where enrollments.student_record_id = records.id
       order by
         case enrollments.status
           when 'ACTIVE' then 0
           when 'COMPLETED' then 1
           when 'CANCELLED' then 2
           else 3
         end,
         periods.starts_on desc,
         enrollments.created_at desc
       limit 1
    ) current_enrollment on true
    left join academic.groups current_group
      on current_group.id = current_enrollment.group_id
    left join academic.academic_periods current_period
      on current_period.id = current_enrollment.academic_period_id
    left join academic.training_areas current_area
      on current_area.id = coalesce(
        current_enrollment.training_area_id,
        records.current_training_area_id
      )
    where records.id = target_student_record_id
  )
  select jsonb_build_object(
    'studentRecordId', target_record.student_record_id,
    'studentIdentifier', target_record.institutional_student_code,
    'studentDisplayName', null,
    'studentStatus', target_record.student_status,
    'identity', jsonb_build_object(
      'studentRecordId', target_record.student_record_id,
      'studentIdentifier', target_record.institutional_student_code,
      'studentDisplayName', null,
      'studentStatus', target_record.student_status
    ),
    'currentSituation', jsonb_build_object(
      'semesterNumber', target_record.current_semester_number,
      'academicPeriod', case
        when target_record.academic_period_id is null then null
        else jsonb_build_object(
          'academicPeriodId', target_record.academic_period_id,
          'code', target_record.academic_period_code,
          'name', target_record.academic_period_name
        )
      end,
      'group', case
        when target_record.group_id is null then null
        else jsonb_build_object(
          'groupId', target_record.group_id,
          'code', target_record.group_code,
          'name', target_record.group_name
        )
      end,
      'trainingArea', case
        when target_record.training_area_id is null then null
        else jsonb_build_object(
          'trainingAreaId', target_record.training_area_id,
          'code', target_record.training_area_code,
          'name', target_record.training_area_name
        )
      end,
      'studyPlan', jsonb_build_object(
        'studyPlanId', target_record.study_plan_id,
        'code', target_record.study_plan_code,
        'name', target_record.study_plan_name,
        'version', target_record.study_plan_version
      ),
      'generation', jsonb_build_object(
        'generationId', target_record.generation_id,
        'code', target_record.generation_code,
        'name', target_record.generation_name
      )
    ),
    'currentEnrollment', case
      when target_record.period_enrollment_id is null then null
      else jsonb_build_object(
        'periodEnrollmentId', target_record.period_enrollment_id,
        'status', target_record.enrollment_status,
        'enrollmentNumber', target_record.enrollment_number,
        'enrolledAt', target_record.enrolled_at,
        'completedAt', target_record.completed_at,
        'cancelledAt', target_record.cancelled_at
      )
    end,
    'timeline', jsonb_build_object(
      'activatedAt', target_record.activated_at,
      'graduatedAt', target_record.graduated_at,
      'withdrawnAt', target_record.withdrawn_at
    )
  )
    into result
    from target_record;

  if result is null then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;

  return result;
end;
$$;

create function academic.list_control_school_groups(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_training_area_id uuid default null,
  requested_group_status academic.group_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  page_limit integer := academic.clamp_control_school_limit(requested_limit);
  page_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  perform academic.require_control_school_application_context();
  perform academic.require_academic_permission('academic.groups.read');

  return (
    with filtered as (
      select
        groups.id as group_id,
        groups.code as group_code,
        groups.display_name as group_name,
        groups.semester_number,
        groups.status as group_status,
        periods.id as academic_period_id,
        periods.code as academic_period_code,
        periods.name as academic_period_name,
        areas.id as training_area_id,
        areas.code as training_area_code,
        areas.name as training_area_name,
        coalesce(member_counts.student_count, 0) as student_count
      from academic.groups
      join academic.academic_periods periods
        on periods.id = groups.academic_period_id
      left join academic.training_areas areas
        on areas.id = groups.training_area_id
      left join lateral (
        select count(*)::integer as student_count
          from academic.period_enrollments enrollments
         where enrollments.group_id = groups.id
           and enrollments.status in ('ACTIVE', 'COMPLETED')
      ) member_counts on true
      where (
          requested_academic_period_id is null
          or groups.academic_period_id = requested_academic_period_id
        )
        and (
          requested_semester_number is null
          or groups.semester_number = requested_semester_number
        )
        and (
          requested_training_area_id is null
          or groups.training_area_id = requested_training_area_id
        )
        and (
          requested_group_status is null
          or groups.status = requested_group_status
        )
    ),
    counted as (
      select count(*)::integer as total_rows from filtered
    ),
    paged as (
      select *
        from filtered
       order by academic_period_name desc, semester_number asc, group_name asc
       limit page_limit
      offset page_offset
    )
    select jsonb_build_object(
      'offset', page_offset,
      'pageSize', page_limit,
      'totalRows', (select total_rows from counted),
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'groupId', paged.group_id,
            'code', paged.group_code,
            'name', paged.group_name,
            'semesterNumber', paged.semester_number,
            'status', paged.group_status,
            'studentCount', paged.student_count,
            'academicPeriod', jsonb_build_object(
              'academicPeriodId', paged.academic_period_id,
              'code', paged.academic_period_code,
              'name', paged.academic_period_name
            ),
            'trainingArea', case
              when paged.training_area_id is null then null
              else jsonb_build_object(
                'trainingAreaId', paged.training_area_id,
                'code', paged.training_area_code,
                'name', paged.training_area_name
              )
            end
          )
          order by paged.academic_period_name desc, paged.semester_number asc, paged.group_name asc
        ),
        '[]'::jsonb
      )
    )
    from paged
  );
end;
$$;

create function academic.get_control_school_group_detail(target_group_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  result jsonb;
begin
  perform academic.require_control_school_application_context();
  perform academic.require_academic_permission('academic.groups.read');
  perform academic.require_student_enrollment_permission('academic.students.read');
  perform academic.require_academic_permission('academic.subjects.read');
  perform academic.require_schedule_permission('academic.workload.read');

  if target_group_id is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  with target_group as (
    select
      groups.id as group_id,
      groups.code as group_code,
      groups.display_name as group_name,
      groups.semester_number,
      groups.status as group_status,
      periods.id as academic_period_id,
      periods.code as academic_period_code,
      periods.name as academic_period_name,
      areas.id as training_area_id,
      areas.code as training_area_code,
      areas.name as training_area_name
    from academic.groups
    join academic.academic_periods periods
      on periods.id = groups.academic_period_id
    left join academic.training_areas areas
      on areas.id = groups.training_area_id
    where groups.id = target_group_id
  ),
  student_rows as (
    select
      enrollments.student_record_id,
      records.institutional_student_code,
      null::text as student_display_name,
      enrollments.status as enrollment_status,
      enrollments.semester_number
    from academic.period_enrollments enrollments
    join academic.student_records records
      on records.id = enrollments.student_record_id
    where enrollments.group_id = target_group_id
      and enrollments.status in ('ACTIVE', 'COMPLETED')
    order by records.institutional_student_code
  ),
  subject_rows as (
    select
      offerings.id as academic_offering_id,
      subjects.id as subject_id,
      subjects.code as subject_code,
      subjects.name as subject_name,
      curriculum.weekly_hours
    from academic.academic_offerings offerings
    join academic.curriculum_subjects curriculum
      on curriculum.id = offerings.curriculum_subject_id
    join academic.subjects subjects
      on subjects.id = curriculum.subject_id
    where offerings.group_id = target_group_id
      and offerings.status in ('PLANNED', 'ACTIVE', 'CLOSED')
    order by subjects.name
  ),
  teacher_rows as (
    select
      assignments.id as teaching_assignment_id,
      assignments.assignment_type,
      assignments.status,
      accounts.institutional_identifier as teacher_identifier
    from academic.teaching_assignments assignments
    join academic.academic_offerings offerings
      on offerings.id = assignments.academic_offering_id
    left join core.accounts accounts
      on accounts.id = assignments.teacher_account_id
    where offerings.group_id = target_group_id
      and assignments.status in ('PLANNED', 'ACTIVE', 'ENDED')
    order by assignments.assignment_type, assignments.valid_from
  )
  select jsonb_build_object(
    'group', jsonb_build_object(
      'groupId', target_group.group_id,
      'code', target_group.group_code,
      'name', target_group.group_name,
      'semesterNumber', target_group.semester_number,
      'status', target_group.group_status,
      'academicPeriod', jsonb_build_object(
        'academicPeriodId', target_group.academic_period_id,
        'code', target_group.academic_period_code,
        'name', target_group.academic_period_name
      ),
      'trainingArea', case
        when target_group.training_area_id is null then null
        else jsonb_build_object(
          'trainingAreaId', target_group.training_area_id,
          'code', target_group.training_area_code,
          'name', target_group.training_area_name
        )
      end
    ),
    'students', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'studentRecordId', student_rows.student_record_id,
          'studentIdentifier', student_rows.institutional_student_code,
          'studentDisplayName', student_rows.student_display_name,
          'semesterNumber', student_rows.semester_number,
          'enrollmentStatus', student_rows.enrollment_status
        )
        order by student_rows.institutional_student_code
      )
      from student_rows
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'academicOfferingId', subject_rows.academic_offering_id,
          'subjectId', subject_rows.subject_id,
          'subjectCode', subject_rows.subject_code,
          'subjectName', subject_rows.subject_name,
          'weeklyHours', subject_rows.weekly_hours
        )
        order by subject_rows.subject_name
      )
      from subject_rows
    ), '[]'::jsonb),
    'teachers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'teachingAssignmentId', teacher_rows.teaching_assignment_id,
          'assignmentType', teacher_rows.assignment_type,
          'assignmentStatus', teacher_rows.status,
          'teacherIdentifier', teacher_rows.teacher_identifier,
          'teacherDisplayName', null
        )
        order by teacher_rows.assignment_type, teacher_rows.teacher_identifier
      )
      from teacher_rows
    ), '[]'::jsonb)
  )
    into result
    from target_group;

  if result is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  return result;
end;
$$;

create function academic.get_control_school_group_schedule(
  target_group_id uuid,
  requested_academic_period_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  resolved_period_id uuid;
begin
  perform academic.require_control_school_application_context();
  perform academic.require_schedule_permission('academic.schedules.read');

  if target_group_id is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  select groups.academic_period_id
    into resolved_period_id
    from academic.groups
   where groups.id = target_group_id;

  if resolved_period_id is null then
    raise exception 'GROUP_NOT_FOUND';
  end if;

  if requested_academic_period_id is not null and requested_academic_period_id <> resolved_period_id then
    raise exception 'PERIOD_NOT_AVAILABLE';
  end if;

  return (
    with rows as (
      select
        sessions.id as class_session_id,
        sessions.weekday,
        blocks.starts_at,
        blocks.ends_at,
        blocks.display_name as time_block_name,
        schedules.status as schedule_status,
        subjects.code as subject_code,
        subjects.name as subject_name,
        accounts.institutional_identifier as teacher_identifier,
        spaces.code as space_code,
        spaces.name as space_name,
        groups.id as group_id,
        groups.code as group_code,
        groups.display_name as group_name
      from academic.class_sessions sessions
      join academic.group_schedules schedules
        on schedules.id = sessions.group_schedule_id
      join academic.academic_offerings offerings
        on offerings.id = sessions.academic_offering_id
      join academic.curriculum_subjects curriculum
        on curriculum.id = offerings.curriculum_subject_id
      join academic.subjects subjects
        on subjects.id = curriculum.subject_id
      join academic.groups
        on groups.id = schedules.group_id
      join academic.schedule_time_blocks blocks
        on blocks.id = sessions.time_block_id
      left join academic.teaching_assignments assignments
        on assignments.id = sessions.teaching_assignment_id
      left join core.accounts accounts
        on accounts.id = assignments.teacher_account_id
      left join academic.academic_spaces spaces
        on spaces.id = sessions.academic_space_id
      where schedules.group_id = target_group_id
        and schedules.academic_period_id = coalesce(requested_academic_period_id, resolved_period_id)
        and schedules.status in ('PUBLISHED', 'APPROVED', 'UNDER_REVIEW', 'DRAFT')
        and sessions.status = 'ACTIVE'
      order by sessions.weekday, blocks.sequence_number, subjects.name
    )
    select jsonb_build_object(
      'groupId', target_group_id,
      'academicPeriodId', coalesce(requested_academic_period_id, resolved_period_id),
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'classSessionId', rows.class_session_id,
            'weekday', rows.weekday,
            'startsAt', rows.starts_at,
            'endsAt', rows.ends_at,
            'timeBlockName', rows.time_block_name,
            'scheduleStatus', rows.schedule_status,
            'subjectCode', rows.subject_code,
            'subjectName', rows.subject_name,
            'teacherIdentifier', rows.teacher_identifier,
            'teacherDisplayName', null,
            'spaceCode', rows.space_code,
            'spaceName', rows.space_name,
            'group', jsonb_build_object(
              'groupId', rows.group_id,
              'code', rows.group_code,
              'name', rows.group_name
            )
          )
          order by rows.weekday, rows.starts_at, rows.subject_name
        ),
        '[]'::jsonb
      )
    )
    from rows
  );
end;
$$;

create function academic.get_control_school_structure(
  requested_academic_period_id uuid default null,
  requested_study_plan_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform academic.require_control_school_application_context();
  perform academic.require_control_school_catalog_permission('academic.cycles.read');
  perform academic.require_control_school_catalog_permission('academic.periods.read');
  perform academic.require_control_school_catalog_permission('academic.plans.read');
  perform academic.require_control_school_catalog_permission('academic.subjects.read');
  perform academic.require_control_school_catalog_permission('academic.groups.read');

  return (
    select jsonb_build_object(
      'cycles', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'schoolCycleId', cycles.id,
            'code', cycles.code,
            'name', cycles.name,
            'status', cycles.status,
            'startsOn', cycles.starts_on,
            'endsOn', cycles.ends_on
          )
          order by cycles.starts_on desc
        )
        from academic.school_cycles cycles
      ), '[]'::jsonb),
      'periods', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'academicPeriodId', periods.id,
            'schoolCycleId', periods.school_cycle_id,
            'code', periods.code,
            'name', periods.name,
            'sequenceNumber', periods.sequence_number,
            'status', periods.status,
            'startsOn', periods.starts_on,
            'endsOn', periods.ends_on
          )
          order by periods.starts_on desc
        )
        from academic.academic_periods periods
        where requested_academic_period_id is null or periods.id = requested_academic_period_id
      ), '[]'::jsonb),
      'studyPlans', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'studyPlanId', plans.id,
            'code', plans.code,
            'name', plans.name,
            'version', plans.version,
            'status', plans.status,
            'validFrom', plans.valid_from,
            'validTo', plans.valid_to,
            'totalSemesters', plans.total_semesters
          )
          order by plans.name, plans.version
        )
        from academic.study_plans plans
        where requested_study_plan_id is null or plans.id = requested_study_plan_id
      ), '[]'::jsonb),
      'planSemesters', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'planSemesterId', semesters.id,
            'studyPlanId', semesters.study_plan_id,
            'semesterNumber', semesters.semester_number,
            'name', semesters.name,
            'specializationRequired', semesters.specialization_required
          )
          order by semesters.study_plan_id, semesters.semester_number
        )
        from academic.plan_semesters semesters
        where requested_study_plan_id is null or semesters.study_plan_id = requested_study_plan_id
      ), '[]'::jsonb),
      'trainingAreas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'trainingAreaId', areas.id,
            'code', areas.code,
            'name', areas.name,
            'status', areas.status,
            'startsAtSemester', areas.starts_at_semester
          )
          order by areas.starts_at_semester, areas.name
        )
        from academic.training_areas areas
      ), '[]'::jsonb),
      'subjects', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'subjectId', subjects.id,
            'code', subjects.code,
            'name', subjects.name,
            'shortName', subjects.short_name,
            'status', subjects.status,
            'subjectType', subjects.subject_type
          )
          order by subjects.name
        )
        from academic.subjects subjects
      ), '[]'::jsonb),
      'groups', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'groupId', groups.id,
            'academicPeriodId', groups.academic_period_id,
            'studyPlanId', groups.study_plan_id,
            'semesterNumber', groups.semester_number,
            'trainingAreaId', groups.training_area_id,
            'code', groups.code,
            'name', groups.display_name,
            'status', groups.status
          )
          order by groups.display_name
        )
        from academic.groups
        where (requested_academic_period_id is null or groups.academic_period_id = requested_academic_period_id)
          and (requested_study_plan_id is null or groups.study_plan_id = requested_study_plan_id)
      ), '[]'::jsonb)
    )
  );
end;
$$;

create function academic.list_control_school_enrollments(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_status academic.period_enrollment_status default null,
  requested_search_text text default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  page_limit integer := academic.clamp_control_school_limit(requested_limit);
  page_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  perform academic.require_control_school_application_context();
  perform academic.require_student_enrollment_permission('academic.enrollments.read');

  return (
    with filtered as (
      select
        enrollments.id as period_enrollment_id,
        enrollments.student_record_id,
        records.institutional_student_code,
        null::text as student_display_name,
        enrollments.status as enrollment_status,
        enrollments.enrollment_number,
        enrollments.semester_number,
        enrollments.enrolled_at,
        enrollments.completed_at,
        enrollments.cancelled_at,
        periods.id as academic_period_id,
        periods.code as academic_period_code,
        periods.name as academic_period_name,
        groups.id as group_id,
        groups.code as group_code,
        groups.display_name as group_name
      from academic.period_enrollments enrollments
      join academic.student_records records
        on records.id = enrollments.student_record_id
      join academic.academic_periods periods
        on periods.id = enrollments.academic_period_id
      left join academic.groups groups
        on groups.id = enrollments.group_id
      where (
          requested_academic_period_id is null
          or enrollments.academic_period_id = requested_academic_period_id
        )
        and (
          requested_semester_number is null
          or enrollments.semester_number = requested_semester_number
        )
        and (
          requested_group_id is null
          or enrollments.group_id = requested_group_id
        )
        and (
          requested_status is null
          or enrollments.status = requested_status
        )
        and (
          requested_search_text is null
          or requested_search_text = ''
          or records.institutional_student_code ilike '%' || btrim(requested_search_text) || '%'
        )
    ),
    counted as (
      select count(*)::integer as total_rows from filtered
    ),
    paged as (
      select *
        from filtered
       order by academic_period_name desc, semester_number asc, institutional_student_code asc
       limit page_limit
      offset page_offset
    )
    select jsonb_build_object(
      'offset', page_offset,
      'pageSize', page_limit,
      'totalRows', (select total_rows from counted),
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'periodEnrollmentId', paged.period_enrollment_id,
            'studentRecordId', paged.student_record_id,
            'studentIdentifier', paged.institutional_student_code,
            'studentDisplayName', paged.student_display_name,
            'status', paged.enrollment_status,
            'enrollmentNumber', paged.enrollment_number,
            'semesterNumber', paged.semester_number,
            'enrolledAt', paged.enrolled_at,
            'completedAt', paged.completed_at,
            'cancelledAt', paged.cancelled_at,
            'academicPeriod', jsonb_build_object(
              'academicPeriodId', paged.academic_period_id,
              'code', paged.academic_period_code,
              'name', paged.academic_period_name
            ),
            'group', case
              when paged.group_id is null then null
              else jsonb_build_object(
                'groupId', paged.group_id,
                'code', paged.group_code,
                'name', paged.group_name
              )
            end
          )
          order by paged.academic_period_name desc, paged.semester_number asc, paged.institutional_student_code asc
        ),
        '[]'::jsonb
      )
    )
    from paged
  );
end;
$$;

create function academic.get_control_school_student_trajectory(target_student_record_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  result jsonb;
begin
  perform academic.require_control_school_application_context();
  perform academic.require_student_enrollment_permission('academic.students.read');
  perform academic.require_student_enrollment_permission('academic.enrollments.read');
  perform academic.require_student_enrollment_permission('academic.progress.read');

  if target_student_record_id is null then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;

  if not exists(select 1 from academic.student_records where id = target_student_record_id) then
    raise exception 'STUDENT_RECORD_NOT_FOUND';
  end if;

  with periods as (
    select
      enrollments.id as period_enrollment_id,
      periods.id as academic_period_id,
      periods.code as academic_period_code,
      periods.name as academic_period_name,
      periods.starts_on,
      periods.ends_on,
      enrollments.semester_number,
      enrollments.status as enrollment_status,
      groups.id as group_id,
      groups.code as group_code,
      groups.display_name as group_name,
      areas.id as training_area_id,
      areas.code as training_area_code,
      areas.name as training_area_name
    from academic.period_enrollments enrollments
    join academic.academic_periods periods
      on periods.id = enrollments.academic_period_id
    left join academic.groups groups
      on groups.id = enrollments.group_id
    left join academic.training_areas areas
      on areas.id = enrollments.training_area_id
    where enrollments.student_record_id = target_student_record_id
    order by periods.starts_on desc, enrollments.created_at desc
  ),
  decisions as (
    select
      decisions.id as decision_id,
      source_periods.id as source_academic_period_id,
      source_periods.code as source_academic_period_code,
      source_periods.name as source_academic_period_name,
      decisions.decision_type,
      decisions.decision_status,
      decisions.resulting_semester_number,
      areas.id as resulting_training_area_id,
      areas.code as resulting_training_area_code,
      areas.name as resulting_training_area_name,
      decisions.decided_at,
      decisions.reversed_at
    from academic.academic_progress_decisions decisions
    join academic.academic_periods source_periods
      on source_periods.id = decisions.source_academic_period_id
    left join academic.training_areas areas
      on areas.id = decisions.resulting_training_area_id
    where decisions.student_record_id = target_student_record_id
    order by source_periods.starts_on desc, decisions.created_at desc
  )
  select jsonb_build_object(
    'studentRecordId', target_student_record_id,
    'periods', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'periodEnrollmentId', periods.period_enrollment_id,
          'academicPeriodId', periods.academic_period_id,
          'academicPeriodCode', periods.academic_period_code,
          'academicPeriodName', periods.academic_period_name,
          'startsOn', periods.starts_on,
          'endsOn', periods.ends_on,
          'semesterNumber', periods.semester_number,
          'enrollmentStatus', periods.enrollment_status,
          'group', case
            when periods.group_id is null then null
            else jsonb_build_object(
              'groupId', periods.group_id,
              'code', periods.group_code,
              'name', periods.group_name
            )
          end,
          'trainingArea', case
            when periods.training_area_id is null then null
            else jsonb_build_object(
              'trainingAreaId', periods.training_area_id,
              'code', periods.training_area_code,
              'name', periods.training_area_name
            )
          end
        )
        order by periods.starts_on desc, periods.period_enrollment_id
      )
      from periods
    ), '[]'::jsonb),
    'progressDecisions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'decisionId', decisions.decision_id,
          'sourceAcademicPeriodId', decisions.source_academic_period_id,
          'sourceAcademicPeriodCode', decisions.source_academic_period_code,
          'sourceAcademicPeriodName', decisions.source_academic_period_name,
          'decisionType', decisions.decision_type,
          'decisionStatus', decisions.decision_status,
          'resultingSemesterNumber', decisions.resulting_semester_number,
          'resultingTrainingArea', case
            when decisions.resulting_training_area_id is null then null
            else jsonb_build_object(
              'trainingAreaId', decisions.resulting_training_area_id,
              'code', decisions.resulting_training_area_code,
              'name', decisions.resulting_training_area_name
            )
          end,
          'decidedAt', decisions.decided_at,
          'reversedAt', decisions.reversed_at
        )
        order by decisions.source_academic_period_name desc, decisions.decision_id
      )
      from decisions
    ), '[]'::jsonb)
  )
    into result;

  return result;
end;
$$;

create or replace function public.list_control_school_students(
  requested_search_text text default null,
  requested_student_status academic.student_record_status default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_academic_period_id uuid default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_control_school_students(
    requested_search_text,
    requested_student_status,
    requested_semester_number,
    requested_group_id,
    requested_academic_period_id,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.get_control_school_student_detail(target_student_record_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select academic.get_control_school_student_detail(target_student_record_id); $$;

create or replace function public.list_control_school_groups(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_training_area_id uuid default null,
  requested_group_status academic.group_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_control_school_groups(
    requested_academic_period_id,
    requested_semester_number,
    requested_training_area_id,
    requested_group_status,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.get_control_school_group_detail(target_group_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select academic.get_control_school_group_detail(target_group_id); $$;

create or replace function public.get_control_school_group_schedule(
  target_group_id uuid,
  requested_academic_period_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select academic.get_control_school_group_schedule(target_group_id, requested_academic_period_id); $$;

create or replace function public.get_control_school_structure(
  requested_academic_period_id uuid default null,
  requested_study_plan_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select academic.get_control_school_structure(requested_academic_period_id, requested_study_plan_id); $$;

create or replace function public.list_control_school_enrollments(
  requested_academic_period_id uuid default null,
  requested_semester_number integer default null,
  requested_group_id uuid default null,
  requested_status academic.period_enrollment_status default null,
  requested_search_text text default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_control_school_enrollments(
    requested_academic_period_id,
    requested_semester_number,
    requested_group_id,
    requested_status,
    requested_search_text,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.get_control_school_student_trajectory(target_student_record_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$ select academic.get_control_school_student_trajectory(target_student_record_id); $$;

alter function academic.require_control_school_application_context() owner to postgres;
alter function academic.require_control_school_catalog_permission(text) owner to postgres;
alter function academic.clamp_control_school_limit(integer) owner to postgres;
alter function academic.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer) owner to postgres;
alter function academic.get_control_school_student_detail(uuid) owner to postgres;
alter function academic.list_control_school_groups(uuid, integer, uuid, academic.group_status, integer, integer) owner to postgres;
alter function academic.get_control_school_group_detail(uuid) owner to postgres;
alter function academic.get_control_school_group_schedule(uuid, uuid) owner to postgres;
alter function academic.get_control_school_structure(uuid, uuid) owner to postgres;
alter function academic.list_control_school_enrollments(uuid, integer, uuid, academic.period_enrollment_status, text, integer, integer) owner to postgres;
alter function academic.get_control_school_student_trajectory(uuid) owner to postgres;

alter function public.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer) owner to postgres;
alter function public.get_control_school_student_detail(uuid) owner to postgres;
alter function public.list_control_school_groups(uuid, integer, uuid, academic.group_status, integer, integer) owner to postgres;
alter function public.get_control_school_group_detail(uuid) owner to postgres;
alter function public.get_control_school_group_schedule(uuid, uuid) owner to postgres;
alter function public.get_control_school_structure(uuid, uuid) owner to postgres;
alter function public.list_control_school_enrollments(uuid, integer, uuid, academic.period_enrollment_status, text, integer, integer) owner to postgres;
alter function public.get_control_school_student_trajectory(uuid) owner to postgres;

revoke all on function academic.require_control_school_application_context() from public, anon, authenticated;
revoke all on function academic.require_control_school_catalog_permission(text) from public, anon, authenticated;
revoke all on function academic.clamp_control_school_limit(integer) from public, anon, authenticated;
revoke all on function academic.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function academic.get_control_school_student_detail(uuid) from public, anon, authenticated;
revoke all on function academic.list_control_school_groups(uuid, integer, uuid, academic.group_status, integer, integer) from public, anon, authenticated;
revoke all on function academic.get_control_school_group_detail(uuid) from public, anon, authenticated;
revoke all on function academic.get_control_school_group_schedule(uuid, uuid) from public, anon, authenticated;
revoke all on function academic.get_control_school_structure(uuid, uuid) from public, anon, authenticated;
revoke all on function academic.list_control_school_enrollments(uuid, integer, uuid, academic.period_enrollment_status, text, integer, integer) from public, anon, authenticated;
revoke all on function academic.get_control_school_student_trajectory(uuid) from public, anon, authenticated;

revoke all on function public.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer) from public, anon;
revoke all on function public.get_control_school_student_detail(uuid) from public, anon;
revoke all on function public.list_control_school_groups(uuid, integer, uuid, academic.group_status, integer, integer) from public, anon;
revoke all on function public.get_control_school_group_detail(uuid) from public, anon;
revoke all on function public.get_control_school_group_schedule(uuid, uuid) from public, anon;
revoke all on function public.get_control_school_structure(uuid, uuid) from public, anon;
revoke all on function public.list_control_school_enrollments(uuid, integer, uuid, academic.period_enrollment_status, text, integer, integer) from public, anon;
revoke all on function public.get_control_school_student_trajectory(uuid) from public, anon;

grant execute on function public.list_control_school_students(text, academic.student_record_status, integer, uuid, uuid, integer, integer) to authenticated;
grant execute on function public.get_control_school_student_detail(uuid) to authenticated;
grant execute on function public.list_control_school_groups(uuid, integer, uuid, academic.group_status, integer, integer) to authenticated;
grant execute on function public.get_control_school_group_detail(uuid) to authenticated;
grant execute on function public.get_control_school_group_schedule(uuid, uuid) to authenticated;
grant execute on function public.get_control_school_structure(uuid, uuid) to authenticated;
grant execute on function public.list_control_school_enrollments(uuid, integer, uuid, academic.period_enrollment_status, text, integer, integer) to authenticated;
grant execute on function public.get_control_school_student_trajectory(uuid) to authenticated;

commit;
