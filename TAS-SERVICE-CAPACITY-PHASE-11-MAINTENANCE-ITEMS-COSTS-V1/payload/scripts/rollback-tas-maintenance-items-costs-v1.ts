import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-items-costs-v1-state.json");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!fs.existsSync(STATE)) {
    console.log("TAS_MAINTENANCE_ITEMS_COSTS_ROLLBACK=PASS");
    console.log("CHANGES_REVERTED=NO_STATE");
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    for (const table of [
      "tas_service_booking_items",
      "tas_maintenance_interval_items",
      "tas_maintenance_items",
    ]) {
      if (state.tables?.[table] === "created") {
        await db.query("DROP TABLE IF EXISTS " + table);
      }
    }

    console.log("TAS_MAINTENANCE_ITEMS_COSTS_ROLLBACK=PASS");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_ITEMS_COSTS_ROLLBACK=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
