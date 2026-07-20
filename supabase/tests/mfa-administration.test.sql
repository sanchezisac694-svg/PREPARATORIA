begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

select has_table('core','mfa_recovery_requests','1 solicitudes');
select has_table('core','mfa_recovery_factor_operations','2 operaciones');
select has_table('core','mfa_administrative_security_events','3 eventos');
select enum_has_labels('core','mfa_recovery_status',array[
  'REQUESTED','PENDING_IDENTITY_VERIFICATION','IDENTITY_VERIFIED','APPROVED',
  'EXECUTION_PENDING','EXECUTION_IN_PROGRESS','REENROLLMENT_REQUIRED',
  'REENROLLMENT_IN_PROGRESS','COMPLETED','CANCELLED','EXPIRED',
  'RETRYABLE_FAILURE','TERMINAL_FAILURE','RECONCILIATION_REQUIRED'],'4 estados exactos');
select enum_has_labels('core','mfa_identity_verification_method',array[
  'IN_PERSON_WITH_INSTITUTIONAL_RECORD','IN_PERSON_WITH_GOVERNMENT_ID',
  'VERIFIED_BY_CONTROL_ESCOLAR_RECORDS','VERIFIED_BY_AUTHORIZED_GUARDIAN',
  'OTHER_APPROVED_INSTITUTIONAL_PROCEDURE'],'5 métodos exactos');
select enum_has_labels('core','mfa_recovery_scope',array[
  'DELETE_ALL_VERIFIED_TOTP_FACTORS','DELETE_SELECTED_COMPROMISED_FACTORS'],'6 alcances');
select has_pk('core','mfa_recovery_requests','7 PK solicitudes');
select has_pk('core','mfa_recovery_factor_operations','8 PK operaciones');
select has_pk('core','mfa_administrative_security_events','9 PK eventos');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='mfa_recovery_requests'),'10 RLS solicitudes');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='mfa_recovery_factor_operations'),'11 RLS operaciones');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='mfa_administrative_security_events'),'12 RLS eventos');
select is((select count(*)::integer from pg_policies where schemaname='core'
  and tablename like 'mfa_%'),0,'13 cero policies');
select is((select count(*)::integer from information_schema.role_table_grants
  where table_schema='core' and table_name like 'mfa_%'
  and grantee in ('PUBLIC','anon','authenticated')),0,'14 cero grants');
select has_function('core','request_mfa_recovery','15 solicitar');
select has_function('core','record_mfa_identity_verification','16 verificar');
select has_function('core','approve_mfa_recovery','17 aprobar');
select has_function('core','begin_mfa_recovery_execution','18 ejecutar');
select has_function('core','record_mfa_factor_operation','19 registrar factor');
select has_function('core','complete_mfa_factor_operation','20 completar factor');
select has_function('core','mark_mfa_reenrollment_required','21 exigir reenrolamiento');
select has_function('core','complete_mfa_recovery','22 completar');
select has_function('core','mark_mfa_recovery_failure','23 fallo');
select has_function('core','mark_mfa_recovery_reconciliation_required','24 reconciliar');
select has_function('core','cancel_mfa_recovery','25 cancelar');
select is(core.mfa_recovery_transition_allowed('REQUESTED','PENDING_IDENTITY_VERIFICATION'),true,'26 transición válida');
select is(core.mfa_recovery_transition_allowed('REQUESTED','COMPLETED'),false,'27 salto rechazado');
select is(core.mfa_recovery_transition_allowed('COMPLETED','REQUESTED'),false,'28 terminal');
select is(core.mfa_recovery_transition_allowed('REENROLLMENT_IN_PROGRESS','COMPLETED'),true,'29 cierre válido');
select is(core.mfa_recovery_transition_allowed('RETRYABLE_FAILURE','EXECUTION_PENDING'),true,'30 retry válido');

