import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-availability-engine-v2-state.json");

async function indexExists(db: mysql.Connection) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND INDEX_NAME='idx_service_bookings_bayId'"
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function columnExists(db: mysql.Connection) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND COLUMN_NAME='bayId'"
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  if (!fs.existsSync(STATE)) {
    console.log("TAS_AVAILABILITY_ENGINE_V2_ROLLBACK=PASS");
    console.log("CHANGES_REVERTED=NO_STATE");
    console.log("ERROR=NONE");
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    if (state.bayIdIndexCreated && await indexExists(db)) {
      await db.query("DROP INDEX idx_service_bookings_bayId ON tas_service_bookings");
    }
    if (state.bayIdCreated && await columnExists(db)) {
      await db.query("ALTER TABLE tas_service_bookings DROP COLUMN bayId");
    }

    console.log("TAS_AVAILABILITY_ENGINE_V2_ROLLBACK=PASS");
    console.log("CHANGES_REVERTED=YES");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_AVAILABILITY_ENGINE_V2_ROLLBACK=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
