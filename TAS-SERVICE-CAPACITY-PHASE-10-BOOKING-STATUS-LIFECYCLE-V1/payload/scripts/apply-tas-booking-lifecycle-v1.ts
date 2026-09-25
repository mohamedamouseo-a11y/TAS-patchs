import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-booking-lifecycle-v1-state.json");
const TABLE = "tas_service_booking_status_history";

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const state: any = { version: 1, tableCreated: false };
  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };
  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    const [rows] = await db.execute<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [TABLE],
    );
    const exists = Number(rows?.[0]?.c ?? 0) > 0;
    if (!exists) {
      await db.query(
        "CREATE TABLE tas_service_booking_status_history (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "bookingId INT NOT NULL," +
        "fromStatus VARCHAR(40) NOT NULL," +
        "toStatus VARCHAR(40) NOT NULL," +
        "reason TEXT NULL," +
        "actorUserId INT NULL," +
        "actorRole VARCHAR(120) NULL," +
        "source VARCHAR(80) NOT NULL DEFAULT 'ServiceUI'," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "INDEX idx_tas_booking_status_history_booking (bookingId, createdAt, id)," +
        "INDEX idx_tas_booking_status_history_actor (actorUserId, createdAt)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      );
      state.tableCreated = true;
      persist();
    } else {
      persist();
    }
    console.log("TAS_BOOKING_LIFECYCLE_MIGRATION=PASS");
    console.log("STATUS_HISTORY_TABLE=READY");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_BOOKING_LIFECYCLE_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
