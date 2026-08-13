begin;

create function academic.require_grade_management_application_context()
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

create function academic.require_grade_management_permissions(permission_codes text[])
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  permission_code text;
  actor_account_id uuid;
begin
  if permission_codes is null or coalesce(array_length(permission_codes, 1), 0) = 0 then
    raise exception using errcode='42501', message='ACTOR_NOT_AUTHORIZED';
  end if;

  actor_account_id := academic.require_grade_management_application_context();

  foreach permission_code in array permission_codes loop
    perform academic.require_grade_permission(permission_code);
  end loop;

  return actor_account_id;
end;
$$;

create function academic.is_grade_management_teacher(actor_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
      from core.account_roles account_roles
      join core.roles roles on roles.id = account_roles.role_id
     where account_roles.account_id = actor_account_id
       and account_roles.revoked_at is null
       and roles.code = 'DOCENTE'
  );
$$;

create function academic.require_grade_management_teacher_scope(
  actor_account_id uuid,
  target_academic_offering_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not exists(
    select 1
      from academic.teaching_assignments assignments
     where assignments.academic_offering_id = target_academic_offering_id
       and assignments.teacher_account_id = actor_account_id
       and assignments.status = 'ACTIVE'
  ) then
    raise exception using errcode='42501', message='TEACHER_NOT_AUTHORIZED';
  end if;
end;
$$;

create function academic.list_grade_management_offerings(
  requested_academic_period_id uuid default null,
  requested_group_id uuid default null,
  requested_subject_id uuid default null,
  requested_teacher_identifier text default null,
  requested_academic_offering_id uuid default null,
  requested_window_status academic.grade_window_status default null,
  requested_offering_status academic.offering_status default null,
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
  actor_account_id uuid;
  restrict_to_teacher_scope boolean;
  sanitized_limit integer := least(greatest(coalesce(requested_limit, 25), 1), 100);
  sanitized_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  actor_account_id := academic.require_grade_management_permissions(array[
    'academic.grades.read',
    'academic.subject_results.read'
  ]);
  restrict_to_teacher_scope := academic.is_grade_management_teacher(actor_account_id);

  return (
    with offering_base as (
      select
        offerings.id as academic_offering_id,
        offerings.status as offering_status,
        periods.id as academic_period_id,
        periods.code as academic_period_code,
        periods.name as academic_period_name,
        groups.id as group_id,
        groups.code as group_code,
        groups.display_name as group_name,
        groups.semester_number,
        training_areas.id as training_area_id,
        training_areas.code as training_area_code,
        training_areas.name as training_area_name,
        subjects.id as subject_id,
        subjects.code as subject_code,
        subjects.name as subject_name,
        teachers.teacher_identifier,
        teachers.teacher_display_name,
        teachers.teaching_assignment_status,
        teachers.assignment_type,
        coalesce(student_counts.student_count, 0) as student_count,
        coalesce(window_counts.draft_count, 0) as draft_window_count,
        coalesce(window_counts.open_count, 0) as open_window_count,
        coalesce(window_counts.closed_count, 0) as closed_window_count,
        coalesce(window_counts.cancelled_count, 0) as cancelled_window_count,
        coalesce(grade_counts.captured_count, 0) as captured_count,
        coalesce(grade_counts.reviewed_count, 0) as reviewed_count,
        coalesce(grade_counts.finalized_count, 0) as finalized_count,
        coalesce(grade_counts.corrected_count, 0) as corrected_count,
        coalesce(result_counts.calculated_count, 0) as calculated_result_count,
        coalesce(result_counts.confirmed_count, 0) as confirmed_result_count,
        coalesce(correction_counts.pending_count, 0) as pending_correction_count
      from academic.academic_offerings offerings
      join academic.academic_periods periods on periods.id = offerings.academic_period_id
      join academic.groups groups on groups.id = offerings.group_id
      join academic.curriculum_subjects curriculum_subjects on curriculum_subjects.id = offerings.curriculum_subject_id
      join academic.subjects subjects on subjects.id = curriculum_subjects.subject_id
      left join academic.training_areas training_areas on training_areas.id = groups.training_area_id
      left join lateral (
        select
          teacher_accounts.institutional_identifier as teacher_identifier,
          null::text as teacher_display_name,
          assignments.status as teaching_assignment_status,
          assignments.assignment_type
        from academic.teaching_assignments assignments
        join core.accounts teacher_accounts on teacher_accounts.id = assignments.teacher_account_id
        where assignments.academic_offering_id = offerings.id
          and assignments.status = 'ACTIVE'
        order by case when assignments.assignment_type = 'PRIMARY' then 0 else 1 end, assignments.valid_from desc
        limit 1
      ) teachers on true
      left join lateral (
        select count(*)::integer as student_count
        from academic.student_offering_enrollments enrollments
        where enrollments.academic_offering_id = offerings.id
          and enrollments.status in ('ACTIVE', 'COMPLETED')
      ) student_counts on true
      left join lateral (
        select
          count(*) filter (where windows.status = 'DRAFT')::integer as draft_count,
          count(*) filter (where windows.status = 'OPEN')::integer as open_count,
          count(*) filter (where windows.status = 'CLOSED')::integer as closed_count,
          count(*) filter (where windows.status = 'CANCELLED')::integer as cancelled_count
        from academic.grade_capture_windows windows
        where windows.academic_period_id = offerings.academic_period_id
      ) window_counts on true
      left join lateral (
        select
          count(*) filter (where grades.status = 'CAPTURED')::integer as captured_count,
          count(*) filter (where grades.status = 'REVIEWED')::integer as reviewed_count,
          count(*) filter (where grades.status = 'FINALIZED')::integer as finalized_count,
          count(*) filter (where grades.status = 'CORRECTED')::integer as corrected_count
        from academic.student_unit_grades grades
        where grades.academic_offering_id = offerings.id
      ) grade_counts on true
      left join lateral (
        select
          count(*) filter (where results.status = 'CALCULATED')::integer as calculated_count,
          count(*) filter (where results.status = 'CONFIRMED')::integer as confirmed_count
        from academic.subject_final_results results
        where results.academic_offering_id = offerings.id
      ) result_counts on true
      left join lateral (
        select count(*)::integer as pending_count
        from academic.grade_corrections corrections
        join academic.student_unit_grades grades on grades.id = corrections.student_unit_grade_id
        where grades.academic_offering_id = offerings.id
          and corrections.status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
      ) correction_counts on true
      where (requested_academic_period_id is null or offerings.academic_period_id = requested_academic_period_id)
        and (requested_group_id is null or offerings.group_id = requested_group_id)
        and (requested_subject_id is null or subjects.id = requested_subject_id)
        and (requested_academic_offering_id is null or offerings.id = requested_academic_offering_id)
        and (requested_offering_status is null or offerings.status = requested_offering_status)
        and (
          requested_teacher_identifier is null
          or teachers.teacher_identifier = requested_teacher_identifier
        )
        and (
          requested_window_status is null
          or exists(
            select 1
              from academic.grade_capture_windows windows
             where windows.academic_period_id = offerings.academic_period_id
               and windows.status = requested_window_status
          )
        )
        and (
          not restrict_to_teacher_scope
          or exists(
            select 1
              from academic.teaching_assignments assignments
             where assignments.academic_offering_id = offerings.id
               and assignments.teacher_account_id = actor_account_id
               and assignments.status = 'ACTIVE'
          )
        )
    ),
    counted as (
      select count(*)::integer as total_rows from offering_base
    ),
    paged as (
      select *
      from offering_base
      order by academic_period_code, group_code, subject_code, academic_offering_id
      offset sanitized_offset
      limit sanitized_limit
    )
    select jsonb_build_object(
      'offset', sanitized_offset,
      'pageSize', sanitized_limit,
      'totalRows', counted.total_rows,
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'academicOfferingId', paged.academic_offering_id,
            'offeringStatus', paged.offering_status,
            'academicPeriod', jsonb_build_object(
              'academicPeriodId', paged.academic_period_id,
              'code', paged.academic_period_code,
              'name', paged.academic_period_name
            ),
            'group', jsonb_build_object(
              'groupId', paged.group_id,
              'code', paged.group_code,
              'name', paged.group_name
            ),
            'subject', jsonb_build_object(
              'subjectId', paged.subject_id,
              'code', paged.subject_code,
              'name', paged.subject_name
            ),
            'semesterNumber', paged.semester_number,
            'trainingArea', case when paged.training_area_id is null then null else jsonb_build_object(
              'trainingAreaId', paged.training_area_id,
              'code', paged.training_area_code,
              'name', paged.training_area_name
            ) end,
            'teacher', case when paged.teacher_identifier is null then null else jsonb_build_object(
              'teacherIdentifier', paged.teacher_identifier,
              'teacherDisplayName', paged.teacher_display_name,
              'assignmentStatus', paged.teaching_assignment_status,
              'assignmentType', paged.assignment_type
            ) end,
            'studentCount', paged.student_count,
            'windowSummary', jsonb_build_object(
              'draftCount', paged.draft_window_count,
              'openCount', paged.open_window_count,
              'closedCount', paged.closed_window_count,
              'cancelledCount', paged.cancelled_window_count
            ),
            'captureSummary', jsonb_build_object(
              'capturedCount', paged.captured_count,
              'reviewedCount', paged.reviewed_count,
              'finalizedCount', paged.finalized_count,
              'correctedCount', paged.corrected_count,
              'calculatedResultCount', paged.calculated_result_count,
              'confirmedResultCount', paged.confirmed_result_count,
              'pendingCorrectionCount', paged.pending_correction_count
            )
          )
          order by paged.academic_period_code, paged.group_code, paged.subject_code, paged.academic_offering_id
        ),
        '[]'::jsonb
      )
    )
    from counted
    left join paged on true
    group by counted.total_rows
  );
