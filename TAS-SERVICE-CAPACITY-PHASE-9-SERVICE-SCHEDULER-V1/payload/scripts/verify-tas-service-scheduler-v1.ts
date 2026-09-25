import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

function requireText(file: string, marker: string) {
  const content = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  if (!content.includes(marker)) throw new Error(`Missing marker in ${file}: ${marker}`);
}

async function main() {
  requireText("server/tasDb.ts", "schedulerVersion: 1");
  requireText("server/tasDb.ts", 'laneType === "bay"');
  requireText("server/routers.ts", "getTASServiceScheduler");
  requireText("client/src/components/tas/TASServiceScheduler.tsx", "UNASSIGNED");
  requireText("client/src/components/tas/TASServiceScheduler.tsx", "Bay exception");
  requireText("client/src/pages/tas/TASServicePage.tsx", "<TASServiceScheduler />");

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const [tableRows] = await db.query<any[]>(
      "SELECT " +
      "(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_branches') branchesTable, " +
      "(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bays') baysTable, " +
      "(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings') bookingsTable"
    );
    const tables = tableRows?.[0] ?? {};
    if (Number(tables.branchesTable ?? 0) !== 1) throw new Error("tas_branches missing");
    if (Number(tables.baysTable ?? 0) !== 1) throw new Error("tas_service_bays missing");
    if (Number(tables.bookingsTable ?? 0) !== 1) throw new Error("tas_service_bookings missing");

    const [counts] = await db.query<any[]>(
      "SELECT " +
      "(SELECT COUNT(*) FROM tas_branches) branchCount, " +
      "(SELECT COUNT(*) FROM tas_service_bays WHERE isActive=1) activeBayCount, " +
      "(SELECT COUNT(*) FROM tas_service_bookings) bookingCount"
    );

    console.log("TAS_SERVICE_SCHEDULER_VERIFY=PASS");
    console.log("BRANCH_COUNT=" + Number(counts?.[0]?.branchCount ?? 0));
    console.log("ACTIVE_BAY_COUNT=" + Number(counts?.[0]?.activeBayCount ?? 0));
    console.log("BOOKING_COUNT=" + Number(counts?.[0]?.bookingCount ?? 0));
    console.log("DB_MUTATION=NONE");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_SERVICE_SCHEDULER_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
