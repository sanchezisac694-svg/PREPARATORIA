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
  assert.equal(result.status, 0, `Fallo flujo local de horarios: ${result.stderr}`);
  return result.stdout;
}

test("ejecuta los 49 pasos institucionales de horarios y revierte fixtures", () => {
  const output = runSql(String.raw`
begin;
insert into auth.users(instance_id,id,aud,role,encrypted_password,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d1000000-0000-4000-8000-000000000001','authenticated','authenticated','synthetic','schedule-admin@example.invalid','{}','{}',now(),now());
insert into core.people(id,status) values
('d2000000-0000-4000-8000-000000000001','ACTIVE'),('d2000000-0000-4000-8000-000000000002','ACTIVE');
insert into core.accounts(id,person_id,auth_user_id,account_status) values
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','ACTIVE'),
('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002',null,'ACTIVE');
insert into core.account_roles(account_id,role_id) select v.account_id::uuid,r.id from (values
('d3000000-0000-4000-8000-000000000001','SUPERADMIN'),('d3000000-0000-4000-8000-000000000002','DOCENTE'))v(account_id,role_code) join core.roles r on r.code=v.role_code;
select set_config('request.jwt.claims','{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_version":1}',true);

insert into academic.school_cycles(id,code,name,status,starts_on,ends_on,created_by_account_id) values('d4000000-0000-4000-8000-000000000001','B3_CYCLE','Synthetic cycle','ACTIVE','2094-01-01','2094-12-31','d3000000-0000-4000-8000-000000000001');
insert into academic.academic_periods(id,school_cycle_id,code,name,sequence_number,starts_on,ends_on,status,created_by_account_id) values('d4100000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','B3_PERIOD','Synthetic period',1,'2094-01-01','2094-06-30','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.study_plans(id,code,name,version,status,valid_from,created_by_account_id) values('d4200000-0000-4000-8000-000000000001','B3_PLAN','Synthetic plan','V1','ACTIVE','2094-01-01','d3000000-0000-4000-8000-000000000001');
insert into academic.plan_semesters(id,study_plan_id,semester_number,name,specialization_required) values('d4300000-0000-4000-8000-000000000001','d4200000-0000-4000-8000-000000000001',1,'Semester one',false);
insert into academic.subjects(id,code,name,subject_type,created_by_account_id) values('d4400000-0000-4000-8000-000000000001','B3_SUBJECT','Synthetic subject','COMMON','d3000000-0000-4000-8000-000000000001');
insert into academic.curriculum_subjects(id,study_plan_id,plan_semester_id,subject_id,display_order) values('d4500000-0000-4000-8000-000000000001','d4200000-0000-4000-8000-000000000001','d4300000-0000-4000-8000-000000000001','d4400000-0000-4000-8000-000000000001',1);
insert into academic.groups(id,academic_period_id,study_plan_id,semester_number,code,display_name,status,created_by_account_id) values('d4600000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000001','d4200000-0000-4000-8000-000000000001',1,'B3_GROUP','Synthetic group','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.academic_offerings(id,academic_period_id,group_id,curriculum_subject_id,status,created_by_account_id) values('d4700000-0000-4000-8000-000000000001','d4100000-0000-4000-8000-000000000001','d4600000-0000-4000-8000-000000000001','d4500000-0000-4000-8000-000000000001','ACTIVE','d3000000-0000-4000-8000-000000000001');
insert into academic.teaching_assignments(id,academic_offering_id,teacher_account_id,assignment_type,status,valid_from,assigned_by_account_id) values('d4800000-0000-4000-8000-000000000001','d4700000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002','PRIMARY','ACTIVE','2094-01-01','d3000000-0000-4000-8000-000000000001');

create temporary table b3_ids(name text primary key,id uuid);
insert into b3_ids select 'shift',entity_id from academic.create_academic_shift('B3_SHIFT','Synthetic shift','07:00','13:00','B3_SHIFT_CREATE');
select * from academic.activate_academic_shift((select id from b3_ids where name='shift'),'B3_SHIFT_ACTIVE');
insert into b3_ids select 'room',entity_id from academic.create_academic_space('B3_ROOM','Synthetic room','CLASSROOM',30,null,null,null,'B3_ROOM_CREATE');
insert into b3_ids select 'lab',entity_id from academic.create_academic_space('B3_LAB','Synthetic laboratory','LABORATORY',20,null,null,null,'B3_LAB_CREATE');
select * from academic.activate_academic_space((select id from b3_ids where name='room'),'B3_ROOM_ACTIVE');
select * from academic.activate_academic_space((select id from b3_ids where name='lab'),'B3_LAB_ACTIVE');
insert into b3_ids select 'block1',entity_id from academic.create_schedule_time_block((select id from b3_ids where name='shift'),'B3_P1','Period one',1::smallint,'07:00','07:50',true,false,'B3_BLOCK1_CREATE');
insert into b3_ids select 'block2',entity_id from academic.create_schedule_time_block((select id from b3_ids where name='shift'),'B3_P2','Period two',2::smallint,'08:00','08:50',false,false,'B3_BLOCK2_CREATE');
insert into b3_ids select 'break',entity_id from academic.create_schedule_time_block((select id from b3_ids where name='shift'),'B3_BREAK','Break',3::smallint,'08:50','09:10',false,true,'B3_BREAK_CREATE');
select * from academic.activate_schedule_time_block((select id from b3_ids where name='block1'),'B3_BLOCK1_ACTIVE');
select * from academic.activate_schedule_time_block((select id from b3_ids where name='block2'),'B3_BLOCK2_ACTIVE');
select * from academic.activate_schedule_time_block((select id from b3_ids where name='break'),'B3_BREAK_ACTIVE');
insert into b3_ids select 'template',entity_id from academic.create_schedule_template('B3_TEMPLATE','Synthetic template',(select id from b3_ids where name='shift'),'2094-01-01','2094-06-30','B3_TEMPLATE_CREATE');
select * from academic.add_schedule_template_block((select id from b3_ids where name='template'),1::smallint,(select id from b3_ids where name='block1'),'B3_TEMPLATE_BLOCK1');
select * from academic.add_schedule_template_block((select id from b3_ids where name='template'),1::smallint,(select id from b3_ids where name='block2'),'B3_TEMPLATE_BLOCK2');
select * from academic.submit_schedule_template((select id from b3_ids where name='template'),'B3_TEMPLATE_SUBMIT');
select * from academic.approve_schedule_template((select id from b3_ids where name='template'),'B3_TEMPLATE_APPROVE');
select * from academic.activate_schedule_template((select id from b3_ids where name='template'),'B3_TEMPLATE_ACTIVE');
insert into b3_ids select 'availability',entity_id from academic.declare_teacher_availability('d3000000-0000-4000-8000-000000000002','d4100000-0000-4000-8000-000000000001',1::smallint,(select id from b3_ids where name='block1'),'AVAILABLE','2094-01-01','2094-06-30','B3_AVAIL_CREATE');
insert into b3_ids select 'schedule',entity_id from academic.create_group_schedule('d4600000-0000-4000-8000-000000000001',(select id from b3_ids where name='template'),1,'2094-01-01','2094-06-30','B3_SCHEDULE_CREATE');
insert into b3_ids select 'session',entity_id from academic.create_class_session((select id from b3_ids where name='schedule'),'d4700000-0000-4000-8000-000000000001','d4800000-0000-4000-8000-000000000001',(select id from b3_ids where name='room'),1::smallint,(select id from b3_ids where name='block1'),'REGULAR_CLASS','2094-01-01','2094-06-30','B3_SESSION_CREATE');
select * from academic.activate_class_session((select id from b3_ids where name='session'),'B3_SESSION_ACTIVE');
do $$declare c record; w record; begin select * into c from academic.validate_group_schedule_coverage((select id from b3_ids where name='schedule')); if not c.valid then raise exception 'coverage failed'; end if; select * into w from academic.get_teacher_workload_summary('d3000000-0000-4000-8000-000000000002','d4100000-0000-4000-8000-000000000001'); if w.weekly_session_count<>1 or w.weekly_minutes<>50 then raise exception 'workload failed'; end if; end$$;
select * from academic.submit_group_schedule((select id from b3_ids where name='schedule'),'B3_SCHEDULE_SUBMIT');
select * from academic.approve_group_schedule((select id from b3_ids where name='schedule'),'B3_SCHEDULE_APPROVE');
select * from academic.publish_group_schedule((select id from b3_ids where name='schedule'),'B3_SCHEDULE_PUBLISH');
insert into b3_ids select 'change',entity_id from academic.create_schedule_change_request((select id from b3_ids where name='schedule'),'SESSION_MOVE','CORRECTIVE_CHANGE','B3_CHANGE_CREATE');
select * from academic.submit_schedule_change_request((select id from b3_ids where name='change'),'B3_CHANGE_SUBMIT');
select * from academic.begin_schedule_change_review((select id from b3_ids where name='change'),'B3_CHANGE_REVIEW');
select * from academic.approve_schedule_change_request((select id from b3_ids where name='change'),'B3_CHANGE_APPROVE');
select * from academic.move_class_session((select id from b3_ids where name='session'),1::smallint,(select id from b3_ids where name='block2'),(select id from b3_ids where name='change'),'B3_SESSION_MOVE');
select * from academic.apply_schedule_change_request((select id from b3_ids where name='change'),'B3_CHANGE_APPLY');
select * from academic.mark_academic_space_maintenance((select id from b3_ids where name='room'),'B3_ROOM_MAINT');
select * from academic.close_group_schedule((select id from b3_ids where name='schedule'),'B3_SCHEDULE_CLOSE');
do $$declare first_id uuid; replay_id uuid; begin select id into first_id from b3_ids where name='shift'; select entity_id into replay_id from academic.create_academic_shift('B3_SHIFT','Synthetic shift','07:00','13:00','B3_SHIFT_CREATE'); if first_id<>replay_id then raise exception 'idempotency failed'; end if; begin perform * from academic.create_academic_shift('B3_CHANGED','Synthetic shift','07:00','13:00','B3_SHIFT_CREATE'); raise exception 'conflict accepted'; exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end; end$$;
do $$begin if (select count(*) from academic.schedule_events)<20 then raise exception 'audit incomplete'; end if; if exists(select 1 from academic.schedule_events where actor_account_id is null) then raise exception 'actor missing'; end if; end$$;
select 'STEPS=49';
rollback;
`);
  assert.match(output, /STEPS=49/);
  assert.equal(
    runSql("select count(*) from academic.academic_shifts where code='B3_SHIFT';").trim(),
    "0",
  );
});
