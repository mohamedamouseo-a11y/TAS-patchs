import path from "node:path";
import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";
import {
  TAS_SALES_SCHEMA_FOUNDATION_TABLES,
  TAS_SALES_SCHEMA_TABLES,
} from "./tas-sales-schema-reconciliation-v1-spec";

dotenvConfig({ path: path.join(process.cwd(), ".env"), override: false });

const APPLY = process.argv.includes("--apply");
const LOCK_NAME = "tas_sales_schema_reconciliation_v1";

type Connection = mysql.Connection;
type Inspection = {
  table: string;
  state: "missing" | "complete" | "partial";
  missingColumns: string[];
};

async function tableExists(connection: Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS total
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

async function columnsFor(connection: Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION`,
    [tableName],
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME)));
}

async function currentDatabase(connection: Connection) {
  const [rows] = await connection.query<any[]>("SELECT DATABASE() AS databaseName");
  return String(rows[0]?.databaseName ?? "");
}

async function assertExpectedDatabase(connection: Connection) {
  const expected = String(process.env.TAS_EXPECTED_DATABASE_NAME ?? "").trim();
  if (!expected) throw new Error("TAS_EXPECTED_DATABASE_NAME is required");
  const actual = await currentDatabase(connection);
  if (!actual || actual !== expected) {
    throw new Error(`Database identity mismatch: expected=${expected || "<empty>"} actual=${actual || "<empty>"}`);
  }
  return actual;
}

async function assertFoundation(connection: Connection) {
  const missing: string[] = [];
  for (const table of TAS_SALES_SCHEMA_FOUNDATION_TABLES) {
    if (!(await tableExists(connection, table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(`Required TAS foundation tables are missing: ${missing.join(", ")}`);
  }
}

async function inspect(connection: Connection): Promise<Inspection[]> {
  const result: Inspection[] = [];
  for (const spec of TAS_SALES_SCHEMA_TABLES) {
    if (!(await tableExists(connection, spec.name))) {
      result.push({ table: spec.name, state: "missing", missingColumns: [...spec.requiredColumns] });
      continue;
    }
    const columns = await columnsFor(connection, spec.name);
    const missingColumns = spec.requiredColumns.filter((column) => !columns.has(column));
    result.push({
      table: spec.name,
      state: missingColumns.length ? "partial" : "complete",
      missingColumns,
    });
  }
  return result;
}

function printInspection(databaseName: string, rows: Inspection[]) {
  console.log(`TAS_SALES_SCHEMA_DATABASE=${databaseName}`);
  for (const row of rows) {
    console.log(
      `TAS_SALES_SCHEMA_TABLE table=${row.table} state=${row.state}` +
        (row.missingColumns.length ? ` missingColumns=${row.missingColumns.join(",")}` : ""),
    );
  }
}

function assertNoPartialTables(rows: Inspection[]) {
  const partial = rows.filter((row) => row.state === "partial");
  if (partial.length) {
    throw new Error(
      `Fail-closed: existing TAS sales tables are structurally partial: ${partial
        .map((row) => `${row.table}[${row.missingColumns.join(",")}]`)
        .join("; ")}`,
    );
  }
}

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL ?? "").trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const connection = await mysql.createConnection(databaseUrl);
  let lockAcquired = false;
  try {
    const databaseName = await assertExpectedDatabase(connection);
    await assertFoundation(connection);

    const before = await inspect(connection);
    printInspection(databaseName, before);
    assertNoPartialTables(before);

    const missingBefore = before.filter((row) => row.state === "missing").map((row) => row.table);
    if (!APPLY) {
      console.log(`TAS_SALES_SCHEMA_DRY_RUN=PASS missing=${missingBefore.length} tables=${missingBefore.join(",") || "none"}`);
      return;
    }

    const [lockRows] = await connection.query<any[]>("SELECT GET_LOCK(?, 30) AS acquired", [LOCK_NAME]);
    lockAcquired = Number(lockRows[0]?.acquired ?? 0) === 1;
    if (!lockAcquired) throw new Error("Could not acquire TAS sales schema reconciliation lock");

    // Re-inspect under the advisory lock so the decision cannot be based on stale preflight state.
    const lockedState = await inspect(connection);
    assertNoPartialTables(lockedState);

    const created: string[] = [];
    for (const spec of TAS_SALES_SCHEMA_TABLES) {
      const state = lockedState.find((row) => row.table === spec.name);
      if (state?.state === "complete") continue;
      if (state?.state !== "missing") throw new Error(`Unexpected schema state for ${spec.name}`);
      console.log(`TAS_SALES_SCHEMA_CREATE=${spec.name}`);
      await connection.query(spec.ddl);
      created.push(spec.name);
    }

    const after = await inspect(connection);
    printInspection(databaseName, after);
    assertNoPartialTables(after);
    const remainingMissing = after.filter((row) => row.state !== "complete");
    if (remainingMissing.length) {
      throw new Error(`Schema reconciliation incomplete: ${remainingMissing.map((row) => row.table).join(", ")}`);
    }

    console.log(`TAS_SALES_SCHEMA_RECONCILIATION=PASS created=${created.length} tables=${created.join(",") || "none"}`);
  } finally {
    if (lockAcquired) {
      await connection.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    }
    await connection.end();
  }
}

main().catch((error) => {
  console.error("TAS_SALES_SCHEMA_RECONCILIATION=FAIL", error);
  process.exit(1);
});
