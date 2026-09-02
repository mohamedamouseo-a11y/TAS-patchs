import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, "..");
const filesRoot = path.join(patchRoot, "files");

const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
const targetArg = targetIndex >= 0 ? args[targetIndex + 1] : args.find((arg) => !arg.startsWith("--"));
if (!targetArg) {
  console.error("Usage: node apply-tas-rbac-role-matrix-tests-v1.mjs --target <TAS_WORKTREE>");
  process.exit(2);
}

const targetRoot = path.resolve(targetArg);
const required = ["package.json", "server/tasRbacPolicy.ts", "server/tasRbacApiAccess.ts", "client/src/lib/tasRbac.ts"];
for (const relative of required) {
  if (!fs.existsSync(path.join(targetRoot, relative))) {
    console.error(`TAS_RBAC_TEST_PATCH_APPLY=FAIL missing required TAS file: ${relative}`);
    process.exit(1);
  }
}

const files = [
  "server/tasRbacPolicy.test.ts",
  "server/tasRbacApiAccess.test.ts",
  "client/src/lib/tasRbac.test.ts",
  "scripts/verify-tas-rbac-live.ts",
  "scripts/audit-tas-rbac-ui-gates.mjs",
];

for (const relative of files) {
  const source = path.join(filesRoot, relative);
  const destination = path.join(targetRoot, relative);
  if (!fs.existsSync(source)) {
    console.error(`TAS_RBAC_TEST_PATCH_APPLY=FAIL patch source missing: ${relative}`);
    process.exit(1);
  }
  const next = fs.readFileSync(source, "utf8");
  if (fs.existsSync(destination)) {
    const current = fs.readFileSync(destination, "utf8");
    if (current === next) {
      console.log(`SKIP unchanged ${relative}`);
      continue;
    }
    console.error(`TAS_RBAC_TEST_PATCH_APPLY=FAIL destination already exists with different content: ${relative}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, next, "utf8");
  console.log(`ADD ${relative}`);
}

console.log("TAS_RBAC_TEST_PATCH_APPLY=PASS");
