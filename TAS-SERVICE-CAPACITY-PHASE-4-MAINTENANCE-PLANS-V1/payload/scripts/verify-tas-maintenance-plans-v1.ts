import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-plans-v1-state.json");
const PLAN_COLUMNS = ["id","name","code","description","sortOrder","isActive","createdAt","updatedAt"];
const INTERVAL_COLUMNS = ["id","planId","mileageKm","label","durationMinutes","notes","sortOrder","isActive","createdAt","updatedAt"];

async function getColumns(db: mysql.Connection, table: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COLUMN_NAME name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  return new Set(rows.map((row) => String(row.name)));
}

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

    const state = fs.existsSync(STATE)
      ? JSON.parse(fs.readFileSync(STATE, "utf8"))
      : { plansCreated: false, plansPreexisting: false, intervalsCreated: false, intervalsPreexisting: false };

    const plansExist = await tableExists(db, "tas_maintenance_plans");
    const intervalsExist = await tableExists(db, "tas_maintenance_intervals");

    if (rolledBack) {
      if (state.plansCreated && plansExist) throw new Error("Rollback left migration-created plans table");
      if (state.intervalsCreated && intervalsExist) throw new Error("Rollback left migration-created intervals table");
      if (state.plansPreexisting && !plansExist) throw new Error("Rollback removed preexisting plans table");
      if (state.intervalsPreexisting && !intervalsExist) throw new Error("Rollback removed preexisting intervals table");
      console.log("TAS_MAINTENANCE_PLANS_ROLLBACK_VERIFY=PASS");
      console.log("ERROR=NONE");
      return;
    }

    if (!plansExist) throw new Error("Missing table: tas_maintenance_plans");
    if (!intervalsExist) throw new Error("Missing table: tas_maintenance_intervals");

    const planColumns = await getColumns(db, "tas_maintenance_plans");
    const intervalColumns = await getColumns(db, "tas_maintenance_intervals");
    for (const name of PLAN_COLUMNS) if (!planColumns.has(name)) throw new Error("Missing maintenance plan column: " + name);
    for (const name of INTERVAL_COLUMNS) if (!intervalColumns.has(name)) throw new Error("Missing maintenance interval column: " + name);

    const [invalidPlans] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_maintenance_plans WHERE TRIM(name)='' OR sortOrder < -100000 OR sortOrder > 100000 OR isActive NOT IN (0,1)"
    );
    if (Number(invalidPlans?.[0]?.c ?? 0) > 0) throw new Error("Invalid maintenance plan rows detected");

    const [invalidIntervals] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_maintenance_intervals i LEFT JOIN tas_maintenance_plans p ON p.id=i.planId " +
      "WHERE p.id IS NULL OR i.mileageKm < 0 OR i.mileageKm > 2000000 OR i.durationMinutes < 15 OR i.durationMinutes > 2880 " +
      "OR i.sortOrder < -100000 OR i.sortOrder > 2000000 OR i.isActive NOT IN (0,1)"
    );
    if (Number(invalidIntervals?.[0]?.c ?? 0) > 0) throw new Error("Invalid maintenance interval rows detected");

    const [counts] = await db.query<any[]>(
      "SELECT (SELECT COUNT(*) FROM tas_maintenance_plans) plans, (SELECT COUNT(*) FROM tas_maintenance_intervals) intervals"
    );
    console.log("TAS_MAINTENANCE_PLANS_VERIFY=PASS");
    console.log("PLAN_ROWS=" + Number(counts?.[0]?.plans ?? 0));
    console.log("INTERVAL_ROWS=" + Number(counts?.[0]?.intervals ?? 0));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_PLANS_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