end;
$$;

create function academic.list_my_grade_management_offerings(
  requested_academic_period_id uuid default null,
  requested_window_status academic.grade_window_status default null,
  requested_offering_status academic.offering_status default null,
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
  actor_account_id uuid;
begin
  actor_account_id := academic.require_grade_management_permissions(array['academic.grades.read']);

  if not academic.is_grade_management_teacher(actor_account_id) then
    raise exception using errcode='42501', message='TEACHER_NOT_AUTHORIZED';
  end if;

  return academic.list_grade_management_offerings(
    requested_academic_period_id,
    null,
    null,
    (
      select institutional_identifier
      from core.accounts
      where id = actor_account_id
    ),
    null,
    requested_window_status,
    requested_offering_status,
    requested_limit,
    requested_offset
  );
end;
$$;

create function academic.get_grade_management_offering_detail(
  target_academic_offering_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor_account_id uuid;
  restrict_to_teacher_scope boolean;
  offering_record record;
begin
  actor_account_id := academic.require_grade_management_permissions(array[
    'academic.grades.read',
    'academic.subject_results.read'
  ]);
  restrict_to_teacher_scope := academic.is_grade_management_teacher(actor_account_id);

  if restrict_to_teacher_scope then
    perform academic.require_grade_management_teacher_scope(actor_account_id, target_academic_offering_id);
  end if;

  select
    offerings.id as academic_offering_id,
    offerings.status as offering_status,
    periods.id as academic_period_id,
    periods.code as academic_period_code,
    periods.name as academic_period_name,
    groups.id as group_id,
    groups.code as group_code,
    groups.display_name as group_name,
    groups.semester_number,
    training_areas.id as training_area_id,
    training_areas.code as training_area_code,
    training_areas.name as training_area_name,
    subjects.id as subject_id,
    subjects.code as subject_code,
    subjects.name as subject_name,
    teachers.teacher_identifier,
    teachers.teacher_display_name,
    teachers.teaching_assignment_id,
    teachers.assignment_status,
    teachers.assignment_type
    into offering_record
  from academic.academic_offerings offerings
  join academic.academic_periods periods on periods.id = offerings.academic_period_id
  join academic.groups groups on groups.id = offerings.group_id
  join academic.curriculum_subjects curriculum_subjects on curriculum_subjects.id = offerings.curriculum_subject_id
  join academic.subjects subjects on subjects.id = curriculum_subjects.subject_id
  left join academic.training_areas training_areas on training_areas.id = groups.training_area_id
  left join lateral (
    select
      teacher_accounts.institutional_identifier as teacher_identifier,
      null::text as teacher_display_name,
      assignments.id as teaching_assignment_id,
      assignments.status as assignment_status,
      assignments.assignment_type
    from academic.teaching_assignments assignments
    join core.accounts teacher_accounts on teacher_accounts.id = assignments.teacher_account_id
    where assignments.academic_offering_id = offerings.id
      and assignments.status = 'ACTIVE'
    order by case when assignments.assignment_type = 'PRIMARY' then 0 else 1 end, assignments.valid_from desc
    limit 1
  ) teachers on true
  where offerings.id = target_academic_offering_id;

  if offering_record.academic_offering_id is null then
    raise exception using errcode='P0002', message='ACADEMIC_OFFERING_NOT_FOUND';
  end if;

  return (
    with enrolled_students as (
      select
        student_enrollments.id as student_offering_enrollment_id,
        student_enrollments.status as offering_enrollment_status,
        period_enrollments.id as period_enrollment_id,
        period_enrollments.status as period_enrollment_status,
        student_records.id as student_record_id,
        student_records.institutional_student_code as student_identifier,
        null::text as student_display_name
      from academic.student_offering_enrollments student_enrollments
      join academic.period_enrollments period_enrollments on period_enrollments.id = student_enrollments.period_enrollment_id
      join academic.student_records student_records on student_records.id = period_enrollments.student_record_id
      where student_enrollments.academic_offering_id = target_academic_offering_id
        and student_enrollments.status in ('ACTIVE', 'COMPLETED')
      order by student_records.institutional_student_code
    )
    select jsonb_build_object(
      'offering', jsonb_build_object(
        'academicOfferingId', offering_record.academic_offering_id,
        'offeringStatus', offering_record.offering_status,
        'academicPeriod', jsonb_build_object(
          'academicPeriodId', offering_record.academic_period_id,
          'code', offering_record.academic_period_code,
          'name', offering_record.academic_period_name
        ),
        'group', jsonb_build_object(
          'groupId', offering_record.group_id,
          'code', offering_record.group_code,
          'name', offering_record.group_name
        ),
        'subject', jsonb_build_object(
          'subjectId', offering_record.subject_id,
          'code', offering_record.subject_code,
          'name', offering_record.subject_name
        ),
        'semesterNumber', offering_record.semester_number,
        'trainingArea', case when offering_record.training_area_id is null then null else jsonb_build_object(
          'trainingAreaId', offering_record.training_area_id,
          'code', offering_record.training_area_code,
          'name', offering_record.training_area_name
        ) end,
        'teacher', case when offering_record.teacher_identifier is null then null else jsonb_build_object(
          'teachingAssignmentId', offering_record.teaching_assignment_id,
          'teacherIdentifier', offering_record.teacher_identifier,
          'teacherDisplayName', offering_record.teacher_display_name,
          'assignmentStatus', offering_record.assignment_status,
          'assignmentType', offering_record.assignment_type
        ) end
      ),
      'students', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'studentOfferingEnrollmentId', enrolled_students.student_offering_enrollment_id,
            'periodEnrollmentId', enrolled_students.period_enrollment_id,
            'studentRecordId', enrolled_students.student_record_id,
            'studentIdentifier', enrolled_students.student_identifier,
            'studentDisplayName', enrolled_students.student_display_name,
            'enrollmentStatus', enrolled_students.period_enrollment_status,
            'offeringEnrollmentStatus', enrolled_students.offering_enrollment_status,
            'unitGrades', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'studentUnitGradeId', grades.id,
                  'subjectUnitId', grades.subject_unit_id,
                  'unitNumber', grades.unit_number,
                  'rawGrade', grades.raw_grade,
                  'normalizedGrade', grades.normalized_grade,
                  'isAccredited', grades.is_accredited,
                  'status', grades.status,
                  'capturedAt', grades.captured_at,
                  'reviewedAt', grades.reviewed_at,
                  'finalizedAt', grades.finalized_at
                )
                order by grades.unit_number
              )
              from academic.student_unit_grades grades
              where grades.student_offering_enrollment_id = enrolled_students.student_offering_enrollment_id
            ), '[]'::jsonb),
            'subjectResult', (
              select case when results.id is null then null else jsonb_build_object(
                'subjectFinalResultId', results.id,
                'rawFinalGrade', results.raw_final_grade,
                'roundedFinalGrade', results.rounded_final_grade,
                'resultCode', results.result_code,
                'calculationStatus', results.calculation_status,
                'status', results.status,
                'accreditedUnitCount', results.accredited_unit_count,
                'nonAccreditedUnitCount', results.non_accredited_unit_count,
                'calculatedAt', results.calculated_at,
                'confirmedAt', results.confirmed_at
              ) end
              from academic.subject_final_results results
              where results.student_offering_enrollment_id = enrolled_students.student_offering_enrollment_id
            )
          )
          order by enrolled_students.student_identifier
        ),
        '[]'::jsonb
      )
    )
    from enrolled_students
  );
