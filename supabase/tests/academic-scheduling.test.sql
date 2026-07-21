begin;
create extension if not exists pgtap with schema extensions;
select plan(75);

select has_schema('academic','01 academic schema exists');
select has_table('academic','academic_shifts','02 shifts');
select has_table('academic','academic_spaces','03 spaces');
select has_table('academic','schedule_time_blocks','04 blocks');
select has_table('academic','schedule_templates','05 templates');
select has_table('academic','schedule_template_blocks','06 template blocks');
select has_table('academic','teacher_availability','07 availability');
select has_table('academic','group_schedules','08 schedules');
select has_table('academic','class_sessions','09 sessions');
select has_table('academic','schedule_change_requests','10 changes');
select has_table('academic','schedule_commands','11 commands');
select has_table('academic','schedule_events','12 events');

select enum_has_labels('academic','schedule_resource_status',array['DRAFT','ACTIVE','INACTIVE','RETIRED'],'13 resource statuses');
select enum_has_labels('academic','academic_space_type',array['CLASSROOM','LABORATORY','WORKSHOP','MULTIPURPOSE','OTHER'],'14 space types');
select enum_has_labels('academic','academic_space_status',array['DRAFT','ACTIVE','MAINTENANCE','INACTIVE','RETIRED'],'15 space statuses');
select enum_has_labels('academic','schedule_template_status',array['DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','RETIRED','CANCELLED'],'16 template statuses');
select enum_has_labels('academic','teacher_availability_type',array['AVAILABLE','UNAVAILABLE','PREFERRED'],'17 availability types');
select enum_has_labels('academic','group_schedule_status',array['DRAFT','UNDER_REVIEW','APPROVED','PUBLISHED','CLOSED','CANCELLED'],'18 schedule statuses');
select enum_has_labels('academic','class_session_type',array['REGULAR_CLASS','LABORATORY','WORKSHOP'],'19 session types');
select enum_has_labels('academic','class_session_status',array['PLANNED','ACTIVE','CANCELLED','ENDED'],'20 session statuses');
select enum_has_labels('academic','schedule_change_type',array['SESSION_ADD','SESSION_MOVE','SESSION_SPACE_CHANGE','SESSION_TEACHER_CHANGE','SESSION_CANCEL','SCHEDULE_REPLACEMENT'],'21 change types');
select enum_has_labels('academic','schedule_change_status',array['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','APPLIED','CANCELLED','EXPIRED'],'22 change statuses');

select ok((select count(*)=11 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname=any(array['academic_shifts','academic_spaces','schedule_time_blocks','schedule_templates','schedule_template_blocks','teacher_availability','group_schedules','class_sessions','schedule_change_requests','schedule_commands','schedule_events']) and c.relrowsecurity),'23 RLS all tables');
select is((select count(*)::integer from pg_policies where schemaname='academic' and tablename=any(array['academic_shifts','academic_spaces','schedule_time_blocks','schedule_templates','schedule_template_blocks','teacher_availability','group_schedules','class_sessions','schedule_change_requests','schedule_commands','schedule_events'])),0,'24 zero policies');
select is((select count(*)::integer from information_schema.role_table_grants where table_schema='academic' and table_name=any(array['academic_shifts','academic_spaces','schedule_time_blocks','schedule_templates','schedule_template_blocks','teacher_availability','group_schedules','class_sessions','schedule_change_requests','schedule_commands','schedule_events']) and grantee in ('PUBLIC','anon','authenticated')),0,'25 zero grants');
select ok(not has_schema_privilege('anon','academic','usage'),'26 anon schema denied');
select ok(not has_schema_privilege('authenticated','academic','usage'),'27 authenticated schema denied');
select ok(not exists(select 1 from pg_namespace where nspname='public' and oid in(select pronamespace from pg_proc where proname like '%schedule%')),'28 no public schedule functions');

select has_column('academic','academic_shifts','created_by_account_id','29 shift actor');
select has_column('academic','academic_spaces','accessibility_notes_code','30 accessibility code');
select has_column('academic','schedule_time_blocks','is_first_period','31 first period');
select has_column('academic','schedule_time_blocks','is_break','32 break');
select has_column('academic','schedule_templates','approved_by_account_id','33 template approval');
select has_column('academic','teacher_availability','availability_type','34 availability kind');
select has_column('academic','group_schedules','version_number','35 schedule version');
select has_column('academic','class_sessions','teaching_assignment_id','36 assignment');
select has_column('academic','schedule_change_requests','request_fingerprint','37 change fingerprint');
select has_column('academic','schedule_commands','request_fingerprint','38 command fingerprint');
select has_column('academic','schedule_events','correlation_id','39 correlation');

