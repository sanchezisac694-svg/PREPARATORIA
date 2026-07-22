begin;
create extension if not exists pgtap with schema extensions;
select plan(75);

select has_table('academic','attendance_sessions','1 attendance_sessions');
select has_table('academic','attendance_records','2 attendance_records');
select has_table('academic','attendance_record_history','3 attendance history');
select has_table('academic','student_lateness_counters','4 lateness counters');
select has_table('academic','lateness_alerts','5 lateness alerts');
select has_table('academic','student_permissions','6 student permissions');
select has_table('academic','permission_validations','7 permission validations');
select has_table('academic','attendance_corrections','8 corrections');
select has_table('academic','attendance_commands','9 commands');
select has_table('academic','attendance_events','10 events');
select ok(exists(select 1 from core.roles where code='PREFECTURA' and is_system and is_active),'11 PREFECTURA seeded');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.attendance.read%','12 attendance read permission');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.attendance.manage%','13 attendance manage permission');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.attendance.validate%','14 attendance validate permission');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.permissions.read%','15 permission read');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.permissions.manage%','16 permission manage');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.permissions.validate%','17 permission validate');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.lateness.read%','18 lateness read');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.lateness.validate%','19 lateness validate');
select ok(pg_get_functiondef('academic.require_attendance_permission(text)'::regprocedure) like '%academic.lateness.notifications.record%','20 notification record');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='academic' and c.relname in ('attendance_sessions','attendance_records','attendance_record_history','student_lateness_counters','lateness_alerts','student_permissions','permission_validations','attendance_corrections','attendance_commands','attendance_events') and c.relrowsecurity),10::bigint,'21 RLS on ten tables');
select is((select count(*) from pg_policies where schemaname='academic' and tablename like 'attendance%' or schemaname='academic' and tablename in ('student_lateness_counters','lateness_alerts','student_permissions','permission_validations')),0::bigint,'22 zero policies');
select is((select count(*) from information_schema.role_table_grants where table_schema='academic' and table_name in ('attendance_sessions','attendance_records','attendance_record_history','student_lateness_counters','lateness_alerts','student_permissions','permission_validations','attendance_corrections','attendance_commands','attendance_events') and grantee='PUBLIC'),0::bigint,'23 no PUBLIC grants');
select is((select count(*) from information_schema.role_table_grants where table_schema='academic' and table_name in ('attendance_sessions','attendance_records','attendance_record_history','student_lateness_counters','lateness_alerts','student_permissions','permission_validations','attendance_corrections','attendance_commands','attendance_events') and grantee='anon'),0::bigint,'24 no anon grants');
select is((select count(*) from information_schema.role_table_grants where table_schema='academic' and table_name in ('attendance_sessions','attendance_records','attendance_record_history','student_lateness_counters','lateness_alerts','student_permissions','permission_validations','attendance_corrections','attendance_commands','attendance_events') and grantee='authenticated'),0::bigint,'25 no authenticated grants');
select ok(not exists(select 1 from unnest(string_to_array(current_setting('pgrst.db_schemas',true),',')) s where btrim(s)='academic'),'26 academic outside Data API');
select is((select array_agg(enumlabel::text order by enumsortorder) from pg_enum join pg_type on pg_type.oid=enumtypid join pg_namespace n on n.oid=pg_type.typnamespace where n.nspname='academic' and typname='attendance_status'),array['NOT_RECORDED','PRESENT','ABSENT','LATE','EXCUSED']::text[],'27 attendance states');
select is((select array_agg(enumlabel::text order by enumsortorder) from pg_enum join pg_type on pg_type.oid=enumtypid join pg_namespace n on n.oid=pg_type.typnamespace where n.nspname='academic' and typname='attendance_session_status'),array['DRAFT','OPEN','CLOSED','CANCELLED','LOCKED']::text[],'28 session states');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='student_permission_type'),6::bigint,'29 permission types');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='student_permission_status'),8::bigint,'30 permission states');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='permission_reason_code'),7::bigint,'31 closed permission reasons');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='attendance_correction_status'),7::bigint,'32 correction states');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='lateness_alert_status'),4::bigint,'33 alert states');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='lateness_counter_type'),2::bigint,'34 counter types');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='attendance_event_type'),25::bigint,'35 event catalog');
select is((select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='attendance_command_type'),29::bigint,'36 command catalog');
select ok(exists(select 1 from pg_constraint where conrelid='academic.attendance_sessions'::regclass and contype='u'),'37 session uniqueness');
select ok(exists(select 1 from pg_constraint where conrelid='academic.attendance_records'::regclass and contype='u'),'38 roster uniqueness');
select ok(exists(select 1 from pg_constraint where conrelid='academic.lateness_alerts'::regclass and pg_get_constraintdef(oid) like '%threshold_value%4%'),'39 threshold four');
select ok(exists(select 1 from pg_constraint where conrelid='academic.attendance_records'::regclass and pg_get_constraintdef(oid) like '%lateness_minutes%'),'40 lateness minutes checks');
select ok(exists(select 1 from pg_attribute where attrelid='academic.attendance_records'::regclass and attname='is_first_period' and attnotnull),'41 first period stored derived');
select ok(exists(select 1 from pg_constraint where conrelid='academic.student_lateness_counters'::regclass and pg_get_constraintdef(oid) like '%current_count%'),'42 nonnegative bounded current counter');
select ok(exists(select 1 from pg_constraint where conrelid='academic.student_lateness_counters'::regclass and pg_get_constraintdef(oid) like '%lifetime_count%'),'43 nonnegative lifetime');
select ok(academic.valid_attendance_session_transition('DRAFT','OPEN'),'44 session open transition');
select ok(academic.valid_attendance_session_transition('OPEN','CLOSED'),'45 session close transition');
select ok(academic.valid_attendance_session_transition('CLOSED','LOCKED'),'46 session lock transition');
select ok(not academic.valid_attendance_session_transition('LOCKED','OPEN'),'47 session invalid transition');
select ok(academic.valid_student_permission_transition('DRAFT','SUBMITTED'),'48 permission submit');
select ok(not academic.valid_student_permission_transition('REJECTED','APPROVED'),'49 permission terminal');
select ok(academic.valid_attendance_correction_transition('APPROVED','APPLIED'),'50 correction apply');
select ok(not academic.valid_attendance_correction_transition('APPLIED','DRAFT'),'51 correction terminal');
select is(length(academic.attendance_fingerprint('{"a":1}'::jsonb)),64,'52 SHA-256');
select has_function('academic','create_attendance_session','53 create session function');
select has_function('academic','open_attendance_session','54 open session function');
select has_function('academic','populate_attendance_session_roster','55 roster function');
select has_function('academic','record_student_attendance','56 record function');
select has_function('academic','record_bulk_attendance','57 bulk function');
select has_function('academic','validate_student_lateness','58 lateness validation');
select has_function('academic','process_first_period_lateness','59 counter function');
select has_function('academic','create_student_permission','60 permission function');
select has_function('academic','approve_student_permission','61 permission approval');
select has_function('academic','mark_attendance_excused','62 excuse function');
select has_function('academic','create_attendance_correction','63 correction function');
select has_function('academic','apply_attendance_correction','64 correction application');
select has_function('academic','record_lateness_notification','65 notification record function');
select has_function('academic','acknowledge_lateness_alert','66 alert acknowledge');
select has_function('academic','close_attendance_session','67 close function');
select has_function('academic','lock_attendance_session','68 lock function');
select has_function('academic','get_attendance_session_summary','69 session summary');
select has_function('academic','get_student_attendance_summary','70 student summary');
select has_function('academic','get_student_lateness_summary','71 lateness summary');
select has_function('academic','validate_attendance_session_integrity','72 integrity function');
select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like '%attendance%'
  ),
  1::bigint,
  '73 solo existe el wrapper público de asistencia propia'
);
select is((select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and not t.tgisinternal and pg_get_triggerdef(t.oid) like '%attendance%'),0::bigint,'74 Auth has no attendance triggers');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='academic' and p.proname like '%attendance%' and p.proconfig is null),'75 fixed search_path');

select * from finish();
rollback;