end;
$$;

create function academic.get_grade_management_unit_grade_history(
  target_student_unit_grade_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor_account_id uuid;
  restrict_to_teacher_scope boolean;
  offering_id uuid;
begin
  actor_account_id := academic.require_grade_management_permissions(array['academic.grades.read']);
  restrict_to_teacher_scope := academic.is_grade_management_teacher(actor_account_id);

  select grades.academic_offering_id
    into offering_id
    from academic.student_unit_grades grades
   where grades.id = target_student_unit_grade_id;

  if offering_id is null then
    raise exception using errcode='P0002', message='UNIT_GRADE_NOT_FOUND';
  end if;

  if restrict_to_teacher_scope then
    perform academic.require_grade_management_teacher_scope(actor_account_id, offering_id);
  end if;

  return (
    with target_grade as (
      select
        grades.id,
        grades.student_record_id,
        grades.student_offering_enrollment_id,
        grades.unit_number,
        student_records.institutional_student_code as student_identifier
      from academic.student_unit_grades grades
      join academic.student_records student_records on student_records.id = grades.student_record_id
      where grades.id = target_student_unit_grade_id
    )
    select jsonb_build_object(
      'studentUnitGradeId', target_grade.id,
      'studentRecordId', target_grade.student_record_id,
      'studentIdentifier', target_grade.student_identifier,
      'studentOfferingEnrollmentId', target_grade.student_offering_enrollment_id,
      'unitNumber', target_grade.unit_number,
      'history', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'historyId', history.id,
            'previousRawGrade', history.previous_raw_grade,
            'resultingRawGrade', history.resulting_raw_grade,
            'previousStatus', history.previous_status,
            'resultingStatus', history.resulting_status,
            'reasonCode', history.reason_code,
            'correctionId', history.correction_id,
            'actorIdentifier', actor_accounts.institutional_identifier,
            'createdAt', history.created_at
          )
          order by history.created_at, history.id
        )
        from academic.student_unit_grade_history history
        left join core.accounts actor_accounts on actor_accounts.id = history.actor_account_id
        where history.student_unit_grade_id = target_grade.id
      ), '[]'::jsonb)
    )
    from target_grade
  );
