import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-service-bays-v1-state.json");
const TABLE = "tas_service_bays";
const REQUIRED_COLUMNS = ["id","branchId","name","code","bayType","capabilitiesJson","notes","sortOrder","isActive","createdAt","updatedAt"];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const rolledBack = process.argv.includes("--rolled-back");
  const db = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const [tableRows] = await db.execute<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [TABLE],
    );
    const exists = Number(tableRows?.[0]?.c ?? 0) > 0;
    const state = fs.existsSync(STATE)
      ? JSON.parse(fs.readFileSync(STATE, "utf8"))
      : { created: false, preexisting: false };

    if (rolledBack) {
      if (state.created && exists) throw new Error("Rollback left migration-created table");
      if (state.preexisting && !exists) throw new Error("Rollback removed preexisting table");
      console.log("TAS_SERVICE_BAYS_ROLLBACK_VERIFY=PASS");
      console.log("ERROR=NONE");
      return;
    }

    if (!exists) throw new Error("Missing table: " + TABLE);

    const [columnRows] = await db.query<any[]>(
      "SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bays'"
    );
    const columns = new Set(columnRows.map((row) => String(row.name)));
    for (const name of REQUIRED_COLUMNS) {
      if (!columns.has(name)) throw new Error("Missing bay column: " + name);
    }

    const [invalidRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_service_bays b LEFT JOIN tas_branches br ON br.id=b.branchId " +
      "WHERE br.id IS NULL OR TRIM(b.name)='' OR b.sortOrder < -100000 OR b.sortOrder > 100000 OR b.isActive NOT IN (0,1)"
    );
    if (Number(invalidRows?.[0]?.c ?? 0) > 0) throw new Error("Invalid service bay rows detected");

    const [counts] = await db.query<any[]>("SELECT COUNT(*) bays, SUM(CASE WHEN isActive=1 THEN 1 ELSE 0 END) activeBays FROM tas_service_bays");
    console.log("TAS_SERVICE_BAYS_VERIFY=PASS");
    console.log("BAY_ROWS=" + Number(counts?.[0]?.bays ?? 0));
    console.log("ACTIVE_BAY_ROWS=" + Number(counts?.[0]?.activeBays ?? 0));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_SERVICE_BAYS_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
