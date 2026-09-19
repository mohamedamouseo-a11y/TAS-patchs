#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-/var/www/TAS-root}"
cd "$ROOT"

ENV_FILE=""
for candidate in "$ROOT/.env" "$ROOT/current/.env"; do
  if [[ -f "$candidate" ]]; then
    ENV_FILE="$candidate"
    break
  fi
done

if [[ -z "$ENV_FILE" && -L "$ROOT/current" ]]; then
  current_real="$(readlink -f "$ROOT/current" || true)"
  if [[ -n "$current_real" && -f "$current_real/.env" ]]; then
    ENV_FILE="$current_real/.env"
  fi
fi

if [[ -z "$ENV_FILE" ]]; then
  echo "TARA_SCHEMA_RECOVERY=FAIL"
  echo "FAILED_STEP=ENV_CHECK"
  echo "ERROR=no .env found in $ROOT, $ROOT/current, or resolved current release"
  exit 1
fi

echo "ROOT=$ROOT"
echo "ENV_FILE=$ENV_FILE"

declare -a STEPS=(
  "V2R5|scripts/tas-tara-v2r5-migration.mjs|d29f4894d63a892e79c96ec31bb03ade75e5df2e"
  "V2R5R4|scripts/tas-tara-v2r5r4-no-draft-migration.mjs|bf77aa8d8349952579e9bb35c3f36000157f62f0"
  "V2R5R5|scripts/tas-tara-parity-v2r5r5-migration.mjs|3cfe39068519512798bdeefd6d82d838c3db372c"
  "V2R5R6|scripts/tas-tara-parity-v2r5r6-voice-migration.mjs|e8de57139fc505f34b4388d39ba474695b984f0a"
  "V2R5R7|scripts/tas-tara-parity-v2r5r7-meta-migration.mjs|ead400cbca890610f8d8e216797d4df7748c40ca"
)

for entry in "${STEPS[@]}"; do
  IFS='|' read -r label script expected_blob <<< "$entry"
  if [[ ! -f "$script" ]]; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "ERROR=missing $script"
    exit 1
  fi
  actual_blob="$(git hash-object "$script")"
  if [[ "$actual_blob" != "$expected_blob" ]]; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "ERROR=$label script blob mismatch expected=$expected_blob actual=$actual_blob"
    exit 1
  fi
done

run_with_env() {
  local script="$1"
  local op="$2"
  ENV_FILE="$ENV_FILE" SCRIPT_PATH="$script" SCRIPT_OP="$op" node --input-type=module <<'NODE'
import { spawn } from "node:child_process";
import fs from "node:fs";
import { parse } from "dotenv";

const envFile = process.env.ENV_FILE;
const script = process.env.SCRIPT_PATH;
const op = process.env.SCRIPT_OP;
if (!envFile || !script || !op) process.exit(97);

const parsed = parse(fs.readFileSync(envFile));
const child = spawn(process.execPath, [script, op], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, ...parsed },
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
NODE
}

DB_NAME="$(ENV_FILE="$ENV_FILE" node --input-type=module <<'NODE'
import fs from "node:fs";
import { parse } from "dotenv";
import mysql from "mysql2/promise";

const parsed = parse(fs.readFileSync(process.env.ENV_FILE));
const merged = { ...process.env, ...parsed };
const url = String(merged.DATABASE_URL || "").trim();
const cfg = url || {
  host: merged.DB_HOST || merged.MYSQL_HOST || "127.0.0.1",
  port: Number(merged.DB_PORT || merged.MYSQL_PORT || 3306),
  user: merged.DB_USER || merged.MYSQL_USER || "",
  password: merged.DB_PASSWORD || merged.MYSQL_PASSWORD || "",
  database: merged.DB_NAME || merged.MYSQL_DATABASE || "",
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
  echo "FAILED_STEP=DB_CHECK"
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

  if run_with_env "$script" verify >"$verify_log" 2>&1; then
    echo "$label=ALREADY_APPLIED"
    skipped=$((skipped + 1))
    continue
  fi

  echo "$label=APPLYING"
  if ! run_with_env "$script" apply >"$apply_log" 2>&1; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "LOG=$apply_log"
    echo "ERROR=migration apply failed; stopped without automatic rollback"
    exit 1
  fi

  if ! run_with_env "$script" verify >"$verify_after_log" 2>&1; then
    echo "TARA_SCHEMA_RECOVERY=FAIL"
    echo "FAILED_STEP=$label"
    echo "LOG=$verify_after_log"
    echo "ERROR=post-apply verification failed; stopped without automatic rollback"
    exit 1
  fi

  echo "$label=APPLIED"
  applied=$((applied + 1))
done

ENV_FILE="$ENV_FILE" node --input-type=module <<'NODE'
import fs from "node:fs";
import { parse } from "dotenv";
import mysql from "mysql2/promise";

const parsed = parse(fs.readFileSync(process.env.ENV_FILE));
const merged = { ...process.env, ...parsed };
const url = String(merged.DATABASE_URL || "").trim();
const cfg = url || {
  host: merged.DB_HOST || merged.MYSQL_HOST || "127.0.0.1",
  port: Number(merged.DB_PORT || merged.MYSQL_PORT || 3306),
  user: merged.DB_USER || merged.MYSQL_USER || "",
  password: merged.DB_PASSWORD || merged.MYSQL_PASSWORD || "",
  database: merged.DB_NAME || merged.MYSQL_DATABASE || "",
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
echo "FAILED_STEP=NONE"
echo "ERROR=NONE"
