import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
import {
  AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS,
  AUTOMOTIVE_VEHICLES_REQUIRED_BASE_COLUMNS,
  AUTOMOTIVE_VEHICLES_TABLE,
} from "./tas-automotive-catalog-schema-v1-spec";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

const APPLY = process.argv.includes("--apply");
const LOCK_NAME = "tas-automotive-catalog-schema-v1";

type Connection = mysql.Connection;

async function getDatabaseName(connection: Connection) {
  const [rows] = await connection.query<any[]>("SELECT DATABASE() AS db");
  return String(rows[0]?.db ?? "");
}

async function getColumns(connection: Connection) {
  const [rows] = await connection.query<any[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [AUTOMOTIVE_VEHICLES_TABLE],
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME)));
}

async function tableExists(connection: Connection) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [AUTOMOTIVE_VEHICLES_TABLE],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const expectedDb = String(process.env.TAS_EXPECTED_DATABASE_NAME ?? "").trim();
  if (!expectedDb) throw new Error("TAS_EXPECTED_DATABASE_NAME is required for this production-safe patch");

  const connection = await mysql.createConnection(databaseUrl);
  let lockHeld = false;

  try {
    const actualDb = await getDatabaseName(connection);
    if (actualDb !== expectedDb) {
      throw new Error(`Database safety check failed: expected ${expectedDb}, connected to ${actualDb || "<none>"}`);
    }

    if (!(await tableExists(connection))) {
      throw new Error(`${AUTOMOTIVE_VEHICLES_TABLE} does not exist. This hotfix is additive-only and will not create a replacement table.`);
    }

    const before = await getColumns(connection);
    const missingBase = AUTOMOTIVE_VEHICLES_REQUIRED_BASE_COLUMNS.filter((column) => !before.has(column));
    if (missingBase.length) {
      throw new Error(`Base automotive catalog schema is invalid; missing required columns: ${missingBase.join(", ")}`);
    }

    const missing = Object.keys(AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS).filter((column) => !before.has(column));
    console.log(`[TAS Automotive Catalog V1] database=${actualDb}`);
    console.log(`[TAS Automotive Catalog V1] missing runtime columns=${missing.length ? missing.join(", ") : "none"}`);

    if (!APPLY) {
      console.log("TAS_AUTOMOTIVE_CATALOG_SCHEMA_DRY_RUN=PASS");
      return;
    }

    const [lockRows] = await connection.query<any[]>("SELECT GET_LOCK(?, 10) AS acquired", [LOCK_NAME]);
    if (Number(lockRows[0]?.acquired ?? 0) !== 1) throw new Error("Could not acquire automotive schema advisory lock");
    lockHeld = true;

    for (const column of missing) {
      const ddl = AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS[column];
      console.log(`[TAS Automotive Catalog V1] adding ${column}`);
      await connection.query(`ALTER TABLE \`${AUTOMOTIVE_VEHICLES_TABLE}\` ADD COLUMN ${ddl}`);
    }

    const after = await getColumns(connection);
    const stillMissing = Object.keys(AUTOMOTIVE_VEHICLES_ADDITIVE_COLUMNS).filter((column) => !after.has(column));
    if (stillMissing.length) throw new Error(`Schema reconciliation incomplete: ${stillMissing.join(", ")}`);

    console.log("TAS_AUTOMOTIVE_CATALOG_SCHEMA_RECONCILIATION=PASS");
  } finally {
    if (lockHeld) await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    await connection.end();
  }
}

main().catch((error) => {
  console.error("[TAS Automotive Catalog V1] FAILED", error);
  process.exit(1);
});
