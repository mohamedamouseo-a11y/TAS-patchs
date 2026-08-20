import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const expected = String(process.env.TAS_EXPECTED_DATABASE_NAME || "").trim();
const runtimeRoot = String(process.env.TAS_RUNTIME_ROOT || "").trim();
if (!expected) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");
if (!runtimeRoot) throw new Error("TAS_RUNTIME_ROOT is required");

const resolvedRuntimeRoot = fs.realpathSync(path.resolve(runtimeRoot));
const runtimeRequire = createRequire(path.join(resolvedRuntimeRoot, "package.json"));
const mysql = runtimeRequire("mysql2/promise");
const { config: dotenvConfig } = runtimeRequire("dotenv");

const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
];

function loadExactRuntimeDatabaseEnvironment() {
  const runtimeEnv = path.join(resolvedRuntimeRoot, ".env");
  if (!fs.existsSync(runtimeEnv)) throw new Error("Active TAS runtime .env is missing");
  const runtimeEnvResolved = fs.realpathSync(runtimeEnv);
  const requested = String(process.env.TAS_RUNTIME_ENV_FILE || runtimeEnv).trim();
  if (!requested) throw new Error("TAS runtime env path is empty");
  const requestedResolved = fs.realpathSync(requested);
  if (requestedResolved !== runtimeEnvResolved) {
    throw new Error("TAS runtime env path does not match the active release runtime env");
  }
  for (const key of DATABASE_ENV_KEYS) delete process.env[key];
  const loaded = dotenvConfig({ path: runtimeEnvResolved, override: true });
  if (loaded.error) throw loaded.error;
  return runtimeEnvResolved;
}

function databaseConfig() {
  const rawUrl = String(process.env.DATABASE_URL || "").trim();
  if (rawUrl) {
    const parsed = new URL(rawUrl);
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    if (!databaseName) throw new Error("Database name is missing from DATABASE_URL");
    return { connection: rawUrl, databaseName };
  }
  const connection = {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || "",
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || "",
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || "",
    multipleStatements: false,
  };
  if (!connection.user || !connection.database) {
    throw new Error("Production database configuration is missing from the active TAS runtime env");
  }
  return { connection, databaseName: String(connection.database) };
}

loadExactRuntimeDatabaseEnvironment();
const { connection: connectionConfig, databaseName } = databaseConfig();
if (databaseName !== expected) throw new Error(`Unexpected database name: ${databaseName}`);

async function main() {
  const connection = await mysql.createConnection(connectionConfig);
  const q = async (sql, values = []) => connection.query(sql, values);
  const scalar = async (sql, values = []) => Number(((await q(sql, values))[0] ?? [])[0]?.n ?? 0);
  const tableExists = async (table) => (await scalar(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?",
    [databaseName, table],
  )) === 1;
  const columnExists = async (table, column) => (await scalar(
    "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
    [databaseName, table, column],
  )) === 1;
  const indexExists = async (table, indexName) => (await scalar(
    "SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?",
    [databaseName, table, indexName],
  )) > 0;

  try {
    const [identityRows] = await q("SELECT DATABASE() AS databaseName");
    const connectedDatabase = String(identityRows?.[0]?.databaseName || "");
    if (connectedDatabase !== expected) throw new Error(`Connected database mismatch: ${connectedDatabase || "empty"}`);

    await q("SET SESSION lock_wait_timeout = 5");
    await q("SET SESSION innodb_lock_wait_timeout = 5");

    for (const requiredTable of ["tas_excel_import_batches", "tas_vehicles", "leads"]) {
      if (!(await tableExists(requiredTable))) throw new Error(`Required table missing: ${requiredTable}`);
    }

    await q(`CREATE TABLE IF NOT EXISTS tas_vehicle_brands (
      id INT NOT NULL AUTO_INCREMENT,
      code VARCHAR(64) NOT NULL,
      nameEn VARCHAR(120) NOT NULL,
      nameAr VARCHAR(120) NULL,
      aliases JSON NULL,
      isActive TINYINT NOT NULL DEFAULT 1,
      sortOrder INT NOT NULL DEFAULT 0,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_vehicle_brands_code (code),
      UNIQUE KEY uq_tas_vehicle_brands_name_en (nameEn),
      KEY idx_tas_vehicle_brands_active_sort (isActive, sortOrder, nameEn)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    if (!(await columnExists("tas_excel_import_batches", "brandId"))) {
      await q("ALTER TABLE tas_excel_import_batches ADD COLUMN brandId INT NULL AFTER sourceFileName");
    }
    if (!(await indexExists("tas_excel_import_batches", "idx_tas_excel_batches_brand"))) {
      await q("ALTER TABLE tas_excel_import_batches ADD INDEX idx_tas_excel_batches_brand (brandId)");
    }

    if (!(await columnExists("tas_vehicles", "brandId"))) {
      await q("ALTER TABLE tas_vehicles ADD COLUMN brandId INT NULL AFTER id");
    }
    if (!(await indexExists("tas_vehicles", "idx_tas_vehicles_brand_id"))) {
      await q("ALTER TABLE tas_vehicles ADD INDEX idx_tas_vehicles_brand_id (brandId)");
    }

    await q(`CREATE TABLE IF NOT EXISTS tas_lead_brand_interests (
      id INT NOT NULL AUTO_INCREMENT,
      leadId INT NOT NULL,
      brandId INT NOT NULL,
      importBatchId INT NULL,
      source VARCHAR(64) NOT NULL DEFAULT 'manual',
      isPrimary TINYINT NOT NULL DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_lead_brand_interest (leadId, brandId),
      KEY idx_tas_lead_brand (brandId, leadId),
      KEY idx_tas_lead_brand_batch (importBatchId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    let automotiveIntegration = "SKIPPED_TABLE_NOT_PRESENT";
    if (await tableExists("automotive_vehicles")) {
      if (!(await columnExists("automotive_vehicles", "brandId"))) {
        await q("ALTER TABLE automotive_vehicles ADD COLUMN brandId INT NULL AFTER id");
      }
      if (!(await indexExists("automotive_vehicles", "idx_automotive_vehicles_brand_id"))) {
        await q("ALTER TABLE automotive_vehicles ADD INDEX idx_automotive_vehicles_brand_id (brandId)");
      }
      automotiveIntegration = "APPLIED";
    }

    console.log("TAS_VEHICLE_BRAND_V2_SCHEMA_PREP=PASS");
    console.log(`DATABASE_NAME=${databaseName}`);
    console.log("RUNTIME_ENV_SOURCE=ACTIVE_RELEASE_DOTENV");
    console.log("DEPENDENCY_RESOLUTION=ACTIVE_RELEASE");
    console.log("DDL_LOCK_TIMEOUT_SECONDS=5");
    console.log(`AUTOMOTIVE_OPTIONAL_INTEGRATION=${automotiveIntegration}`);
    console.log("DESTRUCTIVE_OPERATIONS=NONE");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("TAS_VEHICLE_BRAND_V2_SCHEMA_PREP=FAIL");
  console.error(`SAFE_ERROR=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
