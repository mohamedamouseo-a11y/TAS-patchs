import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const LOCK = "tas-maintenance-plans-v1";
const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-plans-v1-state.json");

async function tableExists(db: mysql.Connection, name: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [name],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  let locked = false;
  const state = {
    version: 1,
    plansCreated: false,
    plansPreexisting: false,
    intervalsCreated: false,
    intervalsPreexisting: false,
  };

  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    for (const required of ["tas_branches", "tas_service_types", "tas_service_bookings", "tas_service_bays"]) {
      if (!(await tableExists(db, required))) throw new Error("Required table missing: " + required);
    }

    const [lockRows] = await db.query<any[]>("SELECT GET_LOCK(?, 10) acquired", [LOCK]);
    locked = Number(lockRows?.[0]?.acquired ?? 0) === 1;
    if (!locked) throw new Error("Could not acquire migration lock");

    if (await tableExists(db, "tas_maintenance_plans")) {
      state.plansPreexisting = true;
      persist();
    } else {
      await db.query(
        "CREATE TABLE tas_maintenance_plans (" +
        "id INT NOT NULL AUTO_INCREMENT," +
        "name VARCHAR(180) NOT NULL," +
        "code VARCHAR(80) NULL," +
        "description TEXT NULL," +
        "sortOrder INT NOT NULL DEFAULT 0," +
        "isActive TINYINT NOT NULL DEFAULT 1," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "PRIMARY KEY (id)," +
        "INDEX idx_tas_maintenance_plans_active (isActive,sortOrder,id)," +
        "INDEX idx_tas_maintenance_plans_code (code)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      );
      state.plansCreated = true;
      persist();
    }

    if (await tableExists(db, "tas_maintenance_intervals")) {
      state.intervalsPreexisting = true;
      persist();
    } else {
      await db.query(
        "CREATE TABLE tas_maintenance_intervals (" +
        "id INT NOT NULL AUTO_INCREMENT," +
        "planId INT NOT NULL," +
        "mileageKm INT NOT NULL," +
        "label VARCHAR(120) NULL," +
        "durationMinutes INT NOT NULL DEFAULT 60," +
        "notes TEXT NULL," +
        "sortOrder INT NOT NULL DEFAULT 0," +
        "isActive TINYINT NOT NULL DEFAULT 1," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "PRIMARY KEY (id)," +
        "INDEX idx_tas_maintenance_intervals_plan (planId,mileageKm,id)," +
        "INDEX idx_tas_maintenance_intervals_active (planId,isActive,sortOrder,id)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
      );
      state.intervalsCreated = true;
      persist();
    }

    console.log("TAS_MAINTENANCE_PLANS_MIGRATION=PASS");
    console.log("PLANS_CREATED=" + (state.plansCreated ? "YES" : "NO"));
    console.log("INTERVALS_CREATED=" + (state.intervalsCreated ? "YES" : "NO"));
    console.log("SEED_PLANS=0");
    console.log("SEED_INTERVALS=0");
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
  console.error("TAS_MAINTENANCE_PLANS_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
