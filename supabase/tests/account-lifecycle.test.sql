begin;

select plan(27);

select has_table('core', 'account_lifecycle_events', 'existe la auditoría de ciclo de vida');
select ok(
  (select relrowsecurity
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'core' and c.relname = 'account_lifecycle_events'),
  'RLS está habilitada'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'core' and tablename = 'account_lifecycle_events'),
  0,
  'la auditoría comienza sin políticas'
);
select is(
  (select count(*)::integer
   from information_schema.role_table_grants
   where table_schema = 'core'
     and table_name = 'account_lifecycle_events'
     and grantee in ('PUBLIC', 'anon', 'authenticated')),
  0,
  'no existen grants para aplicaciones'
);

insert into auth.users (
  instance_id, id, aud, role, encrypted_password, email,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '71000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', '', 'synthetic-lifecycle@example.invalid',
  '{}', '{}', now(), now()
);

insert into core.people (id)
values
  ('72000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002'),
  ('72000000-0000-0000-0000-000000000003'),
  ('72000000-0000-0000-0000-000000000004'),
  ('72000000-0000-0000-0000-000000000005'),
  ('72000000-0000-0000-0000-000000000006');

insert into core.accounts (id, person_id, auth_user_id, account_status)
values
  (
    '73000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    null, 'ACTIVE'
  ),
  (
    '73000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001', 'PENDING_INVITATION'
  ),
  (
    '73000000-0000-0000-0000-000000000003',
    '72000000-0000-0000-0000-000000000003',
    null, 'ACTIVE'
  ),
  (
    '73000000-0000-0000-0000-000000000004',
    '72000000-0000-0000-0000-000000000004',
    null, 'PENDING_INVITATION'
  ),
  (
    '73000000-0000-0000-0000-000000000005',
    '72000000-0000-0000-0000-000000000005',
    null, 'ACTIVE'
  ),
  (
    '73000000-0000-0000-0000-000000000006',
    '72000000-0000-0000-0000-000000000006',
    null, 'PENDING_INVITATION'
  );

select set_config('core.account_lifecycle_transition_allowed', 'on', true);
update core.accounts set account_status = 'DISABLED', disabled_at = now()
where id = '73000000-0000-0000-0000-000000000005';
select set_config('core.account_lifecycle_transition_allowed', 'off', true);

insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000001', id
from core.roles where code = 'SUPERADMIN';
insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000002', id
from core.roles where code = 'ALUMNO';
insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000003', id
from core.roles where code = 'CAJA';
insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000004', id
from core.roles where code = 'ASPIRANTE';
insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000005', id
from core.roles where code = 'ADMINISTRATIVO';
insert into core.account_roles (account_id, role_id)
select '73000000-0000-0000-0000-000000000006', id
from core.roles where code = 'ASPIRANTE';

