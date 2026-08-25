#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, "..");
const filesRoot = path.join(patchRoot, "files");
const targetArgIndex = process.argv.indexOf("--target");
const targetRoot = path.resolve(targetArgIndex >= 0 ? process.argv[targetArgIndex + 1] : process.cwd());

if (!fs.existsSync(path.join(targetRoot, "server", "routers.ts"))) {
  throw new Error(`Invalid TAS target: ${targetRoot}`);
}

function copyPayload(relativePath) {
  const source = path.join(filesRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) throw new Error(`Missing V3 payload: ${relativePath}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[RBAC V3] copied ${relativePath}`);
}

function replaceRequired(text, oldValue, newValue, label) {
  if (text.includes(newValue)) return text;
  if (!text.includes(oldValue)) throw new Error(`Anchor not found: ${label}`);
  return text.replace(oldValue, newValue);
}

function replaceProcedureBuilders(slice, label) {
  const builders = [
    "protectedProcedure",
    "adminProcedure",
    "managerProcedure",
    "salesReadProcedure",
    "salesEditProcedure",
    "automotiveReadProcedure",
    "automotiveWriteProcedure",
    "clientOpsProcedure",
  ];
  let output = slice;
  let replacements = 0;
  for (const builder of builders) {
    const pattern = new RegExp(`\\b${builder}\\b`, "g");
    output = output.replace(pattern, () => {
      replacements += 1;
      return "tasPermissionProcedure";
    });
  }
  if (!replacements) throw new Error(`No TAS procedure builders replaced in ${label}`);
  console.log(`[RBAC V3] ${label}: replaced ${replacements} procedure references`);
  return output;
}

function replaceBetween(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Start marker not found: ${label}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`End marker not found: ${label}`);
  const before = text.slice(0, start);
  const body = text.slice(start, end);
  const after = text.slice(end);
  return before + replaceProcedureBuilders(body, label) + after;
}

for (const relative of [
  "server/tasRbacApiAccess.ts",
  "server/tasRbacApiV3.contract.test.ts",
]) {
  copyPayload(relative);
}

const routersPath = path.join(targetRoot, "server", "routers.ts");
let routers = fs.readFileSync(routersPath, "utf8");

routers = replaceRequired(
  routers,
  'import { canMutateActivity } from "./activityAuthorization";\n',
  'import { canMutateActivity } from "./activityAuthorization";\nimport { authorizeTasApiRequest } from "./tasRbacApiAccess";\n',
  "tasRbacApiAccess import",
);

const procedureAnchor = 'const userRoleSchema = z.enum(APP_USER_ROLES);\n';
const procedureDefinition = `const tasPermissionProcedure = protectedProcedure.use(async ({ ctx, next, path, type, getRawInput }) => {\n  const rawInput = await getRawInput();\n  const access = await authorizeTasApiRequest(ctx.user, path, type, rawInput);\n  if (!access) return next();\n  const executionUser = { ...ctx.user, role: access.effectiveLegacyRole } as typeof ctx.user;\n  return next({\n    ctx: {\n      ...ctx,\n      user: executionUser,\n      tasRbacAccess: access,\n    } as any,\n  });\n});\n\n${procedureAnchor}`;
routers = replaceRequired(routers, procedureAnchor, procedureDefinition, "tasPermissionProcedure definition");

// Main TAS router: publicProcedure and waGatewaySuperAdminProcedure remain intentionally untouched.
routers = replaceBetween(
  routers,
  "const tasRouter = router({",
  "export const appRouter = router({",
  "tasRouter",
);

// Automotive operational routers that live directly under appRouter.
routers = replaceBetween(
  routers,
  "  automotiveFollowUp: router({",
  "  automotiveFeedback: router({",
  "automotiveFollowUp",
);
routers = replaceBetween(
  routers,
  "  automotiveFeedback: router({",
  "automotivePhase3: router({",
  "automotiveFeedback",
);
routers = replaceBetween(
  routers,
  "automotivePhase3: router({",
  "  automotivePhase2: router({",
  "automotivePhase3",
);
routers = replaceBetween(
  routers,
  "  automotivePhase2: router({",
  "  metaAudit: router({",
  "automotivePhase2",
);

fs.writeFileSync(routersPath, routers);
console.log("[RBAC V3] integrated server/routers.ts");

// The queue hotfix contract previously asserted the legacy builder literally.
// V3 intentionally upgrades excelQueues to tasPermissionProcedure, so align the
// existing regression contract with the stronger server-side authorization.
const queueContractPath = path.join(targetRoot, "server", "tasQueueFeedbackUiHotfix.test.ts");
if (!fs.existsSync(queueContractPath)) {
  throw new Error("Missing queue feedback contract: server/tasQueueFeedbackUiHotfix.test.ts");
}
let queueContract = fs.readFileSync(queueContractPath, "utf8");
queueContract = replaceRequired(
  queueContract,
  '    expect(router).toContain("excelQueues: protectedProcedure");',
  '    expect(router).toContain("excelQueues: tasPermissionProcedure");',
  "queue feedback RBAC contract",
);
fs.writeFileSync(queueContractPath, queueContract);
console.log("[RBAC V3] aligned server/tasQueueFeedbackUiHotfix.test.ts with RBAC procedure");

console.log("[RBAC V3] apply complete");
