begin;

create function public.get_current_identity_context()
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
security invoker
set search_path = ''
as $$
  select * from core.get_current_identity_context();
$$;

alter function public.get_current_identity_context() owner to postgres;
revoke execute on function public.get_current_identity_context()
  from public, anon, authenticated;
grant execute on function public.get_current_identity_context()
  to authenticated;

commit;
