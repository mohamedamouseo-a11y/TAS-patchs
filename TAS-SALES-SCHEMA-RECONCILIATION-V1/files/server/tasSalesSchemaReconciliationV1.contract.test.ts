import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TAS_SALES_SCHEMA_FOUNDATION_TABLES,
  TAS_SALES_SCHEMA_TABLES,
} from "../scripts/tas-sales-schema-reconciliation-v1-spec";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const expectedTables = [
  "tas_vehicle_interests",
  "tas_sales_quotations",
  "tas_test_drives",
  "tas_sales_tasks",
  "tas_trade_ins",
  "tas_vehicle_inventory",
  "tas_sales_finance_applications",
];

const destructiveOrDataChangingStatement = /(?:^|;)\s*(?:DROP|TRUNCATE|RENAME|ALTER|DELETE\s+FROM|UPDATE\s+[`\w]+|INSERT\s+INTO)\b/im;

describe("TAS Sales Schema Reconciliation V1", () => {
  it("covers the complete advanced TAS sales runtime table set", () => {
    expect(TAS_SALES_SCHEMA_TABLES.map((table) => table.name)).toEqual(expectedTables);
    expect(TAS_SALES_SCHEMA_TABLES).toHaveLength(7);
  });

  it("uses only additive create-if-missing DDL", () => {
    for (const spec of TAS_SALES_SCHEMA_TABLES) {
      expect(spec.ddl).toContain(`CREATE TABLE IF NOT EXISTS ${spec.name}`);
      expect(spec.ddl).not.toMatch(destructiveOrDataChangingStatement);
      expect(spec.requiredColumns).toContain("id");
      expect(spec.requiredColumns).toContain("createdAt");
      expect(spec.requiredColumns).toContain("updatedAt");
    }
  });

  it("fails closed on wrong database identity and partial existing tables", () => {
    const migration = read("scripts/apply-tas-sales-schema-reconciliation-v1.ts");
    expect(migration).toContain("TAS_EXPECTED_DATABASE_NAME is required");
    expect(migration).toContain("Database identity mismatch");
    expect(migration).toContain("Fail-closed: existing TAS sales tables are structurally partial");
    expect(migration).toContain("SELECT GET_LOCK(?, 30)");
    expect(migration).toContain("SELECT RELEASE_LOCK(?)");
  });

  it("defaults to dry-run and requires an explicit --apply flag for DDL", () => {
    const migration = read("scripts/apply-tas-sales-schema-reconciliation-v1.ts");
    expect(migration).toContain('const APPLY = process.argv.includes("--apply")');
    expect(migration).toContain("TAS_SALES_SCHEMA_DRY_RUN=PASS");
    expect(migration).toContain("TAS_SALES_SCHEMA_RECONCILIATION=PASS");
  });

  it("requires the existing TAS foundation before creating advanced sales tables", () => {
    expect(TAS_SALES_SCHEMA_FOUNDATION_TABLES).toEqual([
      "users",
      "leads",
      "tas_vehicles",
      "tas_branches",
      "tas_conversations",
      "tas_sales_handovers",
    ]);
  });

  it("ships a read-only post-migration verifier", () => {
    const verifier = read("scripts/verify-tas-sales-schema-reconciliation-v1.ts");
    expect(verifier).toContain("INFORMATION_SCHEMA.TABLES");
    expect(verifier).toContain("INFORMATION_SCHEMA.COLUMNS");
    expect(verifier).toContain("TAS_SALES_SCHEMA_VERIFY=PASS");
    expect(verifier).not.toMatch(destructiveOrDataChangingStatement);
  });
});
