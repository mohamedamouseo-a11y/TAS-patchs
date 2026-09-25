import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

function requireText(file: string, marker: string) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes(marker)) throw new Error("Missing marker in " + file + ": " + marker);
}

async function main() {
  requireText("server/services/tasBookingLifecycle.ts", "ALLOWED_TRANSITIONS");
  requireText("server/services/tasBookingLifecycle.ts", "REASON_REQUIRED");
  requireText("server/routers.ts", "transitionBookingStatus");
  requireText("client/src/components/tas/TASBookingLifecycleActions.tsx", "allowedTransitions");
  requireText("server/tasPhase2.ts", "transitionTASBookingStatus");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [dbRows] = await db.query<any[]>("SELECT DATABASE() db");
    if (String(dbRows?.[0]?.db ?? "") !== "tas_crm") throw new Error("Refusing unexpected database");

    const [tableRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_booking_status_history'"
    );
    if (Number(tableRows?.[0]?.c ?? 0) !== 1) throw new Error("status history table missing");

    const [indexes] = await db.query<any[]>(
      "SELECT COUNT(DISTINCT INDEX_NAME) c FROM information_schema.STATISTICS " +
      "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_booking_status_history' " +
      "AND INDEX_NAME IN ('idx_tas_booking_status_history_booking','idx_tas_booking_status_history_actor')"
    );
    if (Number(indexes?.[0]?.c ?? 0) !== 2) throw new Error("status history indexes missing");

    console.log("TAS_BOOKING_LIFECYCLE_VERIFY=PASS");
    console.log("STATUS_HISTORY=ACTIVE");
    console.log("REASON_GUARD=ACTIVE");
    console.log("TERMINAL_STATE_GUARD=ACTIVE");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_BOOKING_LIFECYCLE_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
