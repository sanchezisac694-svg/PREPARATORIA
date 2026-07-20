begin;

create type core.institutional_identifier_type as enum (
  'NUMERO_CONTROL',
  'MATRICULA',
  'EMPLOYEE_ID',
  'ADMINISTRATIVE_ID'
);

create function core.normalize_institutional_identifier(input_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case
    when upper(btrim(input_value)) ~ '^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$'
      then upper(btrim(input_value))
    else null
  end;
$$;

alter function core.normalize_institutional_identifier(text) owner to postgres;
revoke execute on function core.normalize_institutional_identifier(text)
  from public, anon, authenticated;

alter table core.accounts
  add column institutional_identifier_type core.institutional_identifier_type,
  add column institutional_identifier text,
  add column identifier_assigned_at timestamptz,
  add column identifier_changed_at timestamptz,
  add constraint accounts_institutional_identifier_complete check (
    (
      institutional_identifier_type is null
      and institutional_identifier is null
      and identifier_assigned_at is null
      and identifier_changed_at is null
    )
    or (
      institutional_identifier_type is not null
      and institutional_identifier is not null
      and identifier_assigned_at is not null
      and identifier_changed_at is not null
    )
  ),
  add constraint accounts_institutional_identifier_canonical check (
    institutional_identifier is null
    or (
      core.normalize_institutional_identifier(institutional_identifier) is not null
      and institutional_identifier =
        core.normalize_institutional_identifier(institutional_identifier)
    )
  ),
  add constraint accounts_identifier_timestamps_check check (
    identifier_assigned_at is null
    or (
      identifier_assigned_at >= created_at
      and identifier_changed_at >= identifier_assigned_at
      and identifier_changed_at <= updated_at + interval '5 minutes'
    )
  );

create unique index accounts_institutional_identifier_key
  on core.accounts (institutional_identifier)
  where institutional_identifier is not null;

revoke all on core.accounts from public, anon, authenticated;

commit;
