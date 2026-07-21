import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  accessReasons,
  accountStatuses,
  accountStatusTransitions,
  accountStatusValues,
  applicationRoleMap,
  applications,
  canAccessApplication,
  canTransitionAccountStatus,
  evaluateAccess,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
  isAccountStatus,
  isApplication,
  isPermission,
  isRole,
  permissions,
  permissionsForRole,
  permissionValues,
  rolePermissionMap,
  roles,
  roleValues,
} from "../dist/index.js";

const expectedRoles = [
  "ADMINISTRATIVO",
  "ALUMNO",
  "ASPIRANTE",
  "CAJA",
  "CONTROL_ESCOLAR",
  "DOCENTE",
  "PREFECTURA",
  "SUPERADMIN",
  "TUTOR",
];

const expectedPermissions = [
  "academic.assignments.manage",
  "academic.assignments.read",
  "academic.attendance.manage",
  "academic.attendance.read",
  "academic.attendance.validate",
  "academic.cycles.manage",
  "academic.cycles.read",
  "academic.enrollment_requests.manage",
  "academic.enrollment_requests.read",
  "academic.enrollments.manage",
  "academic.enrollments.read",
  "academic.generations.manage",
  "academic.generations.read",
  "academic.group_assignments.manage",
  "academic.group_assignments.read",
  "academic.groups.manage",
  "academic.groups.read",
  "academic.lateness.notifications.record",
  "academic.lateness.read",
  "academic.lateness.validate",
  "academic.offerings.manage",
  "academic.offerings.read",
  "academic.periods.manage",
  "academic.periods.read",
  "academic.permissions.manage",
  "academic.permissions.read",
  "academic.permissions.validate",
  "academic.plans.approve",
  "academic.plans.manage",
  "academic.plans.read",
  "academic.progress.manage",
  "academic.progress.read",
  "academic.schedule_changes.approve",
  "academic.schedule_changes.manage",
  "academic.schedule_templates.manage",
  "academic.schedule_templates.read",
  "academic.schedules.approve",
  "academic.schedules.manage",
  "academic.schedules.publish",
  "academic.schedules.read",
  "academic.shifts.manage",
  "academic.shifts.read",
  "academic.spaces.manage",
  "academic.spaces.read",
  "academic.students.manage",
  "academic.students.read",
  "academic.subjects.manage",
  "academic.subjects.read",
  "academic.teacher_availability.manage",
  "academic.teacher_availability.read",
  "academic.time_blocks.manage",
  "academic.time_blocks.read",
  "academic.withdrawals.manage",
  "academic.workload.read",
  "academics.manage",
  "academics.read",
  "admissions.manage",
  "admissions.read",
  "attendance.manage",
  "attendance.read",
  "audit.read",
  "documents.manage",
  "documents.read",
  "grades.manage",
  "grades.read",
  "identity.manage",
  "identity.read",
  "payments.manage",
  "payments.read",
  "reports.export",
  "reports.read",
  "roles.assign",
  "roles.read",
  "settings.manage",
  "settings.read",
];

const expectedAccountStatuses = [
  "ACTIVE",
  "BLOCKED",
  "DISABLED",
  "PENDING_ACTIVATION",
  "PENDING_INVITATION",
  "SUSPENDED",
];

function identity(roleSet, accountStatus = accountStatuses.ACTIVE) {
  return {
    accountStatus,
    personId: "person-test",
    roles: roleSet,
  };
}

test("el catálogo de roles es cerrado, estable y congelado", () => {
  assert.deepEqual([...roleValues].sort(), expectedRoles);
  assert.deepEqual(Object.values(roles).sort(), expectedRoles);
  assert.equal(Object.isFrozen(roles), true);
  assert.equal(Object.isFrozen(roleValues), true);
});

test("el catálogo de permisos es cerrado, estable y sin wildcards", () => {
  assert.deepEqual([...permissionValues].sort(), expectedPermissions);
  assert.deepEqual(Object.values(permissions).sort(), expectedPermissions);
  assert.equal(Object.isFrozen(permissions), true);
  assert.equal(Object.isFrozen(permissionValues), true);

  for (const permission of permissionValues) {
    assert.doesNotMatch(permission, /\*|\ball\b|admin\.\*/i);
  }
});

