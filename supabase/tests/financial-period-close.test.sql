begin;
select plan(18);

select has_table('finance', 'financial_period_closures', '01 existe financial_period_closures');
select ok(
  (select relrowsecurity from pg_class where oid = 'finance.financial_period_closures'::regclass),
  '02 financial_period_closures tiene RLS'
);
select ok(
  not has_table_privilege('authenticated', 'finance.financial_period_closures', 'select'),
  '03 authenticated no recibe grants directos sobre financial_period_closures'
);

select ok(
  exists(select 1 from pg_type where typnamespace = 'finance'::regnamespace and typname = 'financial_period_closure_status'),
  '04 enum financial_period_closure_status existe'
);
select col_is_pk('finance', 'financial_period_closures', 'id', '05 id es PK');
select col_not_null('finance', 'financial_period_closures', 'academic_period_id', '06 academic_period_id es not null');
select col_not_null('finance', 'financial_period_closures', 'business_date', '07 business_date es not null');
select col_not_null('finance', 'financial_period_closures', 'version', '08 version es not null');
select col_not_null('finance', 'financial_period_closures', 'gross_charges', '09 gross_charges es not null');
select col_not_null('finance', 'financial_period_closures', 'net_collections', '10 net_collections es not null');
select col_not_null('finance', 'financial_period_closures', 'outstanding', '11 outstanding es not null');

select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname = 'finance'
      and tablename = 'financial_period_closures'
      and indexname = 'financial_period_closures_one_active_equivalent'
  ),
  '12 existe índice único lógico para cierre activo equivalente'
);

select ok(
  has_function_privilege('authenticated', 'public.create_financial_period_close(uuid,date,text,uuid)', 'EXECUTE'),
  '13 authenticated sí ejecuta wrapper público create_financial_period_close'
);
select ok(
  has_function_privilege('authenticated', 'public.approve_financial_period_close(uuid,text,uuid)', 'EXECUTE'),
  '14 authenticated sí ejecuta wrapper público approve_financial_period_close'
);
select ok(
  has_function_privilege('authenticated', 'public.supersede_financial_period_close(uuid,date,text,uuid)', 'EXECUTE'),
  '15 authenticated sí ejecuta wrapper público supersede_financial_period_close'
);
select ok(
  not has_function_privilege('authenticated', 'finance.create_financial_period_close(uuid,date,text,uuid)', 'EXECUTE'),
  '16 authenticated no ejecuta función interna create_financial_period_close'
);
select ok(
  not has_function_privilege('authenticated', 'finance.approve_financial_period_close(uuid,text,uuid)', 'EXECUTE'),
  '17 authenticated no ejecuta función interna approve_financial_period_close'
);
select ok(
  not has_function_privilege('authenticated', 'finance.supersede_financial_period_close(uuid,date,text,uuid)', 'EXECUTE'),
  '18 authenticated no ejecuta función interna supersede_financial_period_close'
);

select * from finish();
rollback;
