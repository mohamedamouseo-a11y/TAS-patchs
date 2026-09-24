import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const LOCK = "tas-availability-engine-v2";
const STATE = path.join(process.cwd(), "storage", "migrations", "tas-availability-engine-v2-state.json");

async function columnExists(db: mysql.Connection, table: string, column: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
    [table, column],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function indexExists(db: mysql.Connection, table: string, indexName: string) {
  const [rows] = await db.execute<any[]>(
    "SELECT COUNT(*) c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?",
    [table, indexName],
  );
  return Number(rows?.[0]?.c ?? 0) > 0;
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const db = await mysql.createConnection(process.env.DATABASE_URL);
  let locked = false;
  const state = {
    version: 1,
    bayIdCreated: false,
    bayIdPreexisting: false,
    bayIdIndexCreated: false,
    bayIdIndexPreexisting: false,
  };

  const persist = () => {
    fs.mkdirSync(path.dirname(STATE), { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  };

  try {
    const [databaseRows] = await db.query<any[]>("SELECT DATABASE() db");
    const databaseName = String(databaseRows?.[0]?.db ?? "");
    if (databaseName !== "tas_crm") throw new Error("Refusing unexpected database: " + (databaseName || "<none>"));

    for (const required of ["tas_service_bookings", "tas_service_bays", "tas_branches", "tas_service_types"]) {
      const [rows] = await db.execute<any[]>(
        "SELECT COUNT(*) c FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [required],
      );
      if (Number(rows?.[0]?.c ?? 0) === 0) throw new Error("Required table missing: " + required);
    }

    const [lockRows] = await db.query<any[]>("SELECT GET_LOCK(?, 10) acquired", [LOCK]);
    locked = Number(lockRows?.[0]?.acquired ?? 0) === 1;
    if (!locked) throw new Error("Could not acquire migration lock");

    if (await columnExists(db, "tas_service_bookings", "bayId")) {
      state.bayIdPreexisting = true;
      persist();
    } else {
      await db.query("ALTER TABLE tas_service_bookings ADD COLUMN bayId INT NULL AFTER serviceTypeId");
      state.bayIdCreated = true;
      persist();
    }

    if (await indexExists(db, "tas_service_bookings", "idx_service_bookings_bayId")) {
      state.bayIdIndexPreexisting = true;
      persist();
    } else {
      await db.query("CREATE INDEX idx_service_bookings_bayId ON tas_service_bookings (bayId)");
      state.bayIdIndexCreated = true;
      persist();
    }

    console.log("TAS_AVAILABILITY_ENGINE_V2_MIGRATION=PASS");
    console.log("BAY_ID_CREATED=" + (state.bayIdCreated ? "YES" : "NO"));
    console.log("BAY_ID_INDEX_CREATED=" + (state.bayIdIndexCreated ? "YES" : "NO"));
    console.log("ERROR=NONE");
  } catch (error) {
    persist();
    throw error;
  } finally {
    if (locked) await db.query("SELECT RELEASE_LOCK(?)", [LOCK]).catch(() => undefined);
    await db.end();
  }
}

main().catch((error) => {
  console.error("TAS_AVAILABILITY_ENGINE_V2_MIGRATION=FAIL");
  console.error("ERROR=" + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
});