test("la matriz enumera permisos válidos explícitos para todos los roles", () => {
  assert.deepEqual(Object.keys(rolePermissionMap).sort(), expectedRoles);

  for (const [role, assignedPermissions] of Object.entries(rolePermissionMap)) {
    assert.equal(expectedRoles.includes(role), true);
    assert.equal(Object.isFrozen(assignedPermissions), true);
    assert.equal(new Set(assignedPermissions).size, assignedPermissions.length);
    for (const permission of assignedPermissions) {
      assert.equal(permissionValues.includes(permission), true);
      assert.doesNotMatch(permission, /\*|\ball\b|admin\.\*/i);
    }
  }

  assert.deepEqual([...rolePermissionMap[roles.SUPERADMIN]].sort(), expectedPermissions);
});

test("evalúa personas con un rol o múltiples roles sin duplicar cuentas", () => {
  assert.equal(hasRole([roles.DOCENTE], roles.DOCENTE), true);
  assert.equal(hasRole([roles.DOCENTE], roles.CAJA), false);
  assert.equal(hasAnyRole([roles.TUTOR, roles.CAJA], [roles.CAJA, roles.SUPERADMIN]), true);
  assert.equal(
    hasAnyPermission(
      [roles.TUTOR, roles.CAJA],
      [permissions.PAYMENTS_MANAGE, permissions.SETTINGS_MANAGE],
    ),
    true,
  );
});

test("respeta el acceso inicial al Portal Escolar", () => {
  for (const role of [roles.ASPIRANTE, roles.ALUMNO, roles.TUTOR, roles.DOCENTE]) {
    assert.equal(canAccessApplication([role], applications.PORTAL_ESCOLAR), true);
  }

  for (const role of [roles.SUPERADMIN, roles.ADMINISTRATIVO, roles.CONTROL_ESCOLAR, roles.CAJA]) {
    assert.equal(canAccessApplication([role], applications.PORTAL_ESCOLAR), false);
  }
});

test("respeta el acceso inicial al Sistema Administrativo", () => {
  for (const role of [roles.SUPERADMIN, roles.ADMINISTRATIVO, roles.CONTROL_ESCOLAR, roles.CAJA]) {
    assert.equal(canAccessApplication([role], applications.SISTEMA_ADMINISTRATIVO), true);
  }

  for (const role of [roles.ASPIRANTE, roles.ALUMNO, roles.TUTOR, roles.DOCENTE]) {
    assert.equal(canAccessApplication([role], applications.SISTEMA_ADMINISTRATIVO), false);
  }

  assert.equal(
    canAccessApplication([roles.DOCENTE, roles.CAJA], applications.SISTEMA_ADMINISTRATIVO),
    true,
  );
});

