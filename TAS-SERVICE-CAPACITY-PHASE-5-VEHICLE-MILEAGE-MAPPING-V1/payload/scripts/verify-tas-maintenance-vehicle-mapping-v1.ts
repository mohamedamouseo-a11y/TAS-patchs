import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-vehicle-mapping-v1-state.json");
const TABLE = "tas_maintenance_vehicle_mappings";
const REQUIRED = ["id","vehicleId","planId","powertrain","variant","yearFrom","yearTo","notes","sortOrder","isActive","createdAt","updatedAt"];

async function tableExists(db: mysql.Connection, table: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
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

    const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : { created: false, preexisting: false };
    const exists = await tableExists(db, TABLE);

    if (rolledBack) {
      if (state.created && exists) throw new Error("Rollback left migration-created mapping table");
      if (state.preexisting && !exists) throw new Error("Rollback removed preexisting mapping table");
      console.log("TAS_MAINTENANCE_VEHICLE_MAPPING_ROLLBACK_VERIFY=PASS");
      console.log("ERROR=NONE");
      return;
    }

    if (!exists) throw new Error("Missing table: " + TABLE);

    const [columnRows] = await db.query<any[]>(
      "SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_maintenance_vehicle_mappings'"
    );
    const columns = new Set(columnRows.map((row) => String(row.name)));
    for (const name of REQUIRED) if (!columns.has(name)) throw new Error("Missing mapping column: " + name);

    const [invalid] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_maintenance_vehicle_mappings m " +
      "LEFT JOIN tas_vehicles v ON v.id=m.vehicleId " +
      "LEFT JOIN tas_maintenance_plans p ON p.id=m.planId " +
      "WHERE v.id IS NULL OR p.id IS NULL OR m.sortOrder < -100000 OR m.sortOrder > 100000 " +
      "OR m.isActive NOT IN (0,1) OR (m.yearFrom IS NOT NULL AND (m.yearFrom < 0 OR m.yearFrom > 9999)) " +
      "OR (m.yearTo IS NOT NULL AND (m.yearTo < 0 OR m.yearTo > 9999)) " +
      "OR (m.yearFrom IS NOT NULL AND m.yearTo IS NOT NULL AND m.yearTo < m.yearFrom)"
    );
    if (Number(invalid?.[0]?.c ?? 0) > 0) throw new Error("Invalid maintenance vehicle mapping rows detected");

    const [counts] = await db.query<any[]>(
      "SELECT COUNT(*) mappings, SUM(CASE WHEN isActive=1 THEN 1 ELSE 0 END) activeMappings FROM tas_maintenance_vehicle_mappings"
    );
    console.log("TAS_MAINTENANCE_VEHICLE_MAPPING_VERIFY=PASS");
    console.log("MAPPING_ROWS=" + Number(counts?.[0]?.mappings ?? 0));
    console.log("ACTIVE_MAPPING_ROWS=" + Number(counts?.[0]?.activeMappings ?? 0));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_VEHICLE_MAPPING_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
