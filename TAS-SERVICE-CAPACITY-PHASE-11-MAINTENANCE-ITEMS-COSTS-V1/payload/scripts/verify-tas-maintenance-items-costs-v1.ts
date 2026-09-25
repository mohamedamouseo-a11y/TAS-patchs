import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

function requireText(file: string, marker: string) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes(marker)) throw new Error("Missing marker in " + file + ": " + marker);
}

async function main() {
  requireText("shared/schema.ts", "tasMaintenanceItems");
  requireText("shared/schema.ts", "tasMaintenanceIntervalItems");
  requireText("shared/schema.ts", "tasServiceBookingItems");
  requireText("server/tasDb.ts", "getTASMaintenanceIntervalPackage");
  requireText("server/tasDb.ts", "snapshotTASMaintenancePackageForBooking");
  requireText("server/routers.ts", "getMaintenanceIntervalPackage");
  requireText("client/src/components/tas/TASMaintenanceItemsCostsSettings.tsx", "PACKAGE_TOTALS");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    for (const table of [
      "tas_maintenance_items",
      "tas_maintenance_interval_items",
      "tas_service_booking_items",
    ]) {
      const [rows] = await db.execute<any[]>(
        "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [table],
      );
      if (Number(rows?.[0]?.c ?? 0) !== 1) throw new Error("Missing table: " + table);
    }

    const [counts] = await db.query<any[]>(
      "SELECT " +
      "(SELECT COUNT(*) FROM tas_maintenance_items) itemCount, " +
      "(SELECT COUNT(*) FROM tas_maintenance_interval_items) packageLineCount, " +
      "(SELECT COUNT(*) FROM tas_service_booking_items) bookingSnapshotCount"
    );

    console.log("TAS_MAINTENANCE_ITEMS_COSTS_VERIFY=PASS");
    console.log("ITEM_COUNT=" + Number(counts?.[0]?.itemCount ?? 0));
    console.log("PACKAGE_LINE_COUNT=" + Number(counts?.[0]?.packageLineCount ?? 0));
    console.log("BOOKING_SNAPSHOT_COUNT=" + Number(counts?.[0]?.bookingSnapshotCount ?? 0));
    console.log("SOURCE_DATA_SEED=NOT_INCLUDED_BY_DESIGN");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_MAINTENANCE_ITEMS_COSTS_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
