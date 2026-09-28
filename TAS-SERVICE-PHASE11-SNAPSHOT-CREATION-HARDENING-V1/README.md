# TAS Phase 11 Snapshot Creation Hardening V1

Purpose: harden Premium Service Booking snapshot creation without backfilling historical bookings.

The patch:
- uses the exact validated maintenanceIntervalId for snapshot creation;
- invokes snapshot creation inside the booking transaction;
- counts active package lines before snapshotting;
- verifies the booking snapshot row count before the transaction can commit;
- fails/rolls back instead of silently creating a maintenance booking without its required snapshot when package lines exist;
- does not touch bookings #15/#16 or any existing data;
- does not stage, commit, or push TAS source changes.

After deploy, create a new UAT booking to validate the snapshot end-to-end.
