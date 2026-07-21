import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";
const source = readFileSync(
  new URL("./attendance-management-local.test.mjs", import.meta.url),
  "utf8",
);
const fixture = source.match(/begin;([\s\S]*?)create temporary table b4_ids/);
assert.ok(fixture, "No se encontró el fixture académico sintético");

function run(sql) {
  return spawnSync(
    "docker",
    [
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
      "-Atq",
    ],
    { encoding: "utf8", input: sql, shell: false },
  );
}

test("recorre cuarenta controles institucionales de calificaciones y revierte fixtures", () => {
  const admin = `select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);`;
  const teacher = `select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2","session_version":1}',true);`;
  const sql = `begin;${fixture[1]}
select set_config('academic.actor_account_id','f3000000-0000-4000-8000-000000000001',true),set_config('academic.operation_key','B5_UNITS_FIXTURE',true);
insert into academic.subject_units(id,curriculum_subject_id,unit_number,name,display_order) values
('f5600000-0000-4000-8000-000000000001','f4500000-0000-4000-8000-000000000001',1,'Unit one',1),
('f5600000-0000-4000-8000-000000000002','f4500000-0000-4000-8000-000000000001',2,'Unit two',2),
('f5600000-0000-4000-8000-000000000003','f4500000-0000-4000-8000-000000000001',3,'Unit three',3);
${admin}
create temporary table b5_ids(name text primary key,id uuid);
insert into b5_ids select 'w'||u,entity_id from generate_series(1,3) u cross join lateral academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',u::smallint,'UNIT_CAPTURE','2020-01-01','2100-01-01','B5_WINDOW_'||u);
do $$declare r record; begin for r in select * from b5_ids loop perform * from academic.open_grade_capture_window(r.id,'B5_OPEN_'||r.name); end loop; end$$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true);
do $$begin perform * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',null,'FINAL_REVIEW','2020-01-01','2100-01-01','B5_AAL1'); raise exception 'EXPECTED_AAL2_REQUIRED'; exception when others then if sqlerrm not like '%AAL2_REQUIRED%' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":999}',true);
do $$begin perform * from academic.create_grade_capture_window('f4100000-0000-4000-8000-000000000001',null,'FINAL_REVIEW','2020-01-01','2100-01-01','B5_STALE'); raise exception 'EXPECTED_ACTOR_NOT_AUTHORIZED'; exception when others then if sqlerrm not like '%ACTOR_NOT_AUTHORIZED%' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$begin perform * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'B5_PREFECT'); raise exception 'EXPECTED_ACTOR_NOT_AUTHORIZED'; exception when others then if sqlerrm not like '%ACTOR_NOT_AUTHORIZED%' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$begin perform * from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',7,'B5_CASH'); raise exception 'EXPECTED_ACTOR_NOT_AUTHORIZED'; exception when others then if sqlerrm not like '%ACTOR_NOT_AUTHORIZED%' then raise; end if; end$$;
${teacher}
insert into b5_ids select 'g1',entity_id from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000001',5.95,'B5_GRADE_1');
insert into b5_ids select 'g2',entity_id from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000002',6.25,'B5_GRADE_2');
insert into b5_ids select 'g3',entity_id from academic.capture_student_unit_grade('f5500000-0000-4000-8000-000000000001','f5600000-0000-4000-8000-000000000003',6.26,'B5_GRADE_3');
do $$declare r record; begin for r in select * from b5_ids where name like 'g%' loop perform * from academic.review_student_unit_grade(r.id,'B5_REVIEW_'||r.name); perform * from academic.finalize_student_unit_grade(r.id,'B5_FINAL_'||r.name); end loop; end$$;
${admin}
insert into b5_ids select 'result',entity_id from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','B5_RESULT');
do $$begin
 if academic.apply_institutional_grade_rounding(5.95)<>5.95 then raise exception '5.95_INVALID'; end if;
 if academic.apply_institutional_grade_rounding(6.25)<>6 then raise exception '6.25_INVALID'; end if;
 if academic.apply_institutional_grade_rounding(6.26)<>6.5 then raise exception '6.26_INVALID'; end if;
 if academic.apply_institutional_grade_rounding(6.75)<>6.5 then raise exception '6.75_INVALID'; end if;
 if academic.apply_institutional_grade_rounding(6.76)<>7 then raise exception '6.76_INVALID'; end if;
 if not exists(select 1 from academic.subject_final_results where result_code='AC' and accredited_unit_count=2 and raw_final_grade is null and rounded_final_grade is null and calculation_status='MANUAL_REVIEW_REQUIRED') then raise exception 'SUBJECT_RESULT_INVALID'; end if;
end$$;
insert into b5_ids select 'summary',entity_id from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','B5_SUMMARY');
insert into b5_ids select 'correction',entity_id from academic.create_grade_correction((select id from b5_ids where name='g1'),7,'DATA_ENTRY_ERROR','B5_CORRECTION');
select * from academic.create_grade_correction((select id from b5_ids where name='g1'),7,'DATA_ENTRY_ERROR','B5_CORRECTION');
do $$begin perform * from academic.create_grade_correction((select id from b5_ids where name='g1'),8,'DATA_ENTRY_ERROR','B5_CORRECTION'); raise exception 'EXPECTED_IDEMPOTENCY_CONFLICT'; exception when others then if sqlerrm not like '%IDEMPOTENCY_CONFLICT%' then raise; end if; end$$;
select * from academic.submit_grade_correction((select id from b5_ids where name='correction'),'B5_CORRECTION_SUBMIT');
select * from academic.begin_grade_correction_review((select id from b5_ids where name='correction'),'B5_CORRECTION_REVIEW');
select * from academic.approve_grade_correction((select id from b5_ids where name='correction'),'B5_CORRECTION_APPROVE');
select * from academic.approve_grade_correction((select id from b5_ids where name='correction'),'B5_CORRECTION_APPROVE');
select * from academic.apply_grade_correction((select id from b5_ids where name='correction'),'B5_CORRECTION_APPLY');
select * from academic.apply_grade_correction((select id from b5_ids where name='correction'),'B5_CORRECTION_APPLY');
select * from academic.calculate_subject_final_result('f5500000-0000-4000-8000-000000000001','B5_RESULT_AFTER_CORRECTION');
select * from academic.confirm_subject_final_result((select id from b5_ids where name='result'),'B5_CONFIRM_RESULT');
select * from academic.confirm_subject_final_result((select id from b5_ids where name='result'),'B5_CONFIRM_RESULT');
select * from academic.calculate_semester_evaluation_summary('f5300000-0000-4000-8000-000000000001','B5_SUMMARY_AFTER_CORRECTION');
select set_config('academic.grade_controlled_mutation','on',true);
update academic.semester_evaluation_summaries set evaluation_status='COMPLETE',proposed_progress_decision='ADVANCE',proposal_reason_code='ALL_SUBJECTS_AC' where id=(select id from b5_ids where name='summary');
select set_config('academic.grade_controlled_mutation','off',true);
insert into b5_ids select 'decision',entity_id from academic.confirm_semester_progress_decision((select id from b5_ids where name='summary'),'B5_CONFIRM_PROGRESS');
select * from academic.confirm_semester_progress_decision((select id from b5_ids where name='summary'),'B5_CONFIRM_PROGRESS');
do $$begin
 if not exists(select 1 from academic.student_unit_grades where id=(select id from b5_ids where name='g1') and raw_grade=7 and status='CORRECTED') then raise exception 'CORRECTION_NOT_APPLIED'; end if;
 if (select count(*) from academic.student_unit_grade_history)<4 then raise exception 'HISTORY_MISSING'; end if;
 if (select count(*) from academic.student_unit_grade_history where correction_id=(select id from b5_ids where name='correction'))<>1 then raise exception 'HISTORY_DUPLICATED'; end if;
 if (select count(*) from academic.grade_events where event_type='SUBJECT_RESULT_CONFIRMED')<>1 then raise exception 'CONFIRM_EVENT_DUPLICATED'; end if;
 if (select count(*) from academic.grade_events where event_type='GRADE_CORRECTION_APPLIED')<>1 then raise exception 'CORRECTION_EVENT_DUPLICATED'; end if;
 if (select count(*) from academic.grade_events where event_type='PROGRESS_DECISION_CONFIRMED')<>1 then raise exception 'PROGRESS_EVENT_DUPLICATED'; end if;
 if (select count(*) from academic.academic_progress_decisions where source_period_enrollment_id='f5300000-0000-4000-8000-000000000001' and decision_status='CONFIRMED')<>1 then raise exception 'PROGRESS_DECISION_DUPLICATED'; end if;
 if (select count(*) from academic.grade_events)<15 then raise exception 'AUDIT_MISSING'; end if;
 if (select count(*) from academic.grade_commands where request_fingerprint!~'^[0-9a-f]{64}$')<>0 then raise exception 'SHA256_INVALID'; end if;
 if exists(select 1 from academic.semester_evaluation_summaries where evaluation_status<>'CONFIRMED' and proposed_progress_decision<>'MANUAL_REVIEW_REQUIRED') then raise exception 'PROGRESS_RULE_INVENTED'; end if;
end$$;
rollback;`;
  const result = run(sql);
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.doesNotMatch(result.stdout + result.stderr, /@|token|password|curp/i);
});
