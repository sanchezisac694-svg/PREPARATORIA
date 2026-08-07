begin;
select plan(34);

select ok(
  coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 finance permanece fuera de la Data API'
);

select has_schema('finance', '02 schema finance existe');
select ok(not has_schema_privilege('public', 'finance', 'USAGE'), '03 public no recibe USAGE sobre finance');
select ok(not has_schema_privilege('anon', 'finance', 'USAGE'), '04 anon no recibe USAGE sobre finance');
select ok(not has_schema_privilege('authenticated', 'finance', 'USAGE'), '05 authenticated no recibe USAGE sobre finance');

select has_table('finance', 'charge_concepts', '06 charge_concepts existe');
select has_table('finance', 'charge_rates', '07 charge_rates existe');
select has_table('finance', 'student_accounts', '08 student_accounts existe');
select has_table('finance', 'student_charges', '09 student_charges existe');
select has_table('finance', 'charge_adjustments', '10 charge_adjustments existe');
select has_table('finance', 'payments', '11 payments existe');
select has_table('finance', 'payment_allocations', '12 payment_allocations existe');
select has_table('finance', 'financial_commands', '13 financial_commands existe');
select has_table('finance', 'financial_events', '14 financial_events existe');
select has_table('finance', 'receipt_sequences', '15 receipt_sequences existe');

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'academic'
      and table_name = 'guardian_access_scopes'
      and column_name = 'can_view_financial_account'
  ),
  '16 guardian_access_scopes contiene can_view_financial_account'
);

select ok(
  exists (
    select 1
    from academic.guardian_access_scopes
    where code = 'STANDARD_ACADEMIC_READ'
      and can_view_financial_account = false
  ),
  '17 STANDARD_ACADEMIC_READ conserva scope financiero cerrado'
);

select ok((select relrowsecurity from pg_class where oid = 'finance.charge_concepts'::regclass), '18 charge_concepts tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.student_accounts'::regclass), '19 student_accounts tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.payments'::regclass), '20 payments tiene RLS');
select ok((select relrowsecurity from pg_class where oid = 'finance.financial_events'::regclass), '21 financial_events tiene RLS');

select is((select count(*) from pg_policies where schemaname = 'finance'), 0::bigint, '22 finance no define policies directas');
select ok(not has_table_privilege('authenticated', 'finance.student_accounts', 'SELECT'), '23 authenticated no lee student_accounts');
select ok(not has_table_privilege('authenticated', 'finance.payments', 'SELECT'), '24 authenticated no lee payments');

select has_function('public', 'get_my_student_financial_summary', array[]::text[], '25 wrapper público resumen alumno existe');
select has_function('public', 'get_my_student_account_statement', array['uuid'], '26 wrapper público ledger alumno existe');
select has_function('public', 'get_my_student_receipt', array['uuid'], '27 wrapper público recibo alumno existe');
select has_function('public', 'get_my_guardian_student_financial_summary', array['uuid'], '28 wrapper público tutor existe');
select ok(has_function_privilege('authenticated', 'public.get_my_student_financial_summary()', 'EXECUTE'), '29 authenticated ejecuta wrapper propio');
select ok(not has_function_privilege('authenticated', 'finance.open_student_account(uuid,text,uuid)', 'EXECUTE'), '30 authenticated no ejecuta función administrativa');
select has_function('finance', 'guard_receipt_sequence_mutation', array[]::text[], '31 trigger específico de receipt_sequences existe');
select ok(
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'finance'
      and event_object_table = 'receipt_sequences'
      and trigger_name = 'receipt_sequences_guard'
      and action_statement like '%guard_receipt_sequence_mutation%'
  ),
  '32 receipt_sequences usa trigger propio'
);
select ok(
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'finance'
      and event_object_table = 'student_charges'
      and trigger_name = 'student_charges_guard'
      and action_statement like '%guard_financial_immutable%'
  ),
  '33 student_charges conserva trigger genérico de inmutabilidad'
);
select ok(
  exists (
    select 1
    from information_schema.triggers
    where event_object_schema = 'finance'
      and event_object_table = 'payments'
      and trigger_name = 'payments_guard'
      and action_statement like '%guard_financial_immutable%'
  ),
  '34 payments conserva trigger genérico de inmutabilidad'
);

select * from finish();
rollback;
