import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const container = "supabase_db_sistema-preparatoria-local";

function runSql(sql) {
  const result = spawnSync(
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
      "-At",
    ],
    { encoding: "utf8", input: sql, shell: false },
  );
  assert.equal(result.status, 0, `Falló la prueba académica local: ${result.stderr}`);
  return result.stdout;
}

test("flujo académico completo usa mutaciones controladas y revierte sus fixtures", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','admin@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000002','authenticated','authenticated','synthetic','teacher@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000003','authenticated','authenticated','synthetic','operator@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000004','authenticated','authenticated','synthetic','control@example.invalid','{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','a1000000-0000-4000-8000-000000000005','authenticated','authenticated','synthetic','cash@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) select ('a2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.person_status from generate_series(1,5)n;
insert into core.accounts(id,person_id,auth_user_id,account_status) select ('a3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('a2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('a1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'::core.account_status from generate_series(1,5)n;
insert into core.account_roles(account_id,role_id) select actor::uuid,r.id from (values
('a3000000-0000-4000-8000-000000000001','SUPERADMIN'),('a3000000-0000-4000-8000-000000000002','DOCENTE'),
('a3000000-0000-4000-8000-000000000003','ADMINISTRATIVO'),('a3000000-0000-4000-8000-000000000004','CONTROL_ESCOLAR'),
('a3000000-0000-4000-8000-000000000005','CAJA'))v(actor,role_code) join core.roles r on r.code=v.role_code;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);
create temporary table ids(name text primary key,id uuid);

insert into ids select 'cycle',entity_id from academic.create_school_cycle('SYNTHETIC_CYCLE','Ciclo sintético','2098-01-01','2098-12-31','LOCAL_CYCLE_01');
select * from academic.plan_school_cycle((select id from ids where name='cycle'),'LOCAL_CYCLE_PLAN');
select * from academic.activate_school_cycle((select id from ids where name='cycle'),'LOCAL_CYCLE_ACTIVE');
insert into ids select 'period',entity_id from academic.create_academic_period((select id from ids where name='cycle'),'P1','Periodo uno',1::smallint,'2098-01-01','2098-06-30','LOCAL_PERIOD_01');
select * from academic.plan_academic_period((select id from ids where name='period'),'LOCAL_PERIOD_PLAN');
select * from academic.activate_academic_period((select id from ids where name='period'),'LOCAL_PERIOD_ACTIVE');
insert into ids select 'period2',entity_id from academic.create_academic_period((select id from ids where name='cycle'),'P2','Periodo dos',2::smallint,'2098-07-01','2098-12-31','LOCAL_PERIOD_02');

insert into ids select 'plan',entity_id from academic.create_study_plan('SYNTHETIC_PLAN','Plan sintético','V1','2098-01-01','LOCAL_PLAN_01');
do $$begin if (select count(*) from academic.plan_semesters where study_plan_id=(select id from ids where name='plan'))<>6 then raise exception 'six semesters missing'; end if; end$$;
insert into ids select 'common-subject',entity_id from academic.create_subject('SYNTHETIC_COMMON','Materia común','COMMON','LOCAL_SUBJECT_01');
insert into ids select 'area-subject',entity_id from academic.create_subject('SYNTHETIC_AREA','Materia de área','AREA_SPECIFIC','LOCAL_SUBJECT_02');
insert into ids select 'common-curriculum',entity_id from academic.add_subject_to_study_plan((select id from ids where name='plan'),(select id from academic.plan_semesters where study_plan_id=(select id from ids where name='plan') and semester_number=1),(select id from ids where name='common-subject'),null,1::smallint,'LOCAL_CURRICULUM_01');
insert into ids select 'area-curriculum',entity_id from academic.add_subject_to_study_plan((select id from ids where name='plan'),(select id from academic.plan_semesters where study_plan_id=(select id from ids where name='plan') and semester_number=5),(select id from ids where name='area-subject'),(select id from academic.training_areas where code='QUIMICO_BIOLOGOS'),1::smallint,'LOCAL_CURRICULUM_02');
select * from academic.create_subject_units((select id from ids where name='common-curriculum'),'LOCAL_UNITS_01');
do $$begin insert into academic.subject_units(curriculum_subject_id,unit_number,name,display_order) values((select id from ids where name='common-curriculum'),4,'Unidad cuatro',4); raise exception 'fourth unit accepted'; exception when check_violation then null; end$$;
select * from academic.submit_study_plan_for_review((select id from ids where name='plan'),'LOCAL_PLAN_REVIEW');
select * from academic.approve_study_plan((select id from ids where name='plan'),'LOCAL_PLAN_APPROVE');
do $$begin update academic.study_plans set name='Cambio prohibido' where id=(select id from ids where name='plan'); raise exception 'approved mutation accepted'; exception when others then if sqlerrm<>'STUDY_PLAN_IMMUTABLE' then raise; end if; end$$;
select * from academic.activate_study_plan((select id from ids where name='plan'),'LOCAL_PLAN_ACTIVE');

insert into ids select 'common-group',entity_id from academic.create_group((select id from ids where name='period'),(select id from ids where name='plan'),1::smallint,null,'G1A','Grupo común','LOCAL_GROUP_01');
select * from academic.plan_group((select id from ids where name='common-group'),'LOCAL_GROUP_PLAN');
select * from academic.open_group((select id from ids where name='common-group'),'LOCAL_GROUP_OPEN');
select * from academic.activate_group((select id from ids where name='common-group'),'LOCAL_GROUP_ACTIVE');
insert into ids select 'fm-group',entity_id from academic.create_group((select id from ids where name='period'),(select id from ids where name='plan'),5::smallint,(select id from academic.training_areas where code='FISICO_MATEMATICOS'),'G5FM','Grupo FM','LOCAL_GROUP_02');
insert into ids select 'qb-group1',entity_id from academic.create_group((select id from ids where name='period'),(select id from ids where name='plan'),5::smallint,(select id from academic.training_areas where code='QUIMICO_BIOLOGOS'),'G5QB1','Grupo QB uno','LOCAL_GROUP_03');
insert into ids select 'qb-group2',entity_id from academic.create_group((select id from ids where name='period'),(select id from ids where name='plan'),5::smallint,(select id from academic.training_areas where code='QUIMICO_BIOLOGOS'),'G5QB2','Grupo QB dos','LOCAL_GROUP_04');

insert into ids select 'common-offering',entity_id from academic.create_academic_offering((select id from ids where name='common-group'),(select id from ids where name='common-curriculum'),'LOCAL_OFFER_01');
select * from academic.plan_academic_offering((select id from ids where name='common-offering'),'LOCAL_OFFER_PLAN');
select * from academic.activate_academic_offering((select id from ids where name='common-offering'),'LOCAL_OFFER_ACTIVE');
insert into ids select 'specific-offering',entity_id from academic.create_academic_offering((select id from ids where name='qb-group1'),(select id from ids where name='area-curriculum'),'LOCAL_OFFER_02');
do $$begin perform * from academic.create_academic_offering((select id from ids where name='fm-group'),(select id from ids where name='area-curriculum'),'LOCAL_OFFER_BAD'); raise exception 'incompatible offering accepted'; exception when others then if sqlerrm<>'ACADEMIC_OFFERING_PLAN_MISMATCH' then raise; end if; end$$;

insert into ids select 'assignment',entity_id from academic.assign_teacher((select id from ids where name='common-offering'),'a3000000-0000-4000-8000-000000000002','PRIMARY','2098-01-01',null,'LOCAL_ASSIGN_01');
select * from academic.activate_teaching_assignment((select id from ids where name='assignment'),'LOCAL_ASSIGN_ACTIVE');
insert into ids select 'cancel-assignment',entity_id from academic.assign_teacher((select id from ids where name='common-offering'),'a3000000-0000-4000-8000-000000000002','CO_TEACHER','2098-01-01',null,'LOCAL_ASSIGN_CANCEL_CREATE');
select * from academic.cancel_teaching_assignment((select id from ids where name='cancel-assignment'),'LOCAL_ASSIGN_CANCEL');
do $$begin perform * from academic.assign_teacher((select id from ids where name='common-offering'),'a3000000-0000-4000-8000-000000000002','PRIMARY','2098-01-01',null,'LOCAL_ASSIGN_02'); raise exception 'second primary accepted'; exception when unique_violation then null; end$$;
select * from academic.end_teaching_assignment((select id from ids where name='assignment'),'LOCAL_ASSIGN_END');
do $$begin perform * from academic.activate_teaching_assignment((select id from ids where name='assignment'),'LOCAL_ASSIGN_REACTIVATE'); raise exception 'ended assignment reactivated'; exception when others then if sqlerrm<>'TEACHER_ASSIGNMENT_CONFLICT' then raise; end if; end$$;

select * from academic.close_academic_offering((select id from ids where name='common-offering'),'LOCAL_OFFER_CLOSE');
select * from academic.close_group((select id from ids where name='common-group'),'LOCAL_GROUP_CLOSE');
select * from academic.begin_academic_period_closing((select id from ids where name='period'),'LOCAL_PERIOD_CLOSING');
select * from academic.plan_academic_offering((select id from ids where name='specific-offering'),'LOCAL_SPECIFIC_PLAN');
do $$begin perform * from academic.activate_academic_offering((select id from ids where name='specific-offering'),'LOCAL_SPECIFIC_ACTIVE'); raise exception 'offering activated while closing'; exception when others then if sqlerrm<>'ACADEMIC_OFFERING_CONFLICT' then raise; end if; end$$;
select * from academic.cancel_academic_offering((select id from ids where name='specific-offering'),'LOCAL_SPECIFIC_CANCEL');
select * from academic.cancel_group((select id from ids where name='fm-group'),'LOCAL_FM_GROUP_CANCEL');
select * from academic.cancel_group((select id from ids where name='qb-group1'),'LOCAL_QB1_GROUP_CANCEL');
select * from academic.cancel_group((select id from ids where name='qb-group2'),'LOCAL_QB2_GROUP_CANCEL');
select * from academic.close_academic_period((select id from ids where name='period'),'LOCAL_PERIOD_CLOSE');
select * from academic.cancel_academic_period((select id from ids where name='period2'),'LOCAL_PERIOD2_CANCEL');
select * from academic.begin_school_cycle_closing((select id from ids where name='cycle'),'LOCAL_CYCLE_CLOSING');
select * from academic.close_school_cycle((select id from ids where name='cycle'),'LOCAL_CYCLE_CLOSE');
select * from academic.retire_study_plan((select id from ids where name='plan'),'LOCAL_PLAN_RETIRE');
insert into ids select 'cancel-cycle',entity_id from academic.create_school_cycle('SYNTHETIC_CANCEL_CYCLE','Ciclo cancelable','2100-01-01','2100-12-31','LOCAL_CANCEL_CYCLE_CREATE');
select * from academic.cancel_school_cycle((select id from ids where name='cancel-cycle'),'LOCAL_CANCEL_CYCLE');
insert into ids select 'cancel-plan',entity_id from academic.create_study_plan('SYNTHETIC_CANCEL_PLAN','Plan cancelable','V1','2100-01-01','LOCAL_CANCEL_PLAN_CREATE');
select * from academic.cancel_study_plan((select id from ids where name='cancel-plan'),'LOCAL_CANCEL_PLAN');

do $$begin update academic.academic_periods set name='Cambio' where id=(select id from ids where name='period'); raise exception 'closed period changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin update academic.groups set display_name='Cambio' where id=(select id from ids where name='common-group'); raise exception 'closed group changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin update academic.academic_offerings set updated_at=now() where id=(select id from ids where name='common-offering'); raise exception 'closed offering changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin update academic.teaching_assignments set updated_at=now() where id=(select id from ids where name='assignment'); raise exception 'ended assignment changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin update academic.training_areas set code='CHANGED' where code='FISICO_MATEMATICOS'; raise exception 'area code changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$begin update academic.academic_commands set resulting_entity_type='CHANGED' where status='COMPLETED'; raise exception 'completed command changed'; exception when others then if sqlerrm<>'HISTORICAL_RECORD_IMMUTABLE' then raise; end if; end$$;
do $$declare table_name text; begin foreach table_name in array array['school_cycles','academic_periods','study_plans','plan_semesters','training_areas','subjects','curriculum_subjects','subject_units','groups','academic_offerings','teaching_assignments','academic_structure_events','academic_commands'] loop begin execute format('delete from academic.%I where true',table_name); raise exception 'delete accepted for %',table_name; exception when others then if sqlerrm not in ('HISTORICAL_RECORD_IMMUTABLE','ACADEMIC_HISTORY_IMMUTABLE') then raise; end if; end; end loop; end$$;

do $$declare completed integer; events integer; begin select count(*) into completed from academic.academic_commands where status='COMPLETED'; select count(*) into events from academic.academic_structure_events; if completed<>events then raise exception 'audit mismatch commands %, events %',completed,events; end if; end$$;
do $$declare original uuid; replay uuid; begin select id into original from ids where name='cycle'; select entity_id into replay from academic.plan_school_cycle(original,'LOCAL_CYCLE_PLAN'); if replay<>original then raise exception 'idempotency failed'; end if; end$$;
do $$begin perform academic.begin_academic_command('a3000000-0000-4000-8000-000000000001','PLAN_SCHOOL_CYCLE','LOCAL_CYCLE_PLAN',repeat('f',64)); raise exception 'fingerprint conflict accepted'; exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end$$;

do $$begin perform set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_version":1}',true); perform academic.require_academic_permission('academic.groups.manage'); raise exception 'aal1 accepted'; exception when others then if sqlerrm<>'AAL2_REQUIRED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2","session_version":1}',true);
select academic.require_academic_permission('academic.groups.manage');
do $$begin perform academic.require_academic_permission('academic.plans.approve'); raise exception 'control approved plan'; exception when others then if sqlerrm<>'ACTOR_NOT_AUTHORIZED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal2","session_version":1}',true);
do $$begin perform academic.require_academic_permission('academic.groups.manage'); raise exception 'cash accepted'; exception when others then if sqlerrm<>'ACTOR_NOT_AUTHORIZED' then raise; end if; end$$;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":99}',true);
do $$begin perform academic.require_academic_permission('academic.groups.manage'); raise exception 'stale session accepted'; exception when others then if sqlerrm<>'SESSION_VERSION_INVALID' then raise; end if; end$$;
do $$begin set local role authenticated; perform * from academic.get_academic_structure_summary(); raise exception 'direct access accepted'; exception when insufficient_privilege then null; end$$;
reset role;
select 'LOCAL_INTEGRATION_46_STEPS_OK';
rollback;
`);
  assert.match(output, /LOCAL_INTEGRATION_46_STEPS_OK/);
});