insert into core.people(id,status) values
('e1000000-0000-4000-8000-000000000001','ACTIVE'),
('e1000000-0000-4000-8000-000000000002','ACTIVE'),
('e1000000-0000-4000-8000-000000000003','ACTIVE'),
('e1000000-0000-4000-8000-000000000004','ACTIVE');
insert into core.accounts(id,person_id,account_status) values
('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','ACTIVE'),
('e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','ACTIVE'),
('e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','ACTIVE'),
('e2000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000004','ACTIVE');
insert into core.account_roles(account_id,role_id,assigned_by)
select 'e2000000-0000-4000-8000-000000000001'::uuid,id,null::uuid from core.roles where code='SUPERADMIN'
union all select 'e2000000-0000-4000-8000-000000000002'::uuid,id,null::uuid from core.roles where code='ADMINISTRATIVO'
union all select 'e2000000-0000-4000-8000-000000000003'::uuid,id,null::uuid from core.roles where code='CAJA'
union all select 'e2000000-0000-4000-8000-000000000004'::uuid,id,null::uuid from core.roles where code='ALUMNO';
insert into core.account_mfa_compliance(
  account_id,requirement_level,status,verified_factor_count,achieved_at
) values (
  'e2000000-0000-4000-8000-000000000004','REQUIRED','COMPLIANT',2,statement_timestamp()
);

select lives_ok($$select core.request_mfa_recovery(
  'e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001',
  'LOST_ALL_FACTORS','request-key-001','e3000000-0000-4000-8000-000000000001','aal2')$$,
  '31 solicitud válida');
