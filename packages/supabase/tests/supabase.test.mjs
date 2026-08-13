import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  AccountLifecycleError,
  accountLifecycleErrorCodes,
  accountLifecycleEventTypes,
  accountLifecycleReasonCodes,
  manageInstitutionalAccountLifecycle,
  safeAccountLifecycleDiagnostic,
} from "../dist/account-lifecycle.js";
import {
  AcademicStructureError,
  academicStructureErrorCodes,
  academicSqlFunctions,
  academicStructureOperations,
  createGroup,
  normalizeAcademicCode,
  validateSemesterNumber,
} from "../dist/academic-structure.js";
import {
  AcademicSchedulingError,
  academicSchedulingCommands,
  academicSchedulingErrorCodes,
  academicSchedulingOperations,
  academicSchedulingSqlFunctions,
  normalizeScheduleCode,
  validateGroupScheduleCoverage,
  validateIsoWeekday,
  validateTimeValue,
} from "../dist/academic-scheduling.js";
import {
  AttendanceManagementError,
  attendanceManagementCommands,
  attendanceManagementErrorCodes,
  attendanceManagementOperations,
  attendanceManagementSqlFunctions,
  attendanceSessionStatuses,
  attendanceStatuses,
  validateAttendanceDate,
  validateLatenessMinutes,
} from "../dist/attendance-management.js";
import {
  GradeManagementError,
  gradeCalculationStatuses,
  gradeManagementCommands,
  gradeManagementErrorCodes,
  gradeManagementOperations,
  gradeWindowStatuses,
  subjectResultCodes,
  unitGradeStatuses,
  validateGradeDecimal,
} from "../dist/grade-management.js";
import {
  StudentEnrollmentError,
  createEnrollmentRequest,
  normalizeInstitutionalStudentCode,
  studentEnrollmentErrorCodes,
  studentEnrollmentOperations,
  studentEnrollmentSqlFunctions,
  validateStudentSemester,
} from "../dist/student-enrollment.js";
import {
  GuardianPortalError,
  createGuardianPortalService,
  guardianPortalRpcNames,
} from "../dist/guardian-portal.js";
import { createStudentPortalService, studentPortalRpcNames } from "../dist/student-portal.js";
import {
  createStudentFinanceService,
  StudentFinanceError,
  studentFinanceRpcNames,
} from "../dist/student-finance.js";
import {
  approveCashDifference,
  beginCashSessionClose,
  CashRegisterError,
  cashRegisterErrorCodes,
  cashRegisterOperations,
  cashRegisterSqlFunctions,
  closeCashSession,
  createCashRegister,
  getActiveCashSession,
  getCashRegisters,
  openCashSession,
  recordCashCount,
  registerCashierPayment,
  registerCashMovement,
} from "../dist/cash-register.js";
import {
  approveChargeGenerationBatch,
  approveChargeGenerationRuleVersion,
  chargeGenerationErrorCodes,
  chargeGenerationOperations,
  chargeGenerationSqlFunctions,
  ChargeGenerationError,
  createChargeGenerationBatch,
  createChargeGenerationExclusion,
  createChargeGenerationRule,
  createChargeGenerationRuleVersion,
  executeChargeGenerationBatch,
  previewChargeGeneration,
  submitChargeGenerationBatch,
} from "../dist/charge-generation.js";
import {
  addCollectionAction,
  cancelPaymentCommitment,
  closeCollectionCase,
  collectionErrorCodes,
  collectionOperations,
  collectionSqlFunctions,
  CollectionError,
  createPaymentCommitment,
  evaluatePaymentCommitment,
  getStudentDebtPosition,
  listOverdueStudentAccounts,
  markPaymentCommitmentBroken,
  markPaymentCommitmentFulfilled,
  openCollectionCase,
  resolveCollectionCase,
} from "../dist/collections.js";
import {
  activateScholarshipProgram,
  activateStudentScholarship,
  applyAuthorizedDiscount,
  applyAuthorizedWaiver,
  applyStudentScholarship,
  approveAuthorizedWaiver,
  approveScholarshipProgram,
  approveStudentScholarship,
  assignStudentScholarship,
  createAuthorizedWaiver,
  createScholarshipProgram,
  financialBenefitErrorCodes,
  financialBenefitOperations,
  financialBenefitSqlFunctions,
  FinancialBenefitError,
  reverseFinancialBenefit,
  revokeStudentScholarship,
  submitScholarshipProgram,
  submitStudentScholarship,
} from "../dist/financial-benefits.js";
import {
  approvePaymentAgreement,
  cancelPaymentAgreement,
  createPaymentAgreement,
  evaluatePaymentAgreement,
  markPaymentAgreementDefaulted,
  paymentAgreementErrorCodes,
  paymentAgreementOperations,
  paymentAgreementSqlFunctions,
  PaymentAgreementError,
  reconcilePaymentAgreementInstallment,
} from "../dist/payment-agreements.js";
import {
  AcademicDocumentsError,
  createAcademicDocumentsService,
  createLocalAcademicDocumentFileStore,
  createVerificationCode,
} from "../dist/academic-documents.js";
import {
  createAuthenticationService,
  evaluateApplicationAccess,
  safeInternalRedirect,
} from "../dist/auth-session.js";
import { createSupabaseBrowserClient } from "../dist/browser.js";
import {
  createAuthenticationAttemptKey,
  createInMemoryAuthenticationAttemptGuard,
  deriveInstitutionalAuthAlias,
  genericInstitutionalLoginMessage,
  normalizeInstitutionalIdentifier,
  signInAsApplicant,
  signInWithInstitutionalCredentials,
  validateInstitutionalNip,
} from "../dist/institutional-access.js";
import {
  changeAuthenticatedNip,
  createNipAbuseKey,
  digestNipResetToken,
  generateNipResetToken,
  isValidNipRecoveryTransition,
  nipAbuseCategories,
  nipRecoveryAdministrativeRoles,
  nipRecoveryStatuses,
  nipSecurityErrorCodes,
  nipSecurityEventTypes,
  nipSecurityReasonCodes,
  resetNipWithAuthorization,
  safeTokenDigestEquals,
} from "../dist/nip-security.js";
import {
  beginBackupFactorEnrollment,
  beginMfaChallenge,
  beginTotpEnrollment,
  completeMfaRecovery,
  createInMemoryMfaAttemptGuard,
  createMfaAbuseKey,
  getMfaAssuranceState,
  listOwnMfaFactors,
  mfaErrorCodes,
  mfaSecurityEventTypes,
  mfaSecurityReasonCodes,
  requestMfaRecovery,
  requireMfaCompliance,
  requireStepUpAuthentication,
  resolveMfaRequirement,
  unenrollOwnTotpFactor,
  verifyTotpChallenge,
  verifyTotpEnrollment,
} from "../dist/mfa-security.js";
import {
  AdministrativeMfaRecoveryError,
  administrativeMfaAbuseCategories,
  administrativeMfaRecoveryErrors,
  administrativeMfaRecoveryStatuses,
  approveAdministrativeMfaRecovery,
  createAdministrativeMfaAbuseKey,
  createMfaFactorReferenceDigest,
  executeAdministrativeMfaRecovery,
  requestAdministrativeMfaRecovery,
} from "../dist/mfa-administration.js";
import {
  createLocalPrivilegedAuthMfaAdministrationAdapter,
  validateLocalSupabaseAuthAdminUrl,
} from "../dist/mfa-administration-local.js";
import {
  ProvisioningError,
  provisionInstitutionalIdentity,
  provisioningErrorCodes,
  safeProvisioningDiagnostic,
} from "../dist/provisioning.js";
import { createSupabaseSsrClient } from "../dist/ssr.js";
import {
  invalidateInstitutionalSessions,
  parseAuthenticatorAssuranceLevel,
  parseInstitutionalSessionVersionClaim,
  parseVerifiedInstitutionalClaims,
  sessionSecurityErrorCodes,
} from "../dist/session-security.js";

const validConfig = {
  publishableKey: "sb_publishable_example123",
  url: "https://example.supabase.co",
};

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const portalDirectory = join(repositoryRoot, "apps", "portal-escolar");

function resolvePnpmInvocation() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return { argsPrefix: [process.env.npm_execpath], command: process.execPath };
  }

  const corepackPnpm = join(
    dirname(process.execPath),
    "node_modules",
    "corepack",
    "dist",
    "pnpm.js",
  );
  if (existsSync(corepackPnpm)) {
    return { argsPrefix: [corepackPnpm], command: process.execPath };
  }

  if (process.platform !== "win32") {
    const lookup = spawnSync("which", ["pnpm"], { encoding: "utf8" });
    const pnpmPath = lookup.status === 0 ? lookup.stdout.trim().split(/\r?\n/, 1)[0] : undefined;
    if (pnpmPath && existsSync(pnpmPath)) {
      return { argsPrefix: [], command: pnpmPath };
    }
  }

  throw new Error(
    "No fue posible resolver pnpm sin shell. Ejecute la prueba mediante el script pnpm del paquete o habilite Corepack.",
  );
}

async function linkFixtureDependencies(fixtureDirectory) {
  const fixtureNodeModules = join(fixtureDirectory, "node_modules");
  const fixtureBin = join(fixtureNodeModules, ".bin");
  const fixtureScope = join(fixtureNodeModules, "@preparatoria");
  const fixtureSupabaseScope = join(fixtureNodeModules, "@supabase");
  const linkType = process.platform === "win32" ? "junction" : "dir";

  await Promise.all([
    mkdir(fixtureBin, { recursive: true }),
    mkdir(fixtureScope, { recursive: true }),
    mkdir(fixtureSupabaseScope, { recursive: true }),
  ]);

  const fixtureSupabasePackage = join(fixtureScope, "supabase");
  const fixtureEnvPackage = join(fixtureScope, "env");
  const supabaseSourceDirectory = join(repositoryRoot, "packages", "supabase");
  await Promise.all([mkdir(fixtureSupabasePackage), mkdir(fixtureEnvPackage)]);

  const fixtureSupabaseManifest = JSON.parse(
    await readFile(join(supabaseSourceDirectory, "package.json"), "utf8"),
  );
  for (const exportedEntry of Object.values(fixtureSupabaseManifest.exports)) {
    exportedEntry.default = exportedEntry.default.replace("./dist/", "./");
    exportedEntry.types = exportedEntry.types
      .replace("./src/", "./dist/")
      .replace(/\.ts$/, ".d.ts");
  }

  const supabaseRuntimeFiles = [
    "account-lifecycle.js",
    "academic-documents.js",
    "academic-structure.js",
    "academic-scheduling.js",
    "attendance-management.js",
    "collections.js",
    "grade-management.js",
    "auth-session.js",
    "institutional-access.js",
    "mfa-administration.js",
    "mfa-administration-local.js",
    "mfa-security.js",
    "nip-security.js",
    "admin-contract.js",
    "browser.js",
    "config.js",
    "provisioning.js",
    "session-security.js",
    "student-enrollment.js",
    "student-portal.js",
    "ssr.js",
    "types.js",
  ];
  await Promise.all([
    writeFile(
      join(fixtureSupabasePackage, "package.json"),
      JSON.stringify(fixtureSupabaseManifest),
    ),
    copyFile(
      join(repositoryRoot, "packages", "env", "package.json"),
      join(fixtureEnvPackage, "package.json"),
    ),
    cp(join(supabaseSourceDirectory, "dist"), join(fixtureSupabasePackage, "dist"), {
      recursive: true,
    }),
    cp(join(repositoryRoot, "packages", "env", "dist"), join(fixtureEnvPackage, "dist"), {
      recursive: true,
    }),
    ...supabaseRuntimeFiles.map((file) =>
      copyFile(join(supabaseSourceDirectory, "dist", file), join(fixtureSupabasePackage, file)),
    ),
  ]);

  await Promise.all([
    symlink(
      realpathSync(join(portalDirectory, "node_modules", "next")),
      join(fixtureNodeModules, "next"),
      linkType,
    ),
    symlink(
      realpathSync(join(portalDirectory, "node_modules", "react")),
      join(fixtureNodeModules, "react"),
      linkType,
    ),
    symlink(
      realpathSync(join(portalDirectory, "node_modules", "react-dom")),
      join(fixtureNodeModules, "react-dom"),
      linkType,
    ),
    symlink(
      realpathSync(
        join(repositoryRoot, "packages", "supabase", "node_modules", "@supabase", "ssr"),
      ),
      join(fixtureSupabaseScope, "ssr"),
      linkType,
    ),
    symlink(
      realpathSync(
        join(repositoryRoot, "packages", "supabase", "node_modules", "@supabase", "supabase-js"),
      ),
      join(fixtureSupabaseScope, "supabase-js"),
      linkType,
    ),
    symlink(
      realpathSync(join(repositoryRoot, "packages", "supabase", "node_modules", "server-only")),
      join(fixtureNodeModules, "server-only"),
      linkType,
    ),
    symlink(
      realpathSync(join(repositoryRoot, "packages", "env", "node_modules", "zod")),
      join(fixtureNodeModules, "zod"),
      linkType,
    ),
    symlink(
      realpathSync(join(repositoryRoot, "packages", "shared")),
      join(fixtureScope, "shared"),
      linkType,
    ),
    symlink(
      realpathSync(join(repositoryRoot, "packages", "authz")),
      join(fixtureScope, "authz"),
      linkType,
    ),
  ]);

  if (process.platform === "win32") {
    await copyFile(
      join(portalDirectory, "node_modules", ".bin", "next.CMD"),
      join(fixtureBin, "next.CMD"),
    );
  } else {
    await symlink(join("..", "next", "dist", "bin", "next"), join(fixtureBin, "next"));
  }
}

async function expectClientBuildFailure(exportName) {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), "preparatoria-server-only-"));
  const appDirectory = join(fixtureDirectory, "app");
  const packageSpecifier = ["@preparatoria", "supabase", exportName].join("/");
  const fixtureMessage = `Fixture temporal: ${fixtureDirectory}`;

  try {
    await mkdir(appDirectory);
    await linkFixtureDependencies(fixtureDirectory);
    await Promise.all([
      writeFile(
        join(fixtureDirectory, "package.json"),
        JSON.stringify({ name: "server-only-negative-fixture", private: true }),
      ),
      writeFile(
        join(fixtureDirectory, "next.config.mjs"),
        [
          "export default {",
          '  transpilePackages: ["@preparatoria/supabase"],',
          "  turbopack: { root: import.meta.dirname },",
          "};",
          "",
        ].join("\n"),
      ),
      writeFile(
        join(appDirectory, "layout.js"),
        "export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n",
      ),
      writeFile(
        join(appDirectory, "page.js"),
        [
          '"use client";',
          `import * as forbiddenModule from "${packageSpecifier}";`,
          "export default function Page() {",
          "  void forbiddenModule;",
          "  return null;",
          "}",
          "",
        ].join("\n"),
      ),
    ]);

    const pnpm = resolvePnpmInvocation();
    const result = spawnSync(
      pnpm.command,
      [...pnpm.argsPrefix, "exec", "next", "build", "--webpack"],
      {
        cwd: fixtureDirectory,
        encoding: "utf8",
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      },
    );
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const normalizedOutput = output.replaceAll("\\", "/");

    assert.equal(result.error, undefined, `${fixtureMessage}\n${result.error?.message ?? ""}`);
    assert.notEqual(
      result.status,
      0,
      `${fixtureMessage}\nNext.js permitió importar ${packageSpecifier} desde cliente.`,
    );
    assert.match(
      normalizedOutput,
      /server-only/i,
      `${fixtureMessage}\nEl error no identifica la barrera server-only.`,
    );
    assert.match(
      normalizedOutput,
      new RegExp(`${packageSpecifier.replaceAll("/", String.raw`\/`)}(?:\\.js)?`),
      `${fixtureMessage}\nEl error no identifica el subpath ${packageSpecifier}.`,
    );
    assert.match(
      normalizedOutput,
      /(?:Client Component|client component|client environment|entorno cliente)/i,
      `${fixtureMessage}\nEl error no identifica una violación del entorno cliente.`,
    );

    const alternativeErrors = [
      /Module not found/i,
      /Cannot find module/i,
      /Can't resolve/i,
      /Command ["']?next["']? not found|no se reconoce como un comando/i,
      /\bSyntaxError\b/i,
      /TypeScript (?:configuration|config)/i,
      /(?:missing|absent|not found).{0,40}dependenc|dependenc.{0,40}(?:missing|absent|not found)/i,
      /(?:ENOENT|file.{0,40}(?:does not exist|not found)|archivo.{0,40}inexistente)/i,
      /(?:invalid|inválida).{0,40}(?:configuration|configuración|next\.config)/i,
      /workspace root.{0,80}(?:not be correct|incorrect)/is,
    ];

    for (const alternativeError of alternativeErrors) {
      assert.doesNotMatch(
        normalizedOutput,
        alternativeError,
        `${fixtureMessage}\nEl build falló por un error alternativo: ${alternativeError}.`,
      );
    }
  } finally {
    await rm(fixtureDirectory, { force: true, recursive: true });
  }
}

