begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

select enum_has_labels('core', 'mfa_requirement',
  array['NOT_REQUIRED','OPTIONAL','RECOMMENDED','REQUIRED'], '1 requisitos exactos');
select enum_has_labels('core', 'mfa_compliance_status',
  array['NOT_APPLICABLE','NOT_ENROLLED','ENROLLMENT_PENDING','COMPLIANT','GRACE_PERIOD',
        'NON_COMPLIANT','RECOVERY_REQUIRED','ADMINISTRATIVE_REVIEW'], '2 estados exactos');
select enum_has_labels('core', 'mfa_security_reason_code',
  array['USER_ENROLLMENT','POLICY_REQUIRED','BACKUP_FACTOR','USER_UNENROLLMENT',
        'LOST_FACTOR','SUSPECTED_COMPROMISE','ADMINISTRATIVE_RECOVERY','STEP_UP_REQUIRED',
        'SECURITY_POLICY','ACCOUNT_ROLE_CHANGED','RECONCILIATION'], '3 razones exactas');
select enum_has_labels('core', 'mfa_security_event_type',
  array['MFA_ENROLLMENT_STARTED','MFA_ENROLLMENT_VERIFIED','MFA_ENROLLMENT_FAILED',
        'MFA_CHALLENGE_STARTED','MFA_CHALLENGE_VERIFIED','MFA_CHALLENGE_FAILED',
        'MFA_FACTOR_UNENROLL_REQUESTED','MFA_FACTOR_UNENROLLED','MFA_FACTOR_UNENROLL_FAILED',
        'MFA_BACKUP_FACTOR_ENROLLED','MFA_REQUIRED_BY_POLICY','MFA_GRACE_PERIOD_STARTED',
        'MFA_COMPLIANCE_ACHIEVED','MFA_COMPLIANCE_LOST','MFA_RECOVERY_REQUESTED',
        'MFA_RECOVERY_APPROVED','MFA_RECOVERY_COMPLETED','MFA_STEP_UP_REQUIRED',
        'MFA_STEP_UP_COMPLETED','MFA_ACCESS_REJECTED','MFA_RECONCILIATION_REQUIRED'],
  '4 eventos exactos');
select has_table('core', 'account_mfa_policies', '5 tabla de políticas');
select has_table('core', 'account_mfa_compliance', '6 tabla de cumplimiento');
select has_table('core', 'account_mfa_security_events', '7 tabla de auditoría');
select has_pk('core', 'account_mfa_policies', '8 política tiene PK');
select has_pk('core', 'account_mfa_compliance', '9 cumplimiento tiene PK');
select has_pk('core', 'account_mfa_security_events', '10 auditoría tiene PK');
select is((select count(*)::integer from core.account_mfa_policies), 8, '11 ocho políticas');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='SUPERADMIN'), 'REQUIRED', '12 superadmin obligatorio');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='ADMINISTRATIVO'), 'REQUIRED', '13 administrativo obligatorio');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='CONTROL_ESCOLAR'), 'REQUIRED', '14 control escolar obligatorio');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='CAJA'), 'REQUIRED', '15 caja obligatorio');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='DOCENTE'), 'RECOMMENDED', '16 docente recomendado');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='ALUMNO'), 'OPTIONAL', '17 alumno opcional');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='TUTOR'), 'OPTIONAL', '18 tutor opcional');
select is((select requirement::text from core.account_mfa_policies p join core.roles r on r.id=p.role_id
  where r.code='ASPIRANTE'), 'OPTIONAL', '19 aspirante opcional');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='account_mfa_policies'), '20 RLS políticas');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='account_mfa_compliance'), '21 RLS cumplimiento');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='account_mfa_security_events'), '22 RLS auditoría');
select is((select count(*)::integer from pg_policies where schemaname='core'
  and tablename like 'account_mfa_%'), 0, '23 tablas MFA sin políticas de aplicación');
select is((select count(*)::integer from information_schema.role_table_grants
  where table_schema='core' and table_name like 'account_mfa_%'
  and grantee in ('PUBLIC','anon','authenticated')), 0, '24 tablas MFA sin grants');
select has_function('core','current_authenticator_assurance_level',array[]::text[],'25 lector AAL');
select has_function('core','is_current_aal2',array[]::text[],'26 predicado AAL2');
select has_function('core','is_mfa_required_for_current_account',array[]::text[],'27 política efectiva');
select has_function('core','is_current_mfa_policy_satisfied',array[]::text[],'28 satisfacción');
select has_function('core','require_current_mfa_policy',array[]::text[],'29 guard');
select has_function('public','get_current_identity_context',array[]::text[],'30 gateway');

select set_config('request.jwt.claims', '{"aal":"aal1"}', true);
select is(core.current_authenticator_assurance_level(), 'aal1', '31 AAL1 parseado');
select is(core.is_current_aal2(), false, '32 AAL1 no es AAL2');
select set_config('request.jwt.claims', '{"aal":"aal2"}', true);
select is(core.current_authenticator_assurance_level(), 'aal2', '33 AAL2 parseado');
select is(core.is_current_aal2(), true, '34 AAL2 aceptado');
select set_config('request.jwt.claims', '{"aal":"aal3"}', true);
select is(core.current_authenticator_assurance_level(), null, '35 AAL inválido rechazado');

