import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-plans-v1-state.json");

async function tableExists(db: mysql.Connection, table: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  if (!fs.existsSync(STATE)) {
    console.log("TAS_MAINTENANCE_PLANS_ROLLBACK=PASS");
    console.log("DROPPED_TABLES=NONE");
    console.log("ERROR=NONE");
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const dropped: string[] = [];

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    if (state.intervalsCreated && await tableExists(db, "tas_maintenance_intervals")) {
      await db.query("DROP TABLE tas_maintenance_intervals");
      dropped.push("tas_maintenance_intervals");
    }
    if (state.plansCreated && await tableExists(db, "tas_maintenance_plans")) {
      await db.query("DROP TABLE tas_maintenance_plans");
      dropped.push("tas_maintenance_plans");
    }

    console.log("TAS_MAINTENANCE_PLANS_ROLLBACK=PASS");
    console.log("DROPPED_TABLES=" + (dropped.join(",") || "NONE"));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_PLANS_ROLLBACK=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