test("crea un adaptador limitado de navegador con una dependencia simulada y sin red", () => {
  const expectedSdkClient = { kind: "browser-double" };
  const calls = [];
  const adapter = createSupabaseBrowserClient(validConfig, (url, key) => {
    calls.push({ key, url });
    return expectedSdkClient;
  });

  assert.equal(adapter.runtime, "browser");
  assert.equal(adapter.isInitialized(), true);
  assert.deepEqual(calls, [{ key: validConfig.publishableKey, url: validConfig.url }]);
  assert.deepEqual(Object.keys(adapter).sort(), ["runtime"]);
});

test("rechaza URL inválida, clave faltante y claves no publicables", () => {
  assert.throws(
    () => createSupabaseBrowserClient({ ...validConfig, url: "invalid" }, () => ({})),
    /URL/,
  );
  assert.throws(
    () => createSupabaseBrowserClient({ ...validConfig, publishableKey: "" }, () => ({})),
    /clave publicable|PUBLISHABLE/i,
  );
  assert.throws(
    () =>
      createSupabaseBrowserClient({ ...validConfig, publishableKey: "secret_value" }, () => ({})),
    /clave publicable|PUBLISHABLE/i,
  );
});

test("parser session_version accepts only positive safe integers", () => {
  assert.equal(parseInstitutionalSessionVersionClaim(1), 1n);
  assert.equal(parseInstitutionalSessionVersionClaim(Number.MAX_SAFE_INTEGER), 9007199254740991n);
  for (const value of [undefined, null, 0, -1, 1.5, "1", "invalid", {}, [], true, 1n]) {
    assert.throws(
      () => parseInstitutionalSessionVersionClaim(value),
      (error) => sessionSecurityErrorCodes.includes(error.code),
    );
  }
  assert.deepEqual(
    parseVerifiedInstitutionalClaims({
      aal: "aal2",
      session_id: "00000000-0000-4000-8000-000000000001",
      session_version: 2,
      sub: "00000000-0000-4000-8000-000000000002",
    }),
    {
      aal: "aal2",
      sessionId: "00000000-0000-4000-8000-000000000001",
      sessionVersion: 2n,
      sub: "00000000-0000-4000-8000-000000000002",
    },
  );
});

test("session coordinator invalidates first and fails closed when Auth fails", async () => {
  const calls = [];
  const result = await invalidateInstitutionalSessions(
    {
      authScope: "global",
      correlationId: "00000000-0000-4000-8000-000000000003",
      eventType: "GLOBAL_SESSION_REVOCATION_REQUESTED",
      idempotencyKey: "session:synthetic:0001",
      reason: "USER_LOGOUT_ALL",
    },
    {
      auth: {
        revokeAllSessions: async () => {
          calls.push("auth");
          return { ok: false };
        },
        revokeOtherSessions: async () => ({ ok: true }),
      },
      persistence: {
        invalidate: async () => {
          calls.push("database");
          return { invalidated: true, ok: true };
        },
      },
    },
  );
  assert.deepEqual(calls, ["database", "auth"]);
  assert.deepEqual(result, { invalidated: true, revocationConfirmed: false });
  assert.doesNotMatch(JSON.stringify(result), /access.?token|refresh.?token|cookie|jwt/i);
});

test("crea un adaptador SSR limitado con cookies simuladas y sin red", () => {
  const expectedSdkClient = { kind: "ssr-double" };
  const cookies = { getAll: () => [], setAll: () => undefined };
  const adapter = createSupabaseSsrClient(validConfig, cookies, (url, key, options) => {
    assert.equal(url, validConfig.url);
    assert.equal(key, validConfig.publishableKey);
    assert.equal(options.cookies, cookies);
    return expectedSdkClient;
  });

  assert.equal(adapter.runtime, "server");
  assert.equal(adapter.isInitialized(), true);
  assert.deepEqual(Object.keys(adapter).sort(), ["runtime"]);
});

test("SSR falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("ssr");
});

test("admin-contract falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("admin-contract");
});

test("provisioning falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("provisioning");
});

test("account-lifecycle falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("account-lifecycle");
});

test("auth-session falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("auth-session");
});

test("institutional-access falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("institutional-access");
});

test("nip-security falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("nip-security");
});

test("mfa-security falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("mfa-security");
});

test("mfa-administration falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("mfa-administration");
});

test("mfa-administration-local falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("mfa-administration-local");
});

test("academic-structure falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("academic-structure");
});

test("academic-scheduling falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("academic-scheduling");
});

test("attendance-management falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("attendance-management");
});

test("grade-management falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("grade-management");
});

test("student-enrollment falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("student-enrollment");
});

test("student-portal falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("student-portal");
});

test("academic-documents falla al importarse desde un Client Component", async () => {
  await expectClientBuildFailure("academic-documents");
});