select has_function('academic','require_schedule_permission',array['text'],'40 authorization function');
select has_function('academic','schedule_fingerprint',array['jsonb'],'41 SHA function');
select has_function('academic','validate_group_schedule_coverage',array['uuid'],'42 coverage');
select has_function('academic','get_teacher_workload_summary',array['uuid','uuid'],'43 workload');
select has_function('academic','validate_teacher_workload',array['uuid','uuid'],'44 workload validation');
select has_function('academic','validate_schedule_conflicts',array['uuid','uuid','uuid','uuid','smallint','uuid','uuid'],'45 conflict validation');
select has_function('academic','create_academic_shift',array['text','text','time without time zone','time without time zone','text','uuid'],'46 create shift');
select has_function('academic','create_academic_space',array['text','text','academic.academic_space_type','integer','text','text','academic.accessibility_notes_code','text','uuid'],'47 create space');
select has_function('academic','create_schedule_time_block',array['uuid','text','text','smallint','time without time zone','time without time zone','boolean','boolean','text','uuid'],'48 create block');
select has_function('academic','create_schedule_template',array['text','text','uuid','date','date','text','uuid'],'49 create template');
select has_function('academic','declare_teacher_availability',array['uuid','uuid','smallint','uuid','academic.teacher_availability_type','date','date','text','uuid'],'50 availability operation');
select has_function('academic','create_group_schedule',array['uuid','uuid','integer','date','date','text','uuid'],'51 create schedule');
select has_function('academic','create_class_session',array['uuid','uuid','uuid','uuid','smallint','uuid','academic.class_session_type','date','date','text','uuid'],'52 create session');
select has_function('academic','create_schedule_change_request',array['uuid','academic.schedule_change_type','academic.schedule_reason_code','text','uuid'],'53 create change');

select ok(academic.valid_shift_transition('DRAFT','ACTIVE'),'54 shift activate');
select ok(not academic.valid_shift_transition('DRAFT','RETIRED'),'55 shift jump rejected');
select ok(academic.valid_space_transition('ACTIVE','MAINTENANCE'),'56 maintenance');
select ok(not academic.valid_space_transition('RETIRED','ACTIVE'),'57 retired terminal');
select ok(academic.valid_template_transition('DRAFT','UNDER_REVIEW'),'58 template review');
select ok(not academic.valid_template_transition('DRAFT','ACTIVE'),'59 template jump rejected');
select ok(academic.valid_group_schedule_transition('APPROVED','PUBLISHED'),'60 publish');
select ok(not academic.valid_group_schedule_transition('PUBLISHED','APPROVED'),'61 published immutable');
select ok(academic.valid_class_session_transition('PLANNED','ACTIVE'),'62 session activate');
select ok(not academic.valid_class_session_transition('ENDED','ACTIVE'),'63 ended terminal');
select ok(academic.valid_schedule_change_transition('APPROVED','APPLIED'),'64 apply change');
select ok(not academic.valid_schedule_change_transition('REJECTED','APPROVED'),'65 rejected terminal');

select is(length(academic.schedule_fingerprint('{"a":1}'::jsonb)),64,'66 SHA-256 length');
select is(academic.schedule_fingerprint('{"a":1,"b":2}'::jsonb),academic.schedule_fingerprint('{"b":2,"a":1}'::jsonb),'67 canonical jsonb');
select ok((select count(*)>=41 from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='academic' and t.typname='schedule_command_type'),'68 command catalog');
select ok((select count(*)>=42 from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='academic' and t.typname='schedule_event_type'),'69 event catalog');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' and p.proname like '%schedule%' and p.prosecdef and p.proconfig is null),'70 fixed search path');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' and p.proname like '%schedule%' and pg_get_functiondef(p.oid)~*'insert\s+into\s+auth\.|update\s+auth\.|delete\s+from\s+auth\.'),'71 Auth untouched');
select ok(not exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and not t.tgisinternal and pg_get_triggerdef(t.oid)~*'schedule'),'72 no Auth triggers');
select ok((select count(*)=11 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname=any(array['academic_shifts','academic_spaces','schedule_time_blocks','schedule_templates','schedule_template_blocks','teacher_availability','group_schedules','class_sessions','schedule_change_requests','schedule_commands','schedule_events']) and not t.tgisinternal and t.tgname like '%schedule_history'),'73 immutability triggers');
select ok(not exists(select 1 from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname=any(array['academic_shifts','academic_spaces','schedule_time_blocks','schedule_templates','schedule_template_blocks','teacher_availability','group_schedules','class_sessions','schedule_change_requests','schedule_commands','schedule_events']) and con.contype='f' and pg_get_constraintdef(con.oid)!~*'ON DELETE RESTRICT'),'74 all FKs restrict');
select ok(not exists(select 1 from academic.academic_shifts where code like 'REAL_%'),'75 synthetic isolation');

select * from finish();
rollback;
