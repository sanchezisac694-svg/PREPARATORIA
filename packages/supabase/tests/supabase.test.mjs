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
  ProvisioningError,
  provisionInstitutionalIdentity,
  provisioningErrorCodes,
  safeProvisioningDiagnostic,
} from "../dist/provisioning.js";
import { createSupabaseSsrClient } from "../dist/ssr.js";

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
    "admin-contract.js",
    "browser.js",
    "config.js",
    "provisioning.js",
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

test("las entradas server-only conservan una defensa adicional de ejecución", async () => {
  for (const moduleName of [
    "ssr",
    "admin-contract",
    "provisioning",
    "account-lifecycle",
    "auth-session",
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
              data: { claims: user ? { sub: user.id } : null },
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
        },
        async rpc() {
          return { data: context ? [context] : [], error: null };
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
  const result = await service.signInWithInstitutionalCredentials({
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
    await invalid.service.signInWithInstitutionalCredentials({
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

const provisioningCommand = {
  accountId: "account-test",
  deliveryMode: "INVITE",
  email: "sensitive@example.invalid",
  idempotencyKey: "idempotency-test",
  initialRoleCodes: ["ALUMNO"],
  personId: "person-test",
  requestedAccountStatus: "PENDING_INVITATION",
  requestedByAccountId: "actor-test",
};

function createProvisioningScenario(options = {}) {
  const calls = [];
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
    async prepare() {
      calls.push("prepare");
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
    async createOrInviteUser() {
      calls.push("createOrInviteUser");
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

  return { authAdmin, calls, persistence };
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
    email: provisioningCommand.email,
    message: `Falló ${provisioningCommand.email}`,
    token: "not-a-real-token",
  });

  assert.deepEqual(diagnostic, {
    email: "[REDACTED]",
    message: "Falló [REDACTED]",
    token: "[REDACTED]",
  });
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
