import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const targetIndex = args.indexOf('--target');
const targetArg = targetIndex >= 0 ? args[targetIndex + 1] : args.find((arg) => !arg.startsWith('--'));
if (!targetArg) {
  console.error('Usage: node apply-tas-rbac-ui-critical-actions-v1-compatible.mjs --target <TAS_WORKTREE>');
  process.exit(2);
}

const targetRoot = path.resolve(targetArg);
const vehicleFile = path.join(targetRoot, 'client/src/pages/automotive/VehicleCatalogPage.tsx');
if (!fs.existsSync(vehicleFile)) {
  console.error('TAS_RBAC_UI_CRITICAL_ACTIONS_APPLY=FAIL missing VehicleCatalogPage.tsx');
  process.exit(1);
}

let vehicleSource = fs.readFileSync(vehicleFile, 'utf8');
const priorPatchBlock = '  const { user, isAuthenticated } = useAuth();\n  const rbac = useTasRbac(isAuthenticated);\n  const canArchive = rbac.can("catalog", "delete");';
const baselineBlock = '  const { user } = useAuth();\n  const canArchive = ["Admin", "admin", "SalesManager"].includes(String(user?.role || ""));';
if (vehicleSource.includes(priorPatchBlock)) {
  vehicleSource = vehicleSource.replace(priorPatchBlock, baselineBlock);
  fs.writeFileSync(vehicleFile, vehicleSource, 'utf8');
  console.log('NORMALIZE prior VehicleCatalog archive-only RBAC patch');
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const core = path.join(scriptDir, 'apply-tas-rbac-ui-critical-actions-v1.mjs');
const result = spawnSync(process.execPath, [core, '--target', targetRoot], { stdio: 'inherit' });
process.exit(result.status ?? 1);
