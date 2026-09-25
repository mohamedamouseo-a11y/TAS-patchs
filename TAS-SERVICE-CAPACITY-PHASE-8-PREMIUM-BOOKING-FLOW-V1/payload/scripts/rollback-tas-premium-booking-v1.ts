import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-premium-booking-v1-state.json");
const columns = [
  "plannedDurationMinutes",
  "maintenanceIntervalId",
  "maintenancePlanId",
  "maintenanceMappingId",
  "mileageKm",
  "vehicleId",
];
const indexes = [
  "idx_service_bookings_maintenanceIntervalId",
  "idx_service_bookings_vehicleId",
];

async function columnExists(db: mysql.Connection, column: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND COLUMN_NAME=?",
    [column],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function indexExists(db: mysql.Connection, indexName: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND INDEX_NAME=?",
    [indexName],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!fs.existsSync(STATE)) {
    console.log("TAS_PREMIUM_BOOKING_ROLLBACK=PASS");
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

    for (const indexName of indexes) {
      if (state.indexes?.[indexName] === "created" && await indexExists(db, indexName)) {
        await db.query(`DROP INDEX ${indexName} ON tas_service_bookings`);
      }
    }

    for (const column of columns) {
      if (state.columns?.[column] === "created" && await columnExists(db, column)) {
        await db.query(`ALTER TABLE tas_service_bookings DROP COLUMN ${column}`);
      }
    }

    console.log("TAS_PREMIUM_BOOKING_ROLLBACK=PASS");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_PREMIUM_BOOKING_ROLLBACK=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