test("rechaza conjuntos vacíos de roles en ambas aplicaciones", () => {
  assert.equal(canAccessApplication([], applications.PORTAL_ESCOLAR), false);
  assert.equal(canAccessApplication([], applications.SISTEMA_ADMINISTRATIVO), false);

  const decision = evaluateAccess({
    application: applications.PORTAL_ESCOLAR,
    identity: identity([]),
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, accessReasons.APPLICATION_ACCESS_DENIED);
});

test("roles duplicados no alteran acceso ni multiplican permisos", () => {
  const uniqueRoles = [roles.DOCENTE];
  const duplicateRoles = [roles.DOCENTE, roles.DOCENTE, roles.DOCENTE];

  assert.equal(
    canAccessApplication(duplicateRoles, applications.PORTAL_ESCOLAR),
    canAccessApplication(uniqueRoles, applications.PORTAL_ESCOLAR),
  );
  for (const permission of permissionValues) {
    assert.equal(hasPermission(duplicateRoles, permission), hasPermission(uniqueRoles, permission));
  }
});

test("hasAnyRole y hasAnyPermission rechazan conjuntos esperados vacíos", () => {
  assert.equal(hasAnyRole([roles.ALUMNO], []), false);
  assert.equal(hasAnyPermission([roles.ALUMNO], []), false);
});

test("asigna capacidades por rol sin escalamiento implícito", () => {
  assert.equal(hasPermission([roles.CAJA], permissions.PAYMENTS_MANAGE), true);
  assert.equal(hasPermission([roles.CAJA], permissions.GRADES_READ), false);
  assert.equal(hasPermission([roles.DOCENTE], permissions.GRADES_MANAGE), true);
  assert.equal(hasPermission([roles.DOCENTE], permissions.IDENTITY_MANAGE), false);
  assert.equal(hasPermission([roles.DOCENTE], permissions.ROLES_ASSIGN), false);
  assert.equal(hasPermission([roles.CONTROL_ESCOLAR], permissions.PAYMENTS_MANAGE), false);
});

test("solo permite transiciones de cuenta expresamente declaradas", () => {
  assert.equal(
    canTransitionAccountStatus(
      accountStatuses.PENDING_INVITATION,
      accountStatuses.PENDING_ACTIVATION,
    ),
    true,
  );
  assert.equal(
    canTransitionAccountStatus(accountStatuses.PENDING_ACTIVATION, accountStatuses.ACTIVE),
    true,
  );
  assert.equal(canTransitionAccountStatus(accountStatuses.ACTIVE, accountStatuses.SUSPENDED), true);
  assert.equal(canTransitionAccountStatus(accountStatuses.SUSPENDED, accountStatuses.ACTIVE), true);
  assert.equal(canTransitionAccountStatus(accountStatuses.ACTIVE, accountStatuses.BLOCKED), true);
  assert.equal(canTransitionAccountStatus(accountStatuses.BLOCKED, accountStatuses.ACTIVE), true);

  for (const status of Object.values(accountStatuses)) {
    if (status !== accountStatuses.DISABLED) {
      assert.equal(canTransitionAccountStatus(status, accountStatuses.DISABLED), true);
    }
  }
});

test("rechaza transiciones arbitrarias y permite reactivación administrativa explícita", () => {
  assert.equal(
    canTransitionAccountStatus(accountStatuses.PENDING_INVITATION, accountStatuses.ACTIVE),
    false,
  );
  assert.equal(canTransitionAccountStatus(accountStatuses.DISABLED, accountStatuses.ACTIVE), true);
  assert.equal(
    canTransitionAccountStatus(accountStatuses.DISABLED, accountStatuses.PENDING_ACTIVATION),
    true,
  );
  assert.equal(canTransitionAccountStatus(accountStatuses.ACTIVE, accountStatuses.ACTIVE), false);
  assert.deepEqual(accountStatusTransitions[accountStatuses.DISABLED], [
    accountStatuses.PENDING_ACTIVATION,
    accountStatuses.ACTIVE,
  ]);
});

test("el catálogo de estados es exacto, cerrado y diferencia bloqueo de suspensión", () => {
  assert.deepEqual([...accountStatusValues].sort(), expectedAccountStatuses);
  assert.deepEqual(Object.values(accountStatuses).sort(), expectedAccountStatuses);
  assert.notEqual(accountStatuses.BLOCKED, accountStatuses.SUSPENDED);
  assert.notDeepEqual(
    accountStatusTransitions[accountStatuses.BLOCKED],
    accountStatusTransitions[accountStatuses.SUSPENDED],
  );
});

test("canTransitionAccountStatus es determinista", () => {
  for (const from of accountStatusValues) {
    for (const to of accountStatusValues) {
      const first = canTransitionAccountStatus(from, to);
      const second = canTransitionAccountStatus(from, to);
      assert.equal(first, second);
    }
  }
});

test("evaluateAccess devuelve razones estables y no sensibles", () => {
  const inactive = evaluateAccess({
    application: applications.PORTAL_ESCOLAR,
    identity: identity([roles.ALUMNO], accountStatuses.SUSPENDED),
  });
  assert.deepEqual(inactive, {
    allowed: false,
    missingPermissions: [],
    missingRoles: [],
    reason: accessReasons.ACCOUNT_NOT_ACTIVE,
  });

  const wrongApplication = evaluateAccess({
    application: applications.SISTEMA_ADMINISTRATIVO,
    identity: identity([roles.DOCENTE]),
  });
  assert.equal(wrongApplication.allowed, false);
  assert.equal(wrongApplication.reason, accessReasons.APPLICATION_ACCESS_DENIED);

  const missingRole = evaluateAccess({
    anyOfRoles: [roles.SUPERADMIN, roles.CONTROL_ESCOLAR],
    application: applications.SISTEMA_ADMINISTRATIVO,
    identity: identity([roles.CAJA]),
  });
  assert.equal(missingRole.allowed, false);
  assert.equal(missingRole.reason, accessReasons.REQUIRED_ROLE_MISSING);

  const missingPermission = evaluateAccess({
    allOfPermissions: [permissions.PAYMENTS_READ, permissions.PAYMENTS_MANAGE],
    application: applications.PORTAL_ESCOLAR,
    identity: identity([roles.TUTOR]),
  });
  assert.equal(missingPermission.allowed, false);
  assert.equal(missingPermission.reason, accessReasons.REQUIRED_PERMISSION_MISSING);
  assert.deepEqual(missingPermission.missingPermissions, [permissions.PAYMENTS_MANAGE]);
});

test("evaluateAccess es determinista para el mismo contexto", () => {
  const context = {
    allOfPermissions: [permissions.GRADES_READ],
    application: applications.PORTAL_ESCOLAR,
    identity: identity([roles.ALUMNO, roles.TUTOR]),
  };

  const first = evaluateAccess(context);
  const second = evaluateAccess(context);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    allowed: true,
    reason: accessReasons.AUTHORIZED,
  });
});

