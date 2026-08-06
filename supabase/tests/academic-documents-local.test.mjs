import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const psqlArgs = [
  "exec",
  "-i",
  container,
  "psql",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-At",
];

function runSql(sql) {
  const result = spawnSync("docker", psqlArgs, { encoding: "utf8", input: sql, shell: false });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test("storage permanece deshabilitado en configuración local", () => {
  const config = readFileSync("supabase/config.toml", "utf8");
  assert.match(config, /\[storage\]\s*[\s\S]*?enabled = false/i);
});

test("lectura documental del tutor permanece cerrada por scope y vínculo", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','docs-admin-local@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','docs-student-local@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','docs-guardian-local-a@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','e1000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','docs-guardian-local-b@example.invalid','{}','{}',now(),now());

insert into core.people(id,status) values
('e2000000-0000-4000-8000-000000000001','ACTIVE'),
('e2000000-0000-4000-8000-000000000002','ACTIVE'),
('e2000000-0000-4000-8000-000000000003','ACTIVE'),
('e2000000-0000-4000-8000-000000000004','ACTIVE');

insert into core.accounts(id,person_id,auth_user_id,account_status,session_version) values
('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','ACTIVE',1),
('e3000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000002','ACTIVE',1),
('e3000000-0000-4000-8000-000000000003','e2000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000003','ACTIVE',1),
('e3000000-0000-4000-8000-000000000004','e2000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000004','ACTIVE',1);

insert into core.account_roles(account_id,role_id)
select actor::uuid, r.id
from (values
('e3000000-0000-4000-8000-000000000001','SUPERADMIN'),
('e3000000-0000-4000-8000-000000000002','ALUMNO'),
('e3000000-0000-4000-8000-000000000003','TUTOR'),
('e3000000-0000-4000-8000-000000000004','TUTOR')
) seeded(actor, role_code)
join core.roles r on r.code = seeded.role_code;

select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id)
values('e4000000-0000-4000-8000-000000000001','DOCS_LOCAL_CYCLE','Cycle docs local','ACTIVE','2099-01-01','2099-12-31','e3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id)
values('e5000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001','DOCS_LOCAL_P1','Periodo docs local',1,'2099-01-01','2099-06-30','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id)
values('e6000000-0000-4000-8000-000000000001','DOCS_LOCAL_PLAN','Plan docs local','V1','ACTIVE','2099-01-01','e3000000-0000-4000-8000-000000000001');
insert into academic.student_generations(id,code,name,entry_school_cycle_id,study_plan_id,status,created_by_account_id)
values('e6100000-0000-4000-8000-000000000001','DOCS_LOCAL_GEN','Generación docs local','e4000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','ACTIVE','e3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required)
values('e6200000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',1,'Semestre 1',false);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,capacity,created_by_account_id)
values('e6500000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',1,'DOCS_LOCAL_G1','Grupo docs local','ACTIVE',10,'e3000000-0000-4000-8000-000000000001');
insert into academic.student_records(id,person_id,account_id,study_plan_id,generation_id,institutional_student_code,status,current_semester_number,created_by_account_id,first_enrollment_period_id,last_enrollment_period_id)
values('e6900000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','e6100000-0000-4000-8000-000000000001','DOCS_LOCAL_ALU_001','ACTIVE',1,'e3000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001');
insert into academic.enrollment_requests(id,student_record_id,academic_period_id,request_type,requested_semester_number,status,eligibility_status,eligibility_reason_code,requested_by_account_id,idempotency_key,request_fingerprint)
values('e6910000-0000-4000-8000-000000000001','e6900000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','INITIAL_ENROLLMENT',1,'APPROVED','ELIGIBLE','INITIAL_ENROLLMENT_ALLOWED','e3000000-0000-4000-8000-000000000001','DOCS_LOCAL_ENROLL_REQ',repeat('a',64));
insert into academic.period_enrollments(id,student_record_id,enrollment_request_id,academic_period_id,study_plan_id,semester_number,group_id,status,enrollment_number,enrolled_by_account_id)
values('e6920000-0000-4000-8000-000000000001','e6900000-0000-4000-8000-000000000001','e6910000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001',1,'e6500000-0000-4000-8000-000000000001','ACTIVE','DOCS_LOCAL_ENR_001','e3000000-0000-4000-8000-000000000001');

select * from academic.create_document_request((select id from academic.document_types where code='ENROLLMENT_CERTIFICATE'),'e6900000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','CONTROL_ESCOLAR','INSTITUTIONAL_VALIDATION_PENDING','DOCS_LOCAL_REQ_001',null);
select * from academic.submit_document_request((select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001'),'DOCS_LOCAL_REQ_SUB_001',null);
select * from academic.begin_document_review((select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001'),'DOCS_LOCAL_REQ_REV_001',null);
select * from academic.approve_document_request((select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001'),'DOCS_LOCAL_REQ_APP_001',null);
select * from academic.create_document_issuance((select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001'),'DOCS_LOCAL_ISS_001',null);
select * from academic.assign_document_folio((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),'DOCS_LOCAL_FOLIO_001',null);
select * from academic.generate_document_snapshot((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),'DOCS_LOCAL_SNAPSHOT_001',null);
select * from academic.attach_document_file((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),'LOCAL_TEST','local-test','documents/local/constancia.pdf','application/pdf',256,repeat('b',64),'DOCS_LOCAL_FILE_001',null);
select * from academic.validate_document_issuance((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),'DOCS_LOCAL_VALIDATE_001',null);
select * from academic.publish_document((select id from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),academic.document_hash('DOCS-LOCAL-CODE'),'DOCS','DOCS_LOCAL_PUBLISH_001',null);

set local session_replication_role=replica;
insert into academic.guardian_student_link_requests(id,guardian_account_id,student_record_id,relationship_type,request_source,status,review_status,reason_code,requested_by_account_id,idempotency_key,request_fingerprint,requested_at,reviewed_at,approved_at,created_at,updated_at)
values
('e7100000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003','e6900000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','APPROVED','VERIFIED','MANUAL_REVIEW_REQUIRED','e3000000-0000-4000-8000-000000000001','DOCS_LOCAL_LINK_REQ_A',repeat('c',64),now(),now(),now(),now(),now()),
('e7100000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000004','e6900000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','APPROVED','VERIFIED','MANUAL_REVIEW_REQUIRED','e3000000-0000-4000-8000-000000000001','DOCS_LOCAL_LINK_REQ_B',repeat('d',64),now(),now(),now(),now(),now()),
('e7100000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000003','e6900000-0000-4000-8000-000000000001','MOTHER','CONTROL_ESCOLAR','EXPIRED','VERIFIED','MANUAL_REVIEW_REQUIRED','e3000000-0000-4000-8000-000000000001','DOCS_LOCAL_LINK_REQ_C',repeat('e',64),now(),now(),now(),now(),now());
insert into academic.guardian_student_links(id,guardian_account_id,student_record_id,source_request_id,relationship_type,status,access_scope_id,is_primary,valid_from,valid_until,activated_by_account_id,suspended_by_account_id,activated_at,suspended_at,created_at,updated_at)
values
('e7200000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000003','e6900000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000001','MOTHER','ACTIVE',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),true,now(),null,'e3000000-0000-4000-8000-000000000001',null,now(),null,now(),now()),
('e7200000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000004','e6900000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000002','MOTHER','SUSPENDED',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,now(),null,'e3000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',now(),now(),now(),now()),
('e7200000-0000-4000-8000-000000000003','e3000000-0000-4000-8000-000000000003','e6900000-0000-4000-8000-000000000001','e7100000-0000-4000-8000-000000000003','MOTHER','EXPIRED',(select id from academic.guardian_access_scopes where code='STANDARD_ACADEMIC_READ'),false,now() - interval '10 days',now() - interval '1 day','e3000000-0000-4000-8000-000000000001',null,now(),null,now(),now());
set local session_replication_role=origin;

select set_config('request.jwt.claims','{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_version":1}',true);
select public.get_my_guardian_student_documents('e7200000-0000-4000-8000-000000000001');
do $$ begin
  perform public.get_my_guardian_student_documents('e7200000-0000-4000-8000-000000000002');
  raise exception 'suspended link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;
do $$ begin
  perform public.get_my_guardian_student_documents('e7200000-0000-4000-8000-000000000003');
  raise exception 'expired link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;
do $$ begin
  perform public.get_my_guardian_student_documents('e7200000-0000-4000-8000-000000000003');
  raise exception 'foreign link accepted';
exception when others then
  if sqlerrm <> 'GUARDIAN_PORTAL_ACCESS_DENIED' then raise; end if;
end $$;

select set_config('request.jwt.claims', null, true);
select public.verify_document_public(
  (select institutional_folio from academic.document_issuances where document_request_id=(select id from academic.document_requests where idempotency_key='DOCS_LOCAL_REQ_001')),
  'DOCS-LOCAL-CODE'
)::text;
rollback;
  `);

  const lines = output.split(/\r?\n/).filter(Boolean);
  const scopeDeniedLine = lines.find((line) => line.includes("DOCUMENT_SCOPE_DENIED"));
  const verificationLine = [...lines]
    .reverse()
    .find((line) => line.includes('"status": "VIGENTE"'));

  assert.equal(scopeDeniedLine, '{"error": "DOCUMENT_SCOPE_DENIED"}');
  assert.match(verificationLine ?? "", /"status": "VIGENTE"/);
  assert.doesNotMatch(
    verificationLine ?? "",
    /institutionalStudentCode|personId|accountId|authUserId|@example\.invalid/i,
  );
});
