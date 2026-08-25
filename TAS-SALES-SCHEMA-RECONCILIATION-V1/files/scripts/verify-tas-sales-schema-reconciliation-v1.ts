import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
import {
  TAS_SALES_SCHEMA_FOUNDATION_TABLES,
  TAS_SALES_SCHEMA_TABLES,
} from "./tas-sales-schema-reconciliation-v1-spec";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  const expectedDatabase = String(process.env.TAS_EXPECTED_DATABASE_NAME ?? "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  if (!expectedDatabase) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");

  const connection = await mysql.createConnection(databaseUrl);
  try {
    const [dbRows] = await connection.query<any[]>("SELECT DATABASE() AS databaseName");
    const actualDatabase = String(dbRows[0]?.databaseName ?? "");
    if (actualDatabase !== expectedDatabase) {
      throw new Error(`Database identity mismatch: expected=${expectedDatabase} actual=${actualDatabase}`);
    }

    const requiredTables = [
      ...TAS_SALES_SCHEMA_FOUNDATION_TABLES,
      ...TAS_SALES_SCHEMA_TABLES.map((table) => table.name),
    ];
    const [tableRows] = await connection.query<any[]>(
      `SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${requiredTables.map(() => "?").join(",")})`,
      requiredTables,
    );
    const existingTables = new Set(tableRows.map((row) => String(row.TABLE_NAME)));
    const missingTables = requiredTables.filter((table) => !existingTables.has(table));
    if (missingTables.length) throw new Error(`Required TAS sales tables missing: ${missingTables.join(", ")}`);

    for (const spec of TAS_SALES_SCHEMA_TABLES) {
      const [columnRows] = await connection.query<any[]>(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [spec.name],
      );
      const columns = new Set(columnRows.map((row) => String(row.COLUMN_NAME)));
      const missingColumns = spec.requiredColumns.filter((column) => !columns.has(column));
      if (missingColumns.length) {
        throw new Error(`${spec.name} missing required columns: ${missingColumns.join(", ")}`);
      }
      const [countRows] = await connection.query<any[]>(`SELECT COUNT(*) AS total FROM \`${spec.name}\``);
      console.log(`TAS_SALES_SCHEMA_VERIFY_TABLE table=${spec.name} rows=${Number(countRows[0]?.total ?? 0)}`);
    }

    console.log(`TAS_SALES_SCHEMA_VERIFY=PASS database=${actualDatabase} tables=${TAS_SALES_SCHEMA_TABLES.length}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("TAS_SALES_SCHEMA_VERIFY=FAIL", error);
  process.exit(1);
});
