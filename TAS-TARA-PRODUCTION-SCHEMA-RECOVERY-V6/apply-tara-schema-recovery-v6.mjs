#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const requireFromTas = createRequire("/var/www/TAS-root/package.json");
const { parse: parseDotenv } = requireFromTas("dotenv");
const mysql = requireFromTas("mysql2/promise");

const ROOT = "/var/www/TAS-root";
const STEPS = [
  ["V2R5", "scripts/tas-tara-v2r5-migration.mjs", "d29f4894d63a892e79c96ec31bb03ade75e5df2e"],
  ["V2R5R5", "scripts/tas-tara-parity-v2r5r5-migration.mjs", "3cfe39068519512798bdeefd6d82d838c3db372c"],
  ["V2R5R6", "scripts/tas-tara-parity-v2r5r6-voice-migration.mjs", "e8de57139fc505f34b4388d39ba474695b984f0a"],
  ["V2R5R7", "scripts/tas-tara-parity-v2r5r7-meta-migration.mjs", "ead400cbca890610f8d8e216797d4df7748c40ca"],
];
const V2R5R4_SCRIPT = ["V2R5R4", "scripts/tas-tara-v2r5r4-no-draft-migration.mjs", "bf77aa8d8349952579e9bb35c3f36000157f62f0"];
const DB_KEYS = [
  "DATABASE_URL",
  "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
  "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
];

function fail(step, message) {
  console.log("TARA_SCHEMA_RECOVERY=FAIL");
  console.log(`FAILED_STEP=${step}`);
  console.log(`ERROR=${message}`);
  process.exit(1);
}

function isInsideRoot(value) {
  if (!value) return false;
  let resolved;
  try { resolved = fs.realpathSync(value); } catch { resolved = path.resolve(value); }
  const root = fs.realpathSync(ROOT);
  return resolved === root || resolved.startsWith(root + path.sep);
}

function selectDbEnv(source) {
  const out = {};
  for (const key of DB_KEYS) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value) !== "") out[key] = String(value);
  }
  return out;
}

function hasDbConfig(env) {
  return Boolean(
    env.DATABASE_URL ||
    ((env.DB_USER || env.MYSQL_USER) && (env.DB_NAME || env.MYSQL_DATABASE))
  );
}

function discoverRuntimeEnv() {
  const candidates = [
    path.join(ROOT, ".env"),
    path.join(ROOT, "current", ".env"),
  ];

  try {
    const currentReal = fs.realpathSync(path.join(ROOT, "current"));
    candidates.push(path.join(currentReal, ".env"));
  } catch {}

  for (const file of [...new Set(candidates)]) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    const env = selectDbEnv(parseDotenv(fs.readFileSync(file)));
    if (hasDbConfig(env)) return { env, source: `FILE:${file}` };
  }

  let pm2List;
  try {
    const raw = execFileSync("pm2", ["jlist"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    });
    pm2List = JSON.parse(raw);
  } catch (error) {
    fail("ENV_DISCOVERY", "no usable .env and PM2 process list could not be read");
  }

  const matches = [];
  for (const proc of Array.isArray(pm2List) ? pm2List : []) {
    const meta = proc?.pm2_env || {};
    if (String(meta.status || "") !== "online") continue;
    const cwd = String(meta.pm_cwd || "");
    const execPath = String(meta.pm_exec_path || "");
    if (!isInsideRoot(cwd) && !isInsideRoot(path.dirname(execPath))) continue;

    const combined = {
      ...(meta.env && typeof meta.env === "object" ? meta.env : {}),
      ...Object.fromEntries(DB_KEYS.map((key) => [key, meta[key]])),
    };
    const env = selectDbEnv(combined);
    if (!hasDbConfig(env)) continue;

    matches.push({
      env,
      name: String(proc?.name || meta.name || `pm_id_${meta.pm_id ?? "unknown"}`),
      cwd,
      pid: Number(proc?.pid || 0),
    });
  }

  if (matches.length !== 1) {
    fail("ENV_DISCOVERY", `expected exactly one online TAS PM2 process with DB config, found ${matches.length}`);
  }

  return { env: matches[0].env, source: `PM2:${matches[0].name}` };
}

