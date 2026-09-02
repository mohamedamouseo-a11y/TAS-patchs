#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || process.cwd());
const target = path.join(root, "scripts/cleanup-tas-excel-import-data.ts");
const fail = [];
const pass = [];
const expect = (label, ok) => (ok ? pass : fail).push(label);

if (!fs.existsSync(target)) {
  console.error(`Missing ${target}`);
  console.error("TAS_EXCEL_IMPORT_CLEANUP_VERIFY=FAIL failures=1");
  process.exit(1);
}

const source = fs.readFileSync(target, "utf8");
expect("dry-run default", source.includes('TAS_EXCEL_IMPORT_CLEANUP=DRY_RUN'));
expect("explicit apply confirmation", source.includes("DELETE_TAS_EXCEL_IMPORT_DATA") && source.includes("--apply"));
expect("targets Excel Import marker", source.includes("Excel Import") && source.includes("sourceMetadata"));
expect("targets import batches", source.includes("tas_excel_import_batches"));
expect("uses transaction", source.includes("beginTransaction") && source.includes("rollback") && source.includes("commit"));
expect("preserves FK enforcement", !/FOREIGN_KEY_CHECKS\s*=\s*0/i.test(source));
expect("no truncate", !/\bTRUNCATE\b/i.test(source));
expect("checks duplicate cross references", source.includes("duplicateCrossReferences") && source.includes("duplicateOfId"));
expect("does not select targets by phone/name/date", !/WHERE[^;]*(phone|name|createdAt)\s*=/is.test(source));
expect("success marker", source.includes("TAS_EXCEL_IMPORT_CLEANUP=PASS"));

for (const item of pass) console.log(`PASS ${item}`);
for (const item of fail) console.error(`FAIL ${item}`);

if (fail.length) {
  console.error(`TAS_EXCEL_IMPORT_CLEANUP_VERIFY=FAIL failures=${fail.length}`);
  process.exit(1);
}
console.log("TAS_EXCEL_IMPORT_CLEANUP_VERIFY=PASS");
