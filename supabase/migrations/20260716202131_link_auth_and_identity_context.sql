begin;

alter table core.accounts
add constraint accounts_auth_user_id_fkey
foreign key (auth_user_id)
references auth.users (id)
on delete restrict;

comment on column core.accounts.auth_user_id is
  'Nullable link to Supabase Auth. Provisioning and lifecycle operations require a future controlled service.';

create or replace function core.current_auth_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function core.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select accounts.id
  from core.accounts
  where accounts.auth_user_id = (select auth.uid())
    and accounts.account_status <> 'DISABLED'::core.account_status;
$$;

create or replace function core.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select accounts.person_id
  from core.accounts
  where accounts.id = (select core.current_account_id());
$$;

create or replace function core.current_account_status()
returns core.account_status
language sql
stable
security definer
set search_path = ''
as $$
  select accounts.account_status
  from core.accounts
  where accounts.auth_user_id = (select auth.uid());
$$;

create or replace function core.current_role_codes()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct roles.code order by roles.code),
    array[]::text[]
  )
  from core.account_roles
  join core.roles
    on roles.id = account_roles.role_id
  where account_roles.account_id = (select core.current_account_id())
    and account_roles.revoked_at is null
    and roles.is_active;
$$;

alter function core.current_auth_user_id() owner to postgres;
alter function core.current_account_id() owner to postgres;
alter function core.current_person_id() owner to postgres;
alter function core.current_account_status() owner to postgres;
alter function core.current_role_codes() owner to postgres;

revoke execute on function core.current_auth_user_id() from public, anon, authenticated;
revoke execute on function core.current_account_id() from public, anon, authenticated;
revoke execute on function core.current_person_id() from public, anon, authenticated;
revoke execute on function core.current_account_status() from public, anon, authenticated;
revoke execute on function core.current_role_codes() from public, anon, authenticated;

grant usage on schema core to authenticated;
grant execute on function core.current_auth_user_id() to authenticated;
grant execute on function core.current_account_id() to authenticated;
grant execute on function core.current_person_id() to authenticated;
grant execute on function core.current_account_status() to authenticated;
grant execute on function core.current_role_codes() to authenticated;

commit;
