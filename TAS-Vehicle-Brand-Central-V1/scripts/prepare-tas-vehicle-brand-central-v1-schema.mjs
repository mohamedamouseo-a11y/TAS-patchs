import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const expected = process.env.TAS_EXPECTED_DATABASE_NAME;
const rawUrl = process.env.DATABASE_URL;
const runtimeRoot = process.env.TAS_RUNTIME_ROOT;

if (!expected) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");
if (!rawUrl) throw new Error("DATABASE_URL is required");
if (!runtimeRoot || !path.isAbsolute(runtimeRoot)) throw new Error("TAS_RUNTIME_ROOT must be an absolute active-release path");
const runtimePackage = path.join(runtimeRoot, "package.json");
if (!fs.existsSync(runtimePackage)) throw new Error("TAS_RUNTIME_ROOT package.json is missing");

const parsed = new URL(rawUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
if (databaseName !== expected) throw new Error(`Unexpected database name: ${databaseName}`);

const runtimeRequire = createRequire(runtimePackage);
let mysql;
try {
  mysql = runtimeRequire("mysql2/promise");
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "MODULE_RESOLUTION_FAILED";
  throw new Error(`mysql2/promise is not resolvable from TAS_RUNTIME_ROOT (${code})`);
}

function dbErrorCode(error) {
  if (!error || typeof error !== "object") return "UNKNOWN";
  if ("code" in error && error.code) return String(error.code);
  if ("errno" in error && error.errno) return String(error.errno);
  return "UNKNOWN";
}

async function main() {
  const connection = await mysql.createConnection(rawUrl);
  const q = async (statement, values = []) => connection.query(statement, values);
  const scalar = async (statement, values = []) => Number(((await q(statement, values))[0] ?? [])[0]?.n ?? 0);

  async function tableExists(table) {
    return (await scalar(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?",
      [databaseName, table],
    )) === 1;
  }

  async function columnExists(table, column) {
    return (await scalar(
      "SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
      [databaseName, table, column],
    )) === 1;
  }

  async function indexExists(table, indexName) {
    return (await scalar(
      "SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?",
      [databaseName, table, indexName],
    )) > 0;
  }

  try {
    await q("SET SESSION lock_wait_timeout = 5");
    await q("SET SESSION innodb_lock_wait_timeout = 5");

    for (const requiredTable of ["tas_excel_import_batches", "automotive_vehicles", "leads"]) {
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

    if (!(await columnExists("automotive_vehicles", "brandId"))) {
      await q("ALTER TABLE automotive_vehicles ADD COLUMN brandId INT NULL AFTER id");
    }
    if (!(await indexExists("automotive_vehicles", "idx_automotive_vehicles_brand_id"))) {
      await q("ALTER TABLE automotive_vehicles ADD INDEX idx_automotive_vehicles_brand_id (brandId)");
    }

    await q(`CREATE TABLE IF NOT EXISTS tas_lead_vehicle_interests (
      id INT NOT NULL AUTO_INCREMENT,
      leadId INT NOT NULL,
      brandId INT NOT NULL,
      importBatchId INT NULL,
      source VARCHAR(64) NOT NULL DEFAULT 'manual',
      isPrimary TINYINT NOT NULL DEFAULT 1,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_tas_lead_vehicle_interest (leadId, brandId),
      KEY idx_tas_lead_vehicle_brand (brandId, leadId),
      KEY idx_tas_lead_vehicle_batch (importBatchId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    console.log("TAS_VEHICLE_BRAND_SCHEMA_PREP=PASS");
    console.log(`DATABASE_NAME=${databaseName}`);
    console.log("DEPENDENCY_RESOLUTION=ACTIVE_RELEASE");
    console.log("DDL_LOCK_TIMEOUT_SECONDS=5");
    console.log("DESTRUCTIVE_OPERATIONS=NONE");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = /^(Required table missing:|Unexpected database name:|mysql2\/promise is not resolvable|TAS_)/.test(message)
    ? message
    : `database operation failed (${dbErrorCode(error)})`;
  console.error("TAS_VEHICLE_BRAND_SCHEMA_PREP=FAIL");
  console.error(`SAFE_ERROR=${safeMessage}`);
  process.exitCode = 1;
});