end;
$$;

create function academic.get_grade_management_subject_result_history(
  target_subject_final_result_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor_account_id uuid;
  restrict_to_teacher_scope boolean;
  offering_id uuid;
begin
  actor_account_id := academic.require_grade_management_permissions(array['academic.subject_results.read']);
  restrict_to_teacher_scope := academic.is_grade_management_teacher(actor_account_id);

  select results.academic_offering_id
    into offering_id
    from academic.subject_final_results results
   where results.id = target_subject_final_result_id;

  if offering_id is null then
    raise exception using errcode='P0002', message='SUBJECT_RESULT_NOT_FOUND';
  end if;

  if restrict_to_teacher_scope then
    perform academic.require_grade_management_teacher_scope(actor_account_id, offering_id);
  end if;

  return (
    with target_result as (
      select
        results.id,
        results.student_record_id,
        results.student_offering_enrollment_id,
        student_records.institutional_student_code as student_identifier
      from academic.subject_final_results results
      join academic.student_records student_records on student_records.id = results.student_record_id
      where results.id = target_subject_final_result_id
    )
    select jsonb_build_object(
      'subjectFinalResultId', target_result.id,
      'studentRecordId', target_result.student_record_id,
      'studentIdentifier', target_result.student_identifier,
      'studentOfferingEnrollmentId', target_result.student_offering_enrollment_id,
      'history', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'historyId', history.id,
            'previousResult', history.previous_result,
            'resultingResult', history.resulting_result,
            'previousStatus', history.previous_status,
            'resultingStatus', history.resulting_status,
            'actorIdentifier', actor_accounts.institutional_identifier,
            'createdAt', history.created_at
          )
          order by history.created_at, history.id
        )
        from academic.subject_result_history history
        left join core.accounts actor_accounts on actor_accounts.id = history.actor_account_id
        where history.subject_final_result_id = target_result.id
      ), '[]'::jsonb)
    )
    from target_result
  );
end;
$$;

