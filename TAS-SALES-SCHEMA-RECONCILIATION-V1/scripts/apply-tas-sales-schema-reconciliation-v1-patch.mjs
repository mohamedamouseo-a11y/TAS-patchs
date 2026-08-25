#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const patchRoot = path.resolve(scriptDir, "..");
const filesRoot = path.join(patchRoot, "files");
const targetIndex = process.argv.indexOf("--target");
const targetRoot = path.resolve(targetIndex >= 0 ? process.argv[targetIndex + 1] : process.cwd());

if (!fs.existsSync(path.join(targetRoot, "server", "tasSales.ts"))) {
  throw new Error(`Invalid TAS target: ${targetRoot}`);
}

const payload = [
  "scripts/tas-sales-schema-reconciliation-v1-spec.ts",
  "scripts/apply-tas-sales-schema-reconciliation-v1.ts",
  "scripts/verify-tas-sales-schema-reconciliation-v1.ts",
  "server/tasSalesSchemaReconciliationV1.contract.test.ts",
];

for (const relative of payload) {
  const source = path.join(filesRoot, relative);
  const target = path.join(targetRoot, relative);
  if (!fs.existsSync(source)) throw new Error(`Missing patch payload: ${relative}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`[TAS Sales Schema Reconciliation V1] copied ${relative}`);
}

console.log("TAS_SALES_SCHEMA_PATCH_APPLY=PASS");
