import mysql from "mysql2/promise";

const expected = process.env.TAS_EXPECTED_DATABASE_NAME;
const rawUrl = process.env.DATABASE_URL;
if (!expected) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");
if (!rawUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(rawUrl);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
if (databaseName !== expected) throw new Error(`Unexpected database name: ${databaseName}`);
const connection = await mysql.createConnection(rawUrl);

async function count(sql: string, values: any[]) {
  const [rows] = await connection.query(sql, values);
  return Number((rows as any[])[0]?.n ?? 0);
}
async function requireTable(table: string) {
  if (await count(`SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema=? AND table_name=?`, [databaseName, table]) !== 1) throw new Error(`Missing table: ${table}`);
}
async function requireColumn(table: string, column: string) {
  if (await count(`SELECT COUNT(*) n FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?`, [databaseName, table, column]) !== 1) throw new Error(`Missing column: ${table}.${column}`);
}
async function requireIndex(table: string, indexName: string) {
  if (await count(`SELECT COUNT(*) n FROM information_schema.statistics WHERE table_schema=? AND table_name=? AND index_name=?`, [databaseName, table, indexName]) < 1) throw new Error(`Missing index: ${table}.${indexName}`);
}

try {
  await requireTable("tas_vehicle_brands");
  for (const column of ["id","code","nameEn","nameAr","aliases","isActive","sortOrder","createdBy","updatedBy","createdAt","updatedAt"]) await requireColumn("tas_vehicle_brands", column);
  await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_code");
  await requireIndex("tas_vehicle_brands", "uq_tas_vehicle_brands_name_en");
  await requireColumn("tas_excel_import_batches", "brandId");
  await requireIndex("tas_excel_import_batches", "idx_tas_excel_batches_brand");
  await requireColumn("automotive_vehicles", "brandId");
  await requireIndex("automotive_vehicles", "idx_automotive_vehicles_brand_id");
  await requireTable("tas_lead_vehicle_interests");
  for (const column of ["id","leadId","brandId","importBatchId","source","isPrimary","createdAt","updatedAt"]) await requireColumn("tas_lead_vehicle_interests", column);
  await requireIndex("tas_lead_vehicle_interests", "uq_tas_lead_vehicle_interest");
  console.log("TAS_VEHICLE_BRAND_SCHEMA_VERIFY=PASS");
  console.log(`DATABASE_NAME=${databaseName}`);
  console.log("VERIFY_MODE=READ_ONLY");
} finally {
  await connection.end();
}
