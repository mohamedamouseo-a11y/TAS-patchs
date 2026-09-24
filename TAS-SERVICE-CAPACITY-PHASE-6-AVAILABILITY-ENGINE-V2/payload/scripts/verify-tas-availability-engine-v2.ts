import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-availability-engine-v2-state.json");

async function exists(db: mysql.Connection, kind: "column" | "index") {
  if (kind === "column") {
    const [rows] = await db.execute<any[]>(
      "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND COLUMN_NAME='bayId'"
    );
    return Number(rows?.[0]?.c ?? 0) > 0;
  }
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND INDEX_NAME='idx_service_bookings_bayId'"
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const rolledBack = process.argv.includes("--rolled-back");
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const state = fs.existsSync(STATE)
      ? JSON.parse(fs.readFileSync(STATE, "utf8"))
      : { bayIdCreated: false, bayIdPreexisting: false, bayIdIndexCreated: false, bayIdIndexPreexisting: false };

    const columnPresent = await exists(db, "column");
    const indexPresent = await exists(db, "index");

    if (rolledBack) {
      if (state.bayIdCreated && columnPresent) throw new Error("Rollback left migration-created bayId column");
      if (state.bayIdPreexisting && !columnPresent) throw new Error("Rollback removed preexisting bayId column");
      if (state.bayIdIndexCreated && indexPresent) throw new Error("Rollback left migration-created bayId index");
      if (state.bayIdIndexPreexisting && !indexPresent) throw new Error("Rollback removed preexisting bayId index");
      console.log("TAS_AVAILABILITY_ENGINE_V2_ROLLBACK_VERIFY=PASS");
      console.log("ERROR=NONE");
      return;
    }

    if (!columnPresent) throw new Error("Missing tas_service_bookings.bayId");
    if (!indexPresent) throw new Error("Missing idx_service_bookings_bayId");

    const [invalidRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_service_bookings b " +
      "LEFT JOIN tas_service_bays bay ON bay.id=b.bayId " +
      "WHERE b.bayId IS NOT NULL AND bay.id IS NULL"
    );
    if (Number(invalidRows?.[0]?.c ?? 0) > 0) throw new Error("Bookings reference missing service Bays");

    const [counts] = await db.query<any[]>(
      "SELECT COUNT(*) totalBookings, SUM(CASE WHEN bayId IS NOT NULL THEN 1 ELSE 0 END) bayAssignedBookings FROM tas_service_bookings"
    );
    console.log("TAS_AVAILABILITY_ENGINE_V2_VERIFY=PASS");
    console.log("TOTAL_BOOKINGS=" + Number(counts?.[0]?.totalBookings ?? 0));
    console.log("BAY_ASSIGNED_BOOKINGS=" + Number(counts?.[0]?.bayAssignedBookings ?? 0));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_AVAILABILITY_ENGINE_V2_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