test("las entradas server-only conservan una defensa adicional de ejecución", async () => {
  for (const moduleName of [
    "ssr",
    "admin-contract",
    "academic-documents",
    "provisioning",
    "account-lifecycle",
    "academic-structure",
    "academic-scheduling",
    "attendance-management",
    "grade-management",
    "student-enrollment",
    "student-portal",
    "auth-session",
    "institutional-access",
    "nip-security",
    "mfa-security",
  ]) {
    const script = `globalThis.window={};import('./dist/${moduleName}.js').catch((error)=>{console.error(error.message);process.exit(1)})`;
    const result = spawnSync(
      process.execPath,
      ["--conditions=react-server", "--input-type=module", "--eval", script],
      {
        cwd: new URL("..", import.meta.url),
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /solo puede importarse desde (?:el )?servidor/);
  }
});

test("las APIs públicas son limitadas y no exponen capacidades generales del SDK", async () => {
  const files = [
    "account-lifecycle.ts",
    "admin-contract.ts",
    "browser.ts",
    "provisioning.ts",
    "ssr.ts",
    "types.ts",
  ];
  const sources = await Promise.all(
    files.map((file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8")),
  );
  const source = sources.join("\n");

  assert.doesNotMatch(source, /SupabaseClient/);
  assert.doesNotMatch(source, /\.(?:from|rpc)\s*\(/);
  assert.doesNotMatch(source, /\.(?:auth|functions|realtime|storage)\b/);
  assert.doesNotMatch(source, /\.channel\s*\(/);
  assert.doesNotMatch(source, /service_role/i);
  assert.doesNotMatch(source, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(source, /process\.env/);

  const authSessionSource = await readFile(
    new URL("../src/auth-session.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(authSessionSource, /SupabaseClient|service_role|process\.env/);
  assert.doesNotMatch(authSessionSource, /\.(?:from|channel)\s*\(/);
  const institutionalAccessSource = await readFile(
    new URL("../src/institutional-access.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(institutionalAccessSource, /SupabaseClient|service_role|process\.env/);
  const nipSecuritySource = await readFile(
    new URL("../src/nip-security.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(nipSecuritySource, /SupabaseClient|service_role|process\.env/);
  const mfaSecuritySource = await readFile(
    new URL("../src/mfa-security.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    mfaSecuritySource,
    /SupabaseClient|service_role|process\.env|access_token|refresh_token|\bSession\b/,
  );
});

function fakeAuthService({
  context,
  mfaRequired = false,
  mfaSatisfied = true,
  sessionValid,
  signInError = false,
  user = { id: "auth-user" },
} = {}) {
  let signOutCalls = 0;
  let claimsCalls = 0;
  let factoryCalls = 0;
  const service = createAuthenticationService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    (_url, _key, options) => {
      factoryCalls += 1;
      return {
        auth: {
          async getClaims() {
            claimsCalls += 1;
            await options.cookies.setAll(
              [
                {
                  name: "synthetic-cookie",
                  options: { httpOnly: false, path: "/", sameSite: "lax" },
                  value: "not-a-token",
                },
              ],
              { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" },
            );
            return {
              data: { claims: user ? { aal: "aal1", session_version: 1, sub: user.id } : null },
              error: user ? null : new Error("expired"),
            };
          },
          async signInWithPassword() {
            return { data: {}, error: signInError ? new Error("invalid") : null };
          },
          async signOut() {
            signOutCalls += 1;
            return { error: null };
          },
          async updateUser() {
            return { data: {}, error: null };
          },
        },
        async rpc() {
          return {
            data: context
              ? [
                  {
                    mfa_required: mfaRequired,
                    mfa_satisfied: mfaSatisfied,
                    session_valid: sessionValid ?? context.account_status === "ACTIVE",
                    ...context,
                  },
                ]
              : [],
            error: null,
          };
        },
      };
    },
  );
  return {
    claimsCalls: () => claimsCalls,
    factoryCalls: () => factoryCalls,
    service,
    signOutCalls: () => signOutCalls,
  };
}

test("getClaims valida cada solicitud y setAll conserva cookies, opciones y headers", async () => {
  const updates = [];
  const secureOptions = [];
  let factoryCalls = 0;
  function createService() {
    return createAuthenticationService(
      validConfig,
      {
        getAll: () => [],
        setAll: (cookies, headers) => updates.push({ cookies, headers }),
      },
      (_url, _key, options) => {
        factoryCalls += 1;
        secureOptions.push(options.cookieOptions.secure);
        return {
          auth: {
            async getClaims() {
              await options.cookies.setAll(
                [{ name: "session", options: { path: "/", sameSite: "lax" }, value: "hidden" }],
                { "Cache-Control": "private, no-store", Expires: "0", Pragma: "no-cache" },
              );
              return { data: { claims: { sub: "auth-user" } }, error: null };
            },
            async signInWithPassword() {
              return { data: {}, error: null };
            },
            async signOut() {
              return { error: null };
            },
            async updateUser() {
              return { data: {}, error: null };
            },
          },
          async rpc() {
            return { data: [], error: null };
          },
        };
      },
    );
  }
  await createService().refreshSession();
  await createService().refreshSession();
  assert.equal(factoryCalls, 2, "cada solicitud debe crear un cliente nuevo");
  assert.deepEqual(secureOptions, [true, true], "HTTPS debe fijar cookies Secure");
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[0].cookies[0].options, { path: "/", sameSite: "lax" });
  assert.deepEqual(updates[0].headers, {
    "Cache-Control": "private, no-store",
    Expires: "0",
    Pragma: "no-cache",
  });
});

test("SSR permite localhost sin Secure y exige Secure para HTTPS", () => {
  let localSecure;
  createAuthenticationService(
    { publishableKey: validConfig.publishableKey, url: "http://localhost:54321" },
    { getAll: () => [], setAll: () => undefined },
    (_url, _key, options) => {
      localSecure = options.cookieOptions.secure;
      return {
        auth: {
          async getClaims() {
            return { data: null, error: null };
          },
          async signInWithPassword() {
            return { data: {}, error: null };
          },
          async signOut() {
            return { error: null };
          },
          async updateUser() {
            return { data: {}, error: null };
          },
        },
        async rpc() {
          return { data: [], error: null };
        },
      };
    },
  );
  assert.equal(localSecure, false);
});

test("autentica, evalúa estados y no devuelve tokens", async () => {
  const active = {
    account_id: "account",
    account_status: "ACTIVE",
    allowed_applications: ["PORTAL_ESCOLAR"],
    auth_user_id: "auth-user",
    person_id: "person",
    role_codes: ["ALUMNO"],
  };
  const { service } = fakeAuthService({ context: active });
  const result = await service.signInWithAuthCredentials({
    email: "local@example.invalid",
    password: "synthetic-password",
  });
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /access_token|refresh_token|synthetic-password/);
  assert.deepEqual(evaluateApplicationAccess(result.identity.context, "PORTAL_ESCOLAR"), {
    allowed: true,
    state: "ACTIVE",
  });
  assert.deepEqual(evaluateApplicationAccess(result.identity.context, "SISTEMA_ADMINISTRATIVO"), {
    allowed: false,
    state: "APPLICATION_NOT_ALLOWED",
  });
  for (const status of [
    "PENDING_INVITATION",
    "PENDING_ACTIVATION",
    "SUSPENDED",
    "BLOCKED",
    "DISABLED",
  ]) {
    assert.deepEqual(
      evaluateApplicationAccess(
        { ...result.identity.context, accountStatus: status },
        "PORTAL_ESCOLAR",
      ),
      { allowed: false, state: status },
    );
  }
});

test("maneja credenciales inválidas, sesión ausente y logout idempotente", async () => {
  const invalid = fakeAuthService({ signInError: true });
  assert.deepEqual(
    await invalid.service.signInWithAuthCredentials({
      email: "x@example.invalid",
      password: "incorrect-value",
    }),
    { error: "INVALID_CREDENTIALS", ok: false },
  );
  const absent = fakeAuthService({ user: null });
  assert.deepEqual(await absent.service.getAuthenticatedIdentity(), {
    error: "SESSION_EXPIRED",
    ok: false,
  });
  const logout = fakeAuthService();
  assert.deepEqual(await logout.service.signOutCurrentSession(), { ok: true });
  assert.deepEqual(await logout.service.signOutCurrentSession(), { ok: true });
  assert.equal(logout.signOutCalls(), 2);
});

test("solo permite redirects internos cerrados", () => {
  assert.equal(safeInternalRedirect("/inicio"), "/inicio");
  assert.equal(safeInternalRedirect("https://evil.invalid"), "/dashboard");
  assert.equal(safeInternalRedirect("//evil.invalid"), "/dashboard");
});

test("normaliza identificadores y conserva ceros significativos", () => {
  assert.equal(normalizeInstitutionalIdentifier("  ab-0012  "), "AB-0012");
  assert.equal(normalizeInstitutionalIdentifier("000123"), "000123");
  assert.equal(normalizeInstitutionalIdentifier("ABCD"), "ABCD");
  for (const value of ["ABC", "A".repeat(33), "AB C1", "áBC1", "AB/C", "a@b.c", "AB.C"]) {
    assert.throws(() => normalizeInstitutionalIdentifier(value), /datos proporcionados/);
  }
});

test("deriva alias determinista, tipado y no colisiona entre identificadores", () => {
  const base = {
    domain: "identidad.sistema-preparatoria.invalid",
    identifierType: "NUMERO_CONTROL",
  };
  const first = deriveInstitutionalAuthAlias({ ...base, normalizedIdentifier: "AB-0001" });
  const repeated = deriveInstitutionalAuthAlias({ ...base, normalizedIdentifier: "AB-0001" });
  const second = deriveInstitutionalAuthAlias({ ...base, normalizedIdentifier: "AB-0002" });
  assert.equal(first, repeated);
  assert.notEqual(first, second);
  assert.match(first, /^[a-z0-9-]+@[a-z0-9.-]+$/);
  assert.throws(
    () =>
      deriveInstitutionalAuthAlias({
        ...base,
        domain: "https://invalid",
        normalizedIdentifier: "AB-0001",
      }),
    /datos proporcionados/,
  );
});

test("valida NIP como string sin perder ceros ni modificar espacios", () => {
  assert.equal(validateInstitutionalNip("000123"), "000123");
  assert.equal(validateInstitutionalNip("A1-bcd"), "A1-bcd");
  for (const value of ["12345", "1".repeat(65), " 000123", "000123 ", "000 123", "abc\n123"]) {
    assert.throws(() => validateInstitutionalNip(value), /datos proporcionados/);
  }
});

test("login institucional separa alias y NIP del resultado y aplica aplicación", async () => {
  const active = {
    account_id: "account",
    account_status: "ACTIVE",
    allowed_applications: ["PORTAL_ESCOLAR"],
    auth_user_id: "auth-user",
    person_id: "person",
    role_codes: ["ALUMNO"],
  };
  const { service } = fakeAuthService({ context: active });
  const attempts = createInMemoryAuthenticationAttemptGuard();
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "PORTAL_ESCOLAR",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: " ab-0001 ",
      identifierType: "NUMERO_CONTROL",
      ipAddress: "127.0.0.1",
      nip: "000123",
    },
    { attempts, authentication: service },
  );
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /ab-0001|000123|identidad\.sistema/);

  const denied = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "SISTEMA_ADMINISTRATIVO",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: "AB-0001",
      identifierType: "NUMERO_CONTROL",
      ipAddress: "127.0.0.1",
      nip: "000123",
    },
    { attempts, authentication: service },
  );
  assert.deepEqual(denied, { error: "APPLICATION_NOT_ALLOWED", ok: false });
});

test("una sesión Auth válida conserva el estado DISABLED sin exponer identidad interna", async () => {
  const { service } = fakeAuthService({
    context: {
      account_id: null,
      account_status: "DISABLED",
      allowed_applications: [],
      auth_user_id: "auth-user",
      person_id: null,
      role_codes: [],
    },
  });
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "PORTAL_ESCOLAR",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: "AB-0099",
      identifierType: "NUMERO_CONTROL",
      ipAddress: null,
      nip: "000123",
    },
    {
      attempts: createInMemoryAuthenticationAttemptGuard(),
      authentication: service,
    },
  );
  assert.deepEqual(result, { error: "ACCOUNT_NOT_ACTIVE", ok: false });
});

test("login institucional acepta un contexto ACTIVE pre-MFA sin exponer identidad completa", async () => {
  const { service } = fakeAuthService({
    context: {
      account_id: null,
      account_status: "ACTIVE",
      allowed_applications: ["SISTEMA_ADMINISTRATIVO"],
      auth_user_id: "auth-user",
      person_id: null,
      role_codes: [],
    },
    mfaRequired: true,
    mfaSatisfied: false,
    sessionValid: true,
  });
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "SISTEMA_ADMINISTRATIVO",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: "ADM-0001",
      identifierType: "ADMINISTRATIVE_ID",
      ipAddress: "127.0.0.1",
      nip: "Secret01!",
    },
    {
      attempts: createInMemoryAuthenticationAttemptGuard(),
      authentication: service,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.identity.context.accountStatus, "ACTIVE");
  assert.equal(result.identity.context.accountId, null);
  assert.equal(result.identity.context.personId, null);
  assert.deepEqual(result.identity.context.roleCodes, []);
  assert.deepEqual(result.identity.context.allowedApplications, ["SISTEMA_ADMINISTRATIVO"]);
  assert.equal(result.identity.context.sessionValid, true);
  assert.equal(result.identity.context.mfaRequired, true);
  assert.equal(result.identity.context.mfaSatisfied, false);
});

test("login institucional no trata MFA pendiente como ACCOUNT_NOT_ACTIVE si la aplicación está permitida", async () => {
  const { service } = fakeAuthService({
    context: {
      account_id: null,
      account_status: "ACTIVE",
      allowed_applications: ["PORTAL_ESCOLAR"],
      auth_user_id: "auth-user",
      person_id: null,
      role_codes: [],
    },
    mfaRequired: true,
    mfaSatisfied: false,
    sessionValid: true,
  });
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "SISTEMA_ADMINISTRATIVO",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: "EMP-0001",
      identifierType: "EMPLOYEE_ID",
      ipAddress: "127.0.0.1",
      nip: "Secret01!",
    },
    {
      attempts: createInMemoryAuthenticationAttemptGuard(),
      authentication: service,
    },
  );

  assert.deepEqual(result, { error: "APPLICATION_NOT_ALLOWED", ok: false });
});

test("login institucional rechaza sesión inválida aunque la cuenta esté ACTIVE", async () => {
  const { service } = fakeAuthService({
    context: {
      account_id: "account",
      account_status: "ACTIVE",
      allowed_applications: ["SISTEMA_ADMINISTRATIVO"],
      auth_user_id: "auth-user",
      person_id: "person",
      role_codes: ["SUPERADMIN"],
    },
    mfaRequired: true,
    mfaSatisfied: false,
    sessionValid: false,
  });
  const result = await signInWithInstitutionalCredentials(
    {
      aliasDomain: "identidad.sistema-preparatoria.invalid",
      application: "SISTEMA_ADMINISTRATIVO",
      attemptSalt: "synthetic-attempt-salt-with-at-least-32-characters",
      identifier: "ADM-0002",
      identifierType: "ADMINISTRATIVE_ID",
      ipAddress: "127.0.0.1",
      nip: "Secret01!",
    },
    {
      attempts: createInMemoryAuthenticationAttemptGuard(),
      authentication: service,
    },
  );

  assert.deepEqual(result, { error: "INVALID_CREDENTIALS", ok: false });
});

test("login de aspirante permanece separado y usa mensaje genérico", async () => {
  const active = {
    account_id: "account",
    account_status: "ACTIVE",
    allowed_applications: ["PORTAL_ESCOLAR"],
    auth_user_id: "auth-user",
    person_id: "person",
    role_codes: ["ASPIRANTE"],
  };
  const { service } = fakeAuthService({ context: active });
  assert.equal(
    (
      await signInAsApplicant(
        {
          application: "PORTAL_ESCOLAR",
          email: "aspirante@example.invalid",
          password: "synthetic-password",
        },
        service,
      )
    ).ok,
    true,
  );
  assert.deepEqual(
    await signInAsApplicant(
      { application: "PORTAL_ESCOLAR", email: "invalid", password: "short" },
      service,
    ),
    { error: "INVALID_CREDENTIALS", ok: false },
  );
  assert.equal(genericInstitutionalLoginMessage.includes("existe"), false);
});

test("guard bloquea temporalmente, usa llave opaca y reinicia tras éxito", () => {
  let now = 1_000;
  const guard = createInMemoryAuthenticationAttemptGuard({ now: () => now });
  const key = createAuthenticationAttemptKey({
    identifierType: "MATRICULA",
    ipAddress: "127.0.0.1",
    normalizedIdentifier: "MAT-0001",
    salt: "synthetic-attempt-salt-with-at-least-32-characters",
  });
  assert.match(key, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(key, /MAT|127/);
  for (let attempt = 0; attempt < 5; attempt += 1) guard.recordFailure(key);
  assert.equal(guard.checkAllowed(key), false);
  now += 15 * 60 * 1000;
  assert.equal(guard.checkAllowed(key), true);
  guard.recordFailure(key);
  guard.recordSuccess(key);
  assert.equal(guard.checkAllowed(key), true);
});

const provisioningCommand = {
  accountId: "account-test",
  credential: {
    email: "sensitive@example.invalid",
    kind: "APPLICANT_EMAIL",
  },
  deliveryMode: "INVITE",
  idempotencyKey: "idempotency-test",
  initialRoleCodes: ["ALUMNO"],
  personId: "person-test",
  requestedAccountStatus: "PENDING_INVITATION",
  requestedByAccountId: "actor-test",
};

function createProvisioningScenario(options = {}) {
  const calls = [];
  const inputs = [];
  let record = {
    accountId: provisioningCommand.accountId,
    authUserCreatedByRequest: null,
    authUserId: null,
    id: "request-test",
    stage: options.initialStage ?? "PREPARED",
  };

  const persistence = {
    async finalize() {
      calls.push("finalize");
      if (options.finalizeError) throw options.finalizeError;
      record = { ...record, stage: "COMPLETED" };
      return record;
    },
    async markAuthPending() {
      calls.push("markAuthPending");
      record = { ...record, stage: "AUTH_PENDING" };
      return record;
    },
    async markCompensation(_requestId, succeeded) {
      calls.push(`markCompensation:${String(succeeded)}`);
      record = {
        ...record,
        stage:
          succeeded === null
            ? "COMPENSATION_PENDING"
            : succeeded
              ? "COMPENSATED"
              : "RETRYABLE_FAILURE",
      };
      return record;
    },
    async markFailure(_requestId, input) {
      calls.push(`markFailure:${input.code}`);
      record = {
        ...record,
        stage: input.retryable ? "RETRYABLE_FAILURE" : "TERMINAL_FAILURE",
      };
      return record;
    },
    async prepare(input) {
      calls.push("prepare");
      inputs.push({ operation: "prepare", value: input });
      return record;
    },
    async recordAuthCreated(_requestId, result) {
      calls.push("recordAuthCreated");
      record = {
        ...record,
        authUserCreatedByRequest: result.createdByOperation,
        authUserId: result.authUserId,
        stage: "AUTH_CREATED",
      };
      return record;
    },
  };

  const authAdmin = {
    async createOrInviteUser(input) {
      calls.push("createOrInviteUser");
      inputs.push({ operation: "createOrInviteUser", value: input });
      if (options.createError) throw options.createError;
      return {
        authUserId: "auth-user-test",
        createdByOperation: options.createdByOperation ?? true,
      };
    },
    async deleteProvisionedUser() {
      calls.push("deleteProvisionedUser");
      if (options.deleteError) throw options.deleteError;
      return { deleted: options.deleted ?? true };
    },
    async getProvisionedUser() {
      calls.push("getProvisionedUser");
      return options.reconciledResult ?? null;
    },
  };

  return { authAdmin, calls, inputs, persistence };
}

test("el orquestador completa e idempotiza sin duplicar el usuario Auth", async () => {
  const scenario = createProvisioningScenario();

  const first = await provisionInstitutionalIdentity(provisioningCommand, scenario);
  const second = await provisionInstitutionalIdentity(provisioningCommand, scenario);

  assert.equal(first.stage, "COMPLETED");
  assert.equal(second.stage, "COMPLETED");
  assert.equal(scenario.calls.filter((call) => call === "createOrInviteUser").length, 1);
  assert.equal(scenario.calls.filter((call) => call === "finalize").length, 1);
});

test("clasifica fallos reintentables, terminales y resultados inciertos", async () => {
  for (const [code, retryable, expectedCall] of [
    [provisioningErrorCodes.AUTH_PROVIDER_RETRYABLE_FAILURE, true, "markFailure"],
    [provisioningErrorCodes.AUTH_PROVIDER_TERMINAL_FAILURE, false, "markFailure"],
    [provisioningErrorCodes.AUTH_RESULT_UNKNOWN, false, "markCompensation:null"],
  ]) {
    const scenario = createProvisioningScenario({
      createError: new ProvisioningError(code, retryable),
    });
    await assert.rejects(
      provisionInstitutionalIdentity(provisioningCommand, scenario),
      (error) => error.code === code,
    );
    assert.ok(scenario.calls.some((call) => call.startsWith(expectedCall)));
    assert.equal(scenario.calls.includes("deleteProvisionedUser"), false);
  }
});

test("reconcilia AUTH_PENDING sin crear inmediatamente otro usuario", async () => {
  const scenario = createProvisioningScenario({
    initialStage: "AUTH_PENDING",
    reconciledResult: { authUserId: "auth-user-existing", createdByOperation: true },
  });

  const result = await provisionInstitutionalIdentity(provisioningCommand, scenario);

  assert.equal(result.stage, "COMPLETED");
  assert.equal(scenario.calls.includes("getProvisionedUser"), true);
  assert.equal(scenario.calls.includes("createOrInviteUser"), false);
});

test("compensa un usuario creado por la operación si falla la finalización", async () => {
  const scenario = createProvisioningScenario({
    finalizeError: new Error("database unavailable"),
  });

  await assert.rejects(
    provisionInstitutionalIdentity(provisioningCommand, scenario),
    (error) => error.code === provisioningErrorCodes.FINALIZATION_FAILED,
  );
  assert.ok(scenario.calls.includes("deleteProvisionedUser"));
  assert.ok(scenario.calls.includes("markCompensation:true"));
});

test("no elimina usuarios preexistentes y reporta compensación fallida", async () => {
  const preexisting = createProvisioningScenario({
    createdByOperation: false,
    finalizeError: new Error("database unavailable"),
  });
  await assert.rejects(
    provisionInstitutionalIdentity(provisioningCommand, preexisting),
    (error) => error.code === provisioningErrorCodes.FINALIZATION_FAILED,
  );
  assert.equal(preexisting.calls.includes("deleteProvisionedUser"), false);

  const failedCompensation = createProvisioningScenario({
    deleteError: new Error("provider unavailable"),
    finalizeError: new Error("database unavailable"),
  });
  await assert.rejects(
    provisionInstitutionalIdentity(provisioningCommand, failedCompensation),
    (error) => error.code === provisioningErrorCodes.COMPENSATION_FAILED,
  );
  assert.ok(failedCompensation.calls.includes("markCompensation:false"));
});

test("redacta correo y valores sensibles de diagnósticos", () => {
  const diagnostic = safeProvisioningDiagnostic({
    email: provisioningCommand.credential.email,
    message: `Falló ${provisioningCommand.credential.email}`,
    token: "not-a-real-token",
  });

  assert.deepEqual(diagnostic, {
    email: "[REDACTED]",
    message: "Falló [REDACTED]",
    token: "[REDACTED]",
  });
});

test("aprovisionamiento institucional entrega NIP solo al puerto Auth", async () => {
  const scenario = createProvisioningScenario();
  await provisionInstitutionalIdentity(
    {
      ...provisioningCommand,
      credential: {
        aliasDomain: "identidad.sistema-preparatoria.invalid",
        identifierType: "MATRICULA",
        kind: "INSTITUTIONAL_NIP",
        nip: "000123",
        normalizedIdentifier: "MAT-0001",
      },
      deliveryMode: "ADMIN_CREATED",
      requestedAccountStatus: "PENDING_ACTIVATION",
    },
    scenario,
  );
  const prepared = scenario.inputs.find((input) => input.operation === "prepare").value;
  const authInput = scenario.inputs.find((input) => input.operation === "createOrInviteUser").value;
  assert.deepEqual(prepared.institutionalIdentifier, {
    normalized: "MAT-0001",
    type: "MATRICULA",
  });
  assert.doesNotMatch(JSON.stringify(prepared), /000123|@/);
  assert.equal(authInput.password, "000123");
  assert.match(authInput.email, /@identidad\.sistema-preparatoria\.invalid$/);
});

test("el servicio de ciclo de vida delega comandos tipados sin red", async () => {
  const command = {
    accountId: "account-test",
    idempotencyKey: "operation-test",
    operation: "ACCOUNT_SUSPENDED",
    reasonCode: "ADMINISTRATIVE_SUSPENSION",
    resultingStatus: "SUSPENDED",
  };
  const expected = {
    accountId: command.accountId,
    eventType: command.operation,
    idempotencyKey: command.idempotencyKey,
    personId: "person-test",
    status: command.resultingStatus,
  };
  let calls = 0;
  const result = await manageInstitutionalAccountLifecycle(command, "actor-test", {
    async execute(received, actor) {
      calls += 1;
      assert.deepEqual(received, command);
      assert.equal(actor, "actor-test");
      return expected;
    },
  });
  assert.deepEqual(result, expected);
  assert.equal(calls, 1);
});

test("catálogos y máquina de estados de seguridad NIP son cerrados", () => {
  assert.deepEqual(nipRecoveryStatuses, [
    "REQUESTED",
    "APPROVED",
    "READY_FOR_RESET",
    "CONSUMED",
    "EXPIRED",
    "CANCELLED",
    "RETRYABLE_FAILURE",
    "TERMINAL_FAILURE",
    "RECONCILIATION_REQUIRED",
  ]);
  assert.equal(nipSecurityEventTypes.length, 16);
  assert.equal(nipSecurityReasonCodes.length, 10);
  assert.equal(nipSecurityErrorCodes.length, 21);
  assert.deepEqual(nipAbuseCategories, [
    "CHANGE_NIP",
    "REQUEST_RECOVERY",
    "RESET_NIP",
    "VALIDATE_RESET_TOKEN",
  ]);
  assert.deepEqual(nipRecoveryAdministrativeRoles, {
    FULL: ["SUPERADMIN", "ADMINISTRATIVO"],
    REQUEST_SCHOOL_IDENTITIES: ["CONTROL_ESCOLAR"],
  });
  assert.equal(isValidNipRecoveryTransition("REQUESTED", "APPROVED"), true);
  assert.equal(isValidNipRecoveryTransition("READY_FOR_RESET", "CONSUMED"), true);
  assert.equal(isValidNipRecoveryTransition("CONSUMED", "READY_FOR_RESET"), false);
  assert.equal(isValidNipRecoveryTransition("REQUESTED", "CONSUMED"), false);
});

test("token de restablecimiento es aleatorio, opaco y usa comparación constante", () => {
  const secret = "synthetic-token-secret-with-at-least-32-characters";
  const first = generateNipResetToken();
  const second = generateNipResetToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 43);
  const digest = digestNipResetToken(first, secret);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(safeTokenDigestEquals(digest, digest), true);
  assert.equal(safeTokenDigestEquals(digest, digestNipResetToken(second, secret)), false);
  assert.doesNotMatch(digest, new RegExp(first));
  assert.notEqual(
    createNipAbuseKey({
      category: "RESET_NIP",
      opaqueSubject: "synthetic-subject",
      salt: secret,
    }),
    createNipAbuseKey({
      category: "CHANGE_NIP",
      opaqueSubject: "synthetic-subject",
      salt: secret,
    }),
  );
});

test("cambio autenticado revalida contexto, actualiza y revoca otras sesiones", async () => {
  const events = [];
  const credentials = [];
  const result = await changeAuthenticatedNip(
    {
      application: "PORTAL_ESCOLAR",
      confirmation: "009988",
      correlationId: "00000000-0000-4000-8000-000000000101",
      currentNip: "001122",
      idempotencyKey: "change:synthetic:0001",
      newNip: "009988",
    },
    {
      audit: { record: async (event) => events.push(event) },
      auth: {
        async invalidateOwnSessions() {
          return { invalidated: true, ok: true };
        },
        async revokeAllSessions() {
          return { ok: true };
        },
        async updateAuthenticatedPassword(input) {
          credentials.push(input);
          return { ok: true };
        },
      },
      async getIdentity() {
        return {
          identity: {
            context: {
              accountId: "account",
              accountStatus: "ACTIVE",
              allowedApplications: ["PORTAL_ESCOLAR"],
              authUserId: "auth",
              personId: "person",
              roleCodes: ["ALUMNO"],
              mfaRequired: false,
              mfaSatisfied: true,
              sessionValid: true,
            },
            userId: "auth",
          },
          ok: true,
        };
      },
    },
  );
  assert.deepEqual(result, { changed: true, otherSessionsRevoked: true });
  assert.equal(events.length, 2);
  assert.deepEqual(credentials, [{ currentPassword: "001122", newPassword: "009988" }]);
  assert.doesNotMatch(JSON.stringify(result), /001122|009988|password|token|alias/i);
});

test("cambio autenticado rechaza confirmación, reutilización, estado y NIP actual", async () => {
  const base = {
    application: "PORTAL_ESCOLAR",
    confirmation: "009988",
    correlationId: "00000000-0000-4000-8000-000000000102",
    currentNip: "001122",
    idempotencyKey: "change:synthetic:0002",
    newNip: "009988",
  };
  const activeIdentity = async () => ({
    identity: {
      context: {
        accountId: "account",
        accountStatus: "ACTIVE",
        allowedApplications: ["PORTAL_ESCOLAR"],
        authUserId: "auth",
        personId: "person",
        roleCodes: ["ALUMNO"],
        mfaRequired: false,
        mfaSatisfied: true,
        sessionValid: true,
      },
      userId: "auth",
    },
    ok: true,
  });
  const dependency = {
    audit: { record: async () => undefined },
    auth: {
      invalidateOwnSessions: async () => ({ invalidated: true, ok: true }),
      revokeAllSessions: async () => ({ ok: false }),
      updateAuthenticatedPassword: async () => ({ ok: false }),
    },
    getIdentity: activeIdentity,
  };
  await assert.rejects(
    changeAuthenticatedNip({ ...base, confirmation: "008877" }, dependency),
    (error) => error.code === "NIP_CONFIRMATION_MISMATCH",
  );
  await assert.rejects(
    changeAuthenticatedNip({ ...base, newNip: "001122", confirmation: "001122" }, dependency),
    (error) => error.code === "NIP_REUSE_NOT_ALLOWED",
  );
  await assert.rejects(
    changeAuthenticatedNip(base, dependency),
    (error) => error.code === "INVALID_CURRENT_NIP",
  );
  await assert.rejects(
    changeAuthenticatedNip(base, {
      ...dependency,
      getIdentity: async () => ({
        identity: {
          context: {
            accountId: "account",
            accountStatus: "SUSPENDED",
            allowedApplications: [],
            authUserId: "auth",
            personId: "person",
            roleCodes: [],
            mfaRequired: false,
            mfaSatisfied: true,
            sessionValid: true,
          },
          userId: "auth",
        },
        ok: true,
      }),
    }),
    (error) => error.code === "ACCOUNT_NOT_ACTIVE",
  );
});

test("restablecimiento consume una sola vez y deriva reconciliación ante resultado incierto", async () => {
  const token = generateNipResetToken();
  const secret = "synthetic-token-secret-with-at-least-32-characters";
  const digest = digestNipResetToken(token, secret);
  const calls = [];
  const attempts = createInMemoryAuthenticationAttemptGuard();
  const persistence = {
    async completeReset(input) {
      calls.push(["complete", input]);
      return { accountId: "account", id: "recovery", personId: "person", status: "CONSUMED" };
    },
    async invalidateSessionsAfterReset(input) {
      calls.push(["invalidate", input]);
      return { ok: true };
    },
    async markReconciliationRequired(input) {
      calls.push(["reconcile", input]);
      return {
        accountId: "account",
        id: "recovery",
        personId: "person",
        status: "RECONCILIATION_REQUIRED",
      };
    },
    async markResetAttempt(value) {
      assert.equal(value, digest);
      return {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        id: "authorization",
        recoveryRequestId: "recovery",
      };
    },
    async markResetFailure(input) {
      calls.push(["failure", input]);
      return {
        accountId: "account",
        id: "recovery",
        personId: "person",
        status: "RETRYABLE_FAILURE",
      };
    },
    async resolveAuthorization(value) {
      assert.equal(value, digest);
      return {
        accountId: "account",
        authorization: {
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          id: "authorization",
          recoveryRequestId: "recovery",
        },
        personId: "person",
        recovery: {
          accountId: "account",
          id: "recovery",
          personId: "person",
          status: "READY_FOR_RESET",
        },
      };
    },
  };
  const result = await resetNipWithAuthorization(
    {
      confirmation: "001234",
      idempotencyKey: "reset:synthetic:0001",
      newNip: "001234",
      token,
      tokenSecret: secret,
    },
    {
      attempts,
      auth: {
        revokeAllSessions: async () => ({ confirmed: false }),
        updatePasswordForAccount: async () => ({ outcome: "SUCCESS" }),
      },
      persistence,
    },
  );
  assert.deepEqual(result, { reset: true, sessionsRevoked: false });
  assert.equal(calls[0][0], "complete");
  await assert.rejects(
    resetNipWithAuthorization(
      {
        confirmation: "006789",
        idempotencyKey: "reset:synthetic:0002",
        newNip: "006789",
        token,
        tokenSecret: secret,
      },
      {
        attempts,
        auth: {
          revokeAllSessions: async () => ({ confirmed: false }),
          updatePasswordForAccount: async () => ({ outcome: "UNKNOWN" }),
        },
        persistence,
      },
    ),
    (error) => error.code === "RECONCILIATION_REQUIRED",
  );
  assert.equal(calls.at(-1)[0], "reconcile");
  assert.doesNotMatch(JSON.stringify(result), /001234|token|digest|password|alias/i);
});

test("normaliza fallos del puerto y conserva errores cerrados", async () => {
  const command = {
    accountId: "account-test",
    idempotencyKey: "operation-test",
    operation: "ACCOUNT_BLOCKED",
    reasonCode: "SECURITY_REVIEW",
    resultingStatus: "BLOCKED",
  };
  await assert.rejects(
    manageInstitutionalAccountLifecycle(command, "actor-test", {
      async execute() {
        throw new Error("sensitive internal detail");
      },
    }),
    (error) =>
      error instanceof AccountLifecycleError &&
      error.code === "LIFECYCLE_OPERATION_FAILED" &&
      !error.message.includes("sensitive"),
  );
  assert.ok(accountLifecycleErrorCodes.includes("IDEMPOTENCY_CONFLICT"));
  assert.ok(accountLifecycleEventTypes.includes("ACTIVATION_CONFIRMED"));
  assert.ok(accountLifecycleReasonCodes.includes("REACTIVATION_APPROVED"));
});

test("redacta diagnósticos del ciclo de vida", () => {
  assert.deepEqual(
    safeAccountLifecycleDiagnostic({
      email: "sensitive@example.invalid",
      token: "secret-token",
    }),
    { email: "[REDACTED]", token: "[REDACTED]" },
  );
});

test("MFA mantiene catálogos cerrados, política por rol y parser AAL", () => {
  assert.equal(mfaSecurityEventTypes.length, 21);
  assert.equal(mfaSecurityReasonCodes.length, 11);
  assert.equal(mfaErrorCodes.length, 22);
  assert.equal(resolveMfaRequirement(["ALUMNO"]), "OPTIONAL");
  assert.equal(resolveMfaRequirement(["DOCENTE"]), "RECOMMENDED");
  assert.equal(resolveMfaRequirement(["ALUMNO", "CAJA"]), "REQUIRED");
  assert.equal(parseAuthenticatorAssuranceLevel("aal1"), "aal1");
  assert.equal(parseAuthenticatorAssuranceLevel("aal2"), "aal2");
  assert.throws(() => parseAuthenticatorAssuranceLevel("aal3"));
});

function activeMfaIdentity(application = "PORTAL_ESCOLAR") {
  return {
    getIdentity: async () => ({
      identity: {
        context: {
          accountId: "account",
          accountStatus: "ACTIVE",
          allowedApplications: [application],
          authUserId: "auth",
          mfaRequired: true,
          mfaSatisfied: application === "SISTEMA_ADMINISTRATIVO",
          personId: "person",
          roleCodes: application === "SISTEMA_ADMINISTRATIVO" ? ["CAJA"] : ["ALUMNO"],
          sessionValid: true,
        },
        userId: "auth",
      },
      ok: true,
    }),
  };
}

test("enrolamiento TOTP entrega material sensible solo en resultado efímero", async () => {
  const calls = [];
  const auth = {
    listFactors: async () => ({
      factors: [
        { id: "verified-factor", status: "verified" },
        { id: "stale-factor-a", status: "unverified" },
        { id: "stale-factor-b", status: "unverified" },
      ],
      ok: true,
    }),
    unenrollFactor: async (factorId) => {
      calls.push(`clear:${factorId}`);
      return { ok: true };
    },
    enrollTotp: async () => {
      calls.push("enroll");
      return {
        factorId: "synthetic-factor",
        ok: true,
        qrCode: "<svg>synthetic</svg>",
        secret: "synthetic-secret",
        sensitive: true,
        uri: "otpauth://synthetic",
      };
    },
  };
  const result = await beginTotpEnrollment(
    {
      application: "PORTAL_ESCOLAR",
      friendlyName: "Teléfono personal",
      recentlyReauthenticated: true,
    },
    { auth, identity: activeMfaIdentity() },
  );
  assert.equal(result.factorId, "synthetic-factor");
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(calls, ["clear:stale-factor-a", "clear:stale-factor-b", "enroll"]);
  await assert.rejects(
    beginTotpEnrollment(
      { application: "PORTAL_ESCOLAR", recentlyReauthenticated: false },
      { auth, identity: activeMfaIdentity() },
    ),
    (error) => error.code === "MFA_AAL2_REQUIRED",
  );
});

test("enrolamiento TOTP falla si no puede limpiar factores pendientes residuales", async () => {
  await assert.rejects(
    beginTotpEnrollment(
      {
        application: "SISTEMA_ADMINISTRATIVO",
        friendlyName: "DEMO-ADMIN",
        recentlyReauthenticated: true,
      },
      {
        auth: {
          enrollTotp: async () => ({ ok: false }),
          listFactors: async () => ({
            factors: [{ id: "stale-factor", status: "unverified" }],
            ok: true,
          }),
          unenrollFactor: async () => ({ ok: false }),
        },
        identity: activeMfaIdentity("SISTEMA_ADMINISTRATIVO"),
      },
    ),
    (error) => error.code === "MFA_UNENROLL_FAILED",
  );
});

test("verify exige AAL2, registra cumplimiento e intenta refrescar", async () => {
  const calls = [];
  const auth = {
    challengeAndVerify: async ({ code }) => {
      calls.push(`verify:${code.length}`);
      return { ok: true };
    },
    getAuthenticatorAssuranceLevel: async () => ({
      currentLevel: "aal2",
      nextLevel: "aal2",
      ok: true,
    }),
    listFactors: async () => ({
      factors: [{ id: "factor", status: "verified" }],
      ok: true,
    }),
    refreshSessionAfterMfaChange: async () => {
      calls.push("refresh");
      return { ok: true };
    },
    signOutAfterMfaRecovery: async () => ({ ok: true }),
  };
  const result = await verifyTotpEnrollment(
    {
      application: "PORTAL_ESCOLAR",
      code: "001234",
      correlationId: "correlation",
      factorId: "factor",
      idempotencyKey: "idempotency",
      reason: "USER_ENROLLMENT",
    },
    {
      auth,
      identity: activeMfaIdentity(),
      persistence: {
        recordState: async (event) => {
          calls.push(`${event.eventType}:${event.factorCount}`);
          return { ok: true };
        },
      },
    },
  );
  assert.deepEqual(result, { factorCount: 1, verified: true });
  assert.deepEqual(calls, ["verify:6", "MFA_ENROLLMENT_VERIFIED:1", "refresh"]);
  await assert.rejects(
    verifyTotpChallenge(
      { code: "12345", factorId: "factor" },
      { challengeAndVerify: async () => ({ ok: true }) },
    ),
    (error) => error.code === "MFA_CODE_INVALID",
  );
});

test("desenrolamiento protege el último factor obligatorio", async () => {
  const auth = {
    getAuthenticatorAssuranceLevel: async () => ({
      currentLevel: "aal2",
      nextLevel: "aal2",
      ok: true,
    }),
    listFactors: async () => ({
      factors: [{ id: "factor", status: "verified" }],
      ok: true,
    }),
  };
  await assert.rejects(
    unenrollOwnTotpFactor(
      {
        application: "SISTEMA_ADMINISTRATIVO",
        correlationId: "correlation",
        factorId: "factor",
        idempotencyKey: "idempotency",
        mfaRequired: true,
        recentlyReauthenticated: true,
      },
      {
        auth,
        identity: activeMfaIdentity("SISTEMA_ADMINISTRATIVO"),
        persistence: { recordState: async () => ({ ok: true }) },
      },
    ),
    (error) => error.code === "MFA_LAST_REQUIRED_FACTOR",
  );
});

test("guardia MFA limita cinco intentos y oculta el sujeto", () => {
  const key = createMfaAbuseKey({
    category: "MFA_LOGIN_CHALLENGE",
    opaqueSubject: "sensitive-subject",
    salt: "synthetic-salt",
  });
  assert.doesNotMatch(key, /sensitive-subject/);
  const guard = createInMemoryMfaAttemptGuard();
  for (let index = 0; index < 5; index += 1) {
    assert.equal(guard.checkAllowed(key), true);
    guard.recordFailure(key);
  }
  assert.equal(guard.checkAllowed(key), false);
  guard.recordSuccess(key);
  assert.equal(guard.checkAllowed(key), true);
});

test("contratos MFA seguros cubren assurance, challenge, recuperación y alias públicos", async () => {
  const events = [];
  const auth = {
    challengeFactor: async () => ({ challengeId: "sensitive-challenge", ok: true }),
    getAuthenticatorAssuranceLevel: async () => ({
      currentLevel: "aal2",
      nextLevel: "aal2",
      ok: true,
    }),
    listFactors: async () => ({
      factors: [{ friendlyName: "Principal", id: "sensitive-factor", status: "verified" }],
      ok: true,
    }),
  };
  assert.deepEqual(await getMfaAssuranceState(auth), {
    currentLevel: "aal2",
    nextLevel: "aal2",
    satisfied: true,
  });
  assert.deepEqual(await beginMfaChallenge("sensitive-factor", auth), {
    challengeId: "sensitive-challenge",
    sensitive: true,
  });
  assert.deepEqual(await listOwnMfaFactors(auth), [
    { factorIndex: 0, friendlyName: "Principal", status: "verified" },
  ]);
  const identity = activeMfaIdentity("SISTEMA_ADMINISTRATIVO");
  assert.equal((await requireMfaCompliance("SISTEMA_ADMINISTRATIVO", identity)).userId, "auth");
  assert.equal(typeof beginBackupFactorEnrollment, "function");
  assert.equal(typeof requireStepUpAuthentication, "function");
  const persistence = {
    recordState: async (event) => {
      events.push(event.eventType);
      return { ok: true };
    },
  };
  assert.deepEqual(
    await requestMfaRecovery(
      {
        application: "SISTEMA_ADMINISTRATIVO",
        correlationId: "correlation",
        idempotencyKey: "idempotency",
      },
      { identity, persistence },
    ),
    { requested: true },
  );
  assert.deepEqual(
    await completeMfaRecovery(
      { approved: true, correlationId: "correlation", idempotencyKey: "completion" },
      {
        auth: { signOutAfterMfaRecovery: async () => ({ ok: true }) },
        persistence,
        recovery: {
          completeApprovedRecovery: async () => ({ completed: true, ok: true }),
        },
      },
    ),
    { completed: true },
  );
  assert.deepEqual(events, ["MFA_RECOVERY_REQUESTED", "MFA_RECOVERY_COMPLETED"]);
});

function administrativeActor(role = "SUPERADMIN", aal = "aal2") {
  return { aal, accountId: "actor", roles: [role], sessionValid: true };
}

function administrativeRepository(overrides = {}) {
  const calls = [];
  return {
    calls,
    approve: async () => "APPROVED",
    beginExecution: async () => ({
      authUserId: "internal-auth-user",
      recoveryId: "recovery",
      sessionVersion: 2,
    }),
    cancel: async () => "CANCELLED",
    complete: async () => "COMPLETED",
    completeFactorOperation: async (input) => calls.push(["completeFactor", input.outcome]),
    markReconciliation: async () => "RECONCILIATION_REQUIRED",
    markReenrollmentRequired: async () => "REENROLLMENT_REQUIRED",
    recordFactorOperation: async () => "operation",
    recordVerification: async () => "IDENTITY_VERIFIED",
    request: async () => ({ recoveryId: "recovery", status: "PENDING_IDENTITY_VERIFICATION" }),
    ...overrides,
  };
}

test("recuperación administrativa autoriza operadores AAL2 y rechaza CAJA/AAL1", async () => {
  const repository = administrativeRepository();
  assert.deepEqual(
    await requestAdministrativeMfaRecovery(
      {
        actor: administrativeActor("CONTROL_ESCOLAR"),
        correlationId: "correlation",
        idempotencyKey: "request-key",
        normalizedInstitutionalIdentifier: "synthetic",
        reason: "LOST_ALL_FACTORS",
      },
      repository,
    ),
    { recoveryId: "recovery", status: "PENDING_IDENTITY_VERIFICATION" },
  );
  await assert.rejects(
    requestAdministrativeMfaRecovery(
      {
        actor: administrativeActor("CAJA"),
        correlationId: "correlation",
        idempotencyKey: "request-key",
        normalizedInstitutionalIdentifier: "synthetic",
        reason: "LOST_ALL_FACTORS",
      },
      repository,
    ),
    (error) =>
      error instanceof AdministrativeMfaRecoveryError && error.code === "ACTOR_NOT_AUTHORIZED",
  );
  await assert.rejects(
    approveAdministrativeMfaRecovery(
      {
        actor: administrativeActor("SUPERADMIN", "aal1"),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        idempotencyKey: "approval-key",
        recoveryId: "recovery",
      },
      repository,
    ),
    (error) =>
      error instanceof AdministrativeMfaRecoveryError && error.code === "ACTOR_NOT_AUTHORIZED",
  );
});

test("ejecución privilegiada no expone IDs y reconcilia eliminación total", async () => {
  const repository = administrativeRepository();
  const auth = {
    deleteUserFactor: async () => ({ outcome: "deleted" }),
    inspectUserMfaState: async () => ({ ok: true, verifiedTotpCount: 0 }),
    listUserFactors: async () => ({
      factors: [
        {
          ephemeralFactorId: "ephemeral-only",
          factorType: "totp",
          status: "verified",
        },
      ],
      ok: true,
    }),
    revokeUserSessions: async () => ({
      mechanism: "verified_factor_deletion",
      ok: true,
    }),
  };
  assert.deepEqual(
    await executeAdministrativeMfaRecovery(
      {
        actor: administrativeActor(),
        digestSecret: "synthetic-digest-key-with-at-least-32-bytes",
        idempotencyKey: "execution-key",
        recoveryId: "recovery",
      },
      { auth, repository },
    ),
    { factorsRemoved: 1, status: "REENROLLMENT_REQUIRED" },
  );
  assert.doesNotMatch(JSON.stringify(repository.calls), /ephemeral-only|internal-auth-user/);
});

test("adaptador privilegiado local falla cerrado para URL remota y credencial ausente", () => {
  assert.equal(validateLocalSupabaseAuthAdminUrl("http://127.0.0.1:54321").hostname, "127.0.0.1");
  assert.throws(
    () => validateLocalSupabaseAuthAdminUrl("https://remote.supabase.co"),
    (error) =>
      error instanceof AdministrativeMfaRecoveryError &&
      error.code === "AUTH_ADMIN_ADAPTER_UNAVAILABLE",
  );
  assert.throws(
    () =>
      createLocalPrivilegedAuthMfaAdministrationAdapter({
        url: "http://127.0.0.1:54321",
      }),
    (error) =>
      error instanceof AdministrativeMfaRecoveryError &&
      error.code === "AUTH_ADMIN_CREDENTIAL_MISSING",
  );
});

test("catálogos, digests y protección de abuso administrativa son cerrados", () => {
  assert.equal(administrativeMfaRecoveryStatuses.length, 14);
  assert.equal(administrativeMfaRecoveryErrors.length, 28);
  assert.equal(administrativeMfaAbuseCategories.length, 6);
  const digest = createMfaFactorReferenceDigest({
    authUserId: "sensitive-user",
    ephemeralFactorId: "sensitive-factor",
    secret: "synthetic-digest-key-with-at-least-32-bytes",
  });
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(digest, /sensitive/);
  const key = createAdministrativeMfaAbuseKey({
    actor: "sensitive-actor",
    category: "MFA_ADMIN_RECOVERY_EXECUTION",
    salt: "synthetic-salt",
    target: "sensitive-target",
  });
  assert.doesNotMatch(key, /sensitive/);
});

test("contrato académico normaliza códigos y limita semestres", () => {
  assert.equal(normalizeAcademicCode("  synthetic_01 "), "SYNTHETIC_01");
  assert.equal(validateSemesterNumber(1), 1);
  assert.equal(validateSemesterNumber(6), 6);
  assert.throws(
    () => validateSemesterNumber(0),
    (error) => error instanceof AcademicStructureError && error.code === "INVALID_SEMESTER_NUMBER",
  );
  assert.throws(() => validateSemesterNumber(7), AcademicStructureError);
  assert.equal(new Set(academicStructureErrorCodes).size, academicStructureErrorCodes.length);
  assert.equal(academicStructureOperations.length, 38);
  assert.deepEqual(Object.keys(academicSqlFunctions), [...academicStructureOperations]);
  assert.equal(
    academicSqlFunctions.BEGIN_ACADEMIC_PERIOD_CLOSING,
    "academic.begin_academic_period_closing",
  );
  assert.equal(
    academicSqlFunctions.ACTIVATE_TEACHING_ASSIGNMENT,
    "academic.activate_teaching_assignment",
  );
  assert.doesNotMatch(
    JSON.stringify(academicSqlFunctions),
    /actorAccountId|sessionVersion|requestFingerprint|SupabaseClient/,
  );
});

test("servicio académico usa un puerto inyectable y retorna datos mínimos", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-group", operation: command.operation, status: "DRAFT" };
    },
    summary: async () => ({
      activeCycleCount: 0,
      activeGroupCount: 0,
      activePeriodCount: 0,
      activePlanCount: 0,
    }),
  };
  const result = await createGroup(
    {
      idempotencyKey: "SYNTHETIC_GROUP_01",
      input: { code: "SYNTHETIC_GROUP_01", semesterNumber: 5 },
    },
    port,
  );
  assert.deepEqual(result, {
    entityId: "synthetic-group",
    operation: "CREATE_GROUP",
    status: "DRAFT",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sqlFunction, "academic.create_group");
  assert.doesNotMatch(JSON.stringify(result), /email|token|nip|SupabaseClient/i);
});

