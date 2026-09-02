import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = [
  "client/src/pages/tas",
  "client/src/pages/automotive",
];

const files = [];
function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
}
for (const relative of roots) walk(path.join(root, relative));

const warnings = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const hasDirectRoleGate = /user\?*\.role|user\.role|ctx\.user\.role|\[\s*["']Admin["']|includes\(String\(user\?*\.role/.test(source);
  if (!hasDirectRoleGate) continue;
  const usesRbac = /useTasRbac|TASPermissionGuard|canFromTasMatrix/.test(source);
  if (!usesRbac) {
    warnings.push(path.relative(root, file).replaceAll(path.sep, "/"));
  }
}

console.log(`TAS_RBAC_UI_GATE_AUDIT scanned=${files.length}`);
if (!warnings.length) {
  console.log("TAS_RBAC_UI_GATE_AUDIT=PASS warnings=0");
  process.exit(0);
}

console.warn("Potential hard-coded role gates without local RBAC helper/guard:");
for (const file of warnings) console.warn(`- ${file}`);
console.warn(`TAS_RBAC_UI_GATE_AUDIT=WARN warnings=${warnings.length}`);
if (process.argv.includes("--strict")) process.exitCode = 1;
