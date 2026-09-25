import "dotenv/config";
import mysql from "mysql2/promise";

const requiredColumns = [
  "vehicleId",
  "mileageKm",
  "maintenanceMappingId",
  "maintenancePlanId",
  "maintenanceIntervalId",
  "plannedDurationMinutes",
];

const requiredIndexes = [
  "idx_service_bookings_vehicleId",
  "idx_service_bookings_maintenanceIntervalId",
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    for (const column of requiredColumns) {
      const [rows] = await db.execute<any[]>(
        "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND COLUMN_NAME=?",
        [column],
      );
      if (Number(rows?.[0]?.c ?? 0) === 0) throw new Error("Missing booking column: " + column);
    }

    for (const indexName of requiredIndexes) {
      const [rows] = await db.execute<any[]>(
        "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND INDEX_NAME=?",
        [indexName],
      );
      if (Number(rows?.[0]?.c ?? 0) === 0) throw new Error("Missing booking index: " + indexName);
    }

    const [invalidRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_service_bookings b " +
      "LEFT JOIN tas_vehicles v ON v.id=b.vehicleId " +
      "LEFT JOIN tas_maintenance_vehicle_mappings m ON m.id=b.maintenanceMappingId " +
      "LEFT JOIN tas_maintenance_plans p ON p.id=b.maintenancePlanId " +
      "LEFT JOIN tas_maintenance_intervals i ON i.id=b.maintenanceIntervalId " +
      "WHERE (b.vehicleId IS NOT NULL AND v.id IS NULL) " +
      "OR (b.maintenanceMappingId IS NOT NULL AND m.id IS NULL) " +
      "OR (b.maintenancePlanId IS NOT NULL AND p.id IS NULL) " +
      "OR (b.maintenanceIntervalId IS NOT NULL AND i.id IS NULL)"
    );
    if (Number(invalidRows?.[0]?.c ?? 0) > 0) throw new Error("Invalid existing premium booking references found");

    const [counts] = await db.query<any[]>(
      "SELECT COUNT(*) totalBookings, " +
      "SUM(CASE WHEN vehicleId IS NOT NULL THEN 1 ELSE 0 END) vehicleContextBookings, " +
      "SUM(CASE WHEN maintenanceIntervalId IS NOT NULL THEN 1 ELSE 0 END) maintenanceContextBookings " +
      "FROM tas_service_bookings"
    );

    console.log("TAS_PREMIUM_BOOKING_VERIFY=PASS");
    console.log("TOTAL_BOOKINGS=" + Number(counts?.[0]?.totalBookings ?? 0));
    console.log("VEHICLE_CONTEXT_BOOKINGS=" + Number(counts?.[0]?.vehicleContextBookings ?? 0));
    console.log("MAINTENANCE_CONTEXT_BOOKINGS=" + Number(counts?.[0]?.maintenanceContextBookings ?? 0));
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_PREMIUM_BOOKING_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