test("contrato de inscripción conserva ceros y limita semestres", () => {
  assert.equal(normalizeInstitutionalStudentCode(" 001234 "), "001234");
  assert.equal(validateStudentSemester(1), 1);
  assert.equal(validateStudentSemester(6), 6);
  assert.throws(
    () => validateStudentSemester(7),
    (error) => error instanceof StudentEnrollmentError && error.code === "INVALID_SEMESTER_NUMBER",
  );
  assert.equal(new Set(studentEnrollmentErrorCodes).size, studentEnrollmentErrorCodes.length);
  assert.equal(studentEnrollmentOperations.length, 31);
  assert.deepEqual(Object.keys(studentEnrollmentSqlFunctions), [...studentEnrollmentOperations]);
  assert.doesNotMatch(
    JSON.stringify(studentEnrollmentSqlFunctions),
    /actorAccountId|sessionVersion|requestFingerprint|SupabaseClient/,
  );
});

test("servicio de inscripción usa puerto inyectable y resultado mínimo", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-request", operation: command.operation, status: "DRAFT" };
    },
    validateCoverage: async () => ({ complete: true, expectedCount: 2, offeredCount: 2 }),
  };
  const result = await createEnrollmentRequest(
    {
      idempotencyKey: "SYNTHETIC_REQUEST_01",
      input: { semesterNumber: 1, studentRecordId: "synthetic-record" },
    },
    port,
  );
  assert.deepEqual(result, {
    entityId: "synthetic-request",
    operation: "CREATE_ENROLLMENT_REQUEST",
    status: "DRAFT",
  });
  assert.equal(calls[0].sqlFunction, "academic.create_enrollment_request");
  assert.doesNotMatch(JSON.stringify(result), /email|name|token|nip|SupabaseClient/i);
});

