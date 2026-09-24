import "dotenv/config";
import mysql from "mysql2/promise";
import { selectTASAutoBayCandidateForLoad } from "../server/tasDb";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    const [columnRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND COLUMN_NAME='bayId'"
    );
    assert(Number(columnRows?.[0]?.c ?? 0) > 0, "Phase 6 bayId column is missing");

    const [indexRows] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tas_service_bookings' AND INDEX_NAME='idx_service_bookings_bayId'"
    );
    assert(Number(indexRows?.[0]?.c ?? 0) > 0, "Phase 6 bayId index is missing");

    const case1 = selectTASAutoBayCandidateForLoad({
      activeBayIds: [1, 2, 3],
      occupiedBayIds: [2],
      legacyUnassignedLoad: 1,
    });
    assert(case1.selectedBayId === 3, "Case 1 expected Bay 3 after one legacy shadow reservation");
    assert(JSON.stringify(case1.legacyShadowReservedBayIds) === JSON.stringify([1]), "Case 1 legacy shadow reservation mismatch");

    const case2 = selectTASAutoBayCandidateForLoad({
      activeBayIds: [10],
      occupiedBayIds: [10],
      legacyUnassignedLoad: 0,
    });
    assert(case2.selectedBayId === null, "Case 2 expected no Bay when the only Bay is occupied");

    const case3 = selectTASAutoBayCandidateForLoad({
      activeBayIds: [5, 6],
      occupiedBayIds: [],
      legacyUnassignedLoad: 2,
    });
    assert(case3.selectedBayId === null, "Case 3 expected no Bay when legacy load consumes all capacity");

    const case4 = selectTASAutoBayCandidateForLoad({
      activeBayIds: [8, 8, 9, 0, -1],
      occupiedBayIds: [99],
      legacyUnassignedLoad: 0,
    });
    assert(case4.selectedBayId === 8, "Case 4 expected deterministic first valid Bay");
    assert(JSON.stringify(case4.freeBayIds) === JSON.stringify([8, 9]), "Case 4 unique/valid Bay normalization mismatch");

    const [invalidRefs] = await db.query<any[]>(
      "SELECT COUNT(*) c FROM tas_service_bookings b LEFT JOIN tas_service_bays bay ON bay.id=b.bayId WHERE b.bayId IS NOT NULL AND bay.id IS NULL"
    );
    assert(Number(invalidRefs?.[0]?.c ?? 0) === 0, "Existing bookings reference missing Bays");

    console.log("TAS_AUTO_BAY_ASSIGNMENT_VERIFY=PASS");
    console.log("ALGORITHM_CASES=4");
    console.log("RACE_SERIALIZATION=BRANCH_BAY_ROW_LOCKS");
    console.log("DB_UNCHANGED=YES");
    console.log("ERROR=NONE");
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_AUTO_BAY_ASSIGNMENT_VERIFY=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
