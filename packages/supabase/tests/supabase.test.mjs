import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createSupabaseBrowserClient } from "../dist/browser.js";
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
    "admin-contract.js",
    "browser.js",
    "config.js",
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

test("las entradas server-only conservan una defensa adicional de ejecución", async () => {
  for (const moduleName of ["ssr", "admin-contract"]) {
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
  const files = ["admin-contract.ts", "browser.ts", "ssr.ts", "types.ts"];
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
});