function gitBlob(file) {
  return execFileSync("git", ["hash-object", file], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runMigration(script, op, runtimeEnv, logFile) {
  const result = spawnSync(process.execPath, [script, op], {
    cwd: ROOT,
    env: { ...process.env, ...runtimeEnv },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  fs.writeFileSync(
    logFile,
    [result.stdout || "", result.stderr || ""].join(""),
    { mode: 0o600 },
  );
  return result.status === 0;
}

function dbConfig(env) {
  const url = String(env.DATABASE_URL || "").trim();
  if (url) return url;
  return {
    host: env.DB_HOST || env.MYSQL_HOST || "127.0.0.1",
    port: Number(env.DB_PORT || env.MYSQL_PORT || 3306),
    user: env.DB_USER || env.MYSQL_USER || "",
    password: env.DB_PASSWORD || env.MYSQL_PASSWORD || "",
    database: env.DB_NAME || env.MYSQL_DATABASE || "",
    multipleStatements: false,
  };
}

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

function normalizeMysqlDefault(value) {
  return String(value ?? "").trim().replace(/^'(.*)'$/, "$1").replace(/^"(.*)"$/, "$1");
}

async function ensureV2R5R4(connection, runtimeEnv, logDir) {
  const [columns] = await connection.query(
    "SELECT COLUMN_TYPE AS columnType, COLUMN_DEFAULT AS columnDefault FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tas_tara_settings' AND column_name='mode' LIMIT 1",
  );
  if (!columns[0]) fail("V2R5R4", "tas_tara_settings.mode is missing");

  const [rows] = await connection.query(
    "SELECT enabled, mode, auto_send_default AS autoSendDefault FROM tas_tara_settings WHERE id=1 LIMIT 1",
  );
  if (!rows[0]) fail("V2R5R4", "tas_tara_settings singleton row is missing");

  const type = String(columns[0].columnType || "").toLowerCase().replace(/\s+/g, "");
  const defaultValue = normalizeMysqlDefault(columns[0].columnDefault);
  const row = rows[0];
  const enabled = Number(row.enabled) === 1;
  const rowSafe =
    String(row.mode) === (enabled ? "auto_send" : "disabled") &&
    Number(row.autoSendDefault) === (enabled ? 1 : 0);

  if (type === "enum('disabled','auto_send')" && defaultValue === "disabled" && rowSafe) {
    console.log("V2R5R4=ALREADY_APPLIED");
    return "skipped";
  }

  const logFile = path.join(logDir, "V2R5R4-apply.log");
  try {
    await connection.query(
      "UPDATE tas_tara_settings SET mode=IF(enabled=1,'auto_send','disabled'), auto_send_default=IF(enabled=1,1,0), updated_at=CURRENT_TIMESTAMP WHERE id=1"
    );
    await connection.query(
      "ALTER TABLE tas_tara_settings MODIFY COLUMN mode ENUM('disabled','auto_send') NOT NULL DEFAULT 'disabled'"
    );
  } catch (error) {
    fs.writeFileSync(logFile, String(error?.stack || error), { mode: 0o600 });
    console.log(`LOG=${logFile}`);
    fail("V2R5R4", "normalized no-draft apply failed");
  }

  const [afterColumns] = await connection.query(
    "SELECT COLUMN_TYPE AS columnType, COLUMN_DEFAULT AS columnDefault FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tas_tara_settings' AND column_name='mode' LIMIT 1",
  );
  const [afterRows] = await connection.query(
    "SELECT enabled, mode, auto_send_default AS autoSendDefault FROM tas_tara_settings WHERE id=1 LIMIT 1",
  );
  const afterType = String(afterColumns[0]?.columnType || "").toLowerCase().replace(/\s+/g, "");
  const afterDefault = normalizeMysqlDefault(afterColumns[0]?.columnDefault);
  const after = afterRows[0];
  const afterEnabled = Number(after?.enabled) === 1;
  const verified =
    afterType === "enum('disabled','auto_send')" &&
    afterDefault === "disabled" &&
    String(after?.mode) === (afterEnabled ? "auto_send" : "disabled") &&
    Number(after?.autoSendDefault) === (afterEnabled ? 1 : 0);

  if (!verified) {
    fs.writeFileSync(logFile, JSON.stringify({
      columnType: afterColumns[0]?.columnType ?? null,
      columnDefault: afterColumns[0]?.columnDefault ?? null,
      enabled: after?.enabled ?? null,
      mode: after?.mode ?? null,
      autoSendDefault: after?.autoSendDefault ?? null,
    }, null, 2), { mode: 0o600 });
    console.log(`LOG=${logFile}`);
    fail("V2R5R4", "normalized no-draft verification failed");
  }

  console.log("V2R5R4=APPLIED");
  return "applied";
}

async function main() {
  if (!fs.existsSync(ROOT) || !fs.statSync(ROOT).isDirectory()) {
    fail("CD_ROOT", `missing canonical root ${ROOT}`);
  }
  process.chdir(ROOT);

  for (const [label, script, expectedBlob] of [...STEPS, V2R5R4_SCRIPT]) {
    if (!fs.existsSync(script)) fail(label, `missing ${script}`);
    const actualBlob = gitBlob(script);
    if (actualBlob !== expectedBlob) {
      fail(label, `script blob mismatch expected=${expectedBlob} actual=${actualBlob}`);
    }
  }

  const runtime = discoverRuntimeEnv();
  console.log(`ENV_SOURCE=${runtime.source}`);

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig(runtime.env));
  } catch {
    fail("DB_CONNECT", "could not connect using discovered production DB environment");
  }

  try {
    const [rows] = await connection.query("SELECT DATABASE() AS db");
    const dbName = String(rows?.[0]?.db || "");
    console.log(`DB_NAME=${dbName}`);
    if (dbName !== "tas_crm") fail("DB_CHECK", `refusing non-audited database ${dbName}`);
  } finally {
    await connection.end();
  }

  const logDir = path.join(
    ROOT,
    "storage",
    "migration-journals",
    `tara-production-recovery-${new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z")}`,
  );
  fs.mkdirSync(logDir, { recursive: true, mode: 0o700 });

  let applied = 0;
  let skipped = 0;

  // V2R5 is already applied from the previous recovery attempt; verify it normally.
  {
    const [label, script] = STEPS[0];
    const beforeLog = path.join(logDir, `${label}-verify-before.log`);
    if (!runMigration(script, "verify", runtime.env, beforeLog)) {
      fail(label, "V2R5 baseline verification failed after the prior successful apply");
    }
    console.log("V2R5=ALREADY_APPLIED");
    skipped += 1;
  }

  connection = await mysql.createConnection(dbConfig(runtime.env));
  try {
    const r4 = await ensureV2R5R4(connection, runtime.env, logDir);
    if (r4 === "applied") applied += 1;
    else skipped += 1;
  } finally {
    await connection.end();
  }

  for (const [label, script] of STEPS.slice(1)) {
    const beforeLog = path.join(logDir, `${label}-verify-before.log`);
    const applyLog = path.join(logDir, `${label}-apply.log`);
    const afterLog = path.join(logDir, `${label}-verify-after.log`);

    if (runMigration(script, "verify", runtime.env, beforeLog)) {
      console.log(`${label}=ALREADY_APPLIED`);
      skipped += 1;
      continue;
    }

    console.log(`${label}=APPLYING`);
    if (!runMigration(script, "apply", runtime.env, applyLog)) {
      console.log(`LOG=${applyLog}`);
      fail(label, "migration apply failed; stopped without automatic rollback");
    }
    if (!runMigration(script, "verify", runtime.env, afterLog)) {
      console.log(`LOG=${afterLog}`);
      fail(label, "post-apply verification failed; stopped without automatic rollback");
    }

    console.log(`${label}=APPLIED`);
    applied += 1;
  }

  connection = await mysql.createConnection(dbConfig(runtime.env));
  try {
    const required = [
      "tas_tara_settings",
      "tas_tara_moderator_profiles",
      "tas_tara_moderator_account_scopes",
      "tas_tara_voice_settings",
      "tas_tara_social_channel_settings",
    ];
    for (const table of required) {
      if (!(await tableExists(connection, table))) {
        fail("FINAL_VERIFY", `missing required table ${table}`);
      }
    }

    const [settingsRows] = await connection.query(
      "SELECT enabled, mode, auto_send_default, runtime_started_at FROM tas_tara_settings WHERE id=1 LIMIT 1",
    );
    const s = settingsRows[0];
    if (!s || Number(s.enabled) !== 0 || s.mode !== "disabled" || Number(s.auto_send_default) !== 0 || s.runtime_started_at !== null) {
      fail("FINAL_VERIFY", "unsafe tas_tara_settings defaults");
    }

    const [voiceRows] = await connection.query(
      "SELECT id, enabled, last_test_status FROM tas_tara_voice_settings WHERE id=1 LIMIT 1",
    );
    const v = voiceRows[0];
    if (!v || Number(v.id) !== 1 || Number(v.enabled) !== 0) {
      fail("FINAL_VERIFY", "unsafe/missing tas_tara_voice_settings singleton");
    }
  } finally {
    await connection.end();
  }

  console.log("FINAL_TABLES=PASS");
  console.log("TARA_SAFE_DEFAULTS=PASS");
  console.log(`APPLIED_COUNT=${applied}`);
  console.log(`ALREADY_APPLIED_COUNT=${skipped}`);
  console.log("SERVICE_RESTART_REQUIRED=NO");
  console.log("TARA_SCHEMA_RECOVERY=PASS");
  console.log("FAILED_STEP=NONE");
  console.log("ERROR=NONE");
}

main().catch((error) => fail("UNEXPECTED", error instanceof Error ? error.message : String(error)));