test("contrato de calificaciones conserva catálogos y decimales cerrados", () => {
  assert.deepEqual(gradeWindowStatuses, ["DRAFT", "OPEN", "CLOSED", "CANCELLED"]);
  assert.deepEqual(unitGradeStatuses, [
    "DRAFT",
    "CAPTURED",
    "REVIEWED",
    "FINALIZED",
    "CORRECTED",
    "CANCELLED",
  ]);
  assert.deepEqual(subjectResultCodes, ["AC", "NA", "PENDING"]);
  assert.deepEqual(gradeCalculationStatuses, ["COMPLETE", "INCOMPLETE", "MANUAL_REVIEW_REQUIRED"]);
  assert.equal(validateGradeDecimal("0.000"), "0.000");
  assert.equal(validateGradeDecimal("5.95"), "5.95");
  assert.equal(validateGradeDecimal("10.0"), "10.0");
  for (const invalid of ["-1", "10.001", "6.1234", " 6", "NaN"]) {
    assert.throws(() => validateGradeDecimal(invalid), GradeManagementError);
  }
  assert.equal(new Set(gradeManagementErrorCodes).size, gradeManagementErrorCodes.length);
  assert.deepEqual(Object.keys(gradeManagementCommands), [...gradeManagementOperations]);
  assert.doesNotMatch(
    JSON.stringify(gradeManagementCommands),
    /actorAccountId|sessionVersion|fingerprint|normalizedGrade|resultCode|SupabaseClient/,
  );
});

test("servicio de calificaciones usa puerto inyectable y resultado mínimo", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-grade", status: "CAPTURED" };
    },
  };
  const result = await gradeManagementCommands.CAPTURE_STUDENT_UNIT_GRADE(
    {
      idempotencyKey: "SYNTHETIC_GRADE_01",
      input: { rawGrade: "6.25", subjectUnitId: "synthetic-unit" },
    },
    port,
  );
  assert.deepEqual(result, { entityId: "synthetic-grade", status: "CAPTURED" });
  assert.equal(calls[0].sqlFunction, "academic.capture_student_unit_grade");
});

test("confirmaciones y correcciones conservan idempotencia y respuestas mínimas", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-entity", status: "COMPLETED" };
    },
  };
  for (const operation of [
    "CONFIRM_SUBJECT_FINAL_RESULT",
    "CONFIRM_SEMESTER_PROGRESS_DECISION",
    "APPROVE_GRADE_CORRECTION",
    "APPLY_GRADE_CORRECTION",
  ]) {
    const result = await gradeManagementCommands[operation](
      { idempotencyKey: `KEY_${operation}`, input: { entityId: "synthetic-entity" } },
      port,
    );
    assert.deepEqual(result, { entityId: "synthetic-entity", status: "COMPLETED" });
  }
  assert.equal(calls.length, 4);
  assert.ok(calls.every((command) => command.idempotencyKey.startsWith("KEY_")));
  assert.doesNotMatch(JSON.stringify(calls), /actorAccountId|sessionVersion|aal|fingerprint/i);
});

test("captura interna por lote conserva un único comando atómico", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-batch", status: "CAPTURED" };
    },
  };
  await gradeManagementCommands.CAPTURE_BULK_UNIT_GRADES(
    {
      idempotencyKey: "SYNTHETIC_BATCH_01",
      input: {
        items: [
          { offeringEnrollmentId: "offering-1", subjectUnitId: "unit-1", rawGrade: "6.25" },
          { offeringEnrollmentId: "offering-1", subjectUnitId: "unit-2", rawGrade: "7.50" },
        ],
      },
    },
    port,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sqlFunction, "academic.capture_bulk_unit_grades");
  assert.equal(calls[0].input.items.length, 2);
});

