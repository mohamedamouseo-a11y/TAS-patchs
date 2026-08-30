#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
if (targetIndex === -1 || !args[targetIndex + 1]) {
  throw new Error("Usage: node scripts/audit-tas-rbac-matrix-enforcement-v4.mjs --target <TAS_TARGET>");
}
const target = path.resolve(args[targetIndex + 1]);
const roots = ["client/src/pages/tas", "client/src/pages/automotive"];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = roots.flatMap((root) => walk(path.join(target, root)))
  .filter((file) => /\.(tsx|ts)$/.test(file) && !/\.orig$/.test(file));

const findings = [];
for (const file of files) {
  const rel = path.relative(target, file).replaceAll("\\", "/");
  const src = fs.readFileSync(file, "utf8");
  const hasMutation = /\.useMutation\s*\(/.test(src);
  const usesMatrixUi = /useTasModuleActions|TASPermissionAction/.test(src);
  const hardcodedRoleGate = /user\?\.role|\.role\s*\?\?|isAdmin\b|isSalesManager\b|isSalesAgent\b|isFinance\b|isLeadDispatcher\b/.test(src);

  if (hasMutation && !usesMatrixUi) {
    findings.push({ rel, type: "MUTATION_WITHOUT_MATRIX_UI", message: "Page has mutations but no useTasModuleActions/TASPermissionAction guard." });
  }
  if (hardcodedRoleGate && !usesMatrixUi) {
    findings.push({ rel, type: "HARDCODED_ROLE_UI", message: "Page contains role-name UI gating without live matrix helper." });
  }
}

const app = fs.readFileSync(path.join(target, "client/src/App.tsx"), "utf8");
for (const route of ["/admin", "/import", "/bd", "/wa-gateway/accounts"]) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const guarded = new RegExp(`<Route path=["']${escaped}["'][\\s\\S]{0,240}LegacyRouteParityGuard`).test(app);
  if (!guarded) findings.push({ rel: "client/src/App.tsx", type: "LEGACY_ROUTE_GAP", message: `${route} is not wrapped by LegacyRouteParityGuard.` });
}

const catalog = fs.readFileSync(path.join(target, "client/src/pages/automotive/VehicleCatalogPage.tsx"), "utf8");
if (!catalog.includes('useTasModuleActions("catalog")')) {
  findings.push({ rel: "client/src/pages/automotive/VehicleCatalogPage.tsx", type: "CATALOG_MATRIX_GAP", message: "Catalog actions are not bound to the live catalog matrix." });
}

const conversations = fs.readFileSync(path.join(target, "client/src/pages/automotive/AutomotiveConversationsPage.tsx"), "utf8");
if (!conversations.includes("detailsConversation")) {
  findings.push({ rel: "client/src/pages/automotive/AutomotiveConversationsPage.tsx", type: "CONVERSATION_RESPONSE_GAP", message: "Conversation detail flat-response adapter is missing." });
}
if (!conversations.includes("useTasModuleActions('conversations')")) {
  findings.push({ rel: "client/src/pages/automotive/AutomotiveConversationsPage.tsx", type: "CONVERSATION_MATRIX_GAP", message: "Conversation actions are not bound to the live conversations matrix." });
}

if (findings.length) {
  console.error(`RBAC UI matrix audit FAILED with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- [${finding.type}] ${finding.rel}: ${finding.message}`);
  console.error("\nDo not promote until every finding is either fixed or explicitly documented as a non-action/read-only false positive.");
  process.exit(2);
}

console.log(`RBAC UI matrix audit PASS (${files.length} TAS/Automotive source files scanned)`);
