# TAS Sales Schema Reconciliation V1

Additive, fail-closed repair for the Production TAS Sales schema drift exposed by the RBAC V3 post-deploy read-only acceptance checks.

## Why this patch exists

The current TAS runtime code references the advanced Sales tables below, while the legacy Production database may not contain them. Existing historical migration scripts partly assume `tas_sales_quotations` already exists, so blindly replaying the old migration chain is not a safe reconciliation strategy.

## Canonical advanced Sales tables

1. `tas_vehicle_interests`
2. `tas_sales_quotations`
3. `tas_test_drives`
4. `tas_sales_tasks`
5. `tas_trade_ins`
6. `tas_vehicle_inventory`
7. `tas_sales_finance_applications`

The definitions are aligned to the current `drizzle/schema.ts` runtime model and the current `server/tasSales.ts` queries.

## Safety model

- Dry-run is the default.
- Production DDL requires the explicit `--apply` flag.
- `TAS_EXPECTED_DATABASE_NAME` is mandatory and must match `SELECT DATABASE()`.
- Required TAS foundation tables must already exist.
- Existing complete advanced tables are left untouched.
- Existing partial advanced tables cause a fail-closed stop; this patch does not silently ALTER them.
- Missing advanced tables are created with `CREATE TABLE IF NOT EXISTS` only.
- No seed, backfill, role mutation, application DML, destructive SQL, or data deletion is performed.
- A MySQL advisory lock protects the apply phase from concurrent execution.

## Patch installation into an isolated TAS candidate

```bash
node TAS-SALES-SCHEMA-RECONCILIATION-V1/scripts/apply-tas-sales-schema-reconciliation-v1-patch.mjs --target <ISOLATED_TAS_CANDIDATE>
```

## Read-only preflight

```bash
pnpm exec tsx scripts/apply-tas-sales-schema-reconciliation-v1.ts
```

Expected marker:

```text
TAS_SALES_SCHEMA_DRY_RUN=PASS
```

## Explicit additive apply

Only after the preflight matches the expected missing-table drift and a database/schema backup has been captured:

```bash
pnpm exec tsx scripts/apply-tas-sales-schema-reconciliation-v1.ts --apply
```

Expected marker:

```text
TAS_SALES_SCHEMA_RECONCILIATION=PASS
```

## Read-only verification

```bash
pnpm exec tsx scripts/verify-tas-sales-schema-reconciliation-v1.ts
```

Expected marker:

```text
TAS_SALES_SCHEMA_VERIFY=PASS
```

After schema verification, rerun the RBAC V3 read-only runtime acceptance checks, especially the public shared quotation invalid-token path and the authenticated Admin TAS Sales pipeline read path. Neither should fail with missing-table HTTP 500 errors.
