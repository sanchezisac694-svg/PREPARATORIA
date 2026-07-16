import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const untrackedFiles = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const repositoryFiles = [...new Set([...trackedFiles, ...untrackedFiles])];

const executableFiles = repositoryFiles.filter(
  (file) =>
    (file.startsWith("apps/") ||
      file.startsWith("packages/") ||
      file.startsWith(".github/scripts/")) &&
    /\.(?:cjs|js|jsx|mjs|ts|tsx)$/.test(file) &&
    !/(?:^|\/)(?:dist|node_modules|tests)(?:\/|$)/.test(file) &&
    !/\.(?:spec|test)\.[^.]+$/.test(file),
);

const forbiddenPatterns = [
  ["Supabase secret key", new RegExp("SUPABASE_" + "SECRET_KEY", "i")],
  ["Supabase service-role variable", new RegExp("SUPABASE_" + "SERVICE_" + "ROLE_KEY", "i")],
  ["Supabase service role", new RegExp("service_" + "role", "i")],
  ["Supabase secret value", new RegExp("sb_" + "secret_[A-Za-z0-9_-]+")],
  ["private key", new RegExp("BEGIN " + "(?:RSA |EC |OPENSSH )?PRIVATE KEY")],
  ["AWS access key", new RegExp("AKIA" + "[A-Z0-9]{16}")],
  ["GitHub token", new RegExp("gh[pousr]_" + "[A-Za-z0-9]{30,}")],
  ["hardcoded JWT", new RegExp("eyJ" + "[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}\\.")],
  [
    "unauthorized privileged client",
    new RegExp(
      "(?:create(?:Supabase)?(?:Admin|Privileged)Client|(?:admin|privileged)Client\\s*=)",
      "i",
    ),
  ],
];

const failures = [];

for (const file of executableFiles) {
  const source = readFileSync(file, "utf8");

  for (const [label, pattern] of forbiddenPatterns) {
    if (pattern.test(source)) {
      failures.push(`${file}: ${label}`);
    }
  }
}

const realEnvFiles = trackedFiles.filter((file) => {
  const name = file.split("/").at(-1);
  return name === ".env" || (name.startsWith(".env.") && name !== ".env.example");
});

for (const file of realEnvFiles) {
  failures.push(`${file}: archivo de entorno real rastreado`);
}

if (failures.length > 0) {
  console.error("La puerta de seguridad encontró problemas:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Seguridad validada en ${executableFiles.length} archivos ejecutables; no hay secretos ni clientes privilegiados.`,
);