create function academic.list_grade_management_corrections(
  target_academic_offering_id uuid default null,
  target_student_unit_grade_id uuid default null,
  requested_status academic.grade_correction_status default null,
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
  actor_account_id uuid;
  restrict_to_teacher_scope boolean;
  sanitized_limit integer := least(greatest(coalesce(requested_limit, 25), 1), 100);
  sanitized_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  actor_account_id := academic.require_grade_management_permissions(array['academic.grades.read']);
  restrict_to_teacher_scope := academic.is_grade_management_teacher(actor_account_id);

  if restrict_to_teacher_scope and target_academic_offering_id is not null then
    perform academic.require_grade_management_teacher_scope(actor_account_id, target_academic_offering_id);
  end if;

  return (
    with correction_base as (
      select
        corrections.id as correction_id,
        grades.id as student_unit_grade_id,
        grades.academic_offering_id,
        grades.unit_number,
        grades.student_record_id,
        student_records.institutional_student_code as student_identifier,
        corrections.previous_raw_grade,
        corrections.proposed_raw_grade,
        corrections.reason_code,
        corrections.status,
        corrections.requested_at,
        corrections.reviewed_at,
        corrections.approved_at,
        corrections.applied_at,
        corrections.rejected_at,
        corrections.cancelled_at,
        requested_by.institutional_identifier as requested_by_identifier,
        reviewed_by.institutional_identifier as reviewed_by_identifier,
        approved_by.institutional_identifier as approved_by_identifier,
        applied_by.institutional_identifier as applied_by_identifier
      from academic.grade_corrections corrections
      join academic.student_unit_grades grades on grades.id = corrections.student_unit_grade_id
      join academic.student_records student_records on student_records.id = grades.student_record_id
      left join core.accounts requested_by on requested_by.id = corrections.requested_by_account_id
      left join core.accounts reviewed_by on reviewed_by.id = corrections.reviewed_by_account_id
      left join core.accounts approved_by on approved_by.id = corrections.approved_by_account_id
      left join core.accounts applied_by on applied_by.id = corrections.applied_by_account_id
      where (target_academic_offering_id is null or grades.academic_offering_id = target_academic_offering_id)
        and (target_student_unit_grade_id is null or corrections.student_unit_grade_id = target_student_unit_grade_id)
        and (requested_status is null or corrections.status = requested_status)
        and (
          not restrict_to_teacher_scope
          or exists(
            select 1
              from academic.teaching_assignments assignments
             where assignments.academic_offering_id = grades.academic_offering_id
               and assignments.teacher_account_id = actor_account_id
               and assignments.status = 'ACTIVE'
          )
        )
    ),
    counted as (
      select count(*)::integer as total_rows from correction_base
    ),
    paged as (
      select *
      from correction_base
      order by requested_at desc, correction_id desc
      offset sanitized_offset
      limit sanitized_limit
    )
    select jsonb_build_object(
      'offset', sanitized_offset,
      'pageSize', sanitized_limit,
      'totalRows', counted.total_rows,
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'correctionId', paged.correction_id,
            'studentUnitGradeId', paged.student_unit_grade_id,
            'academicOfferingId', paged.academic_offering_id,
            'unitNumber', paged.unit_number,
            'studentRecordId', paged.student_record_id,
            'studentIdentifier', paged.student_identifier,
            'previousRawGrade', paged.previous_raw_grade,
            'proposedRawGrade', paged.proposed_raw_grade,
            'reasonCode', paged.reason_code,
            'status', paged.status,
            'requestedAt', paged.requested_at,
            'reviewedAt', paged.reviewed_at,
            'approvedAt', paged.approved_at,
            'appliedAt', paged.applied_at,
            'rejectedAt', paged.rejected_at,
            'cancelledAt', paged.cancelled_at,
            'requestedByIdentifier', paged.requested_by_identifier,
            'reviewedByIdentifier', paged.reviewed_by_identifier,
            'approvedByIdentifier', paged.approved_by_identifier,
            'appliedByIdentifier', paged.applied_by_identifier
          )
          order by paged.requested_at desc, paged.correction_id desc
        ),
        '[]'::jsonb
      )
    )
    from counted
    left join paged on true
    group by counted.total_rows
  );
end;
$$;