test("contrato de horarios valida entradas y mantiene catálogos cerrados", () => {
  assert.equal(normalizeScheduleCode("  schedule_01 "), "SCHEDULE_01");
  assert.equal(validateIsoWeekday(1), 1);
  assert.equal(validateIsoWeekday(7), 7);
  assert.equal(validateTimeValue("07:00"), "07:00");
  assert.throws(
    () => validateIsoWeekday(0),
    (error) =>
      error instanceof AcademicSchedulingError && error.code === "TEMPLATE_BLOCK_NOT_ALLOWED",
  );
  assert.throws(() => validateTimeValue("24:00"), AcademicSchedulingError);
  assert.equal(new Set(academicSchedulingErrorCodes).size, academicSchedulingErrorCodes.length);
  assert.deepEqual(Object.keys(academicSchedulingSqlFunctions), [...academicSchedulingOperations]);
  assert.deepEqual(Object.keys(academicSchedulingCommands), [...academicSchedulingOperations]);
  assert.doesNotMatch(
    JSON.stringify({ academicSchedulingCommands, academicSchedulingSqlFunctions }),
    /actorAccountId|sessionVersion|requestFingerprint|SupabaseClient/,
  );
});

test("servicio de horarios usa puerto inyectable y retorna datos mínimos", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-shift", operation: command.operation, status: "DRAFT" };
    },
    getTeacherWorkload: async () => ({
      activeSessionCount: 0,
      conflictCount: 0,
      distributionByDay: {},
      groupCount: 0,
      offeringCount: 0,
      plannedSessionCount: 0,
      weeklyMinutes: 0,
      weeklySessionCount: 0,
    }),
    validateCoverage: async () => ({
      conflictCount: 0,
      invalidSessionCount: 0,
      missingOfferingCount: 0,
      valid: true,
    }),
  };
  const result = await academicSchedulingCommands.CREATE_ACADEMIC_SHIFT(
    { idempotencyKey: "SYNTHETIC_SHIFT_01", input: { code: "SHIFT_01" } },
    port,
  );
  assert.deepEqual(result, {
    entityId: "synthetic-shift",
    operation: "CREATE_ACADEMIC_SHIFT",
    status: "DRAFT",
  });
  assert.equal(calls[0].sqlFunction, "academic.create_academic_shift");
  assert.deepEqual(await validateGroupScheduleCoverage("synthetic-schedule", port), {
    conflictCount: 0,
    invalidSessionCount: 0,
    missingOfferingCount: 0,
    valid: true,
  });
  assert.doesNotMatch(JSON.stringify(result), /email|name|token|nip|SupabaseClient/i);
});

test("contrato de asistencia mantiene estados, fechas y minutos cerrados", () => {
  assert.deepEqual(attendanceStatuses, ["NOT_RECORDED", "PRESENT", "ABSENT", "LATE", "EXCUSED"]);
  assert.deepEqual(attendanceSessionStatuses, ["DRAFT", "OPEN", "CLOSED", "CANCELLED", "LOCKED"]);
  assert.equal(validateAttendanceDate("2095-03-14"), "2095-03-14");
  assert.equal(validateLatenessMinutes("LATE", 4), 4);
  assert.equal(validateLatenessMinutes("PRESENT", null), null);
  assert.throws(
    () => validateLatenessMinutes("LATE", 0),
    (error) =>
      error instanceof AttendanceManagementError && error.code === "LATENESS_MINUTES_REQUIRED",
  );
  assert.throws(
    () => validateLatenessMinutes("ABSENT", 1),
    (error) =>
      error instanceof AttendanceManagementError && error.code === "LATENESS_MINUTES_NOT_ALLOWED",
  );
  assert.equal(new Set(attendanceManagementErrorCodes).size, attendanceManagementErrorCodes.length);
  assert.deepEqual(Object.keys(attendanceManagementSqlFunctions), [
    ...attendanceManagementOperations,
  ]);
  assert.deepEqual(Object.keys(attendanceManagementCommands), [...attendanceManagementOperations]);
  assert.doesNotMatch(
    JSON.stringify({ attendanceManagementCommands, attendanceManagementSqlFunctions }),
    /actorAccountId|sessionVersion|requestFingerprint|SupabaseClient|email|name|token|nip/,
  );
});

test("servicio de asistencia usa puerto inyectable y retorna datos mínimos", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "synthetic-session", operation: command.operation, status: "DRAFT" };
    },
    getSessionSummary: async () => ({
      absentCount: 0,
      excusedCount: 0,
      expectedCount: 1,
      lateCount: 0,
      notRecordedCount: 1,
      presentCount: 0,
      recordedCount: 0,
    }),
    getStudentLatenessSummary: async () => ({
      alertSequence: 0,
      currentCount: 0,
      lifetimeCount: 0,
      pendingAlertCount: 0,
    }),
  };
  const result = await attendanceManagementCommands.CREATE_ATTENDANCE_SESSION(
    {
      idempotencyKey: "SYNTHETIC_ATTENDANCE_01",
      input: { classSessionId: "synthetic-class", sessionDate: "2095-03-14" },
    },
    port,
  );
  assert.deepEqual(result, {
    entityId: "synthetic-session",
    operation: "CREATE_ATTENDANCE_SESSION",
    status: "DRAFT",
  });
  assert.equal(calls[0].sqlFunction, "academic.create_attendance_session");
  assert.doesNotMatch(JSON.stringify(result), /email|name|token|nip|SupabaseClient/i);
});

test("file store local genera artefactos deterministas y sin rutas absolutas", async () => {
  const store = createLocalAcademicDocumentFileStore(
    join(tmpdir(), "preparatoria-documents-tests"),
  );
  const input = {
    documentId: "00000000-0000-4000-8000-000000000001",
    folio: "DOC-ECT-2026-000001",
    payload: { alpha: 1, beta: "two" },
    title: "Constancia informativa de inscripción",
  };

  const first = await store.createDeterministicPdf(input);
  const second = await store.createDeterministicPdf(input);
  const content = (await store.read(first.objectPath)).toString("utf8");

  assert.deepEqual(first, second);
  assert.match(first.fileHash, /^[0-9a-f]{64}$/);
  assert.equal(first.mimeType, "application/pdf");
  assert.match(first.objectPath, /^documents\/[0-9a-f-]+\/[0-9a-f]{12}\.pdf$/i);
  assert.doesNotMatch(first.objectPath, /^[A-Za-z]:\\/);
  assert.doesNotMatch(first.objectPath, /[:\\]/);
  assert.match(content, /Documento informativo generado por el sistema\./);
  assert.doesNotMatch(content, /oficial|SEP|certificado/i);
});

test("servicio documental SSR consume solo RPCs públicos controlados", async () => {
  const calls = [];
  const service = createAcademicDocumentsService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async (name, input) => {
        calls.push({ input, name });
        switch (name) {
          case "get_my_documents":
            return {
              data: [
                {
                  documentId: "00000000-0000-4000-8000-000000000101",
                  folio: "DOC-ECT-2026-000001",
                  issuedAt: "2026-01-02T00:00:00.000Z",
                  publishedAt: "2026-01-02T00:05:00.000Z",
                  requestedPeriodId: null,
                  status: "PUBLISHED",
                  typeCode: "ENROLLMENT_CERTIFICATE",
                  typeName: "Constancia informativa de inscripción",
                },
              ],
              error: null,
            };
          case "get_my_document":
          case "get_my_guardian_student_document":
            return {
              data: {
                documentId: "00000000-0000-4000-8000-000000000101",
                folio: "DOC-ECT-2026-000001",
                issuedAt: "2026-01-02T00:00:00.000Z",
                publishedAt: "2026-01-02T00:05:00.000Z",
                requestedPeriodId: null,
                status: "PUBLISHED",
                typeCode: "ENROLLMENT_CERTIFICATE",
                typeName: "Constancia informativa de inscripción",
                downloadAvailable: name === "get_my_document",
                supersedesDocumentId: null,
                supersededByDocumentId: null,
              },
              error: null,
            };
          case "get_my_document_download":
            return {
              data: {
                documentId: "00000000-0000-4000-8000-000000000101",
                objectPath: "documents/00000000-0000-4000-8000-000000000101/abc123def456.pdf",
                sizeBytes: 256,
                fileHash: "a".repeat(64),
              },
              error: null,
            };
          case "get_my_guardian_student_documents":
            return {
              data: [
                {
                  documentId: "00000000-0000-4000-8000-000000000101",
                  folio: "DOC-ECT-2026-000001",
                  issuedAt: "2026-01-02T00:00:00.000Z",
                  publishedAt: null,
                  requestedPeriodId: null,
                  status: "REVOKED",
                  typeCode: "ENROLLMENT_CERTIFICATE",
                  typeName: "Constancia informativa de inscripción",
                },
              ],
              error: null,
            };
          case "verify_document_public":
            return {
              data: {
                verified: true,
                folio: "DOC-ECT-2026-000001",
                issuedAt: "2026-01-02T00:00:00.000Z",
                status: "VIGENTE",
                typeName: "Constancia informativa de inscripción",
              },
              error: null,
            };
          default:
            return { data: null, error: null };
        }
      },
    }),
  );

  const linkId = "00000000-0000-4000-8000-000000000201";
  const documentId = "00000000-0000-4000-8000-000000000101";
  await service.getMyDocuments();
  await service.getMyDocument(documentId);
  await service.getMyDocumentDownload(documentId);
  await service.getGuardianStudentDocuments(linkId);
  await service.getGuardianStudentDocument(linkId, documentId);
  await service.verifyPublicDocument(" DOC-ECT-2026-000001 ", "  code-123 ");

  assert.deepEqual(
    calls.map((call) => call.name),
    [
      "get_my_documents",
      "get_my_document",
      "get_my_document_download",
      "get_my_guardian_student_documents",
      "get_my_guardian_student_document",
      "verify_document_public",
    ],
  );
  assert.deepEqual(calls[1], {
    input: { document_id: documentId },
    name: "get_my_document",
  });
  assert.deepEqual(calls[3], {
    input: { link_id: linkId },
    name: "get_my_guardian_student_documents",
  });
  assert.deepEqual(calls[4], {
    input: { document_id: documentId, link_id: linkId },
    name: "get_my_guardian_student_document",
  });
  assert.deepEqual(calls[5], {
    input: { folio: "DOC-ECT-2026-000001", verification_code: "CODE-123" },
    name: "verify_document_public",
  });
  assert.doesNotMatch(
    JSON.stringify(calls),
    /student_record_id|guardian_account_id|account_id|person_id|auth_user_id|from\(/i,
  );
});

test("servicio documental falla cerrado ante scope denegado y UUIDs inválidos", async () => {
  const service = createAcademicDocumentsService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async () => ({ data: { error: "DOCUMENT_SCOPE_DENIED" }, error: null }),
    }),
  );

  await assert.rejects(
    service.getGuardianStudentDocuments("00000000-0000-4000-8000-000000000201"),
    (error) => error instanceof AcademicDocumentsError && error.code === "DOCUMENT_SCOPE_DENIED",
  );
  assert.throws(
    () => service.validateOwnDocumentInput("not-a-uuid"),
    (error) => error instanceof AcademicDocumentsError && error.code === "DOCUMENT_NOT_FOUND",
  );
});

test("código público de verificación produce hash estable y no expone el valor", () => {
  const value = createVerificationCode();
  assert.match(value.plain, /^[A-Z0-9_-]{8}$/);
  assert.equal(value.prefix, value.plain.slice(0, 4));
  assert.match(value.hash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(value.hash, new RegExp(value.plain, "i"));
});

test("servicio SSR del portal del alumno consume solo RPCs públicos controlados", async () => {
  const calls = [];
  const service = createStudentPortalService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async (name, input) => {
        calls.push({ input, name });
        return { data: { ok: true }, error: null };
      },
    }),
  );

  assert.deepEqual(studentPortalRpcNames, [
    "get_my_student_portal_attendance",
    "get_my_student_portal_grades",
    "get_my_student_portal_overview",
    "get_my_student_portal_permissions",
    "get_my_student_portal_record",
    "get_my_student_portal_schedule",
    "get_my_student_portal_subjects",
    "get_my_student_portal_trajectory",
  ]);

  await service.getOverview("00000000-0000-4000-8000-000000000001");
  await service.getRecord();
  await service.getSubjects();
  await service.getSchedule();
  await service.getAttendance();
  await service.getPermissions();
  await service.getGrades();
  await service.getTrajectory();

  assert.equal(calls.length, 8);
  assert.deepEqual(calls[0], {
    input: { requested_period_id: "00000000-0000-4000-8000-000000000001" },
    name: "get_my_student_portal_overview",
  });
  assert.ok(calls.every((call) => String(call.name).startsWith("get_my_student_portal_")));
  assert.doesNotMatch(
    JSON.stringify(calls),
    /student_record_id|account_id|person_id|auth_user_id|from\(/i,
  );
  assert.throws(
    () => service.getOverview("periodo-invalido"),
    (error) => error instanceof Error && error.code === "STUDENT_PORTAL_PERIOD_INVALID",
  );
});

test("servicio SSR del portal del tutor consume solo RPCs públicos controlados", async () => {
  const calls = [];
  const service = createGuardianPortalService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async (name, input) => {
        calls.push({ input, name });
        return { data: { ok: true }, error: null };
      },
    }),
  );

  assert.deepEqual(guardianPortalRpcNames, [
    "get_my_guardian_portal_overview",
    "get_my_linked_students",
    "get_my_guardian_student_overview",
    "get_my_guardian_student_record",
    "get_my_guardian_student_subjects",
    "get_my_guardian_student_schedule",
    "get_my_guardian_student_attendance",
    "get_my_guardian_student_permissions",
    "get_my_guardian_student_grades",
    "get_my_guardian_student_results",
    "get_my_guardian_student_progress",
    "get_my_guardian_student_history",
  ]);

  const id = "00000000-0000-4000-8000-000000000001";
  await service.getPortalOverview();
  await service.getLinkedStudents();
  await service.getStudentOverview(id);
  await service.getStudentRecord(id);
  await service.getStudentSubjects(id);
  await service.getStudentSchedule(id);
  await service.getStudentAttendance(id);
  await service.getStudentPermissions(id);
  await service.getStudentGrades(id);
  await service.getStudentResults(id);
  await service.getStudentProgress(id);
  await service.getStudentHistory(id, 10, 0);

  assert.equal(calls.length, 12);
  assert.equal(calls[2].name, "get_my_guardian_student_overview");
  assert.equal(calls[3].name, "get_my_guardian_student_record");
  assert.doesNotMatch(
    JSON.stringify(calls),
    /student_record_id|guardian_account_id|account_id|person_id|auth_user_id|from\(/i,
  );
  assert.throws(
    () => service.getStudentOverview("invalido"),
    (error) =>
      error instanceof GuardianPortalError && error.code === "GUARDIAN_PORTAL_ACCESS_DENIED",
  );
});

