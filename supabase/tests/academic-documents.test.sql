begin;
select plan(51);

select ok(
  coalesce(position('academic' in current_setting('pgrst.db_schemas', true)), 0) = 0,
  '01 academic permanece fuera de la Data API'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_my_documents',
        'get_my_document',
        'get_my_document_download',
        'get_my_guardian_student_documents',
        'get_my_guardian_student_document',
        'verify_document_public'
      )
  ),
  6::bigint,
  '02 existen exactamente seis wrappers públicos documentales'
);

select has_function('public', 'get_my_documents', array[]::text[], '03 wrapper get_my_documents existe');
select has_function('public', 'get_my_document', array['uuid'], '04 wrapper get_my_document existe');
select has_function('public', 'get_my_document_download', array['uuid'], '05 wrapper get_my_document_download existe');
select has_function('public', 'get_my_guardian_student_documents', array['uuid'], '06 wrapper tutor lista existe');
select has_function('public', 'get_my_guardian_student_document', array['uuid','uuid'], '07 wrapper tutor detalle existe');
select has_function('public', 'verify_document_public', array['text','text'], '08 wrapper verify_document_public existe');

select ok(not has_function_privilege('public', 'public.verify_document_public(text,text)', 'EXECUTE'), '09 PUBLIC no ejecuta verify_document_public');
select ok(has_function_privilege('anon', 'public.verify_document_public(text,text)', 'EXECUTE'), '10 anon ejecuta verify_document_public');
select ok(has_function_privilege('authenticated', 'public.get_my_documents()', 'EXECUTE'), '11 authenticated ejecuta get_my_documents');
select ok(not has_function_privilege('authenticated', 'academic.get_my_documents()', 'EXECUTE'), '12 helper académico no es ejecutable por authenticated');
select ok(not has_schema_privilege('authenticated', 'academic', 'USAGE'), '13 authenticated no recibe USAGE en academic');
select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'academic'
      and table_name = 'guardian_access_scopes'
      and column_name = 'can_view_documents'
  ),
  '14 guardian_access_scopes contiene can_view_documents'
);
select ok(
  exists (
    select 1
    from academic.guardian_access_scopes
    where code = 'STANDARD_ACADEMIC_READ'
      and can_view_documents = false
  ),
  '15 STANDARD_ACADEMIC_READ mantiene documentos deshabilitados'
);
select ok(
  exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'academic'
      and t.typname = 'document_file_provider'
      and e.enumlabel = 'LOCAL_TEST'
  ),
  '16 provider LOCAL_TEST existe'
);
select ok(not has_table_privilege('authenticated', 'academic.document_issuances', 'SELECT'), '17 authenticated no recibe SELECT directo sobre document_issuances');

insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','docs-admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','docs-student@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','docs-guardian@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','docs-guardian-b@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('d2000000-0000-4000-8000-000000000001','ACTIVE'),
('d2000000-0000-4000-8000-000000000002','ACTIVE'),
('d2000000-0000-4000-8000-000000000003','ACTIVE'),
('d2000000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','ACTIVE',1),
('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','ACTIVE',1),
('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003','ACTIVE',1),
('d3000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('d3000000-0000-4000-8000-000000000001','SUPERADMIN'),
('d3000000-0000-4000-8000-000000000002','ALUMNO'),
('d3000000-0000-4000-8000-000000000003','TUTOR'),
('d3000000-0000-4000-8000-000000000004','TUTOR')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('d4000000-0000-4000-8000-000000000001','DOCS_CYCLE','Cycle docs','ACTIVE','2098-01-01','2098-12-31','d3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','DOCS_P1','Periodo docs',1,'2098-01-01','2098-06-30','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('d6000000-0000-4000-8000-000000000001','DOCS_PLAN','Plan docs','V1','ACTIVE','2098-01-01','d3000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('d6100000-0000-4000-8000-000000000001','DOCS_GEN','Generación docs','d4000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('d6200000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('d6500000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'DOCS_G1','Grupo docs','ACTIVE',10,'d3000000-0000-4000-8000-000000000001');

insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('d6900000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000002','d6000000-0000-4000-8000-000000000001','d6100000-0000-4000-8000-000000000001','DOCS_ALU_001','ACTIVE',1,'d3000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001');

insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('d6910000-0000-4000-8000-000000000001','d6900000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','d3000000-0000-4000-8000-000000000001','DOCS_ENROLL_REQ',repeat('a',64));

insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('d6920000-0000-4000-8000-000000000001','d6900000-0000-4000-8000-000000000001','d6910000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001',1,'d6500000-0000-4000-8000-000000000001','ACTIVE','DOCS_ENR_001','d3000000-0000-4000-8000-000000000001');

set local session_replication_role = replica;
insert into academic.guardian_student_link_requests(id,guardian_account_id,student_record_id,relationship_type,request_source,status,review_status,reason_code,requested_by_account_id,idempotency_key,request_fingerprint,requested_at,reviewed_at,approved_at,created_at,updated_at)
values
('d7100000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','d6900000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','APPROVED','VERIFIED','MANUAL_REVIEW_REQUIRED','d3000000-0000-4000-8000-000000000001','DOCS_LINK_REQ_A',repeat('b',64),now(),now(),now(),now(),now()),
('d7100000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000004','d6900000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','APPROVED','VERIFIED','MANUAL_REVIEW_REQUIRED','d3000000-0000-4000-8000-000000000001','DOCS_LINK_REQ_B',repeat('c',64),now(),now(),now(),now(),now());
insert into academic.guardian_student_links(id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,valid_from,valid_until,activated_by_account_id,activated_at,created_at,updated_at)
values
('d7200000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000003','d6900000-0000-4000-8000-000000000001','d7100000-0000-4000-8000-000000000001','MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),true,now(),null,'d3000000-0000-4000-8000-000000000001',now(),now(),now()),
('d7200000-0000-4000-8000-000000000002','d3000000-0000-4000-8000-000000000001','d6900000-0000-4000-8000-000000000001','d7100000-0000-4000-8000-000000000002','MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,now(),null,'d3000000-0000-4000-8000-000000000001',now(),now(),now());
set local session_replication_role = origin;

select lives_ok($$ select * from academic.create_document_request((select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'d6900000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','INSTITUTIONAL_VALIDATION_PENDING','DOC_REQ_001',null) $$,'18 creación de solicitud documental');
select lives_ok($$ select * from academic.submit_document_request((select id from academic.document_requests where idempotency_key='DOC_REQ_001'),'DOC_REQ_SUB_001',null) $$,'19 envío de solicitud documental');
select lives_ok($$ select * from academic.begin_document_review((select id from academic.document_requests where idempotency_key='DOC_REQ_001'),'DOC_REQ_REV_001',null) $$,'20 inicio de revisión documental');
select lives_ok($$ select * from academic.approve_document_request((select id from academic.document_requests where idempotency_key='DOC_REQ_001'),'DOC_REQ_APP_001',null) $$,'21 aprobación documental');
select lives_ok($$ select * from academic.create_document_issuance((select id from academic.document_requests where idempotency_key='DOC_REQ_001'),'DOC_ISS_001',null) $$,'22 creación de emisión documental');
create function pg_temp.current_folio_sequence() returns bigint language sql as $$
  select last_value
  from academic.document_folio_sequences
  where document_type_code = 'ENROLLMENT_CERTIFICATE'
    and issue_year = extract(year from statement_timestamp())::integer
$$;
create function pg_temp.current_folio_event_count() returns bigint language sql as $$
  select count(*)
  from academic.document_events
  where event_type = 'DOCUMENT_FOLIO_ASSIGNED'
    and idempotency_key = 'DOC_FOLIO_001'
$$;
create temp table pg_temp.document_folio_baseline as
select
  coalesce(pg_temp.current_folio_sequence(), 0) as sequence_before,
  pg_temp.current_folio_event_count() as events_before;
select ok(
  (
    (select institutional_folio from academic.assign_document_folio((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOC_FOLIO_001',null))
    like 'DOC-ECT-%'
  ),
  '23 folio técnico provisional generado'
);
select ok(
  exists (
    select 1
    from academic.document_commands
    where actor_account_id = 'd3000000-0000-4000-8000-000000000001'
      and command_type = 'ASSIGN_DOCUMENT_FOLIO'
      and idempotency_key = 'DOC_FOLIO_001'
      and status = 'COMPLETED'
      and result_entity_id = (select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001'))
      and completed_at is not null
  ),
  '24 comando de folio queda COMPLETED con resultado persistido'
);
select is(
  (
    select coalesce(pg_temp.current_folio_sequence(), 0) - sequence_before
    from pg_temp.document_folio_baseline
  ),
  1::bigint,
  '25 primera asignación consume una sola secuencia'
);
select is(
  (
    select institutional_folio
    from academic.assign_document_folio((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOC_FOLIO_001',null)
  ),
  (
    select institutional_folio
    from academic.document_issuances
    where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')
  ),
  '26 reintento con misma clave devuelve exactamente el mismo folio'
);
select is(
  (
    select count(*)
    from academic.document_commands
    where actor_account_id = 'd3000000-0000-4000-8000-000000000001'
      and command_type = 'ASSIGN_DOCUMENT_FOLIO'
  ),
  1::bigint,
  '27 reintento idempotente no crea un comando adicional'
);
select is(
  (
    select count(*)
    from academic.document_events
    where event_type = 'DOCUMENT_FOLIO_ASSIGNED'
      and idempotency_key = 'DOC_FOLIO_001'
  ),
  1::bigint,
  '28 reintento idempotente no duplica el evento de folio'
);
select is(
  (
    select coalesce(pg_temp.current_folio_sequence(), 0) - sequence_before
    from pg_temp.document_folio_baseline
  ),
  1::bigint,
  '29 reintento idempotente no consume secuencia adicional'
);

select lives_ok($$ select * from academic.create_document_request((select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'d6900000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','INSTITUTIONAL_VALIDATION_PENDING','DOC_REQ_002',null) $$,'30 segunda solicitud documental');
select lives_ok($$ select * from academic.submit_document_request((select id from academic.document_requests where idempotency_key='DOC_REQ_002'),'DOC_REQ_SUB_002',null) $$,'31 segundo envío documental');
select lives_ok($$ select * from academic.begin_document_review((select id from academic.document_requests where idempotency_key='DOC_REQ_002'),'DOC_REQ_REV_002',null) $$,'32 segunda revisión documental');
select lives_ok($$ select * from academic.approve_document_request((select id from academic.document_requests where idempotency_key='DOC_REQ_002'),'DOC_REQ_APP_002',null) $$,'33 segunda aprobación documental');
select lives_ok($$ select * from academic.create_document_issuance((select id from academic.document_requests where idempotency_key='DOC_REQ_002'),'DOC_ISS_002',null) $$,'34 segunda emisión documental');
select throws_ok(
  $$
    select *
    from academic.assign_document_folio(
      (select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_002')),
      'DOC_FOLIO_001',
      null
    )
  $$,
  'IDEMPOTENCY_CONFLICT',
  '35 misma clave con distinta huella devuelve IDEMPOTENCY_CONFLICT'
);
select ok(
  (
    select institutional_folio is null
    from academic.document_issuances
    where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_002')
  ),
  '36 conflicto de huella no altera la emisión secundaria'
);
select is(
  (
    select coalesce(pg_temp.current_folio_sequence(), 0) - sequence_before
    from pg_temp.document_folio_baseline
  ),
  1::bigint,
  '37 conflicto de huella tampoco consume secuencia adicional'
);
select is(
  (
    select pg_temp.current_folio_event_count() - events_before
    from pg_temp.document_folio_baseline
  ),
  1::bigint,
  '38 conflicto de huella no crea eventos de folio extra'
);
select is(
  (
    select institutional_folio
    from academic.assign_document_folio((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOC_FOLIO_002',null)
  ),
  (
    select institutional_folio
    from academic.document_issuances
    where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')
  ),
  '39 emisión ya foliada devuelve el mismo folio aun con clave distinta'
);
select is(
  (
    select count(*)
    from academic.document_commands
    where actor_account_id = 'd3000000-0000-4000-8000-000000000001'
      and command_type = 'ASSIGN_DOCUMENT_FOLIO'
      and idempotency_key = 'DOC_FOLIO_002'
  ),
  0::bigint,
  '40 emisión ya foliada no crea un segundo comando con otra clave'
);
select lives_ok($$ select * from academic.generate_document_snapshot((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOC_SNAPSHOT_001',null) $$,'41 snapshot documental generado');
select is(
  (
    select snapshot_payload->>'disclaimer'
    from academic.document_snapshots
    where document_issuance_id = (select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001'))
  ),
  'Documento informativo generado por el sistema. Su validez institucional está pendiente de confirmación.',
  '42 snapshot conserva leyenda provisional exacta'
);
select lives_ok($$ select * from academic.attach_document_file((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'LOCAL_TEST','local-test','documents/test/constancia.pdf','application/pdf',256,repeat('d',64),'DOC_FILE_001',null) $$,'43 archivo local adjuntado');
select ok(
  exists (
    select 1
    from academic.document_files
    where document_issuance_id = (select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001'))
      and storage_provider = 'LOCAL_TEST'
      and object_path = 'documents/test/constancia.pdf'
      and position(':' in object_path) = 0
  ),
  '44 metadatos del archivo usan provider local y path opaco'
);
select lives_ok($$ select * from academic.validate_document_issuance((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOC_VALIDATE_001',null) $$,'45 validación documental');
select lives_ok($$ select * from academic.publish_document((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),academic.document_hash('DOCS-CODE-001'),'DOCS','DOC_PUBLISH_001',null) $$,'46 publicación documental');

select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_version":1}',true);
create function pg_temp.current_docs() returns jsonb language sql as $$ select public.get_my_documents(); $$;
create function pg_temp.current_doc() returns jsonb language sql as $$ select public.get_my_document((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001'))); $$;
create function pg_temp.current_download() returns jsonb language sql as $$ select public.get_my_document_download((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001'))); $$;

select is(jsonb_array_length(pg_temp.current_docs()), 1, '47 alumno autenticado lista una sola emisión propia');
select ok(
  (pg_temp.current_doc()::text like '%d6900000-0000-4000-8000-000000000001%')::int = 0
  and (pg_temp.current_doc()::text like '%d3000000-0000-4000-8000-000000000002%')::int = 0
  and (pg_temp.current_doc()::text like '%@example.invalid%')::int = 0,
  '48 detalle propio no expone IDs internos ni correo'
);
select ok(
  (pg_temp.current_download()->>'objectPath') = 'documents/test/constancia.pdf'
  and (pg_temp.current_download()->>'objectPath') !~ '^[A-Za-z]:\\'
  and position(':' in (pg_temp.current_download()->>'objectPath')) = 0,
  '49 descriptor de descarga no expone ruta absoluta'
);

select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_version":1}',true);
select is(
  public.get_my_guardian_student_documents('d7200000-0000-4000-8000-000000000001')::jsonb,
  jsonb_build_object('error','DOCUMENT_SCOPE_DENIED'),
  '50 tutor activo sin scope documental recibe DOCUMENT_SCOPE_DENIED'
);

select set_config('request.jwt.claims', null, true);
select ok(
  (public.verify_document_public((select institutional_folio from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOCS-CODE-001')::text like '%VIGENTE%')::int = 1
  and (public.verify_document_public((select institutional_folio from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOCS-CODE-001')::text like '%institutionalStudentCode%')::int = 0
  and (public.verify_document_public((select institutional_folio from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOC_REQ_001')),'DOCS-CODE-001')::text like '%calificaciones%')::int = 0,
  '51 verificación pública mínima no expone PII ni datos académicos'
);

select * from finish();
rollback;
