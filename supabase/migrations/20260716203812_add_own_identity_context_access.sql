begin;

create or replace function core.get_current_identity_context()
returns table (
  auth_user_id uuid,
  account_id uuid,
  person_id uuid,
  account_status core.account_status,
  role_codes text[],
  allowed_applications text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with identity as (
    select
      core.current_auth_user_id() as auth_user_id,
      core.current_account_id() as account_id,
      core.current_person_id() as person_id,
      core.current_account_status() as account_status
  ),
  effective_roles as (
    select
      identity.*,
      case
        when identity.account_status = 'ACTIVE'::core.account_status
          then core.current_role_codes()
        else array[]::text[]
      end as role_codes
    from identity
  )
  select
    effective_roles.auth_user_id,
    effective_roles.account_id,
    effective_roles.person_id,
    effective_roles.account_status,
    effective_roles.role_codes,
    case
      when effective_roles.account_status <> 'ACTIVE'::core.account_status
        then array[]::text[]
      else array_remove(
        array[
          case
            when effective_roles.role_codes && array[
              'ASPIRANTE',
              'ALUMNO',
              'TUTOR',
              'DOCENTE'
            ]::text[]
              then 'PORTAL_ESCOLAR'
          end,
          case
            when effective_roles.role_codes && array[
              'SUPERADMIN',
              'ADMINISTRATIVO',
              'CONTROL_ESCOLAR',
              'CAJA'
            ]::text[]
              then 'SISTEMA_ADMINISTRATIVO'
          end
        ]::text[],
        null
      )
    end as allowed_applications
  from effective_roles;
$$;

alter function core.get_current_identity_context() owner to postgres;

revoke execute on function core.get_current_identity_context()
from public, anon, authenticated;

grant execute on function core.get_current_identity_context()
to authenticated;

create policy accounts_select_own_active_context
on core.accounts
for select
to authenticated
using (
  accounts.id = (select core.current_account_id())
  and accounts.account_status = 'ACTIVE'::core.account_status
);

create policy people_select_own_active_context
on core.people
for select
to authenticated
using (
  people.id = (select core.current_person_id())
  and (select core.current_account_status()) = 'ACTIVE'::core.account_status
);

create policy account_roles_select_own_active_context
on core.account_roles
for select
to authenticated
using (
  account_roles.account_id = (select core.current_account_id())
  and account_roles.revoked_at is null
  and (select core.current_account_status()) = 'ACTIVE'::core.account_status
);

create policy roles_select_own_active_context
on core.roles
for select
to authenticated
using (
  roles.is_active
  and roles.code = any (core.current_role_codes())
  and (select core.current_account_status()) = 'ACTIVE'::core.account_status
);

commit;
