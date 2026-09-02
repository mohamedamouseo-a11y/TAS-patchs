#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] || process.cwd());
const read = (rel) => fs.readFileSync(path.join(target, rel), "utf8");
const fail = [];
const pass = [];

function expect(label, ok) {
  (ok ? pass : fail).push(label);
}

const runtime = read("server/services/waGatewayRuntimeConfig.ts");
const readiness = read("server/services/waGatewayDriveReadiness.ts");
const runtimeTest = read("server/services/waGatewayRuntimeConfig.test.ts");

expect("runtime has no Service Account WhatsApp gate", !runtime.includes("GOOGLE_BACKUP_SERVICE_ACCOUNT_JSON") && !runtime.includes("GOOGLE_BACKUP_SERVICE_ACCOUNT_FILE") && !runtime.includes("Google Drive Service Account credentials are required"));
expect("readiness no longer imports GoogleBackupService", !readiness.includes('from "./GoogleBackupService.js"'));
expect("readiness uses TAS OAuth Drive client", readiness.includes("getTasGoogleDriveClient") && readiness.includes("getTasGoogleDriveFileStorageSettings"));
expect("readiness supports unified My Drive identity", readiness.includes('"oauth-my-drive"'));
expect("readiness has no Service Account user-facing requirement", !readiness.includes("Service Account لا يملك") && !readiness.includes("بيانات Service Account"));
expect("runtime test covers no second Service Account requirement", runtimeTest.includes("does not require a second Google Service Account credential"));

for (const item of pass) console.log(`PASS ${item}`);
for (const item of fail) console.error(`FAIL ${item}`);

if (fail.length) {
  console.error(`WHATSAPP_PRIMARY_DRIVE_VERIFY=FAIL failures=${fail.length}`);
  process.exit(1);
}
console.log("WHATSAPP_PRIMARY_DRIVE_VERIFY=PASS");
