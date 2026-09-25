import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const LOCK = "tas-premium-booking-v1";
const STATE = path.join(process.cwd(), "storage", "migrations", "tas-premium-booking-v1-state.json");

const columns = [
  ["vehicleId", "INT NULL AFTER bayId"],
  ["mileageKm", "INT NULL AFTER vehicleId"],
  ["maintenanceMappingId", "INT NULL AFTER mileageKm"],
  ["maintenancePlanId", "INT NULL AFTER maintenanceMappingId"],
  ["maintenanceIntervalId", "INT NULL AFTER maintenancePlanId"],
  ["plannedDurationMinutes", "INT NULL AFTER maintenanceIntervalId"],
] as const;

const indexes = [
  ["idx_service_bookings_vehicleId", "vehicleId"],
  ["idx_service_bookings_maintenanceIntervalId", "maintenanceIntervalId"],
] as const;

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
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  let locked = false;
  const state: any = { version: 1, columns: {}, indexes: {} };
  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const [tableRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings'"
    );
    if (Number(tableRows?.[0]?.c ?? 0) === 0) throw new Error("tas_service_bookings is missing");

    const [lockRows] = await db.query<any[]>("SELECT GET_LOCK(?, 10) acquired", [LOCK]);
    locked = Number(lockRows?.[0]?.acquired ?? 0) === 1;
    if (!locked) throw new Error("Could not acquire migration lock");

    for (const [name, definition] of columns) {
      const exists = await columnExists(db, name);
      state.columns[name] = exists ? "preexisting" : "pending";
      persist();
      if (!exists) {
        await db.query(`ALTER TABLE tas_service_bookings ADD COLUMN ${name} ${definition}`);
        state.columns[name] = "created";
        persist();
      }
    }

    for (const [name, column] of indexes) {
      const exists = await indexExists(db, name);
      state.indexes[name] = exists ? "preexisting" : "pending";
      persist();
      if (!exists) {
        await db.query(`CREATE INDEX ${name} ON tas_service_bookings (${column})`);
        state.indexes[name] = "created";
        persist();
      }
    }

    console.log("TAS_PREMIUM_BOOKING_MIGRATION=PASS");
    console.log("COLUMNS_READY=" + columns.length);
    console.log("INDEXES_READY=" + indexes.length);
    console.log("ERROR=NONE");
  } catch (error) {
    persist();
    throw error;
  } finally {
    if (locked) await db.query("SELECT RELEASE_LOCK(?)", [LOCK]).catch(() => undefined);
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_PREMIUM_BOOKING_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
