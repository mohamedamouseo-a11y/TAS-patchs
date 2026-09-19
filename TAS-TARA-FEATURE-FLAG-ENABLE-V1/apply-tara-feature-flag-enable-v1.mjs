#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = "/var/www/TAS-root";
const CONFIG = path.join(ROOT, "deploy", "ecosystem.current.config.cjs");
const APP = "TAS";
const requireFromTas = createRequire(path.join(ROOT, "package.json"));
const mysql = requireFromTas("mysql2/promise");

const DB_KEYS = [
  "DATABASE_URL",
  "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME",
  "MYSQL_HOST", "MYSQL_PORT", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE",
];

function fail(step, message) {
  console.log("TARA_FLAG_ENABLE=FAIL");
  console.log(`FAILED_STEP=${step}`);
  console.log(`ERROR=${message}`);
  process.exit(1);
}

function pm2List() {
  const raw = execFileSync("pm2", ["jlist"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(raw);
}

function findTasProcess(list) {
  const matches = (Array.isArray(list) ? list : []).filter((p) => {
    const meta = p?.pm2_env || {};
    return String(p?.name || meta.name || "") === APP && String(meta.status || "") === "online";
  });
  if (matches.length !== 1) fail("PM2_DISCOVERY", `expected exactly one online ${APP} process, found ${matches.length}`);
  return matches[0];
}

function selectDbEnv(source) {
  const out = {};
  for (const key of DB_KEYS) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value) !== "") out[key] = String(value);
  }
  return out;
}

