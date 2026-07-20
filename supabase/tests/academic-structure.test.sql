begin;
create extension if not exists pgtap with schema extensions;
select plan(101);

select has_schema('academic', 'academic schema exists');
select has_table('academic', 'school_cycles', 'school cycles exist');
select has_table('academic', 'academic_periods', 'academic periods exist');
select has_table('academic', 'study_plans', 'study plans exist');
select has_table('academic', 'plan_semesters', 'plan semesters exist');
select has_table('academic', 'training_areas', 'training areas exist');
select has_table('academic', 'subjects', 'subjects exist');
select has_table('academic', 'curriculum_subjects', 'curriculum subjects exist');
select has_table('academic', 'subject_units', 'subject units exist');
select has_table('academic', 'groups', 'groups exist');
select has_table('academic', 'academic_offerings', 'academic offerings exist');
select has_table('academic', 'teaching_assignments', 'teaching assignments exist');
select has_table('academic', 'academic_structure_events', 'academic events exist');
select has_table('academic', 'academic_commands', 'persistent academic commands exist');
select has_function('academic', 'create_school_cycle', 'create cycle function exists');
select has_function('academic', 'activate_school_cycle', 'activate cycle function exists');
select has_function('academic', 'close_school_cycle', 'close cycle function exists');
select has_function('academic', 'create_academic_period', 'create period function exists');
select has_function('academic', 'activate_academic_period', 'activate period function exists');
select has_function('academic', 'close_academic_period', 'close period function exists');
select has_function('academic', 'create_study_plan', 'create plan function exists');
select has_function('academic', 'approve_study_plan', 'approve plan function exists');
select has_function('academic', 'activate_study_plan', 'activate plan function exists');
select has_function('academic', 'create_subject', 'create subject function exists');
select has_function('academic', 'deactivate_subject', 'deactivate subject function exists');
select has_function('academic', 'add_subject_to_study_plan', 'curriculum function exists');
select has_function('academic', 'create_subject_units', 'unit function exists');
select has_function('academic', 'create_group', 'create group function exists');
select has_function('academic', 'activate_group', 'activate group function exists');
select has_function('academic', 'create_academic_offering', 'create offering function exists');
select has_function('academic', 'activate_academic_offering', 'activate offering function exists');
select has_function('academic', 'assign_teacher', 'assign teacher function exists');
select has_function('academic', 'end_teaching_assignment', 'end assignment function exists');
select ok(academic.valid_structure_transition('DRAFT','PLANNED'), 'draft structure may be planned');
select ok(academic.valid_structure_transition('CLOSING','CLOSED'), 'closing structure may close');
select ok(not academic.valid_structure_transition('CLOSED','ACTIVE'), 'closed structure cannot reactivate');
select ok(not academic.valid_plan_transition('APPROVED','DRAFT'), 'approved plan cannot return to draft');
select is((select count(*)::integer from pg_indexes where schemaname='academic' and tablename='academic_commands' and indexdef like '%UNIQUE%'), 2, 'commands have primary and idempotency uniqueness');
select ok(not has_function_privilege('authenticated','academic.require_academic_permission(text)','execute'), 'authorization helper is not client callable');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' and p.proname in ('create_school_cycle','activate_school_cycle','close_school_cycle','create_academic_period','activate_academic_period','close_academic_period','create_study_plan','approve_study_plan','activate_study_plan','create_subject','deactivate_subject','add_subject_to_study_plan','create_subject_units','create_group','activate_group','create_academic_offering','activate_academic_offering','assign_teacher','end_teaching_assignment')),19,'all nineteen controlled mutations exist');
select is((select count(*)::integer from pg_policies where schemaname='academic' and tablename='academic_commands'),0,'commands have zero policies');

select results_eq(
  $$select code::text from academic.training_areas order by code$$,
  $$values ('CIENCIAS_SOCIALES'), ('ECONOMICO_ADMINISTRATIVOS'), ('FISICO_MATEMATICOS'), ('QUIMICO_BIOLOGOS')$$,
  'only the four confirmed training areas are seeded'
);
select is((select count(*)::integer from academic.training_areas), 4, 'exactly four areas');
select ok((select bool_and(starts_at_semester = 5) from academic.training_areas), 'areas start at semester five');

