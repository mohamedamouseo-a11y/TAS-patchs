import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
import {
  AUTOMOTIVE_VEHICLES_RUNTIME_COLUMNS,
  AUTOMOTIVE_VEHICLES_TABLE,
} from "./tas-automotive-catalog-schema-v1-spec";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const expectedDb = String(process.env.TAS_EXPECTED_DATABASE_NAME ?? "").trim();
  if (!expectedDb) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [dbRows] = await connection.query<any[]>("SELECT DATABASE() AS db");
    const actualDb = String(dbRows[0]?.db ?? "");
    if (actualDb !== expectedDb) throw new Error(`Database safety check failed: expected ${expectedDb}, connected to ${actualDb || "<none>"}`);

    const [tableRows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [AUTOMOTIVE_VEHICLES_TABLE],
    );
    if (Number(tableRows[0]?.total ?? 0) !== 1) throw new Error(`${AUTOMOTIVE_VEHICLES_TABLE} is missing`);

    const [columnRows] = await connection.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [AUTOMOTIVE_VEHICLES_TABLE],
    );
    const actualColumns = new Set(columnRows.map((row) => String(row.COLUMN_NAME)));
    const missing = AUTOMOTIVE_VEHICLES_RUNTIME_COLUMNS.filter((column) => !actualColumns.has(column));
    if (missing.length) throw new Error(`Missing automotive runtime columns: ${missing.join(", ")}`);

    await connection.query(`SELECT id, brand, model FROM \`${AUTOMOTIVE_VEHICLES_TABLE}\` LIMIT 1`);
    console.log("TAS_AUTOMOTIVE_CATALOG_SCHEMA_VERIFY=PASS");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[TAS Automotive Catalog Verify V1] FAILED", error);
  process.exit(1);
});
