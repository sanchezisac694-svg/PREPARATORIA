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

test("las entradas server-only conservan una defensa adicional de ejecución", async () => {
  for (const moduleName of [
    "ssr",
    "admin-contract",
    "provisioning",
    "account-lifecycle",
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
    assert.match(result.stderr, /solo puede importarse desde el servidor/);
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

function fakeAuthService({ context, signInError = false, user = { id: "auth-user" } } = {}) {
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
                    mfa_required: false,
                    mfa_satisfied: true,
                    session_valid: context.account_status === "ACTIVE",
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
  const auth = {
    enrollTotp: async () => ({
      factorId: "synthetic-factor",
      ok: true,
      qrCode: "<svg>synthetic</svg>",
      secret: "synthetic-secret",
      sensitive: true,
      uri: "otpauth://synthetic",
    }),
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
  await assert.rejects(
    beginTotpEnrollment(
      { application: "PORTAL_ESCOLAR", recentlyReauthenticated: false },
      { auth, identity: activeMfaIdentity() },
    ),
    (error) => error.code === "MFA_AAL2_REQUIRED",
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