function extractProcessEnv(proc) {
  const meta = proc?.pm2_env || {};
  const env = {
    ...(meta.env && typeof meta.env === "object" ? meta.env : {}),
    ...Object.fromEntries(
      Object.entries(meta).filter(([key, value]) =>
        /^[A-Z_][A-Z0-9_]*$/.test(key) &&
        ["string", "number", "boolean"].includes(typeof value)
      )
    ),
  };
  return Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
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

async function assertSafeTaraDefaults(runtimeEnv, phase) {
  const dbEnv = selectDbEnv(runtimeEnv);
  if (!dbEnv.DATABASE_URL && !(dbEnv.DB_USER || dbEnv.MYSQL_USER)) {
    fail(phase, "running TAS process has no usable DB environment");
  }
  const connection = await mysql.createConnection(dbConfig(dbEnv));
  try {
    const [dbRows] = await connection.query("SELECT DATABASE() AS db");
    const dbName = String(dbRows?.[0]?.db || "");
    if (dbName !== "tas_crm") fail(phase, `refusing unexpected database ${dbName}`);

    const [rows] = await connection.query(
      "SELECT enabled, mode, auto_send_default AS autoSendDefault, runtime_started_at AS runtimeStartedAt FROM tas_tara_settings WHERE id=1 LIMIT 1"
    );
    const s = rows[0];
    if (
      !s ||
      Number(s.enabled) !== 0 ||
      String(s.mode) !== "disabled" ||
      Number(s.autoSendDefault) !== 0 ||
      s.runtimeStartedAt !== null
    ) {
      fail(phase, "TARA safe defaults are not intact; refusing feature-flag activation");
    }
  } finally {
    await connection.end();
  }
}

function patchConfig() {
  if (!fs.existsSync(CONFIG)) fail("CONFIG_CHECK", `missing ${CONFIG}`);
  const original = fs.readFileSync(CONFIG, "utf8");

  if (/\bTARA_ENABLED\s*:/.test(original)) {
    if (!/\bTARA_ENABLED\s*:\s*["']true["']/.test(original) && !/\bTARA_ENABLED\s*:\s*true\b/.test(original)) {
      fail("CONFIG_CHECK", "TARA_ENABLED already exists with an unexpected value");
    }
    return { changed: false, backup: "NONE" };
  }

  const needle = '        NODE_ENV: "production",';
  if (!original.includes(needle)) {
    fail("CONFIG_PATCH", "expected NODE_ENV anchor not found in ecosystem config");
  }

  const backupDir = path.join(ROOT, "storage", "patch-backups", "tara-feature-flag");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  const backup = path.join(backupDir, `ecosystem.current.config.cjs.${stamp}.bak`);
  fs.copyFileSync(CONFIG, backup);
  fs.chmodSync(backup, 0o600);

  const next = original.replace(
    needle,
    needle + '\n        TARA_ENABLED: "true",'
  );
  fs.writeFileSync(CONFIG, next, "utf8");

  const check = spawnSync(process.execPath, ["--check", CONFIG], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (check.status !== 0) {
    fs.copyFileSync(backup, CONFIG);
    fail("CONFIG_SYNTAX", "ecosystem config syntax check failed; backup restored");
  }

  const verify = spawnSync(
    process.execPath,
    ["-e", `const c=require(${JSON.stringify(CONFIG)}); const a=(c.apps||[]).find(x=>x.name==="TAS"||x.name===process.env.PM2_APP_NAME); if(!a||String(a.env?.TARA_ENABLED)!=="true") process.exit(2);`],
    {
      cwd: ROOT,
      env: { ...process.env, PM2_ENV_SNAPSHOT: "" },
      encoding: "utf8",
    }
  );
  if (verify.status !== 0) {
    fs.copyFileSync(backup, CONFIG);
    fail("CONFIG_VERIFY", "TARA_ENABLED was not readable as true from ecosystem config; backup restored");
  }

  return { changed: true, backup };
}

async function main() {
  if (!fs.existsSync(ROOT)) fail("ROOT_CHECK", `missing ${ROOT}`);
  process.chdir(ROOT);

  const beforeProc = findTasProcess(pm2List());
  const beforeMeta = beforeProc.pm2_env || {};
  const beforePid = Number(beforeProc.pid || 0);
  const beforeScript = String(beforeMeta.pm_exec_path || "");
  const beforeCwd = String(beforeMeta.pm_cwd || "");
  const existingEnv = extractProcessEnv(beforeProc);

  await assertSafeTaraDefaults(existingEnv, "SAFE_DEFAULTS_BEFORE");
  console.log("SAFE_DEFAULTS_BEFORE=PASS");

  const patched = patchConfig();
  console.log(`CONFIG_CHANGED=${patched.changed ? "YES" : "NO"}`);
  console.log(`BACKUP=${patched.backup}`);

  const restartEnv = { ...process.env, ...existingEnv, TARA_ENABLED: "true" };
  const restart = spawnSync("pm2", ["restart", APP, "--update-env"], {
    cwd: ROOT,
    env: restartEnv,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (restart.status !== 0) {
    fail("PM2_RESTART", "pm2 restart TAS --update-env failed");
  }

  const afterProc = findTasProcess(pm2List());
  const afterMeta = afterProc.pm2_env || {};
  const afterEnv = extractProcessEnv(afterProc);

  if (String(afterEnv.TARA_ENABLED || "").toLowerCase() !== "true") {
    fail("ENV_VERIFY", "TARA_ENABLED is not true in the restarted TAS process");
  }
  if (String(afterMeta.pm_exec_path || "") !== beforeScript || String(afterMeta.pm_cwd || "") !== beforeCwd) {
    fail("PM2_VERIFY", "TAS script path or cwd changed unexpectedly during restart");
  }

  await assertSafeTaraDefaults(afterEnv, "SAFE_DEFAULTS_AFTER");
  console.log("SAFE_DEFAULTS_AFTER=PASS");

  const save = spawnSync("pm2", ["save"], {
    cwd: ROOT,
    env: { ...process.env, ...afterEnv },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (save.status !== 0) fail("PM2_SAVE", "pm2 save failed");

  console.log("PM2_PROCESS=TAS");
  console.log(`OLD_PID=${beforePid}`);
  console.log(`NEW_PID=${Number(afterProc.pid || 0)}`);
  console.log("TARA_ENABLED=true");
  console.log("PERSISTENT_CONFIG=PASS");
  console.log("PM2_SAVED=PASS");
  console.log("BUILD_REQUIRED=NO");
  console.log("GIT_CHANGED_FILE=deploy/ecosystem.current.config.cjs");
  console.log("TARA_FLAG_ENABLE=PASS");
  console.log("FAILED_STEP=NONE");
  console.log("ERROR=NONE");
}

main().catch((error) => fail("UNEXPECTED", error instanceof Error ? error.message : String(error)));
