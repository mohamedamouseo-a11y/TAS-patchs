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

  async function rows(statement, values = []) {
    const [result] = await connection.query(statement, values);
    return Array.isArray(result) ? result : [];
  }

  async function count(statement, values = []) {
    return Number((await rows(statement, values))[0]?.n ?? 0);
  }

  async function requireTable(table) {
    if (await count(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?",
      [databaseName, table],
    ) !== 1) throw new Error(`Missing table: ${table}`);
  }

  async function requireColumn(table, column, { dataType, nullable } = {}) {
    const result = await rows(
      "SELECT data_type dataType, is_nullable isNullable FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?",
      [databaseName, table, column],
    );
    if (result.length !== 1) throw new Error(`Missing column: ${table}.${column}`);
    const actualType = String(result[0].dataType ?? "").toLowerCase();
    const actualNullable = String(result[0].isNullable ?? "").toUpperCase();
    if (dataType && actualType !== String(dataType).toLowerCase()) {
      throw new Error(`Unexpected column type: ${table}.${column}`);
    }
    if (nullable !== undefined && actualNullable !== (nullable ? "YES" : "NO")) {
      throw new Error(`Unexpected column nullability: ${table}.${column}`);
    }
  }

  async function requireIndex(table, indexName) {
    if (await count(
      "SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?",
      [databaseName, table, indexName],
    ) < 1) throw new Error(`Missing index: ${table}.${indexName}`);
  }

  try {
    await requireTable("tas_vehicle_brands");
    for (const column of ["id", "code", "nameEn", "nameAr", "aliases", "isActive", "sortOrder", "createdBy", "updatedBy", "createdAt", "updatedAt"]) {
      await requireColumn("tas_vehicle_brands", column);
    }
    await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_code");
    await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_name_en");
    await requireIndex("tas_vehicle_brands", "idx_tas_vehicle_brands_active_sort");

    await requireColumn("tas_excel_import_batches", "brandId", { dataType: "int", nullable: true });
    await requireIndex("tas_excel_import_batches", "idx_tas_excel_batches_brand");

    await requireColumn("automotive_vehicles", "brandId", { dataType: "int", nullable: true });
    await requireIndex("automotive_vehicles", "idx_automotive_vehicles_brand_id");

    await requireTable("tas_lead_vehicle_interests");
    for (const column of ["id", "leadId", "brandId", "importBatchId", "source", "isPrimary", "createdAt", "updatedAt"]) {
      await requireColumn("tas_lead_vehicle_interests", column);
    }
    await requireIndex("tas_lead_vehicle_interests", "uq_tas_lead_vehicle_interest");
    await requireIndex("tas_lead_vehicle_interests", "idx_tas_lead_vehicle_brand");
    await requireIndex("tas_lead_vehicle_interests", "idx_tas_lead_vehicle_batch");

    console.log("TAS_VEHICLE_BRAND_SCHEMA_VERIFY=PASS");
    console.log(`DATABASE_NAME=${databaseName}`);
    console.log("DEPENDENCY_RESOLUTION=ACTIVE_RELEASE");
    console.log("VERIFY_MODE=READ_ONLY");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = /^(Missing table:|Missing column:|Missing index:|Unexpected column|Unexpected database name:|mysql2\/promise is not resolvable|TAS_)/.test(message)
    ? message
    : `database verification failed (${dbErrorCode(error)})`;
  console.error("TAS_VEHICLE_BRAND_SCHEMA_VERIFY=FAIL");
  console.error(`SAFE_ERROR=${safeMessage}`);
  process.exitCode = 1;
});