test("servicio SSR financiero consume solo RPCs públicos controlados y montos decimales", async () => {
  const calls = [];
  const service = createStudentFinanceService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async (name, input) => {
        calls.push({ input, name });
        if (name === "get_my_student_financial_summary") {
          return {
            data: {
              currencyCode: "MXN",
              lastUpdatedAt: "2026-08-06T00:00:00.000Z",
              openChargeCount: 1,
              paymentCount: 2,
              totalBalance: "500.00",
            },
            error: null,
          };
        }
        if (name === "get_my_student_account_statement") {
          return {
            data: {
              movements: [
                {
                  amount: "1000.00",
                  balance: "500.00",
                  conceptName: "Inscripción",
                  createdAt: "2026-08-06T00:00:00.000Z",
                  effectiveAt: "2026-08-06T00:00:00.000Z",
                  movementType: "CHARGE",
                  referenceMasked: null,
                  status: "POSTED",
                },
              ],
              periodId: "00000000-0000-4000-8000-000000000001",
              totalBalance: "500.00",
            },
            error: null,
          };
        }
        if (name === "get_my_student_charges") {
          return {
            data: [
              {
                originalAmount: "1000.00",
                balance: "500.00",
                conceptName: "Inscripción",
                effectiveAt: "2026-08-06T00:00:00.000Z",
                source: "MANUAL",
                status: "PARTIALLY_PAID",
              },
            ],
            error: null,
          };
        }
        if (name === "get_my_student_payments") {
          return {
            data: [
              {
                amount: "500.00",
                effectiveAt: "2026-08-06T00:00:00.000Z",
                paymentId: "00000000-0000-4000-8000-000000000002",
                paymentMethod: "CASH",
                paymentReferenceMasked: "***1234",
                receiptNumber: "REC-2026-000001",
                status: "CONFIRMED",
              },
            ],
            error: null,
          };
        }
        if (name === "get_my_student_payment") {
          return {
            data: {
              amount: "500.00",
              effectiveAt: "2026-08-06T00:00:00.000Z",
              paymentId: "00000000-0000-4000-8000-000000000002",
              paymentMethod: "CASH",
              paymentReferenceMasked: "***1234",
              receiptNumber: "REC-2026-000001",
              status: "APPLIED",
              allocations: [
                {
                  amount: "500.00",
                  conceptName: "Inscripción",
                  effectiveAt: "2026-08-06T00:00:00.000Z",
                  status: "APPLIED",
                },
              ],
            },
            error: null,
          };
        }
        if (name === "get_my_student_receipt") {
          return {
            data: {
              amount: "500.00",
              issuedAt: "2026-08-06T00:00:00.000Z",
              legend:
                "Comprobante interno de registro de pago. No constituye CFDI ni comprobante fiscal.",
              paymentMethod: "CASH",
              paymentReferenceMasked: "***1234",
              receiptNumber: "REC-2026-000001",
              status: "CONFIRMED",
            },
            error: null,
          };
        }
        return { data: { error: "FINANCE_SCOPE_DENIED" }, error: null };
      },
    }),
  );

  const periodId = "00000000-0000-4000-8000-000000000001";
  const paymentId = "00000000-0000-4000-8000-000000000002";
  const linkId = "00000000-0000-4000-8000-000000000003";
  await service.getSummary();
  await service.getAccountStatement(periodId);
  await service.getCharges(periodId);
  await service.getPayments();
  await service.getPayment(paymentId);
  await service.getReceipt(paymentId);
  await service.getGuardianSummary(linkId);
  await service.getGuardianAccountStatement(linkId, periodId);

  assert.deepEqual(studentFinanceRpcNames, [
    "get_my_student_financial_summary",
    "get_my_student_account_statement",
    "get_my_student_charges",
    "get_my_student_payments",
    "get_my_student_payment",
    "get_my_student_receipt",
    "get_my_guardian_student_financial_summary",
    "get_my_guardian_student_account_statement",
  ]);
  assert.equal(calls.length, 8);
  assert.deepEqual(calls[1], {
    input: { requested_period_id: periodId },
    name: "get_my_student_account_statement",
  });
  assert.doesNotMatch(
    JSON.stringify(calls),
    /student_record_id|guardian_account_id|account_id|person_id|auth_user_id|from\(|CFDI|Pagar ahora/i,
  );
});

test("servicio SSR financiero falla cerrado con UUIDs inválidos y scope denegado", async () => {
  const service = createStudentFinanceService(
    validConfig,
    { getAll: () => [], setAll: () => {} },
    () => ({
      rpc: async () => ({ data: { error: "FINANCE_SCOPE_DENIED" }, error: null }),
    }),
  );

  await assert.rejects(
    service.getAccountStatement("periodo-invalido"),
    (error) => error instanceof StudentFinanceError && error.code === "FINANCE_PERIOD_INVALID",
  );
  await assert.rejects(
    service.getReceipt("pago-invalido"),
    (error) => error instanceof StudentFinanceError && error.code === "FINANCE_ACCESS_DENIED",
  );
  await assert.rejects(
    service.getGuardianSummary("link-invalido"),
    (error) => error instanceof StudentFinanceError && error.code === "FINANCE_SCOPE_DENIED",
  );
});

test("contrato de caja mantiene operaciones, funciones SQL y errores cerrados", () => {
  assert.deepEqual(cashRegisterOperations, [
    "GET_CASH_REGISTERS",
    "GET_ACTIVE_CASH_SESSION",
    "CREATE_CASH_REGISTER",
    "ASSIGN_CASHIER_TO_REGISTER",
    "OPEN_CASH_SESSION",
    "REGISTER_CASHIER_PAYMENT",
    "REGISTER_CASH_MOVEMENT",
    "BEGIN_CASH_SESSION_CLOSE",
    "RECORD_CASH_COUNT",
    "CLOSE_CASH_SESSION",
    "APPROVE_CASH_DIFFERENCE",
  ]);
  assert.deepEqual(Object.keys(cashRegisterSqlFunctions), [...cashRegisterOperations]);
  assert.equal(
    cashRegisterSqlFunctions.REGISTER_CASHIER_PAYMENT,
    "public.register_cashier_payment",
  );
  assert.ok(cashRegisterErrorCodes.includes("IDEMPOTENCY_CONFLICT"));
  assert.ok(cashRegisterErrorCodes.includes("AAL2_REQUIRED"));
  assert.equal(new Set(cashRegisterErrorCodes).size, cashRegisterErrorCodes.length);
  assert.doesNotMatch(
    JSON.stringify({ cashRegisterOperations, cashRegisterSqlFunctions }),
    /SupabaseClient|from\(|auth\.|storage|realtime|service_role/i,
  );
});

test("contrato de caja usa puerto inyectable y conserva montos decimales como strings", async () => {
  const calls = [];
  const session = {
    businessDate: "2099-01-15",
    cashRegisterId: "00000000-0000-4000-8000-000000000101",
    cashSessionId: "00000000-0000-4000-8000-000000000102",
    countedCashAmount: null,
    differenceAmount: null,
    expectedCashAmount: "650.00",
    openingAmount: "150.00",
    status: "OPEN",
  };
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "00000000-0000-4000-8000-000000000999", status: "RECORDED" };
    },
    getActiveSession: async () => session,
    getRegisters: async () => [
      {
        assigned: true,
        cashRegisterId: "00000000-0000-4000-8000-000000000101",
        code: "CAJA-01",
        currencyCode: "MXN",
        locationLabel: "Recepción",
        name: "Caja principal",
        status: "ACTIVE",
      },
    ],
  };

  await createCashRegister(
    port,
    { code: "CAJA-01", name: "Caja principal", status: "ACTIVE" },
    "cash-register:create:1",
    "00000000-0000-4000-8000-000000000001",
  );
  await openCashSession(
    port,
    {
      opening_amount: "150.00",
      requested_business_date: "2099-01-15",
      target_register_id: "00000000-0000-4000-8000-000000000101",
    },
    "cash-session:open:1",
  );
  await registerCashierPayment(
    port,
    {
      account_id: "00000000-0000-4000-8000-000000000201",
      confirm_operation_key: "cash-payment:confirm:1",
      register_operation_key: "cash-payment:register:1",
      requested_amount: "500.00",
      requested_method: "CASH",
      session_id: "00000000-0000-4000-8000-000000000102",
    },
    "cash-payment:link:1",
  );
  await registerCashMovement(
    port,
    {
      amount: "25.00",
      movement_type: "CASH_WITHDRAWAL",
      reason_code: "SAFE_DROP",
      target_session_id: "00000000-0000-4000-8000-000000000102",
    },
    "cash-movement:create:1",
  );
  await beginCashSessionClose(
    port,
    { target_session_id: "00000000-0000-4000-8000-000000000102" },
    "cash-close:begin:1",
  );
  await recordCashCount(
    port,
    { counted_amount: "625.00", target_session_id: "00000000-0000-4000-8000-000000000102" },
    "cash-count:1",
  );
  await closeCashSession(
    port,
    {
      difference_note: null,
      difference_reason_code: null,
      target_session_id: "00000000-0000-4000-8000-000000000102",
    },
    "cash-close:1",
  );
  await approveCashDifference(
    port,
    { target_session_id: "00000000-0000-4000-8000-000000000102" },
    "cash-approve:1",
  );

  const registers = await getCashRegisters(port);
  const activeSession = await getActiveCashSession(port);

  assert.equal(calls.length, 8);
  assert.equal(calls[0].sqlFunction, "finance.create_cash_register");
  assert.equal(calls[1].sqlFunction, "public.open_cash_session");
  assert.equal(calls[2].sqlFunction, "public.register_cashier_payment");
  assert.equal(calls[3].sqlFunction, "public.register_cash_movement");
  assert.equal(calls[4].sqlFunction, "public.begin_cash_session_close");
  assert.equal(calls[5].sqlFunction, "public.record_cash_count");
  assert.equal(calls[6].sqlFunction, "public.close_cash_session");
  assert.equal(calls[7].sqlFunction, "public.approve_cash_difference");
  assert.equal(registers[0].currencyCode, "MXN");
  assert.equal(activeSession?.expectedCashAmount, "650.00");
  assert.equal(typeof activeSession?.openingAmount, "string");
  assert.doesNotMatch(
    JSON.stringify({ calls, registers, activeSession }),
    /SupabaseClient|from\(/i,
  );
});

test("contrato de caja encapsula errores no controlados", async () => {
  const port = {
    execute: async () => {
      throw new Error("synthetic");
    },
    getActiveSession: async () => {
      throw new Error("synthetic");
    },
    getRegisters: async () => {
      throw new Error("synthetic");
    },
  };

  await assert.rejects(
    openCashSession(
      port,
      {
        opening_amount: "100.00",
        requested_business_date: "2099-01-15",
        target_register_id: "00000000-0000-4000-8000-000000000101",
      },
      "cash-session:open:error",
    ),
    (error) => error instanceof CashRegisterError && error.code === "FINANCE_OPERATION_FAILED",
  );
  await assert.rejects(
    getCashRegisters(port),
    (error) => error instanceof CashRegisterError && error.code === "FINANCE_OPERATION_FAILED",
  );
});

test("contrato de generación de cargos mantiene operaciones, funciones SQL y errores cerrados", () => {
  assert.deepEqual(chargeGenerationOperations, [
    "CREATE_RULE",
    "CREATE_RULE_VERSION",
    "APPROVE_RULE_VERSION",
    "ACTIVATE_RULE_VERSION",
    "PREVIEW",
    "CREATE_BATCH",
    "SUBMIT_BATCH",
    "APPROVE_BATCH",
    "EXECUTE_BATCH",
    "CREATE_EXCLUSION",
  ]);
  assert.equal(chargeGenerationSqlFunctions.PREVIEW, "public.preview_charge_generation");
  assert.equal(
    chargeGenerationSqlFunctions.EXECUTE_BATCH,
    "public.execute_charge_generation_batch",
  );
  assert.ok(chargeGenerationErrorCodes.includes("CHARGE_GENERATION_BATCH_NOT_APPROVED"));
  assert.ok(chargeGenerationErrorCodes.includes("AAL2_REQUIRED"));
  assert.doesNotMatch(
    JSON.stringify({ chargeGenerationOperations, chargeGenerationSqlFunctions }),
    /SupabaseClient|from\(|auth\.|storage|realtime|service_role/i,
  );
});

test("contrato de generación de cargos usa puerto inyectable y conserva montos decimales como strings", async () => {
  const calls = [];
  const preview = {
    estimatedTotal: "1500.00",
    items: [
      {
        displayName: null,
        dueDate: "2026-08-31",
        eligibilityStatus: "ELIGIBLE",
        groupName: "1A",
        reasonCode: null,
        resolvedAmount: "1500.00",
        resolvedChargeRateId: "00000000-0000-4000-8000-000000000101",
        semesterNumber: 1,
        studentIdentifier: "AL-001",
      },
    ],
    totalAlreadyCharged: 0,
    totalCandidates: 1,
    totalEligible: 1,
    totalExcluded: 0,
    totalManualReview: 0,
    totalWithoutRate: 0,
  };
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "00000000-0000-4000-8000-000000000999", status: "APPROVED" };
    },
    preview: async (input) => {
      calls.push({
        input,
        operation: "PREVIEW",
        sqlFunction: chargeGenerationSqlFunctions.PREVIEW,
      });
      return preview;
    },
  };

  await createChargeGenerationRule(
    port,
    { requested_code: "R-INS-2026B", requested_name: "Inscripción 2026-B" },
    "cg:rule:create:1",
  );
  await createChargeGenerationRuleVersion(
    port,
    { target_rule_id: "00000000-0000-4000-8000-000000000201" },
    "cg:version:create:1",
  );
  await approveChargeGenerationRuleVersion(
    port,
    { target_rule_version_id: "00000000-0000-4000-8000-000000000202" },
    "cg:version:approve:1",
  );
  await previewChargeGeneration(port, {
    target_academic_period_id: "00000000-0000-4000-8000-000000000203",
    target_rule_version_id: "00000000-0000-4000-8000-000000000202",
  });
  await createChargeGenerationBatch(
    port,
    {
      target_academic_period_id: "00000000-0000-4000-8000-000000000203",
      target_rule_version_id: "00000000-0000-4000-8000-000000000202",
    },
    "cg:batch:create:1",
  );
  await submitChargeGenerationBatch(
    port,
    { target_batch_id: "00000000-0000-4000-8000-000000000204" },
    "cg:batch:submit:1",
  );
  await approveChargeGenerationBatch(
    port,
    { target_batch_id: "00000000-0000-4000-8000-000000000204" },
    "cg:batch:approve:1",
  );
  await executeChargeGenerationBatch(
    port,
    { target_batch_id: "00000000-0000-4000-8000-000000000204" },
    "cg:batch:execute:1",
  );
  await createChargeGenerationExclusion(
    port,
    { target_student_record_id: "00000000-0000-4000-8000-000000000205" },
    "cg:exclusion:create:1",
  );

  assert.equal(calls[0].sqlFunction, "finance.create_charge_generation_rule");
  assert.equal(calls[1].sqlFunction, "finance.create_charge_generation_rule_version");
  assert.equal(calls[2].sqlFunction, "finance.approve_charge_generation_rule_version");
  assert.equal(calls[3].sqlFunction, "public.preview_charge_generation");
  assert.equal(calls[4].sqlFunction, "public.create_charge_generation_batch");
  assert.equal(calls[5].sqlFunction, "public.submit_charge_generation_batch");
  assert.equal(calls[6].sqlFunction, "public.approve_charge_generation_batch");
  assert.equal(calls[7].sqlFunction, "public.execute_charge_generation_batch");
  assert.equal(calls[8].sqlFunction, "finance.create_charge_generation_exclusion");
  assert.equal(preview.estimatedTotal, "1500.00");
});

test("contrato de generación de cargos encapsula errores no controlados", async () => {
  const port = {
    execute: async () => {
      throw new Error("synthetic");
    },
    preview: async () => {
      throw new Error("synthetic");
    },
  };

  await assert.rejects(
    createChargeGenerationBatch(
      port,
      {
        target_academic_period_id: "00000000-0000-4000-8000-000000000203",
        target_rule_version_id: "00000000-0000-4000-8000-000000000202",
      },
      "cg:error:1",
    ),
    (error) => error instanceof ChargeGenerationError && error.code === "FINANCE_OPERATION_FAILED",
  );
  await assert.rejects(
    previewChargeGeneration(port, {
      target_academic_period_id: "00000000-0000-4000-8000-000000000203",
      target_rule_version_id: "00000000-0000-4000-8000-000000000202",
    }),
    (error) => error instanceof ChargeGenerationError && error.code === "FINANCE_OPERATION_FAILED",
  );
});

