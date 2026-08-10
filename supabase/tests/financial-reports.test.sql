begin;
select plan(20);

select ok(
  coalesce(position('finance' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 finance sigue fuera de la Data API'
);

select has_function(
  'finance',
  'get_financial_period_summary',
  array['uuid', 'date'],
  '02 existe finance.get_financial_period_summary(uuid,date)'
);
select has_function(
  'finance',
  'report_charges',
  array[
    'uuid',
    'date',
    'date',
    'uuid',
    'integer',
    'uuid',
    'uuid',
    'finance.student_charge_status',
    'date',
    'integer',
    'integer'
  ],
  '03 existe finance.report_charges con filtros cerrados'
);
select has_function(
  'finance',
  'report_payments',
  array[
    'date',
    'date',
    'uuid',
    'finance.payment_method',
    'finance.payment_status',
    'uuid',
    'uuid',
    'integer',
    'integer'
  ],
  '04 existe finance.report_payments con filtros cerrados'
);
select has_function(
  'finance',
  'report_debt_summary',
  array[
    'uuid',
    'integer',
    'uuid',
    'uuid',
    'text',
    'finance.collection_case_status',
    'text',
    'integer',
    'integer',
    'date'
  ],
  '05 existe finance.report_debt_summary'
);
select has_function(
  'finance',
  'report_cash_operations',
  array['date', 'uuid', 'uuid', 'finance.cash_session_status', 'integer', 'integer'],
  '06 existe finance.report_cash_operations'
);
select has_function(
  'finance',
  'report_financial_benefits',
  array['uuid', 'date', 'date', 'integer', 'integer'],
  '07 existe finance.report_financial_benefits'
);
select has_function(
  'finance',
  'report_payment_agreements',
  array['uuid', 'integer', 'integer', 'date'],
  '08 existe finance.report_payment_agreements'
);

select ok(
  exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'financial_report_grouping'),
  '09 enum financial_report_grouping existe'
);
select ok(
  exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'financial_period_closure_status'),
  '10 enum financial_period_closure_status existe'
);

select is_definer(
  'public',
  'get_financial_period_summary',
  array['uuid', 'date'],
  '11 wrapper público de summary usa SECURITY DEFINER'
);
select is_definer(
  'public',
  'report_charges',
  array['uuid', 'date', 'date', 'uuid', 'integer', 'uuid', 'uuid', 'finance.student_charge_status', 'date', 'integer', 'integer'],
  '12 wrapper público de cargos usa SECURITY DEFINER'
);
select is_definer(
  'public',
  'report_payments',
  array['date', 'date', 'uuid', 'finance.payment_method', 'finance.payment_status', 'uuid', 'uuid', 'integer', 'integer'],
  '13 wrapper público de pagos usa SECURITY DEFINER'
);

select ok(
  not has_function_privilege('authenticated', 'finance.get_financial_period_summary(uuid,date)', 'EXECUTE'),
  '14 authenticated no ejecuta function interna summary'
);
select ok(
  has_function_privilege('authenticated', 'public.get_financial_period_summary(uuid,date)', 'EXECUTE'),
  '15 authenticated sí ejecuta wrapper público summary'
);
select ok(
  has_function_privilege('authenticated', 'public.report_charges(uuid,date,date,uuid,integer,uuid,uuid,finance.student_charge_status,date,integer,integer)', 'EXECUTE'),
  '16 authenticated sí ejecuta wrapper público cargos'
);
select ok(
  has_function_privilege('authenticated', 'public.report_payments(date,date,uuid,finance.payment_method,finance.payment_status,uuid,uuid,integer,integer)', 'EXECUTE'),
  '17 authenticated sí ejecuta wrapper público pagos'
);

select is(
  finance.report_page_size(null),
  50,
  '18 report_page_size usa default 50'
);
select is(
  finance.report_page_size(999),
  200,
  '19 report_page_size limita a 200'
);
select is(
  finance.report_csv_safe_cell('=SUM(A1:A2)'),
  '''=SUM(A1:A2)',
  '20 report_csv_safe_cell protege inyección CSV'
);

select * from finish();
rollback;
