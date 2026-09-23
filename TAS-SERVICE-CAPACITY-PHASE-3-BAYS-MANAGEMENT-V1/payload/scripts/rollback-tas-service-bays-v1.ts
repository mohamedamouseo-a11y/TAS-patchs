import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-service-bays-v1-state.json");
const TABLE = "tas_service_bays";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  if (!fs.existsSync(STATE)) {
    console.log("TAS_SERVICE_BAYS_ROLLBACK=PASS");
    console.log("TABLE_DROPPED=NO_STATE");
    console.log("ERROR=NONE");
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
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

    if (state.created && exists) {
      await db.query("DROP TABLE tas_service_bays");
      console.log("TAS_SERVICE_BAYS_ROLLBACK=PASS");
      console.log("TABLE_DROPPED=YES");
    } else {
      console.log("TAS_SERVICE_BAYS_ROLLBACK=PASS");
      console.log("TABLE_DROPPED=NO");
    }
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_SERVICE_BAYS_ROLLBACK=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