create function academic.list_grade_capture_windows(
  requested_academic_period_id uuid default null,
  requested_window_type academic.grade_window_type default null,
  requested_status academic.grade_window_status default null,
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
  sanitized_limit integer := least(greatest(coalesce(requested_limit, 25), 1), 100);
  sanitized_offset integer := greatest(coalesce(requested_offset, 0), 0);
begin
  perform academic.require_grade_management_permissions(array['academic.grade_windows.manage']);

  return (
    with window_base as (
      select
        windows.id as grade_capture_window_id,
        windows.academic_period_id,
        periods.code as academic_period_code,
        periods.name as academic_period_name,
        windows.unit_number,
        windows.window_type,
        windows.opens_at,
        windows.closes_at,
        windows.status,
        windows.created_at,
        windows.opened_at,
        windows.closed_at,
        creators.institutional_identifier as created_by_identifier,
        openers.institutional_identifier as opened_by_identifier,
        closers.institutional_identifier as closed_by_identifier,
        (
          select count(*)::integer
          from academic.academic_offerings offerings
          where offerings.academic_period_id = windows.academic_period_id
            and offerings.status = 'ACTIVE'
        ) as active_offering_count
      from academic.grade_capture_windows windows
      join academic.academic_periods periods on periods.id = windows.academic_period_id
      left join core.accounts creators on creators.id = windows.created_by_account_id
      left join core.accounts openers on openers.id = windows.opened_by_account_id
      left join core.accounts closers on closers.id = windows.closed_by_account_id
      where (requested_academic_period_id is null or windows.academic_period_id = requested_academic_period_id)
        and (requested_window_type is null or windows.window_type = requested_window_type)
        and (requested_status is null or windows.status = requested_status)
    ),
    counted as (
      select count(*)::integer as total_rows from window_base
    ),
    paged as (
      select *
      from window_base
      order by academic_period_code desc, window_type, unit_number nulls last, opens_at desc, grade_capture_window_id desc
      offset sanitized_offset
      limit sanitized_limit
    )
    select jsonb_build_object(
      'offset', sanitized_offset,
      'pageSize', sanitized_limit,
      'totalRows', counted.total_rows,
      'rows', coalesce(
        jsonb_agg(
          jsonb_build_object(
            'gradeCaptureWindowId', paged.grade_capture_window_id,
            'academicPeriod', jsonb_build_object(
              'academicPeriodId', paged.academic_period_id,
              'code', paged.academic_period_code,
              'name', paged.academic_period_name
            ),
            'unitNumber', paged.unit_number,
            'windowType', paged.window_type,
            'opensAt', paged.opens_at,
            'closesAt', paged.closes_at,
            'status', paged.status,
            'createdAt', paged.created_at,
            'openedAt', paged.opened_at,
            'closedAt', paged.closed_at,
            'createdByIdentifier', paged.created_by_identifier,
            'openedByIdentifier', paged.opened_by_identifier,
            'closedByIdentifier', paged.closed_by_identifier,
            'activeOfferingCount', paged.active_offering_count,
            'isActiveNow', (paged.status = 'OPEN' and statement_timestamp() between paged.opens_at and paged.closes_at),
            'canOpen', paged.status = 'DRAFT',
            'canClose', paged.status = 'OPEN',
            'canCancel', paged.status in ('DRAFT', 'OPEN')
          )
          order by paged.academic_period_code desc, paged.window_type, paged.unit_number nulls last, paged.opens_at desc, paged.grade_capture_window_id desc
        ),
        '[]'::jsonb
      )
    )
    from counted
    left join paged on true
    group by counted.total_rows
  );
end;
$$;

create or replace function public.list_grade_management_offerings(
  requested_academic_period_id uuid default null,
  requested_group_id uuid default null,
  requested_subject_id uuid default null,
  requested_teacher_identifier text default null,
  requested_academic_offering_id uuid default null,
  requested_window_status academic.grade_window_status default null,
  requested_offering_status academic.offering_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_grade_management_offerings(
    requested_academic_period_id,
    requested_group_id,
    requested_subject_id,
    requested_teacher_identifier,
    requested_academic_offering_id,
    requested_window_status,
    requested_offering_status,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.list_my_grade_management_offerings(
  requested_academic_period_id uuid default null,
  requested_window_status academic.grade_window_status default null,
  requested_offering_status academic.offering_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_my_grade_management_offerings(
    requested_academic_period_id,
    requested_window_status,
    requested_offering_status,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.get_grade_management_offering_detail(
  target_academic_offering_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.get_grade_management_offering_detail(target_academic_offering_id);
$$;

create or replace function public.get_grade_management_unit_grade_history(
  target_student_unit_grade_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.get_grade_management_unit_grade_history(target_student_unit_grade_id);
$$;

create or replace function public.get_grade_management_subject_result_history(
  target_subject_final_result_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.get_grade_management_subject_result_history(target_subject_final_result_id);
$$;

create or replace function public.list_grade_management_corrections(
  target_academic_offering_id uuid default null,
  target_student_unit_grade_id uuid default null,
  requested_status academic.grade_correction_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_grade_management_corrections(
    target_academic_offering_id,
    target_student_unit_grade_id,
    requested_status,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.list_grade_capture_windows(
  requested_academic_period_id uuid default null,
  requested_window_type academic.grade_window_type default null,
  requested_status academic.grade_window_status default null,
  requested_limit integer default 25,
  requested_offset integer default 0
)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select academic.list_grade_capture_windows(
    requested_academic_period_id,
    requested_window_type,
    requested_status,
    requested_limit,
    requested_offset
  );
$$;

create or replace function public.create_grade_capture_window(
  period_id uuid,
  unit smallint,
  kind academic.grade_window_type,
  opens timestamptz,
  closes timestamptz,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.create_grade_capture_window(period_id, unit, kind, opens, closes, operation_key, correlation);
$$;

create or replace function public.open_grade_capture_window(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.open_grade_capture_window(id, key, correlation);
$$;

create or replace function public.close_grade_capture_window(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.close_grade_capture_window(id, key, correlation);
$$;

create or replace function public.cancel_grade_capture_window(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.cancel_grade_capture_window(id, key, correlation);
$$;

create or replace function public.capture_student_unit_grade(
  offering_enrollment_id uuid,
  subject_unit_id uuid,
  raw_grade numeric,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.capture_student_unit_grade(offering_enrollment_id, subject_unit_id, raw_grade, operation_key, correlation);
$$;

create or replace function public.capture_bulk_unit_grades(
  items jsonb,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.capture_bulk_unit_grades(items, operation_key, correlation);
$$;

create or replace function public.review_student_unit_grade(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.review_student_unit_grade(id, key, correlation);
$$;

create or replace function public.finalize_student_unit_grade(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.finalize_student_unit_grade(id, key, correlation);
$$;

create or replace function public.cancel_student_unit_grade(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.cancel_student_unit_grade(id, key, correlation);
$$;

create or replace function public.calculate_subject_final_result(
  offering_enrollment_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.calculate_subject_final_result(offering_enrollment_id, operation_key, correlation);
$$;

create or replace function public.confirm_subject_final_result(
  result_id uuid,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.confirm_subject_final_result(result_id, operation_key, correlation);
$$;

create or replace function public.create_grade_correction(
  grade_id uuid,
  proposed numeric,
  reason academic.grade_correction_reason,
  operation_key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.create_grade_correction(grade_id, proposed, reason, operation_key, correlation);
$$;

create or replace function public.submit_grade_correction(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.submit_grade_correction(id, key, correlation);
$$;

create or replace function public.begin_grade_correction_review(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.begin_grade_correction_review(id, key, correlation);
$$;

create or replace function public.approve_grade_correction(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.approve_grade_correction(id, key, correlation);
$$;

create or replace function public.reject_grade_correction(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.reject_grade_correction(id, key, correlation);
$$;

create or replace function public.apply_grade_correction(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.apply_grade_correction(id, key, correlation);
$$;

create or replace function public.cancel_grade_correction(
  id uuid,
  key text,
  correlation uuid default null
)
returns table(entity_id uuid, status text)
language sql
security definer
set search_path=''
as $$
  select * from academic.cancel_grade_correction(id, key, correlation);
$$;

alter function academic.require_grade_management_application_context() owner to postgres;
alter function academic.require_grade_management_permissions(text[]) owner to postgres;
alter function academic.is_grade_management_teacher(uuid) owner to postgres;
alter function academic.require_grade_management_teacher_scope(uuid, uuid) owner to postgres;
alter function academic.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer) owner to postgres;
alter function academic.list_my_grade_management_offerings(uuid, academic.grade_window_status, academic.offering_status, integer, integer) owner to postgres;
alter function academic.get_grade_management_offering_detail(uuid) owner to postgres;
alter function academic.get_grade_management_unit_grade_history(uuid) owner to postgres;
alter function academic.get_grade_management_subject_result_history(uuid) owner to postgres;
alter function academic.list_grade_management_corrections(uuid, uuid, academic.grade_correction_status, integer, integer) owner to postgres;
alter function academic.list_grade_capture_windows(uuid, academic.grade_window_type, academic.grade_window_status, integer, integer) owner to postgres;

alter function public.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer) owner to postgres;
alter function public.list_my_grade_management_offerings(uuid, academic.grade_window_status, academic.offering_status, integer, integer) owner to postgres;
alter function public.get_grade_management_offering_detail(uuid) owner to postgres;
alter function public.get_grade_management_unit_grade_history(uuid) owner to postgres;
alter function public.get_grade_management_subject_result_history(uuid) owner to postgres;
alter function public.list_grade_management_corrections(uuid, uuid, academic.grade_correction_status, integer, integer) owner to postgres;
alter function public.list_grade_capture_windows(uuid, academic.grade_window_type, academic.grade_window_status, integer, integer) owner to postgres;
alter function public.create_grade_capture_window(uuid, smallint, academic.grade_window_type, timestamptz, timestamptz, text, uuid) owner to postgres;
alter function public.open_grade_capture_window(uuid, text, uuid) owner to postgres;
alter function public.close_grade_capture_window(uuid, text, uuid) owner to postgres;
alter function public.cancel_grade_capture_window(uuid, text, uuid) owner to postgres;
alter function public.capture_student_unit_grade(uuid, uuid, numeric, text, uuid) owner to postgres;
alter function public.capture_bulk_unit_grades(jsonb, text, uuid) owner to postgres;
alter function public.review_student_unit_grade(uuid, text, uuid) owner to postgres;
alter function public.finalize_student_unit_grade(uuid, text, uuid) owner to postgres;
alter function public.cancel_student_unit_grade(uuid, text, uuid) owner to postgres;
alter function public.calculate_subject_final_result(uuid, text, uuid) owner to postgres;
alter function public.confirm_subject_final_result(uuid, text, uuid) owner to postgres;
alter function public.create_grade_correction(uuid, numeric, academic.grade_correction_reason, text, uuid) owner to postgres;
alter function public.submit_grade_correction(uuid, text, uuid) owner to postgres;
alter function public.begin_grade_correction_review(uuid, text, uuid) owner to postgres;
alter function public.approve_grade_correction(uuid, text, uuid) owner to postgres;
alter function public.reject_grade_correction(uuid, text, uuid) owner to postgres;
alter function public.apply_grade_correction(uuid, text, uuid) owner to postgres;
alter function public.cancel_grade_correction(uuid, text, uuid) owner to postgres;

revoke all on function academic.require_grade_management_application_context() from public, anon, authenticated;
revoke all on function academic.require_grade_management_permissions(text[]) from public, anon, authenticated;
revoke all on function academic.is_grade_management_teacher(uuid) from public, anon, authenticated;
revoke all on function academic.require_grade_management_teacher_scope(uuid, uuid) from public, anon, authenticated;
revoke all on function academic.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer) from public, anon, authenticated;
revoke all on function academic.list_my_grade_management_offerings(uuid, academic.grade_window_status, academic.offering_status, integer, integer) from public, anon, authenticated;
revoke all on function academic.get_grade_management_offering_detail(uuid) from public, anon, authenticated;
revoke all on function academic.get_grade_management_unit_grade_history(uuid) from public, anon, authenticated;
revoke all on function academic.get_grade_management_subject_result_history(uuid) from public, anon, authenticated;
revoke all on function academic.list_grade_management_corrections(uuid, uuid, academic.grade_correction_status, integer, integer) from public, anon, authenticated;
revoke all on function academic.list_grade_capture_windows(uuid, academic.grade_window_type, academic.grade_window_status, integer, integer) from public, anon, authenticated;

revoke all on function public.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer) from public, anon;
revoke all on function public.list_my_grade_management_offerings(uuid, academic.grade_window_status, academic.offering_status, integer, integer) from public, anon;
revoke all on function public.get_grade_management_offering_detail(uuid) from public, anon;
revoke all on function public.get_grade_management_unit_grade_history(uuid) from public, anon;
revoke all on function public.get_grade_management_subject_result_history(uuid) from public, anon;
revoke all on function public.list_grade_management_corrections(uuid, uuid, academic.grade_correction_status, integer, integer) from public, anon;
revoke all on function public.list_grade_capture_windows(uuid, academic.grade_window_type, academic.grade_window_status, integer, integer) from public, anon;
revoke all on function public.create_grade_capture_window(uuid, smallint, academic.grade_window_type, timestamptz, timestamptz, text, uuid) from public, anon;
revoke all on function public.open_grade_capture_window(uuid, text, uuid) from public, anon;
revoke all on function public.close_grade_capture_window(uuid, text, uuid) from public, anon;
revoke all on function public.cancel_grade_capture_window(uuid, text, uuid) from public, anon;
revoke all on function public.capture_student_unit_grade(uuid, uuid, numeric, text, uuid) from public, anon;
revoke all on function public.capture_bulk_unit_grades(jsonb, text, uuid) from public, anon;
revoke all on function public.review_student_unit_grade(uuid, text, uuid) from public, anon;
revoke all on function public.finalize_student_unit_grade(uuid, text, uuid) from public, anon;
revoke all on function public.cancel_student_unit_grade(uuid, text, uuid) from public, anon;
revoke all on function public.calculate_subject_final_result(uuid, text, uuid) from public, anon;
revoke all on function public.confirm_subject_final_result(uuid, text, uuid) from public, anon;
revoke all on function public.create_grade_correction(uuid, numeric, academic.grade_correction_reason, text, uuid) from public, anon;
revoke all on function public.submit_grade_correction(uuid, text, uuid) from public, anon;
revoke all on function public.begin_grade_correction_review(uuid, text, uuid) from public, anon;
revoke all on function public.approve_grade_correction(uuid, text, uuid) from public, anon;
revoke all on function public.reject_grade_correction(uuid, text, uuid) from public, anon;
revoke all on function public.apply_grade_correction(uuid, text, uuid) from public, anon;
revoke all on function public.cancel_grade_correction(uuid, text, uuid) from public, anon;

grant execute on function public.list_grade_management_offerings(uuid, uuid, uuid, text, uuid, academic.grade_window_status, academic.offering_status, integer, integer) to authenticated;
grant execute on function public.list_my_grade_management_offerings(uuid, academic.grade_window_status, academic.offering_status, integer, integer) to authenticated;
grant execute on function public.get_grade_management_offering_detail(uuid) to authenticated;
grant execute on function public.get_grade_management_unit_grade_history(uuid) to authenticated;
grant execute on function public.get_grade_management_subject_result_history(uuid) to authenticated;
grant execute on function public.list_grade_management_corrections(uuid, uuid, academic.grade_correction_status, integer, integer) to authenticated;
grant execute on function public.list_grade_capture_windows(uuid, academic.grade_window_type, academic.grade_window_status, integer, integer) to authenticated;
grant execute on function public.create_grade_capture_window(uuid, smallint, academic.grade_window_type, timestamptz, timestamptz, text, uuid) to authenticated;
grant execute on function public.open_grade_capture_window(uuid, text, uuid) to authenticated;
grant execute on function public.close_grade_capture_window(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_grade_capture_window(uuid, text, uuid) to authenticated;
grant execute on function public.capture_student_unit_grade(uuid, uuid, numeric, text, uuid) to authenticated;
grant execute on function public.capture_bulk_unit_grades(jsonb, text, uuid) to authenticated;
grant execute on function public.review_student_unit_grade(uuid, text, uuid) to authenticated;
grant execute on function public.finalize_student_unit_grade(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_student_unit_grade(uuid, text, uuid) to authenticated;
grant execute on function public.calculate_subject_final_result(uuid, text, uuid) to authenticated;
grant execute on function public.confirm_subject_final_result(uuid, text, uuid) to authenticated;
grant execute on function public.create_grade_correction(uuid, numeric, academic.grade_correction_reason, text, uuid) to authenticated;
grant execute on function public.submit_grade_correction(uuid, text, uuid) to authenticated;
grant execute on function public.begin_grade_correction_review(uuid, text, uuid) to authenticated;
grant execute on function public.approve_grade_correction(uuid, text, uuid) to authenticated;
grant execute on function public.reject_grade_correction(uuid, text, uuid) to authenticated;
grant execute on function public.apply_grade_correction(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_grade_correction(uuid, text, uuid) to authenticated;

commit;
