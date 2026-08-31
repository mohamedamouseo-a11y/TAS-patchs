# TAS Automotive Catalog Save Hotfix V1

Standalone additive hotfix for the `/automotive/catalog` vehicle-save failure seen when the current TAS runtime inserts into a legacy/partial `automotive_vehicles` schema.

## What this fixes

1. Reconciles missing runtime columns used by `server/automotiveCatalogCompat.ts` when creating/updating vehicles.
2. Keeps existing `automotive_vehicles` data and existing column definitions untouched.
3. Fails closed if the base table or required base columns (`id`, `brand`, `model`) are missing.
4. Replaces the raw database/SQL error shown by `VehicleCatalogPage` with a safe user-facing message while keeping the detailed error in the browser console for diagnosis.

## Safety model

- Patch installation does **not** execute database DDL.
- Database reconciliation is dry-run by default.
- DDL requires the explicit `--apply` flag.
- `TAS_EXPECTED_DATABASE_NAME` is mandatory and must equal `SELECT DATABASE()`.
- Existing columns are never modified or dropped.
- Missing runtime columns are added only.
- No vehicle rows are deleted, rewritten, seeded, or backfilled.
- A MySQL advisory lock protects the apply phase.

## 1. Install into an isolated TAS candidate

Run from the `TAS-patchs` checkout:

```bash
node TAS-AUTOMOTIVE-CATALOG-SAVE-HOTFIX-V1/scripts/apply-tas-automotive-catalog-save-hotfix-v1-patch.mjs --target <ISOLATED_TAS_CANDIDATE>
```

Expected marker:

```text
TAS_AUTOMOTIVE_CATALOG_SAVE_PATCH_APPLY=PASS
```

## 2. Read-only database preflight

From the patched TAS candidate:

```bash
export TAS_EXPECTED_DATABASE_NAME='<expected_database_name>'
pnpm exec tsx scripts/apply-tas-automotive-catalog-schema-v1.ts
```

Expected marker:

```text
TAS_AUTOMOTIVE_CATALOG_SCHEMA_DRY_RUN=PASS
```

The command prints exactly which runtime columns are missing.

## 3. Apply the additive reconciliation

Take/confirm a database backup first, then run:

```bash
pnpm exec tsx scripts/apply-tas-automotive-catalog-schema-v1.ts --apply
```

Expected marker:

```text
TAS_AUTOMOTIVE_CATALOG_SCHEMA_RECONCILIATION=PASS
```

## 4. Verify

```bash
pnpm exec tsx scripts/verify-tas-automotive-catalog-schema-v1.ts
pnpm check
```

Expected schema marker:

```text
TAS_AUTOMOTIVE_CATALOG_SCHEMA_VERIFY=PASS
```

## 5. Functional acceptance

Open `/automotive/catalog`, choose **Add vehicle / إضافة سيارة**, select a valid brand, enter a model, save, and confirm:

- the vehicle is persisted and appears in the catalog after refresh;
- no `Failed query: INSERT INTO automotive_vehicles` SQL text is shown to the user;
- existing vehicles remain unchanged;
- edit and image actions remain available for persisted vehicles.

## Rollback

The UI sanitization can be reverted through source control. The database part is additive-only; do not drop newly added columns blindly after production has begun writing to them. If rollback is required, restore the pre-change database backup or assess column usage before any schema removal.
