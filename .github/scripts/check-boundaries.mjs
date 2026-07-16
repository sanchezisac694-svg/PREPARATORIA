import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

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
const importPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s+)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

for (const file of sourceFiles) {
  const sourceUnit = findUnit(file);
  if (!sourceUnit) continue;

  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];

    if (specifier.startsWith("@preparatoria/")) {
      const packageName = specifier.split("/").slice(0, 2).join("/");
      const target = byName.get(packageName);
      if (!target) {
        failures.push(`${file}: import interno inexistente ${specifier}`);
        continue;
      }
      if (!sourceUnit.dependencies.has(packageName)) {
        failures.push(`${file}: ${packageName} no está declarado como dependencia`);
      }
      if (sourceUnit.kind === "app" && target.kind === "app" && sourceUnit.name !== target.name) {
        failures.push(`${file}: una aplicación importa la aplicación ${target.name}`);
      }
      const key = exportKey(specifier, packageName);
      if (!Object.hasOwn(target.exports, key)) {
        failures.push(`${file}: ${specifier} no usa un export público declarado`);
      }
      continue;
    }

    if (specifier.startsWith(".")) {
      const targetPath = resolve(dirname(resolve(root, file)), specifier);
      if (!isInside(targetPath, sourceUnit.directory)) {
        failures.push(`${file}: import relativo fuera de ${sourceUnit.name}: ${specifier}`);
      }
    }
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
  `Límites validados: ${units.length} unidades, ${sourceFiles.length} fuentes y ningún ciclo o artefacto rastreado.`,
);