select is((select status::text from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'PENDING_IDENTITY_VERIFICATION','32 identidad pendiente');
select lives_ok($$select core.request_mfa_recovery(
  'e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001',
  'LOST_ALL_FACTORS','request-key-001','e3000000-0000-4000-8000-000000000001','aal2')$$,
  '33 solicitud idempotente');
select throws_ok($$select core.request_mfa_recovery(
  'e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000001',
  'SECURITY_INCIDENT','request-key-001','e3000000-0000-4000-8000-000000000001','aal2')$$,
  'P0001','IDEMPOTENCY_CONFLICT','34 conflicto idempotente');
select throws_ok($$select core.request_mfa_recovery(
  'e2000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000003',
  'LOST_ALL_FACTORS','request-key-002',null,'aal2')$$,
  'P0001','ACTOR_NOT_AUTHORIZED','35 CAJA rechazado');
select throws_ok($$select core.record_mfa_identity_verification(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000001','IN_PERSON_WITH_INSTITUTIONAL_RECORD',
  'verify-key-001','aal1')$$,'P0001','ACTOR_NOT_AUTHORIZED','36 AAL1 rechazado');
select lives_ok($$select core.record_mfa_identity_verification(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000001','IN_PERSON_WITH_INSTITUTIONAL_RECORD',
  'verify-key-001','aal2')$$,'37 verificación válida');
select is((select status::text from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'IDENTITY_VERIFIED','38 identidad verificada');
select throws_ok($$select core.approve_mfa_recovery(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000001','approval-key-001',now()+interval '1 hour','aal2')$$,
  'P0001','REQUESTER_APPROVER_CONFLICT','39 autoaprobación rechazada');
select lives_ok($$select core.approve_mfa_recovery(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002','approval-key-001',now()+interval '1 hour','aal2')$$,
  '40 segundo operador aprueba');
select is((select status::text from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'APPROVED','41 aprobada');
select lives_ok($$select * from core.begin_mfa_recovery_execution(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002','execution-key-001','aal2')$$,'42 ejecución inicia');
select is((select session_version from core.accounts where id='e2000000-0000-4000-8000-000000000004'),
  2::bigint,'43 session_version incrementa');
select is((select status::text from core.account_mfa_compliance
  where account_id='e2000000-0000-4000-8000-000000000004'),'RECOVERY_REQUIRED','44 cumplimiento');
select lives_ok($$select * from core.begin_mfa_recovery_execution(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002','execution-key-001','aal2')$$,'45 ejecución idempotente');
select is((select session_version from core.accounts where id='e2000000-0000-4000-8000-000000000004'),
  2::bigint,'46 no duplica incremento');
select lives_ok($$select core.record_mfa_factor_operation(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002',
  repeat('a',64),'VERIFIED','record-operation-001')$$,'47 operación factor');
select lives_ok($$select core.complete_mfa_factor_operation(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  (select id from core.mfa_recovery_factor_operations limit 1),
  'e2000000-0000-4000-8000-000000000002','DELETED',null,'delete-operation-001')$$,
  '48 eliminación confirmada');
select is((select removed_factor_count from core.mfa_recovery_requests
  where idempotency_key='request-key-001'),1,'49 conteo eliminado');
select lives_ok($$select core.mark_mfa_reenrollment_required(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002',1,'reenroll-key-001')$$,
  '50 reenrolamiento requerido');
select is((select status::text from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'REENROLLMENT_REQUIRED','51 estado reenrolamiento');
select throws_ok($$select core.complete_mfa_recovery(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002',1,'aal1','complete-key-001')$$,
  'P0001','REENROLLMENT_NOT_VERIFIED','52 no completa AAL1');
update core.mfa_recovery_requests set status='REENROLLMENT_IN_PROGRESS'
where idempotency_key='request-key-001';
select lives_ok($$select core.complete_mfa_recovery(
  (select id from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'e2000000-0000-4000-8000-000000000002',1,'aal2','complete-key-001')$$,
  '53 completa AAL2');
select is((select status::text from core.mfa_recovery_requests where idempotency_key='request-key-001'),
  'COMPLETED','54 completada');
select is((select status::text from core.account_mfa_compliance
  where account_id='e2000000-0000-4000-8000-000000000004'),'COMPLIANT','55 cumplimiento restaurado');
select throws_ok($$update core.mfa_administrative_security_events set created_at=now()$$,
  'P0001','MFA_ADMINISTRATIVE_EVENT_APPEND_ONLY','56 eventos append-only');
select throws_ok($$delete from core.mfa_administrative_security_events$$,
  'P0001','MFA_ADMINISTRATIVE_EVENT_APPEND_ONLY','57 eventos no borrables');
select is((select count(*)::integer from information_schema.columns where table_schema='core'
  and table_name like 'mfa_recovery%' and column_name ~* '(raw_factor|secret|qr|otpauth|challenge|token|jwt|email|alias|nip)'),0,
  '58 sin columnas sensibles');
select is((select count(*)::integer from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and not t.tgisinternal),0,
  '59 sin triggers Auth nuevos');
select is((select count(*)::integer from pg_policies where schemaname='auth'),0,
  '60 sin policies Auth nuevas');
select is((select count(*)::integer from information_schema.role_table_grants
  where table_schema='auth' and table_name in ('mfa_factors','sessions')
  and grantee in ('anon','authenticated')),0,'61 sin grants Auth');
select is((
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like '%mfa_recovery%')
  +
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='core' and (
      p.proname like '%mfa_recovery%' or p.proname like '%mfa_factor_operation%'
      or p.proname='append_mfa_administrative_event'
    ) and (
      has_function_privilege('public',p.oid,'EXECUTE')
      or has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('authenticated',p.oid,'EXECUTE')
    ))
)::integer,0,'62 sin RPC ni EXECUTE de aplicación');
select ok(not exists(select 1 from core.mfa_recovery_factor_operations
  where factor_reference_digest !~ '^[0-9a-f]{64}$'),'63 solo digest HMAC');
select ok(position('core' in coalesce(current_setting('pgrst.db_schemas',true),''))=0,
  '64 core fuera Data API');
select pass('65 fixtures se revierten');

select * from finish();
rollback;
