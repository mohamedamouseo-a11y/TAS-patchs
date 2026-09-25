import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const STATE = path.join(process.cwd(), "storage", "migrations", "tas-maintenance-items-costs-v1-state.json");
const TABLES = [
  "tas_maintenance_items",
  "tas_maintenance_interval_items",
  "tas_service_booking_items",
] as const;

async function tableExists(db: mysql.Connection, table: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
    [table],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const state: any = { version: 1, tables: {} };
  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    for (const table of TABLES) {
      state.tables[table] = (await tableExists(db, table)) ? "preexisting" : "pending";
      persist();
    }

    if (state.tables.tas_maintenance_items === "pending") {
      await db.query(
        "CREATE TABLE tas_maintenance_items (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "code VARCHAR(80) NULL," +
        "name VARCHAR(180) NOT NULL," +
        "itemType VARCHAR(40) NOT NULL," +
        "unit VARCHAR(40) NOT NULL DEFAULT 'unit'," +
        "partNumber VARCHAR(120) NULL," +
        "defaultUnitCostEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "defaultUnitPriceEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "defaultVatRatePct DECIMAL(5,2) NOT NULL DEFAULT 0.00," +
        "preparationRequired TINYINT NOT NULL DEFAULT 0," +
        "notes TEXT NULL," +
        "sortOrder INT NOT NULL DEFAULT 0," +
        "isActive TINYINT NOT NULL DEFAULT 1," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "UNIQUE KEY ux_tas_maintenance_items_code (code)," +
        "INDEX idx_tas_maintenance_items_active (isActive, sortOrder, id)," +
        "INDEX idx_tas_maintenance_items_type (itemType, isActive, id)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      );
      state.tables.tas_maintenance_items = "created";
      persist();
    }

    if (state.tables.tas_maintenance_interval_items === "pending") {
      await db.query(
        "CREATE TABLE tas_maintenance_interval_items (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "intervalId INT NOT NULL," +
        "itemId INT NOT NULL," +
        "action VARCHAR(40) NOT NULL," +
        "quantity DECIMAL(10,3) NOT NULL DEFAULT 1.000," +
        "unitCostEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "unitPriceEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "vatRatePct DECIMAL(5,2) NOT NULL DEFAULT 0.00," +
        "preparationRequired TINYINT NOT NULL DEFAULT 0," +
        "notes TEXT NULL," +
        "sortOrder INT NOT NULL DEFAULT 0," +
        "isActive TINYINT NOT NULL DEFAULT 1," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "INDEX idx_tas_maintenance_interval_items_interval (intervalId, isActive, sortOrder, id)," +
        "INDEX idx_tas_maintenance_interval_items_item (itemId, isActive, id)," +
        "INDEX idx_tas_maintenance_interval_items_prep (preparationRequired, isActive, intervalId)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      );
      state.tables.tas_maintenance_interval_items = "created";
      persist();
    }

    if (state.tables.tas_service_booking_items === "pending") {
      await db.query(
        "CREATE TABLE tas_service_booking_items (" +
        "id INT NOT NULL AUTO_INCREMENT PRIMARY KEY," +
        "bookingId INT NOT NULL," +
        "intervalItemId INT NULL," +
        "itemId INT NULL," +
        "itemCode VARCHAR(80) NULL," +
        "itemName VARCHAR(180) NOT NULL," +
        "itemType VARCHAR(40) NOT NULL," +
        "action VARCHAR(40) NOT NULL," +
        "unit VARCHAR(40) NOT NULL DEFAULT 'unit'," +
        "quantity DECIMAL(10,3) NOT NULL DEFAULT 1.000," +
        "unitCostEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "unitPriceEgp DECIMAL(12,2) NOT NULL DEFAULT 0.00," +
        "vatRatePct DECIMAL(5,2) NOT NULL DEFAULT 0.00," +
        "preparationRequired TINYINT NOT NULL DEFAULT 0," +
        "notes TEXT NULL," +
        "createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
        "INDEX idx_tas_service_booking_items_booking (bookingId, id)," +
        "INDEX idx_tas_service_booking_items_prep (preparationRequired, bookingId, itemId)," +
        "INDEX idx_tas_service_booking_items_item (itemId, bookingId)" +
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
      );
      state.tables.tas_service_booking_items = "created";
      persist();
    }

    console.log("TAS_MAINTENANCE_ITEMS_COSTS_MIGRATION=PASS");
    console.log("TABLES_READY=3");
    console.log("ERROR=NONE");
  } catch (error) {
    persist();
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_ITEMS_COSTS_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
