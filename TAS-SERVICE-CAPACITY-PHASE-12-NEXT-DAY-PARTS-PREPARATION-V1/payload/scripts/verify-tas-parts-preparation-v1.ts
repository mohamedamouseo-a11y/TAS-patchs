import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

function requireText(file: string, marker: string) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes(marker)) throw new Error("Missing marker in " + file + ": " + marker);
}

async function main() {
  requireText("shared/schema.ts", "tasServiceBookingItemPreparation");
  requireText("server/tasDb.ts", "getTASPartsPreparationBoard");
  requireText("server/tasDb.ts", "updateTASBookingItemPreparation");
  requireText("server/routers.ts", "getPartsPreparationBoard");
  requireText("client/src/components/tas/TASNextDayPartsPreparation.tsx", "NEXT_DAY_PREPARATION_BOARD");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    const [tableRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_booking_item_preparation'"
    );
    if (Number(tableRows?.[0]?.c ?? 0) !== 1) throw new Error("preparation table missing");

    const [indexRows] = await db.query<any[]>(
      "SELECT COUNT(DISTINCT INDEX_NAME) c FROM information_schema.STATISTICS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_booking_item_preparation' " +
      "AND INDEX_NAME IN (" +
      "'ux_tas_booking_item_preparation_item'," +
      "'idx_tas_booking_item_preparation_booking'," +
      "'idx_tas_booking_item_preparation_status'" +
      ")"
    );
    if (Number(indexRows?.[0]?.c ?? 0) !== 3) throw new Error("preparation indexes missing");

    const [counts] = await db.query<any[]>(
      "SELECT " +
      "(SELECT COUNT(*) FROM tas_service_booking_items WHERE preparationRequired=1) prepSnapshotLines, " +
      "(SELECT COUNT(*) FROM tas_service_booking_item_preparation) trackedLines"
    );

    console.log("TAS_PARTS_PREPARATION_VERIFY=PASS");
    console.log("PREP_SNAPSHOT_LINES=" + Number(counts?.[0]?.prepSnapshotLines ?? 0));
    console.log("TRACKED_LINES=" + Number(counts?.[0]?.trackedLines ?? 0));
    console.log("INVENTORY_MUTATION=NONE");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_PARTS_PREPARATION_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
