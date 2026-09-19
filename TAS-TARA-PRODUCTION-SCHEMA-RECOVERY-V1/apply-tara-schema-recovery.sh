#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-/var/www/TAS-root}"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "TARA_SCHEMA_RECOVERY=FAIL"
  echo "ERROR=.env not found in $ROOT"
  exit 1
fi

declare -a STEPS=(
  "V2R5|scripts/tas-tara-v2r5-migration.mjs|d29f4894d63a892e79c96ec31bb03ade75e5df2e"
  "V2R5R4|scripts/tas-tara-v2r5r4-no-draft-migration.mjs|bf77aa8d8349952579e9bb35c3f36000157f62f0"
  "V2R5R5|scripts/tas-tara-parity-v2r5r5-migration.mjs|3cfe39068519512798bdeefd6d82d838c3db372c"
  "V2R5R6|scripts/tas-tara-parity-v2r5r6-voice-migration.mjs|e8de57139fc505f34b4388d39ba474695b984f0a"
  "V2R5R7|scripts/tas-tara-parity-v2r5r7-meta-migration.mjs|ead400cbca890610f8d8e216797d4df7748c40ca"
)

echo "ROOT=$ROOT"

# Safety: only run the migration scripts that were reviewed on TAS/master.
for entry in "${STEPS[@]}"; do
  IFS='|' read -r label script expected_blob <<< "$entry"
  if [[ ! -f "$script" ]]; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "ERROR=missing $script"
    exit 1
  fi
  actual_blob="$(git hash-object "$script")"
  if [[ "$actual_blob" != "$expected_blob" ]]; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "ERROR=$label script blob mismatch expected=$expected_blob actual=$actual_blob"
    exit 1
  fi
done

# Safety: confirm this is the audited production schema. Do not print credentials.
DB_NAME="$(node --input-type=module <<'NODE'
import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });
const url = String(process.env.DATABASE_URL || "").trim();
const cfg = url || {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || "",
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "",
  multipleStatements: false,
};
const c = await mysql.createConnection(cfg);
try {
  const [rows] = await c.query("SELECT DATABASE() AS db");
  process.stdout.write(String(rows?.[0]?.db || ""));
} finally {
  await c.end();
}
NODE
)"

echo "DB_NAME=$DB_NAME"
if [[ "$DB_NAME" != "tas_crm" ]]; then
  echo "TARA_SCHEMA_RECOVERY=FAIL"
  echo "ERROR=refusing non-audited database $DB_NAME"
  exit 1
fi

mkdir -p storage/migration-journals
LOG_DIR="storage/migration-journals/tara-production-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR" || true

applied=0
skipped=0

for entry in "${STEPS[@]}"; do
  IFS='|' read -r label script expected_blob <<< "$entry"
  verify_log="$LOG_DIR/${label}-verify-before.log"
  apply_log="$LOG_DIR/${label}-apply.log"
  verify_after_log="$LOG_DIR/${label}-verify-after.log"

  if node "$script" verify >"$verify_log" 2>&1; then
    echo "$label=ALREADY_APPLIED"
    skipped=$((skipped + 1))
    continue
  fi

  echo "$label=APPLYING"
  if ! node "$script" apply >"$apply_log" 2>&1; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "LOG=$apply_log"
    echo "ERROR=migration apply failed; stopped without automatic rollback"
    exit 1
  fi

  if ! node "$script" verify >"$verify_after_log" 2>&1; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "LOG=$verify_after_log"
    echo "ERROR=post-apply verification failed; stopped without automatic rollback"
    exit 1
  fi

  echo "$label=APPLIED"
  applied=$((applied + 1))
done

# Final independent presence/safe-default verification.
node --input-type=module <<'NODE'
import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });
const url = String(process.env.DATABASE_URL || "").trim();
const cfg = url || {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || "",
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "",
  multipleStatements: false,
};
const c = await mysql.createConnection(cfg);
const required = [
  "tas_tara_settings",
  "tas_tara_moderator_profiles",
  "tas_tara_moderator_account_scopes",
  "tas_tara_voice_settings",
  "tas_tara_social_channel_settings",
];
try {
  for (const table of required) {
    const [rows] = await c.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
      [table],
    );
    if (!rows.length) throw new Error("missing required table " + table);
  }
  const [settingsRows] = await c.query(
    "SELECT enabled, mode, auto_send_default, runtime_started_at FROM tas_tara_settings WHERE id=1 LIMIT 1",
  );
  const s = settingsRows[0];
  if (!s || Number(s.enabled) !== 0 || s.mode !== "disabled" || Number(s.auto_send_default) !== 0 || s.runtime_started_at !== null) {
    throw new Error("unsafe tas_tara_settings defaults");
  }
  const [voiceRows] = await c.query(
    "SELECT id, enabled, last_test_status FROM tas_tara_voice_settings WHERE id=1 LIMIT 1",
  );
  const v = voiceRows[0];
  if (!v || Number(v.id) !== 1 || Number(v.enabled) !== 0) {
    throw new Error("unsafe/missing tas_tara_voice_settings singleton");
  }
  console.log("FINAL_TABLES=PASS");
  console.log("TARA_SAFE_DEFAULTS=PASS");
} finally {
  await c.end();
}
NODE

echo "APPLIED_COUNT=$applied"
echo "ALREADY_APPLIED_COUNT=$skipped"
echo "SERVICE_RESTART_REQUIRED=NO"
echo "TARA_SCHEMA_RECOVERY=PASS"
echo "ERROR=NONE"