test("contrato de cobranza mantiene operaciones, funciones SQL y errores cerrados", () => {
  assert.deepEqual(collectionOperations, [
    "GET_DEBT_POSITION",
    "LIST_OVERDUE",
    "OPEN_CASE",
    "ADD_ACTION",
    "CREATE_COMMITMENT",
    "EVALUATE_COMMITMENT",
    "FULFILL_COMMITMENT",
    "BREAK_COMMITMENT",
    "CANCEL_COMMITMENT",
    "RESOLVE_CASE",
    "CLOSE_CASE",
  ]);
  assert.equal(collectionSqlFunctions.GET_DEBT_POSITION, "public.get_student_debt_position");
  assert.equal(collectionSqlFunctions.CREATE_COMMITMENT, "public.create_payment_commitment");
  assert.ok(collectionErrorCodes.includes("AAL2_REQUIRED"));
  assert.ok(collectionErrorCodes.includes("IDEMPOTENCY_CONFLICT"));
  assert.equal(new Set(collectionErrorCodes).size, collectionErrorCodes.length);
  assert.doesNotMatch(
    JSON.stringify({ collectionOperations, collectionSqlFunctions }),
    /SupabaseClient|from\(|auth\.|storage|realtime|service_role|person_id|auth_user_id/i,
  );
});

test("contrato de cobranza usa puerto inyectable y evita filtrar identificadores técnicos", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "00000000-0000-4000-8000-000000000201", status: "OPEN" };
    },
    query: async (command) => {
      calls.push(command);
      if (command.operation === "GET_DEBT_POSITION") {
        return {
          chargeCount: 2,
          charges: [
            {
              agingBucket: "1_30_DAYS",
              chargeDescription: "Colegiatura",
              chargeId: "00000000-0000-4000-8000-000000000301",
              chargeStatus: "PARTIALLY_PAID",
              debtStatus: "OVERDUE",
              dueDate: "2099-01-15",
              originalAmount: "1000.00",
              outstandingAmount: "500.00",
            },
          ],
          daysPastDue: 22,
          oldestOverdueDate: "2099-01-15",
          overdueChargeCount: 1,
          totalNotDue: "0.00",
          totalOutstanding: "500.00",
          totalOverdue: "500.00",
        };
      }
      if (command.operation === "LIST_OVERDUE") {
        return [
          {
            agingBucket: "1_30_DAYS",
            caseStatus: "OPEN",
            displayName: "Alumno de prueba",
            groupName: "1A",
            institutionalStudentCode: "AL-001",
            oldestOverdueDate: "2099-01-15",
            semesterNumber: 1,
            totalOutstanding: "500.00",
            totalOverdue: "500.00",
          },
        ];
      }
      return {
        appearsBroken: false,
        canBeMarkedFulfilled: true,
        isPastDue: false,
        outstandingCurrent: "0.00",
        promisedAmount: "500.00",
        promisedDate: "2099-02-01",
        qualifyingPaymentsAfterCreated: "500.00",
      };
    },
  };

  await openCollectionCase(
    port,
    {
      requested_opened_reason_code: "OVERDUE_BALANCE",
      requested_priority: "NORMAL",
      requested_student_account_id: "00000000-0000-4000-8000-000000000101",
    },
    "collections:open:1",
  );
  await addCollectionAction(
    port,
    {
      requested_action_status: "RECORDED",
      requested_action_type: "PHONE_CONTACT",
      requested_collection_case_id: "00000000-0000-4000-8000-000000000201",
      requested_contact_channel: "PHONE",
      requested_occurred_at: "2099-01-20T10:00:00.000Z",
      requested_summary: "Seguimiento administrativo factual",
    },
    "collections:action:1",
  );
  await createPaymentCommitment(
    port,
    {
      requested_collection_case_id: "00000000-0000-4000-8000-000000000201",
      requested_notes: "Compromiso administrativo",
      requested_promised_amount: "500.00",
      requested_promised_date: "2099-02-01",
      requested_student_account_id: "00000000-0000-4000-8000-000000000101",
    },
    "collections:commitment:1",
  );
  await markPaymentCommitmentFulfilled(
    port,
    { requested_commitment_id: "00000000-0000-4000-8000-000000000401" },
    "collections:fulfill:1",
  );
  await markPaymentCommitmentBroken(
    port,
    { requested_commitment_id: "00000000-0000-4000-8000-000000000401" },
    "collections:broken:1",
  );
  await cancelPaymentCommitment(
    port,
    {
      requested_commitment_id: "00000000-0000-4000-8000-000000000401",
      requested_note: "Cancelación administrativa",
    },
    "collections:cancel:1",
  );
  await resolveCollectionCase(
    port,
    { requested_collection_case_id: "00000000-0000-4000-8000-000000000201" },
    "collections:resolve:1",
  );
  await closeCollectionCase(
    port,
    {
      requested_close_reason_code: "BALANCE_SETTLED",
      requested_collection_case_id: "00000000-0000-4000-8000-000000000201",
    },
    "collections:close:1",
  );

  const debt = await getStudentDebtPosition(port, {
    business_date: "2099-02-01",
    student_account_id: "00000000-0000-4000-8000-000000000101",
  });
  const overdue = await listOverdueStudentAccounts(port, {
    requested_limit: 25,
    requested_search_text: "AL-001",
  });
  const evaluation = await evaluatePaymentCommitment(port, {
    business_date: "2099-02-01",
    requested_commitment_id: "00000000-0000-4000-8000-000000000401",
  });

  assert.equal(calls.length, 11);
  assert.equal(calls[0].sqlFunction, "public.open_collection_case");
  assert.equal(calls[1].sqlFunction, "public.add_collection_action");
  assert.equal(calls[2].sqlFunction, "public.create_payment_commitment");
  assert.equal(calls[3].sqlFunction, "public.mark_payment_commitment_fulfilled");
  assert.equal(calls[4].sqlFunction, "public.mark_payment_commitment_broken");
  assert.equal(calls[5].sqlFunction, "public.cancel_payment_commitment");
  assert.equal(calls[6].sqlFunction, "public.resolve_collection_case");
  assert.equal(calls[7].sqlFunction, "public.close_collection_case");
  assert.equal(calls[8].sqlFunction, "public.get_student_debt_position");
  assert.equal(calls[9].sqlFunction, "public.list_overdue_student_accounts");
  assert.equal(calls[10].sqlFunction, "public.evaluate_payment_commitment");
  assert.equal(debt.totalOutstanding, "500.00");
  assert.equal(overdue[0].institutionalStudentCode, "AL-001");
  assert.equal(evaluation.canBeMarkedFulfilled, true);
  assert.doesNotMatch(
    JSON.stringify({ calls, debt, overdue, evaluation }),
    /auth_user_id|person_id|phone_number|email_address|medical|password|bank account|card/i,
  );
});

test("contrato de cobranza encapsula errores no controlados", async () => {
  const port = {
    execute: async () => {
      throw new Error("synthetic");
    },
    query: async () => {
      throw new Error("synthetic");
    },
  };

  await assert.rejects(
    openCollectionCase(
      port,
      {
        requested_opened_reason_code: "OVERDUE_BALANCE",
        requested_student_account_id: "00000000-0000-4000-8000-000000000101",
      },
      "collections:error:1",
    ),
    (error) => error instanceof CollectionError && error.code === "FINANCE_OPERATION_FAILED",
  );
  await assert.rejects(
    getStudentDebtPosition(port, { student_account_id: "00000000-0000-4000-8000-000000000101" }),
    (error) => error instanceof CollectionError && error.code === "FINANCE_OPERATION_FAILED",
  );
});

test("contrato de beneficios financieros mantiene operaciones, funciones SQL y errores cerrados", () => {
  assert.deepEqual(financialBenefitOperations, [
    "CREATE_SCHOLARSHIP_PROGRAM",
    "SUBMIT_SCHOLARSHIP_PROGRAM",
    "APPROVE_SCHOLARSHIP_PROGRAM",
    "ACTIVATE_SCHOLARSHIP_PROGRAM",
    "ASSIGN_STUDENT_SCHOLARSHIP",
    "SUBMIT_STUDENT_SCHOLARSHIP",
    "APPROVE_STUDENT_SCHOLARSHIP",
    "ACTIVATE_STUDENT_SCHOLARSHIP",
    "REVOKE_STUDENT_SCHOLARSHIP",
    "APPLY_STUDENT_SCHOLARSHIP",
    "APPLY_AUTHORIZED_DISCOUNT",
    "CREATE_AUTHORIZED_WAIVER",
    "APPROVE_AUTHORIZED_WAIVER",
    "APPLY_AUTHORIZED_WAIVER",
    "REVERSE_FINANCIAL_BENEFIT",
  ]);
  assert.equal(
    financialBenefitSqlFunctions.APPLY_STUDENT_SCHOLARSHIP,
    "finance.apply_student_scholarship",
  );
  assert.ok(financialBenefitErrorCodes.includes("AAL2_REQUIRED"));
  assert.ok(financialBenefitErrorCodes.includes("ADJUSTMENT_EXCEEDS_BALANCE"));
  assert.equal(new Set(financialBenefitErrorCodes).size, financialBenefitErrorCodes.length);
  assert.doesNotMatch(
    JSON.stringify({ financialBenefitOperations, financialBenefitSqlFunctions }),
    /SupabaseClient|from\(|auth\.|storage|realtime|service_role|person_id|auth_user_id/i,
  );
});

test("contrato de beneficios financieros usa puerto inyectable", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "00000000-0000-4000-8000-000000009901", status: "ACTIVE" };
    },
  };

  await createScholarshipProgram(port, { requested_code: "SCH-001" }, "benefits:create:1");
  await submitScholarshipProgram(
    port,
    { target_program_id: "00000000-0000-4000-8000-000000009902" },
    "benefits:submit:1",
  );
  await approveScholarshipProgram(
    port,
    { target_program_id: "00000000-0000-4000-8000-000000009902" },
    "benefits:approve:1",
  );
  await activateScholarshipProgram(
    port,
    { target_program_id: "00000000-0000-4000-8000-000000009902" },
    "benefits:activate:1",
  );
  await assignStudentScholarship(
    port,
    { target_program_id: "00000000-0000-4000-8000-000000009902" },
    "benefits:assign:1",
  );
  await submitStudentScholarship(
    port,
    { target_student_scholarship_id: "00000000-0000-4000-8000-000000009903" },
    "benefits:ssubmit:1",
  );
  await approveStudentScholarship(
    port,
    { target_student_scholarship_id: "00000000-0000-4000-8000-000000009903" },
    "benefits:sapprove:1",
  );
  await activateStudentScholarship(
    port,
    { target_student_scholarship_id: "00000000-0000-4000-8000-000000009903" },
    "benefits:sactivate:1",
  );
  await applyStudentScholarship(
    port,
    {
      target_charge_id: "00000000-0000-4000-8000-000000009904",
      target_student_scholarship_id: "00000000-0000-4000-8000-000000009903",
    },
    "benefits:apply-scholarship:1",
  );
  await applyAuthorizedDiscount(
    port,
    { requested_amount: 100, target_charge_id: "00000000-0000-4000-8000-000000009904" },
    "benefits:discount:1",
  );
  await createAuthorizedWaiver(
    port,
    { requested_amount: 100, target_charge_id: "00000000-0000-4000-8000-000000009904" },
    "benefits:waiver:create:1",
  );
  await approveAuthorizedWaiver(
    port,
    { target_adjustment_id: "00000000-0000-4000-8000-000000009905" },
    "benefits:waiver:approve:1",
  );
  await applyAuthorizedWaiver(
    port,
    { target_adjustment_id: "00000000-0000-4000-8000-000000009905" },
    "benefits:waiver:apply:1",
  );
  await reverseFinancialBenefit(
    port,
    { target_adjustment_id: "00000000-0000-4000-8000-000000009905" },
    "benefits:reverse:1",
  );
  await revokeStudentScholarship(
    port,
    { target_student_scholarship_id: "00000000-0000-4000-8000-000000009903" },
    "benefits:revoke:1",
  );

  assert.equal(calls[0].sqlFunction, "finance.create_scholarship_program");
  assert.equal(calls[8].sqlFunction, "finance.apply_student_scholarship");
  assert.equal(calls[9].sqlFunction, "finance.apply_authorized_discount");
  assert.equal(calls[10].sqlFunction, "finance.create_authorized_waiver");
  assert.equal(calls[13].sqlFunction, "finance.reverse_financial_benefit");
});

test("contrato de beneficios financieros encapsula errores no controlados", async () => {
  const port = {
    execute: async () => {
      throw new Error("synthetic");
    },
  };
  await assert.rejects(
    applyAuthorizedDiscount(port, { requested_amount: 1 }, "benefits:error:1"),
    (error) => error instanceof FinancialBenefitError && error.code === "FINANCE_OPERATION_FAILED",
  );
});

test("contrato de convenios mantiene operaciones, funciones SQL y errores cerrados", () => {
  assert.deepEqual(paymentAgreementOperations, [
    "CREATE_AGREEMENT",
    "APPROVE_AGREEMENT",
    "RECONCILE_INSTALLMENT",
    "EVALUATE_AGREEMENT",
    "CANCEL_AGREEMENT",
    "MARK_AGREEMENT_DEFAULTED",
  ]);
  assert.equal(paymentAgreementSqlFunctions.CREATE_AGREEMENT, "public.create_payment_agreement");
  assert.ok(paymentAgreementErrorCodes.includes("AAL2_REQUIRED"));
  assert.ok(paymentAgreementErrorCodes.includes("PAYMENT_AGREEMENT_INVALID_STATE"));
  assert.doesNotMatch(
    JSON.stringify({ paymentAgreementOperations, paymentAgreementSqlFunctions }),
    /SupabaseClient|from\(|auth\.|storage|realtime|service_role/i,
  );
});

test("contrato de convenios usa puerto inyectable y query separada", async () => {
  const calls = [];
  const port = {
    execute: async (command) => {
      calls.push(command);
      return { entityId: "00000000-0000-4000-8000-000000009911", status: "ACTIVE" };
    },
    query: async (command) => {
      calls.push(command);
      return {
        evaluationStatus: "ON_TRACK",
        installmentsDue: 0,
        installmentsPastDue: 0,
        nextInstallmentDate: "2099-01-31",
        remainingAgreementAmount: "500.00",
        totalFulfilled: "0.00",
        totalScheduled: "500.00",
      };
    },
  };

  await createPaymentAgreement(
    port,
    {
      requested_agreed_amount: 500,
      target_student_account_id: "00000000-0000-4000-8000-000000009912",
    },
    "agreement:create:1",
  );
  await approvePaymentAgreement(
    port,
    { target_payment_agreement_id: "00000000-0000-4000-8000-000000009911" },
    "agreement:approve:1",
  );
  await reconcilePaymentAgreementInstallment(
    port,
    { target_installment_id: "00000000-0000-4000-8000-000000009913" },
    "agreement:reconcile:1",
  );
  const evaluation = await evaluatePaymentAgreement(port, {
    target_payment_agreement_id: "00000000-0000-4000-8000-000000009911",
  });
  await cancelPaymentAgreement(
    port,
    {
      requested_reason: "synthetic",
      target_payment_agreement_id: "00000000-0000-4000-8000-000000009911",
    },
    "agreement:cancel:1",
  );
  await markPaymentAgreementDefaulted(
    port,
    {
      requested_reason: "synthetic",
      target_payment_agreement_id: "00000000-0000-4000-8000-000000009911",
    },
    "agreement:default:1",
  );

  assert.equal(calls[0].sqlFunction, "public.create_payment_agreement");
  assert.equal(calls[3].sqlFunction, "public.evaluate_payment_agreement");
  assert.equal(evaluation.remainingAgreementAmount, "500.00");
});

test("contrato de convenios encapsula errores no controlados", async () => {
  const port = {
    execute: async () => {
      throw new Error("synthetic");
    },
    query: async () => {
      throw new Error("synthetic");
    },
  };
  await assert.rejects(
    createPaymentAgreement(port, { requested_agreed_amount: 1 }, "agreement:error:1"),
    (error) => error instanceof PaymentAgreementError && error.code === "FINANCE_OPERATION_FAILED",
  );
  await assert.rejects(
    evaluatePaymentAgreement(port, {}),
    (error) => error instanceof PaymentAgreementError && error.code === "FINANCE_OPERATION_FAILED",
  );
});