select throws_ok(
  $$insert into academic.training_areas(code, name) values ('área', 'Inválida')$$,
  '23514',
  null,
  'ambiguous unicode code is rejected'
);
select throws_ok(
  $$insert into academic.training_areas(code, name, starts_at_semester) values ('VALID_AREA', 'Área sintética', 7)$$,
  '23514',
  null,
  'semester seven is rejected'
);
select lives_ok(
  $$insert into academic.training_areas(code, name, starts_at_semester) values ('SYNTHETIC_AREA', 'Área sintética', 5)$$,
  'synthetic area is accepted'
);
select throws_ok(
  $$insert into academic.training_areas(code, name, starts_at_semester) values ('SYNTHETIC_AREA', 'Duplicada', 5)$$,
  '23505',
  null,
  'duplicate area code is rejected'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='academic' and c.relkind='r' and c.relrowsecurity),
  13,
  'RLS is enabled on all thirteen tables'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='academic'),
  0,
  'academic has zero policies'
);
select is(
  (select count(*)::integer from information_schema.role_table_grants
   where table_schema='academic' and grantee in ('PUBLIC','anon','authenticated')),
  0,
  'application roles have zero table grants'
);
select is(
  (select count(*)::integer from information_schema.role_usage_grants
   where object_schema='academic' and grantee in ('PUBLIC','anon','authenticated')),
  0,
  'application roles have zero schema usage'
);
select ok(
  coalesce(position('academic' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  'academic is outside Data API'
);
select is(
  (select count(*)::integer from pg_indexes where schemaname='academic' and indexname='one_active_primary_teacher'),
  1,
  'active primary assignment has a unique partial index'
);
select is(
  (select count(*)::integer from pg_trigger
   where tgrelid='academic.academic_structure_events'::regclass and not tgisinternal),
  1,
  'append-only audit trigger exists'
);
select ok(
  not has_function_privilege('anon', 'academic.reject_academic_event_mutation()', 'execute')
  and not has_function_privilege('authenticated', 'academic.reject_academic_event_mutation()', 'execute'),
  'audit protection function has no public execute grants'
);
select is(
  (select prosecdef from pg_proc where oid='academic.reject_academic_event_mutation()'::regprocedure),
  false,
  'audit protection is SECURITY INVOKER'
);
select is(
  (select proconfig[1] from pg_proc where oid='academic.reject_academic_event_mutation()'::regprocedure),
  'search_path=""',
  'audit protection fixes an empty search_path'
);

select col_is_pk('academic', 'school_cycles', 'id', 'cycle id is primary key');
select col_is_fk('academic', 'academic_periods', 'school_cycle_id', 'period references cycle');
select col_is_fk('academic', 'plan_semesters', 'study_plan_id', 'semester references plan');
select col_is_fk('academic', 'subject_units', 'curriculum_subject_id', 'unit references curriculum');
select col_is_fk('academic', 'academic_offerings', 'group_id', 'offering references group');
select col_is_fk('academic', 'teaching_assignments', 'teacher_account_id', 'assignment references account');

select is(
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
   where enumtypid='academic.subject_type'::regtype),
  'COMMON,AREA_SPECIFIC,INSTITUTIONAL,EXTRA_CURRICULAR',
  'subject types are exact'
);
select is(
  (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
   where enumtypid='academic.assignment_type'::regtype),
  'PRIMARY,CO_TEACHER,TEMPORARY',
  'assignment types are exact'
);
select is(
  (select count(*)::integer from pg_constraint where connamespace='academic'::regnamespace and contype='f' and confdeltype <> 'r'),
  0,
  'all academic foreign keys use ON DELETE RESTRICT'
);
select is(
  (select count(*)::integer from information_schema.tables where table_schema='public'
   and table_name in ('school_cycles','academic_periods','study_plans','subjects','groups')),
  0,
  'no academic tables are public'
);
select is(
  (select count(*)::integer from pg_trigger t join pg_class c on c.oid=t.tgrelid
   join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='auth' and not t.tgisinternal and t.tgname like '%academic%'),
  0,
  'no Auth triggers were added'
);
select ok(
  coalesce(position('academic' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  'Data API setting does not mention academic'
);

select has_function('academic','plan_school_cycle','cycle planning function exists');
select has_function('academic','begin_school_cycle_closing','cycle closing-start function exists');
select has_function('academic','cancel_school_cycle','cycle cancellation function exists');
select has_function('academic','plan_academic_period','period planning function exists');
select has_function('academic','begin_academic_period_closing','period closing-start function exists');
select has_function('academic','cancel_academic_period','period cancellation function exists');
select has_function('academic','submit_study_plan_for_review','plan review function exists');
select has_function('academic','retire_study_plan','plan retirement function exists');
select has_function('academic','cancel_study_plan','plan cancellation function exists');
select has_function('academic','plan_group','group planning function exists');
select has_function('academic','open_group','group opening function exists');
select has_function('academic','close_group','group closing function exists');
select has_function('academic','cancel_group','group cancellation function exists');
select has_function('academic','plan_academic_offering','offering planning function exists');
select has_function('academic','close_academic_offering','offering closing function exists');
select has_function('academic','cancel_academic_offering','offering cancellation function exists');
select has_function('academic','activate_teaching_assignment','assignment activation function exists');
select has_function('academic','cancel_teaching_assignment','assignment cancellation function exists');
select ok(academic.valid_group_transition('DRAFT','PLANNED') and academic.valid_group_transition('OPEN','ACTIVE'), 'valid group transitions are explicit');
select ok(not academic.valid_group_transition('DRAFT','ACTIVE') and not academic.valid_group_transition('CLOSED','ACTIVE'), 'invalid group transitions fail closed');
select ok(academic.valid_offering_transition('DRAFT','PLANNED') and academic.valid_offering_transition('ACTIVE','CLOSED'), 'valid offering transitions are explicit');
select ok(not academic.valid_offering_transition('DRAFT','ACTIVE') and not academic.valid_offering_transition('CLOSED','ACTIVE'), 'invalid offering transitions fail closed');
select ok(academic.valid_assignment_transition('PLANNED','ACTIVE') and academic.valid_assignment_transition('ACTIVE','ENDED'), 'valid assignment transitions are explicit');
select ok(not academic.valid_assignment_transition('PLANNED','ENDED') and not academic.valid_assignment_transition('ENDED','ACTIVE'), 'invalid assignment transitions fail closed');
select ok(academic.academic_request_fingerprint('{"b":2,"a":1}'::jsonb) ~ '^[0-9a-f]{64}$','SHA-256 fingerprint is 64 hexadecimal characters');
select is(academic.academic_request_fingerprint('{"a":1,"b":2}'::jsonb),academic.academic_request_fingerprint('{"b":2,"a":1}'::jsonb),'jsonb canonicalization ignores key order');
select isnt(academic.academic_request_fingerprint('{"a":1}'::jsonb),academic.academic_request_fingerprint('{"a":2}'::jsonb),'different payloads have different fingerprints');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' and p.proname in ('plan_school_cycle','begin_school_cycle_closing','cancel_school_cycle','plan_academic_period','begin_academic_period_closing','cancel_academic_period','submit_study_plan_for_review','retire_study_plan','cancel_study_plan','plan_group','open_group','close_group','cancel_group','plan_academic_offering','close_academic_offering','cancel_academic_offering','activate_teaching_assignment','cancel_teaching_assignment') and pg_get_functiondef(p.oid) ~* '\\mmd5\\M'),0,'new operations contain no MD5');
select is((select count(*)::integer from pg_trigger t where t.tgfoid='academic.guard_academic_history()'::regprocedure and not t.tgisinternal),12,'all mutable academic history tables have delete/update guards');
select is((select count(*)::integer from pg_trigger t where t.tgrelid='academic.academic_commands'::regclass and t.tgfoid='academic.guard_academic_history()'::regprocedure and not t.tgisinternal),1,'completed commands are guarded');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%academic%'),0,'no academic functions exist in public');

select * from finish();
rollback;
