# TAS Service Capacity — Phase 1 Foundation Reconciliation V1

Purpose: reconcile the live TAS database with the existing Service schema before Phase 2.

Audit evidence:
- DB connection: PASS.
- `tas_branches`: exists, currently 0 rows.
- `tas_service_types`: missing.
- `tas_service_bookings`: missing.
- Current TAS master already defines both missing tables in `shared/schema.ts`.
- The current foundation migration only upgrades these tables if they already exist; it does not create them.

Safety:
- Database-only reconciliation.
- No application source changes.
- No seed data.
- No branch creation.
- No build.
- No PM2 restart.
- No deploy.
- No Git push.
- Idempotent: existing valid tables are preserved.
- Refuses to run unless the connected database already contains `tas_branches`.

Created tables match TAS master:
- `tas_service_types`
- `tas_service_bookings`

After reconciliation, run the Phase 1 V2 read-only audit again.
