import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import ts from "typescript";

const root = realpathSync(process.cwd());
const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const manifestFiles = trackedFiles.filter((file) =>
  /^(?:apps|packages)\/[^/]+\/package\.json$/.test(file),
);
const units = manifestFiles.map((file) => {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const directory = dirname(resolve(root, file));
  const kind = file.startsWith("apps/") ? "app" : "package";
  const dependencyGroups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].filter(Boolean);
  const dependencies = new Set(
    dependencyGroups.flatMap((group) =>
      Object.keys(group).filter((dependency) => dependency.startsWith("@preparatoria/")),
    ),
  );

  return {
    dependencies,
    directory,
    exports: manifest.exports ?? {},
    kind,
    name: manifest.name,
  };
});

const byName = new Map(units.map((unit) => [unit.name, unit]));
const failures = [];

function isInside(path, directory) {
  const difference = relative(directory, path);
  return (
    difference === "" ||
    (!difference.startsWith(`..${sep}`) && difference !== ".." && !isAbsolute(difference))
  );
}

function findUnit(file) {
  const absoluteFile = resolve(root, file);
  return units.find((unit) => isInside(absoluteFile, unit.directory));
}

function exportKey(specifier, packageName) {
  return specifier === packageName ? "." : `.${specifier.slice(packageName.length)}`;
}

function moduleSpecifiers(file, source) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.getScriptKindFromFileName(file),
  );
  const specifiers = [];

  function addStringLiteral(node) {
    if (node && ts.isStringLiteralLike(node)) {
      specifiers.push(node.text);
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addStringLiteral(node.moduleReference.expression);
    } else if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const [argument] = node.arguments;
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";

      if (isDynamicImport || isRequire) {
        addStringLiteral(argument);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

function importFailures(file, sourceUnit, specifier, unitsByName) {
  const importProblems = [];

  if (specifier.startsWith("@preparatoria/")) {
    const packageName = specifier.split("/").slice(0, 2).join("/");
    const target = unitsByName.get(packageName);
    if (!target) {
      importProblems.push(`${file}: import interno inexistente ${specifier}`);
      return importProblems;
    }
    if (!sourceUnit.dependencies.has(packageName) && sourceUnit.name !== packageName) {
      importProblems.push(`${file}: ${packageName} no está declarado como dependencia`);
    }
    if (sourceUnit.kind === "app" && target.kind === "app" && sourceUnit.name !== target.name) {
      importProblems.push(`${file}: una aplicación importa la aplicación ${target.name}`);
    }
    const key = exportKey(specifier, packageName);
    if (!Object.hasOwn(target.exports, key)) {
      importProblems.push(`${file}: ${specifier} no usa un export público declarado`);
    }
    return importProblems;
  }

  if (specifier.startsWith(".")) {
    const targetPath = resolve(dirname(resolve(root, file)), specifier);
    if (!isInside(targetPath, sourceUnit.directory)) {
      importProblems.push(`${file}: import relativo fuera de ${sourceUnit.name}: ${specifier}`);
    }
  }

  return importProblems;
}

function runRegressionChecks() {
  const embeddedFixture = `
    const fixture = [
      'import type { PersonId } from "@preparatoria/authz";',
      "export { hidden } from '@preparatoria/example/private';",
    ].join("\\n");
    void fixture;
  `;
  assert.deepEqual(moduleSpecifiers("fixture.test.mjs", embeddedFixture), []);

  const realImports = moduleSpecifiers(
    "real-imports.test.ts",
    `
      import { value } from "@preparatoria/example";
      export { privateValue } from "@preparatoria/example/private";
      void value;
    `,
  );
  assert.deepEqual(realImports, ["@preparatoria/example", "@preparatoria/example/private"]);

  const sourceUnit = {
    dependencies: new Set(),
    directory: resolve(root, "packages/source"),
    exports: {},
    kind: "package",
    name: "@preparatoria/source",
  };
  const targetUnit = {
    dependencies: new Set(),
    directory: resolve(root, "packages/example"),
    exports: { ".": "./dist/index.js" },
    kind: "package",
    name: "@preparatoria/example",
  };
  const regressionUnits = new Map([
    [sourceUnit.name, sourceUnit],
    [targetUnit.name, targetUnit],
  ]);

  assert.deepEqual(
    importFailures(
      "packages/source/tests/real-import.test.ts",
      sourceUnit,
      "@preparatoria/example",
      regressionUnits,
    ),
    [
      "packages/source/tests/real-import.test.ts: @preparatoria/example no está declarado como dependencia",
    ],
  );
  assert.deepEqual(
    importFailures(
      "packages/source/tests/private-import.test.ts",
      { ...sourceUnit, dependencies: new Set(["@preparatoria/example"]) },
      "@preparatoria/example/private",
      regressionUnits,
    ),
    [
      "packages/source/tests/private-import.test.ts: @preparatoria/example/private no usa un export público declarado",
    ],
  );
}

runRegressionChecks();

for (const unit of units) {
  for (const dependency of unit.dependencies) {
    const target = byName.get(dependency);
    if (!target) {
      failures.push(`${unit.name}: dependencia interna inexistente ${dependency}`);
    } else if (unit.kind === "package" && target.kind === "app") {
      failures.push(`${unit.name}: un paquete no puede depender de la aplicación ${dependency}`);
    }
  }
}

const sourceFiles = trackedFiles.filter(
  (file) =>
    /^(?:apps|packages)\/[^/]+\/.+\.(?:cjs|js|jsx|mjs|ts|tsx)$/.test(file) &&
    !/(?:^|\/)(?:dist|node_modules)(?:\/|$)/.test(file) &&
    !/\.d\.ts$/.test(file),
);

for (const file of sourceFiles) {
  const sourceUnit = findUnit(file);
  if (!sourceUnit) continue;

  const source = readFileSync(file, "utf8");
  for (const specifier of moduleSpecifiers(file, source)) {
    failures.push(...importFailures(file, sourceUnit, specifier, byName));
  }
}

const visiting = new Set();
const visited = new Set();

function visit(name, path = []) {
  if (visiting.has(name)) {
    failures.push(`ciclo: ${[...path, name].join(" -> ")}`);
    return;
  }
  if (visited.has(name)) return;

  visiting.add(name);
  const unit = byName.get(name);
  for (const dependency of unit?.dependencies ?? []) {
    if (byName.has(dependency)) visit(dependency, [...path, name]);
  }
  visiting.delete(name);
  visited.add(name);
}

for (const name of byName.keys()) visit(name);

const forbiddenTrackedPaths =
  /(^|\/)(?:node_modules|dist|\.next|\.turbo|coverage)(\/|$)|\.tsbuildinfo$/;
for (const file of trackedFiles.filter((path) => forbiddenTrackedPaths.test(path))) {
  failures.push(`${file}: artefacto generado rastreado`);
}

if (failures.length > 0) {
  console.error("La puerta de límites del monorepo encontró problemas:");
  for (const failure of [...new Set(failures)]) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Límites validados: ${units.length} unidades, ${sourceFiles.length} fuentes, regresiones sintácticas correctas y ningún ciclo o artefacto rastreado.`,
);