test("los validadores rechazan entradas unknown inválidas sin excepciones", () => {
  const invalidValues = [undefined, null, 0, false, {}, [], "INVALID", "*"];

  for (const value of invalidValues) {
    assert.equal(isRole(value), false);
    assert.equal(isPermission(value), false);
    assert.equal(isApplication(value), false);
    assert.equal(isAccountStatus(value), false);
    assert.doesNotThrow(() => hasRole(value, value));
    assert.doesNotThrow(() => hasAnyRole(value, value));
    assert.doesNotThrow(() => hasPermission(value, value));
    assert.doesNotThrow(() => hasAnyPermission(value, value));
    assert.doesNotThrow(() => canAccessApplication(value, value));
    assert.doesNotThrow(() => canTransitionAccountStatus(value, value));
    assert.equal(hasRole(value, value), false);
    assert.equal(hasAnyRole(value, value), false);
    assert.equal(hasPermission(value, value), false);
    assert.equal(hasAnyPermission(value, value), false);
    assert.equal(canAccessApplication(value, value), false);
    assert.equal(canTransitionAccountStatus(value, value), false);
    assert.deepEqual(permissionsForRole(value), []);
  }
});

test("evaluateAccess deniega de forma tipada contextos externos inválidos", () => {
  const invalidContexts = [
    undefined,
    null,
    {},
    { application: "INVALID", identity: {} },
    {
      application: applications.PORTAL_ESCOLAR,
      identity: {
        accountStatus: "INVALID",
        personId: "person-test",
        roles: [roles.ALUMNO],
      },
    },
    {
      application: applications.PORTAL_ESCOLAR,
      identity: {
        accountStatus: accountStatuses.ACTIVE,
        personId: "",
        roles: [roles.ALUMNO],
      },
    },
    {
      application: applications.PORTAL_ESCOLAR,
      identity: {
        accountStatus: accountStatuses.ACTIVE,
        personId: "person-test",
        roles: [roles.ALUMNO, "INVALID"],
      },
    },
    {
      allOfPermissions: [permissions.GRADES_READ, "INVALID"],
      application: applications.PORTAL_ESCOLAR,
      identity: identity([roles.ALUMNO]),
    },
  ];

  for (const context of invalidContexts) {
    assert.doesNotThrow(() => evaluateAccess(context));
    assert.deepEqual(evaluateAccess(context), {
      allowed: false,
      missingPermissions: [],
      missingRoles: [],
      reason: accessReasons.INVALID_AUTHORIZATION_CONTEXT,
    });
  }
});

test("una identidad conserva un único personId con múltiples roles", () => {
  const institutionalIdentity = identity([roles.ALUMNO, roles.TUTOR, roles.DOCENTE]);
  assert.equal(institutionalIdentity.personId, "person-test");
  assert.equal(Object.keys(institutionalIdentity).filter((key) => key === "personId").length, 1);
  assert.equal(institutionalIdentity.roles.length, 3);
});