insert into auth.users (
  instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values (
  '00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','synthetic','mfa-test@example.invalid','{}','{}',now(),now()
);
insert into core.people (id, status)
values ('d2000000-0000-4000-8000-000000000001','ACTIVE');
insert into core.accounts (id,person_id,auth_user_id,account_status)
values ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
        'd1000000-0000-4000-8000-000000000001','ACTIVE');
insert into core.account_roles (account_id,role_id,assigned_by)
select 'd3000000-0000-4000-8000-000000000001',id,null from core.roles where code='ALUMNO';
select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}', true);
select is(core.current_mfa_requirement()::text, 'OPTIONAL', '36 alumno es opcional');
select is(core.is_mfa_required_for_current_account(), false, '37 opcional no obliga sin opt-in');
select is(core.is_current_mfa_policy_satisfied(), true, '38 opcional satisface AAL1');
insert into core.account_roles (account_id,role_id,assigned_by)
select 'd3000000-0000-4000-8000-000000000001',id,null from core.roles where code='CAJA';
select is(core.current_mfa_requirement()::text, 'REQUIRED', '39 multirrol usa más fuerte');
select is(core.is_mfa_required_for_current_account(), true, '40 multirrol obliga');
select is(core.is_current_mfa_policy_satisfied(), false, '41 obligatorio rechaza AAL1');
select throws_ok('select core.require_current_mfa_policy()', '42501', 'MFA_AAL2_REQUIRED',
  '42 step-up rechaza AAL1');
select set_config('request.jwt.claims',
  '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}', true);
select is(core.is_current_mfa_policy_satisfied(), true, '43 obligatorio acepta AAL2');
select lives_ok('select core.require_current_mfa_policy()', '44 step-up acepta AAL2');
select is((select mfa_required from public.get_current_identity_context()), true,
  '45 gateway expone obligación');
select is((select mfa_satisfied from public.get_current_identity_context()), true,
  '46 gateway expone satisfacción');
insert into core.account_mfa_security_events (
  account_id,actor_account_id,event_type,reason_code,correlation_id,idempotency_key
) values (
  'd3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',
  'MFA_STEP_UP_COMPLETED','STEP_UP_REQUIRED','d4000000-0000-4000-8000-000000000001',
  'synthetic-mfa-event-001'
);
select throws_ok(
  $$update core.account_mfa_security_events set occurred_at=now()
    where idempotency_key='synthetic-mfa-event-001'$$,
  '42501','MFA_SECURITY_EVENT_APPEND_ONLY','47 auditoría no admite update');
select throws_ok(
  $$delete from core.account_mfa_security_events
    where idempotency_key='synthetic-mfa-event-001'$$,
  '42501','MFA_SECURITY_EVENT_APPEND_ONLY','48 auditoría no admite delete');

select results_eq(
  $$select recorded, session_version from public.record_current_mfa_state(
    'COMPLIANT',1,'MFA_ENROLLMENT_VERIFIED','USER_ENROLLMENT',
    'd4000000-0000-4000-8000-000000000002','synthetic-mfa-state-001')$$,
  $$values (true,2::bigint)$$, '49 cumplimiento se registra e invalida sesión');
select is((select status::text from core.account_mfa_compliance
  where account_id='d3000000-0000-4000-8000-000000000001'), 'COMPLIANT',
  '50 cumplimiento alcanzado');
select is((select verified_factor_count from core.account_mfa_compliance
  where account_id='d3000000-0000-4000-8000-000000000001'), 1,
  '51 solo persiste conteo agregado');
select is((select session_version from core.accounts
  where id='d3000000-0000-4000-8000-000000000001'), 2::bigint,
  '52 session_version incrementada');
select results_eq(
  $$select recorded, session_version from public.record_current_mfa_state(
    'COMPLIANT',1,'MFA_ENROLLMENT_VERIFIED','USER_ENROLLMENT',
    'd4000000-0000-4000-8000-000000000002','synthetic-mfa-state-001')$$,
  $$values (false,2::bigint)$$, '53 reintento idempotente aun con JWT anterior');
select throws_ok(
  $$select * from public.record_current_mfa_state(
    'COMPLIANT',1,'MFA_BACKUP_FACTOR_ENROLLED','BACKUP_FACTOR',
    'd4000000-0000-4000-8000-000000000003','synthetic-mfa-state-001')$$,
  '23505','MFA_IDEMPOTENCY_CONFLICT','54 conflicto idempotente rechazado');
select is((select session_valid from public.get_current_identity_context()), false,
  '55 gateway rechaza session_version obsoleta');
select is((select count(*)::integer from core.account_mfa_security_events
  where account_id='d3000000-0000-4000-8000-000000000001'), 2,
  '56 auditoría contiene solo eventos sintéticos esperados');

select * from finish();
rollback;