select lives_ok(
  $$select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000002',
    now() + interval '1 day',
    '74000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'prepara una invitación'
);
select lives_ok(
  $$select core.mark_account_invitation_issued(
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'confirma la invitación emitida'
);
select lives_ok(
  $$select core.activate_account(
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000003',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'activa una cuenta vinculada'
);
select is(
  (select account_status::text from core.accounts
   where id = '73000000-0000-0000-0000-000000000002'),
  'ACTIVE',
  'la cuenta queda ACTIVE'
);
select lives_ok(
  $$select core.suspend_account(
    '73000000-0000-0000-0000-000000000002',
    'ADMINISTRATIVE_SUSPENSION',
    '74000000-0000-0000-0000-000000000004',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.reactivate_account(
    '73000000-0000-0000-0000-000000000002', 'ACTIVE',
    '74000000-0000-0000-0000-000000000005',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.block_account(
    '73000000-0000-0000-0000-000000000002', 'SECURITY_REVIEW',
    '74000000-0000-0000-0000-000000000006',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.unblock_account(
    '73000000-0000-0000-0000-000000000002', 'ACTIVE',
    '74000000-0000-0000-0000-000000000007',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.disable_account(
    '73000000-0000-0000-0000-000000000002', 'INSTITUTIONAL_REQUEST',
    '74000000-0000-0000-0000-000000000008',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.reactivate_account(
    '73000000-0000-0000-0000-000000000002', 'PENDING_ACTIVATION',
    '74000000-0000-0000-0000-000000000009',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'suspende, reactiva, bloquea, desbloquea, deshabilita y rehabilita'
);
select throws_ok(
  $$select core.activate_account(
    '73000000-0000-0000-0000-000000000004',
    '74000000-0000-0000-0000-000000000010',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'INVALID_ACCOUNT_TRANSITION',
  'rechaza activación desde estado inválido y sin vínculo'
);
select throws_ok(
  $$select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000004',
    now() + interval '1 day',
    '74000000-0000-0000-0000-000000000011',
    '73000000-0000-0000-0000-000000000003'
  )$$,
  'P0001',
  'ACTOR_NOT_AUTHORIZED',
  'rechaza actor sin rol permitido'
);
select lives_ok(
  $$select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000004',
    now() + interval '1 day',
    '74000000-0000-0000-0000-000000000012',
    '73000000-0000-0000-0000-000000000001'
  );
  select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000004',
    now() + interval '1 day',
    '74000000-0000-0000-0000-000000000012',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'un reintento idempotente no duplica eventos'
);
select is(
  (select count(*)::integer from core.account_lifecycle_events
   where idempotency_key = '74000000-0000-0000-0000-000000000012'),
  1,
  'la clave idempotente produce un evento'
);
select throws_ok(
  $$select core.mark_account_invitation_issued(
    '73000000-0000-0000-0000-000000000004',
    '74000000-0000-0000-0000-000000000012',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'IDEMPOTENCY_CONFLICT',
  'rechaza la misma clave con otro comando'
);
select lives_ok(
  $$select core.mark_account_invitation_issued(
    '73000000-0000-0000-0000-000000000004',
    '74000000-0000-0000-0000-000000000013',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'lleva una cuenta sin vínculo a PENDING_ACTIVATION'
);
select throws_ok(
  $$select core.activate_account(
    '73000000-0000-0000-0000-000000000004',
    '74000000-0000-0000-0000-000000000014',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'AUTH_USER_NOT_LINKED',
  'rechaza activación sin auth_user_id'
);
update core.accounts
set invitation_prepared_at = created_at,
    invitation_expires_at = created_at + interval '1 millisecond'
where id = '73000000-0000-0000-0000-000000000002';
select throws_ok(
  $$select core.activate_account(
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000015',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'P0001',
  'INVITATION_EXPIRED',
  'rechaza activación con invitación expirada'
);
select lives_ok(
  $$select core.cancel_account_activation(
    '73000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000016',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'cancela una activación pendiente'
);
update core.accounts
set invitation_prepared_at = created_at,
    invitation_expires_at = created_at + interval '1 millisecond'
where id = '73000000-0000-0000-0000-000000000006';
select lives_ok(
  $$select core.expire_account_invitation(
    '73000000-0000-0000-0000-000000000006',
    '74000000-0000-0000-0000-000000000017',
    '73000000-0000-0000-0000-000000000001'
  )$$,
  'registra la expiración lógica'
);
select throws_ok(
  $$select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000006', now() + interval '1 day',
    '74000000-0000-0000-0000-000000000018',
    '79999999-9999-9999-9999-999999999999'
  )$$,
  'P0001',
  'ACTOR_NOT_AUTHORIZED',
  'rechaza actor inexistente'
);
select throws_ok(
  $$select core.prepare_account_invitation(
    '73000000-0000-0000-0000-000000000006', now() + interval '1 day',
    '74000000-0000-0000-0000-000000000019',
    '73000000-0000-0000-0000-000000000005'
  )$$,
  'P0001',
  'ACTOR_NOT_AUTHORIZED',
  'rechaza actor administrativo inactivo'
);
select throws_ok(
  $$update core.accounts set account_status = 'ACTIVE'
    where id = '73000000-0000-0000-0000-000000000006'$$,
  'P0001',
  'CONTROLLED_ACCOUNT_LIFECYCLE_TRANSITION_REQUIRED',
  'rechaza una transición directa basada en estado obsoleto'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'core.activate_account(uuid,uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated no ejecuta funciones operativas'
);
select throws_ok(
  $$update core.account_lifecycle_events set safe_reason_summary = null$$,
  'P0001',
  'ACCOUNT_LIFECYCLE_AUDIT_APPEND_ONLY',
  'rechaza UPDATE de auditoría'
);
select throws_ok(
  $$delete from core.account_lifecycle_events$$,
  'P0001',
  'ACCOUNT_LIFECYCLE_AUDIT_APPEND_ONLY',
  'rechaza DELETE de auditoría'
);

savepoint lifecycle_reversal;
drop table core.account_lifecycle_events;
select hasnt_table(
  'core',
  'account_lifecycle_events',
  'la reversión local puede retirar la auditoría'
);
rollback to savepoint lifecycle_reversal;
select has_table(
  'core',
  'account_lifecycle_events',
  'el rollback restaura la auditoría'
);

select * from finish();
rollback;
