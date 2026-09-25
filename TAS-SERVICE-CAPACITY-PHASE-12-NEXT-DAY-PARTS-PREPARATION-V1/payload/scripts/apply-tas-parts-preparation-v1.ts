import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-parts-preparation-v1-state.json");
const TABLE = "tas_service_booking_item_preparation";

async function tableExists(db: mysql.Connection) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [TABLE],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const state: any = { version: 1, table: "pending" };
  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    const exists = await tableExists(db);
    state.table = exists ? "preexisting" : "pending";
    persist();

    if (!exists) {
      await db.query(
        "CREATE TABLE tas_service_booking_item_preparation (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "bookingItemId INT NOT NULL," +
        "bookingId INT NOT NULL," +
        "status VARCHAR(30) NOT NULL DEFAULT 'Pending'," +
        "preparedQuantity DECIMAL(10,3) NOT NULL DEFAULT 0.000," +
        "notes TEXT NULL," +
        "updatedByUserId INT NULL," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "UNIQUE KEY ux_tas_booking_item_preparation_item (bookingItemId)," +
        "INDEX idx_tas_booking_item_preparation_booking (bookingId, status, bookingItemId)," +
        "INDEX idx_tas_booking_item_preparation_status (status, updatedAt)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      );
      state.table = "created";
      persist();
    }

    console.log("TAS_PARTS_PREPARATION_MIGRATION=PASS");
    console.log("PREPARATION_TABLE=READY");
    console.log("ERROR=NONE");
  } catch (error) {
    persist();
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_PARTS_PREPARATION_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