test("los identificadores nominales no son asignables entre sí", async () => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "preparatoria-authz-nominal-"));
  const fixturePath = join(fixtureDirectory, "nominal-types.ts");
  const tsconfigPath = join(fixtureDirectory, "tsconfig.json");
  const declarationPath = fileURLToPath(new URL("../dist/index.d.ts", import.meta.url)).replaceAll(
    "\\",
    "/",
  );

  try {
    await Promise.all([
      writeFile(
        fixturePath,
        [
          'import type { AccountId, AuthUserId, PersonId, ProfileId } from "@preparatoria/authz";',
          "declare const accountId: AccountId;",
          "declare const authUserId: AuthUserId;",
          "declare const personId: PersonId;",
          "declare const profileId: ProfileId;",
          "const personFromAccount: PersonId = accountId;",
          "const personFromAuth: PersonId = authUserId;",
          "const profileFromPerson: ProfileId = personId;",
          "const authFromProfile: AuthUserId = profileId;",
          "void personFromAccount;",
          "void personFromAuth;",
          "void profileFromPerson;",
          "void authFromProfile;",
          "",
        ].join("\n"),
      ),
      writeFile(
        tsconfigPath,
        JSON.stringify({
          compilerOptions: {
            baseUrl: ".",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true,
            paths: {
              "@preparatoria/authz": [declarationPath],
            },
            skipLibCheck: true,
            strict: true,
          },
          files: ["nominal-types.ts"],
        }),
      ),
    ]);

    const require = createRequire(import.meta.url);
    const tscPath = require.resolve("typescript/bin/tsc");
    const result = spawnSync(
      process.execPath,
      [tscPath, "--project", tsconfigPath, "--pretty", "false"],
      { encoding: "utf8" },
    );
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(
      output,
      /Cannot find module|Unknown compiler option|error TS5083|SyntaxError/i,
    );
    assert.equal(output.match(/error TS2322/g)?.length, 4);
    assert.match(output, /AccountId.*not assignable.*PersonId/is);
    assert.match(output, /AuthUserId.*not assignable.*PersonId/is);
    assert.match(output, /PersonId.*not assignable.*ProfileId/is);
    assert.match(output, /ProfileId.*not assignable.*AuthUserId/is);
  } finally {
    await rm(fixtureDirectory, { force: true, recursive: true });
  }
});

test("los accesos por aplicación están enumerados y congelados", () => {
  assert.deepEqual(applicationRoleMap[applications.PORTAL_ESCOLAR], [
    roles.ASPIRANTE,
    roles.ALUMNO,
    roles.TUTOR,
    roles.DOCENTE,
  ]);
  assert.deepEqual(applicationRoleMap[applications.SISTEMA_ADMINISTRATIVO], [
    roles.SUPERADMIN,
    roles.ADMINISTRATIVO,
    roles.CONTROL_ESCOLAR,
    roles.PREFECTURA,
    roles.CAJA,
  ]);
  assert.equal(Object.isFrozen(applicationRoleMap), true);
});

test("no usa strings libres de roles o permisos fuera de sus catálogos", async () => {
  const sourceDirectory = new URL("../src/", import.meta.url);
  const files = (await readdir(sourceDirectory)).filter((file) => file.endsWith(".ts"));

  for (const file of files) {
    const source = await readFile(new URL(file, sourceDirectory), "utf8");
    if (file !== "roles.ts") {
      for (const role of expectedRoles) {
        assert.doesNotMatch(source, new RegExp(`["']${role}["']`));
      }
    }
    if (file !== "permissions.ts") {
      for (const permission of expectedPermissions) {
        assert.doesNotMatch(
          source,
          new RegExp(`["']${permission.replace(".", String.raw`\.`)}["']`),
        );
      }
    }
  }
});

test("el paquete no depende de aplicaciones, Supabase, Next.js, React o UI", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.dependencies, undefined);
  assert.deepEqual(manifest.devDependencies, {
    "@preparatoria/config": "workspace:*",
  });

  const sourceFiles = await Promise.all(
    (await readdir(new URL("../src/", import.meta.url)))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")),
  );
  assert.doesNotMatch(sourceFiles.join("\n"), /supabase|next\/|react|@preparatoria\/ui|apps\//i);
});

test("las pruebas no contienen datos personales reales", async () => {
  const source = await readFile(new URL(import.meta.url), "utf8");
  assert.doesNotMatch(source, /[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d|[\w.+-]+@[\w.-]+\.\w+/);
});

test("permisos de inscripción respetan baja definitiva y roles no administrativos", () => {
  assert.equal(hasPermission([roles.SUPERADMIN], permissions.ACADEMIC_WITHDRAWALS_MANAGE), true);
  assert.equal(
    hasPermission([roles.ADMINISTRATIVO], permissions.ACADEMIC_WITHDRAWALS_MANAGE),
    true,
  );
  assert.equal(
    hasPermission([roles.CONTROL_ESCOLAR], permissions.ACADEMIC_ENROLLMENTS_MANAGE),
    true,
  );
  assert.equal(
    hasPermission([roles.CONTROL_ESCOLAR], permissions.ACADEMIC_WITHDRAWALS_MANAGE),
    false,
  );
  for (const role of [roles.CAJA, roles.DOCENTE, roles.TUTOR, roles.ALUMNO, roles.ASPIRANTE]) {
    assert.equal(hasPermission([role], permissions.ACADEMIC_ENROLLMENTS_MANAGE), false);
  }
});
