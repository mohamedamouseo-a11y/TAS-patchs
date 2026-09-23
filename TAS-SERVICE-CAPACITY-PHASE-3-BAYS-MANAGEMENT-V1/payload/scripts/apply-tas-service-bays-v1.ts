import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const LOCK = "tas-service-bays-v1";
const STATE = path.join(process.cwd(), "storage", "migrations", "tas-service-bays-v1-state.json");
const TABLE = "tas_service_bays";

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const state: { version: number; created: boolean; preexisting: boolean } = { version: 1, created: false, preexisting: false };
  let locked = false;

  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const [requiredRows] = await db.query<any[]>(
      "SELECT TABLE_NAME name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('tas_branches','tas_service_types','tas_service_bookings')"
    );
    const required = new Set(requiredRows.map((row) => String(row.name)));
    for (const name of ["tas_branches", "tas_service_types", "tas_service_bookings"]) {
      if (!required.has(name)) throw new Error("Required table missing: " + name);
    }

    const [lockRows] = await db.query<any[]>("SELECT GET_LOCK(?, 10) acquired", [LOCK]);
    locked = Number(lockRows?.[0]?.acquired ?? 0) === 1;
    if (!locked) throw new Error("Could not acquire migration lock");

    const [existsRows] = await db.execute<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [TABLE],
    );

    if (Number(existsRows?.[0]?.c ?? 0) > 0) {
      state.preexisting = true;
      persist();
    } else {
      await db.query(
        "CREATE TABLE tas_service_bays (" +
        "id INT NOT NULL AUTO_INCREMENT," +
        "branchId INT NOT NULL," +
        "name VARCHAR(120) NOT NULL," +
        "code VARCHAR(64) NULL," +
        "bayType VARCHAR(64) NOT NULL DEFAULT 'General'," +
        "capabilitiesJson JSON NULL," +
        "notes TEXT NULL," +
        "sortOrder INT NOT NULL DEFAULT 0," +
        "isActive TINYINT NOT NULL DEFAULT 1," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "PRIMARY KEY (id)," +
        "INDEX idx_tas_service_bays_branch (branchId)," +
        "INDEX idx_tas_service_bays_active (branchId,isActive)," +
        "INDEX idx_tas_service_bays_sort (branchId,sortOrder,id)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      );
      state.created = true;
      persist();
    }

    console.log("TAS_SERVICE_BAYS_MIGRATION=PASS");
    console.log("TABLE_CREATED=" + (state.created ? "YES" : "NO"));
    console.log("TABLE_PREEXISTING=" + (state.preexisting ? "YES" : "NO"));
    console.log("SEED_ROWS=0");
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
  console.error("TAS_SERVICE_BAYS_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
