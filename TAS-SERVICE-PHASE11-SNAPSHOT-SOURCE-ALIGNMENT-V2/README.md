# TAS Phase 11 Snapshot Source Alignment V2

This patch aligns booking snapshot source semantics with the Maintenance Items & Costs package shown in TAS.

Problem addressed:
- The package UI reads active interval lines from tas_maintenance_interval_items.
- Snapshot creation was stricter because it additionally required the maintenance item master row itself to be active.
- That mismatch can make TAS show a package line in the UI while snapshot creation sees zero source rows.

Change:
- Snapshot creation now uses the same active interval-line semantics as the package UI.
- If Phase 11 Snapshot Creation Hardening V1 is present, its expected-row integrity count is aligned to the same source semantics.
- No existing bookings are changed or backfilled.
- No schema/data migration.
