begin;

alter table academic.guardian_access_scopes
  add column if not exists is_system_scope boolean;

select set_config('academic.guardian_portal_controlled_mutation', 'on', true);

update academic.guardian_access_scopes
set
  is_system_scope = case
    when code = 'STANDARD_ACADEMIC_READ' then true
    else coalesce(is_system_scope, false)
  end,
  created_by_account_id = case
    when code = 'STANDARD_ACADEMIC_READ' then null
    else created_by_account_id
  end,
  updated_at = now()
where is_system_scope is null
   or code = 'STANDARD_ACADEMIC_READ';

alter table academic.guardian_access_scopes
  alter column is_system_scope set default false;

alter table academic.guardian_access_scopes
  alter column is_system_scope set not null;

alter table academic.guardian_access_scopes
  drop constraint if exists guardian_access_scopes_system_traceability_check;

alter table academic.guardian_access_scopes
  add constraint guardian_access_scopes_system_traceability_check
  check (
    (is_system_scope = true and created_by_account_id is null)
    or
    (is_system_scope = false and created_by_account_id is not null)
  );

create or replace function academic.guard_guardian_history()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if tg_table_name = 'guardian_access_scopes' then
      if old.is_system_scope then
        raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
      end if;
    end if;
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if current_setting('academic.guardian_portal_controlled_mutation', true) = 'on' then
    return new;
  end if;
  if tg_table_name in ('guardian_student_link_history', 'guardian_portal_events') then
    raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
  end if;
  if tg_table_name = 'guardian_portal_commands' then
    if old.status = 'COMPLETED' and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    return new;
  end if;
  if tg_table_name = 'guardian_access_scopes' then
    if new.is_system_scope is distinct from old.is_system_scope then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    if old.is_system_scope and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    if old.status = 'RETIRED' and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
  end if;
  if tg_table_name = 'guardian_student_link_requests' then
    if old.status in ('LINKED','REJECTED','CANCELLED','EXPIRED') and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
  end if;
  if tg_table_name = 'guardian_student_links' then
    if old.status in ('REVOKED','EXPIRED','CANCELLED') and new is distinct from old then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
    if (new.guardian_account_id, new.student_record_id, new.source_request_id, new.relationship_type)
      is distinct from
      (old.guardian_account_id, old.student_record_id, old.source_request_id, old.relationship_type) then
      raise exception 'GUARDIAN_PORTAL_IMMUTABLE';
    end if;
  end if;
  return new;
end$$;

create or replace function academic.get_my_linked_students()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with base as (
  select *
  from core.get_current_identity_context() identity_context
  where identity_context.session_valid
    and core.is_current_session_version_valid()
    and 'PORTAL_ESCOLAR' = any(identity_context.allowed_applications)
),
guardian as (
  select a.id as account_id
  from base
  join core.accounts a on a.auth_user_id = auth.uid()
  where a.account_status = 'ACTIVE'
    and exists (
      select 1 from core.account_roles ar
      join core.roles r on r.id = ar.role_id and r.is_active
      where ar.account_id = a.id and ar.revoked_at is null and r.code = 'TUTOR'
    )
),
eligible_links as (
  select
    links.id,
    links.relationship_type,
    links.is_primary,
    links.valid_from,
    links.valid_until,
    links.created_at,
    records.status as student_status,
    records.institutional_student_code,
    records.current_semester_number,
    scopes.code as scope_code
  from guardian
  join academic.guardian_student_links links on links.guardian_account_id = guardian.account_id
  join academic.student_records records on records.id = links.student_record_id
  join academic.guardian_access_scopes scopes on scopes.id = links.access_scope_id
  where links.status = 'ACTIVE'
    and links.valid_from <= statement_timestamp()
    and (links.valid_until is null or links.valid_until > statement_timestamp())
    and scopes.status = 'ACTIVE'
)
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'linkId', eligible_links.id,
      'linkStatus', 'ACTIVE',
      'relationshipType', eligible_links.relationship_type,
      'isPrimary', eligible_links.is_primary,
      'validFrom', eligible_links.valid_from,
      'validUntil', eligible_links.valid_until,
      'studentStatus', eligible_links.student_status,
      'institutionalStudentCode', eligible_links.institutional_student_code,
      'currentSemesterNumber', eligible_links.current_semester_number,
      'scopeCode', eligible_links.scope_code
    )
    order by eligible_links.institutional_student_code nulls last, eligible_links.created_at desc
  ),
  '[]'::jsonb
)
from eligible_links
$$;

create or replace function academic.get_my_guardian_portal_overview()
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
with linked as (
  select academic.get_my_linked_students() as payload
)
select jsonb_build_object(
  'linkedStudents', linked.payload,
  'totalLinkedStudents', jsonb_array_length(linked.payload)
)
from linked
$$;

revoke all on function academic.guardian_portal_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function academic.valid_guardian_link_request_transition(academic.guardian_link_request_status, academic.guardian_link_request_status) from public, anon, authenticated;
revoke all on function academic.valid_guardian_link_transition(academic.guardian_link_status, academic.guardian_link_status) from public, anon, authenticated;
revoke all on function academic.require_guardian_admin_permission(text) from public, anon, authenticated;
revoke all on function academic.begin_guardian_portal_command(uuid, academic.guardian_portal_command_type, text, jsonb) from public, anon, authenticated;
revoke all on function academic.complete_guardian_portal_command(uuid, academic.guardian_portal_command_type, text, academic.guardian_portal_entity_type, uuid) from public, anon, authenticated;
revoke all on function academic.append_guardian_portal_event(uuid, uuid, uuid, academic.guardian_portal_entity_type, uuid, academic.guardian_portal_event_type, uuid, text, text, academic.guardian_link_reason_code, text, uuid) from public, anon, authenticated;
revoke all on function academic.assert_guardian_request_preconditions(uuid, uuid) from public, anon, authenticated;
revoke all on function academic.create_guardian_link_request(uuid, uuid, academic.guardian_relationship_type, academic.guardian_request_source, academic.guardian_request_review_status, academic.guardian_request_reason_code, text, uuid) from public, anon, authenticated;
revoke all on function academic.change_guardian_link_request_status(uuid, academic.guardian_link_request_status, academic.guardian_portal_command_type, academic.guardian_portal_event_type, text, academic.guardian_request_reason_code, text, uuid) from public, anon, authenticated;
revoke all on function academic.submit_guardian_link_request(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.begin_guardian_link_review(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.approve_guardian_link_request(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.reject_guardian_link_request(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.cancel_guardian_link_request(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.expire_guardian_link_request(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.create_guardian_student_link(uuid, text, timestamptz, timestamptz, boolean, text, uuid) from public, anon, authenticated;
revoke all on function academic.change_guardian_student_link_status(uuid, academic.guardian_link_status, academic.guardian_portal_command_type, academic.guardian_portal_event_type, text, academic.guardian_link_reason_code, text, uuid) from public, anon, authenticated;
revoke all on function academic.activate_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.suspend_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.reactivate_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.revoke_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.expire_guardian_student_link(uuid, text, uuid) from public, anon, authenticated;
revoke all on function academic.get_guardian_scope(uuid) from public, anon, authenticated;

commit;
