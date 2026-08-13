import assert from "node:assert/strict";
import test from "node:test";

import {
  createControlSchoolService,
  ControlSchoolError,
  controlSchoolRpcNames,
} from "../dist/control-school.js";

const validConfig = {
  publishableKey: "sb_publishable_example123",
  url: "https://example.supabase.co",
};

const cookies = {
  getAll: () => [],
  setAll: () => {},
};

test("servicio server-only de control escolar usa wrappers públicos y DTOs mínimos tipados", async () => {
  const calls = [];
  const service = createControlSchoolService(validConfig, cookies, () => ({
    rpc: async (name, input) => {
      calls.push({ input, name });
      switch (name) {
        case "list_control_school_students":
          return {
            data: {
              offset: 0,
              pageSize: 25,
              rows: [
                {
                  academicPeriod: {
                    academicPeriodId: "00000000-0000-4000-8000-000000000001",
                    code: "2026-A",
                    name: "Periodo 2026-A",
                  },
                  enrollmentStatus: "ACTIVE",
                  group: {
                    groupId: "00000000-0000-4000-8000-000000000002",
                    code: "5QB-A",
                    name: "5° QB A",
                  },
                  semesterNumber: 5,
                  studentDisplayName: null,
                  studentIdentifier: "ALU-001",
                  studentRecordId: "00000000-0000-4000-8000-000000000003",
                  studentStatus: "ACTIVE",
                  trainingArea: {
                    trainingAreaId: "00000000-0000-4000-8000-000000000004",
                    code: "QB",
                    name: "Químico-Biólogos",
                  },
                },
              ],
              totalRows: 1,
            },
            error: null,
          };
        case "get_control_school_student_detail":
          return {
            data: {
              currentEnrollment: {
                cancelledAt: null,
                completedAt: null,
                enrolledAt: "2026-08-01T00:00:00.000Z",
                enrollmentNumber: "ENR-001",
                periodEnrollmentId: "00000000-0000-4000-8000-000000000005",
                status: "ACTIVE",
              },
              currentSituation: {
                academicPeriod: {
                  academicPeriodId: "00000000-0000-4000-8000-000000000001",
                  code: "2026-A",
                  name: "Periodo 2026-A",
                },
                generation: {
                  code: "GEN-26",
                  generationId: "00000000-0000-4000-8000-000000000006",
                  name: "Generación 2026",
                },
                group: {
                  groupId: "00000000-0000-4000-8000-000000000002",
                  code: "5QB-A",
                  name: "5° QB A",
                },
                semesterNumber: 5,
                studyPlan: {
                  code: "BG-2026",
                  name: "Bachillerato General",
                  studyPlanId: "00000000-0000-4000-8000-000000000007",
                  version: "V1",
                },
                trainingArea: {
                  trainingAreaId: "00000000-0000-4000-8000-000000000004",
                  code: "QB",
                  name: "Químico-Biólogos",
                },
              },
              identity: {
                studentDisplayName: null,
                studentIdentifier: "ALU-001",
                studentRecordId: "00000000-0000-4000-8000-000000000003",
                studentStatus: "ACTIVE",
              },
              studentDisplayName: null,
              studentIdentifier: "ALU-001",
              studentRecordId: "00000000-0000-4000-8000-000000000003",
              studentStatus: "ACTIVE",
              timeline: {
                activatedAt: "2026-08-01T00:00:00.000Z",
                graduatedAt: null,
                withdrawnAt: null,
              },
            },
            error: null,
          };
        case "list_control_school_groups":
          return {
            data: {
              offset: 0,
              pageSize: 25,
              rows: [
                {
                  academicPeriod: {
                    academicPeriodId: "00000000-0000-4000-8000-000000000001",
                    code: "2026-A",
                    name: "Periodo 2026-A",
                  },
                  code: "5QB-A",
                  groupId: "00000000-0000-4000-8000-000000000002",
                  name: "5° QB A",
                  semesterNumber: 5,
                  status: "ACTIVE",
                  studentCount: 32,
                  trainingArea: {
                    trainingAreaId: "00000000-0000-4000-8000-000000000004",
                    code: "QB",
                    name: "Químico-Biólogos",
                  },
                },
              ],
              totalRows: 1,
            },
            error: null,
          };
        case "get_control_school_group_detail":
          return {
            data: {
              group: {
                academicPeriod: {
                  academicPeriodId: "00000000-0000-4000-8000-000000000001",
                  code: "2026-A",
                  name: "Periodo 2026-A",
                },
                code: "5QB-A",
                groupId: "00000000-0000-4000-8000-000000000002",
                name: "5° QB A",
                semesterNumber: 5,
                status: "ACTIVE",
                studentCount: 32,
                trainingArea: {
                  trainingAreaId: "00000000-0000-4000-8000-000000000004",
                  code: "QB",
                  name: "Químico-Biólogos",
                },
              },
              students: [],
              subjects: [],
              teachers: [],
            },
            error: null,
          };
        case "get_control_school_group_schedule":
          return {
            data: {
              academicPeriodId: "00000000-0000-4000-8000-000000000001",
              groupId: "00000000-0000-4000-8000-000000000002",
              rows: [],
            },
            error: null,
          };
        case "get_control_school_structure":
          return {
            data: {
              cycles: [],
              groups: [],
              periods: [],
              planSemesters: [],
              studyPlans: [],
              subjects: [],
              trainingAreas: [],
            },
            error: null,
          };
        case "list_control_school_enrollments":
          return {
            data: {
              offset: 0,
              pageSize: 25,
              rows: [],
              totalRows: 0,
            },
            error: null,
          };
        case "get_control_school_student_trajectory":
          return {
            data: {
              periods: [],
              progressDecisions: [],
              studentRecordId: "00000000-0000-4000-8000-000000000003",
            },
            error: null,
          };
        default:
          return { data: null, error: { message: "CONTROL_SCHOOL_OPERATION_FAILED" } };
      }
    },
  }));

  const students = await service.listStudents({ searchText: "ALU" });
  const detail = await service.getStudentDetail("00000000-0000-4000-8000-000000000003");
  const groups = await service.listGroups();
  const groupDetail = await service.getGroupDetail("00000000-0000-4000-8000-000000000002");
  const schedule = await service.getGroupSchedule("00000000-0000-4000-8000-000000000002");
  const structure = await service.getStructure();
  const enrollments = await service.listEnrollments();
  const trajectory = await service.getStudentTrajectory("00000000-0000-4000-8000-000000000003");

  assert.equal(students.rows[0].studentIdentifier, "ALU-001");
  assert.equal(detail.currentSituation.studyPlan.version, "V1");
  assert.equal(groups.rows[0].studentCount, 32);
  assert.equal(groupDetail.group.code, "5QB-A");
  assert.equal(schedule.groupId, "00000000-0000-4000-8000-000000000002");
  assert.deepEqual(structure.subjects, []);
  assert.equal(enrollments.totalRows, 0);
  assert.equal(trajectory.studentRecordId, "00000000-0000-4000-8000-000000000003");
  assert.deepEqual(
    calls.map((call) => call.name),
    controlSchoolRpcNames,
  );
});

test("servicio de control escolar falla cerrado ante respuestas inválidas", async () => {
  const service = createControlSchoolService(validConfig, cookies, () => ({
    rpc: async () => ({ data: { rows: "invalid" }, error: null }),
  }));

  await assert.rejects(
    service.listStudents(),
    (error) =>
      error instanceof ControlSchoolError && error.code === "CONTROL_SCHOOL_RESPONSE_INVALID",
  );
});

test("servicio de control escolar propaga errores de dominio cerrados del RPC", async () => {
  const service = createControlSchoolService(validConfig, cookies, () => ({
    rpc: async () => ({ data: null, error: { message: "ACTOR_NOT_AUTHORIZED" } }),
  }));

  await assert.rejects(
    service.getStructure(),
    (error) => error instanceof ControlSchoolError && error.code === "ACTOR_NOT_AUTHORIZED",
  );
});
