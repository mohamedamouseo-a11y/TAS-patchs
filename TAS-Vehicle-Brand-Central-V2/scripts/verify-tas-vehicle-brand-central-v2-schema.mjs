import { createRequire } from "node:module";
import path from "node:path";

const expected = process.env.TAS_EXPECTED_DATABASE_NAME;
const runtimeRoot = process.env.TAS_RUNTIME_ROOT;
const rawUrl = process.env.DATABASE_URL;
if (!expected) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");
if (!runtimeRoot) throw new Error("TAS_RUNTIME_ROOT is required");
if (!rawUrl) throw new Error("DATABASE_URL is required");

const parsed = new URL(rawUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
if (databaseName !== expected) throw new Error(`Unexpected database name: ${databaseName}`);

const runtimeRequire = createRequire(path.join(path.resolve(runtimeRoot), "package.json"));
const mysql = runtimeRequire("mysql2/promise");

async function main() {
  const connection = await mysql.createConnection(rawUrl);
  const count = async (sql, values = []) => Number(((await connection.query(sql, values))[0] ?? [])[0]?.n ?? 0);
  const tableExists = async (table) => (await count("SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?", [databaseName, table])) === 1;
  const columnExists = async (table, column) => (await count("SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?", [databaseName, table, column])) === 1;
  const indexExists = async (table, indexName) => (await count("SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?", [databaseName, table, indexName])) > 0;
  const requireTable = async (table) => { if (!(await tableExists(table))) throw new Error(`Missing table: ${table}`); };
  const requireColumn = async (table, column) => { if (!(await columnExists(table, column))) throw new Error(`Missing column: ${table}.${column}`); };
  const requireIndex = async (table, indexName) => { if (!(await indexExists(table, indexName))) throw new Error(`Missing index: ${table}.${indexName}`); };

  try {
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
