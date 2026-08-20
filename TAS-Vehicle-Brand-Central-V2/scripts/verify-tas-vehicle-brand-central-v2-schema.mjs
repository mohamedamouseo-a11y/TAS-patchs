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
  "DATABASE_URL","DB_HOST","DB_PORT","DB_USER","DB_PASSWORD","DB_NAME",
  "MYSQL_HOST","MYSQL_PORT","MYSQL_USER","MYSQL_PASSWORD","MYSQL_DATABASE",
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
  const count = async (sql, values = []) => Number(((await connection.query(sql, values))[0] ?? [])[0]?.n ?? 0);
  const tableExists = async (table) => (await count("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?", [databaseName, table])) === 1;
  const columnExists = async (table, column) => (await count("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?", [databaseName, table, column])) === 1;
  const indexExists = async (table, indexName) => (await count("SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?", [databaseName, table, indexName])) > 0;
  const requireTable = async (table) => { if (!(await tableExists(table))) throw new Error(`Missing table: ${table}`); };
  const requireColumn = async (table, column) => { if (!(await columnExists(table, column))) throw new Error(`Missing column: ${table}.${column}`); };
  const requireIndex = async (table, indexName) => { if (!(await indexExists(table, indexName))) throw new Error(`Missing index: ${table}.${indexName}`); };

  try {
    const [identityRows] = await connection.query("SELECT DATABASE() AS databaseName");
    const connectedDatabase = String(identityRows?.[0]?.databaseName || "");
    if (connectedDatabase !== expected) throw new Error(`Connected database mismatch: ${connectedDatabase || "empty"}`);

    await requireTable("tas_vehicle_brands");
    for (const column of ["id","code","nameEn","nameAr","aliases","isActive","sortOrder","createdBy","updatedBy","createdAt","updatedAt"]) await requireColumn("tas_vehicle_brands", column);
    await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_code");
    await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_name_en");

    await requireColumn("tas_excel_import_batches", "brandId");
    await requireIndex("tas_excel_import_batches", "idx_tas_excel_batches_brand");

    await requireColumn("tas_vehicles", "brandId");
    await requireIndex("tas_vehicles", "idx_tas_vehicles_brand_id");

    await requireTable("tas_lead_brand_interests");
    for (const column of ["id","leadId","brandId","importBatchId","source","isPrimary","createdAt","updatedAt"]) await requireColumn("tas_lead_brand_interests", column);
    await requireIndex("tas_lead_brand_interests", "uq_tas_lead_brand_interest");

    let automotiveIntegration = "SKIPPED_TABLE_NOT_PRESENT";
    if (await tableExists("automotive_vehicles")) {
      await requireColumn("automotive_vehicles", "brandId");
      await requireIndex("automotive_vehicles", "idx_automotive_vehicles_brand_id");
      automotiveIntegration = "VERIFIED";
    }

    console.log("TAS_VEHICLE_BRAND_V2_SCHEMA_VERIFY=PASS");
    console.log(`DATABASE_NAME=${databaseName}`);
    console.log("RUNTIME_ENV_SOURCE=ACTIVE_RELEASE_DOTENV");
    console.log("DEPENDENCY_RESOLUTION=ACTIVE_RELEASE");
    console.log("VERIFY_MODE=READ_ONLY");
    console.log(`AUTOMOTIVE_OPTIONAL_INTEGRATION=${automotiveIntegration}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("TAS_VEHICLE_BRAND_V2_SCHEMA_VERIFY=FAIL");
  console.error(`SAFE_ERROR=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
