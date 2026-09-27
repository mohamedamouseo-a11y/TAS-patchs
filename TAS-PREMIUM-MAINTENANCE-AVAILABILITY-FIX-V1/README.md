# TAS Premium Maintenance Availability Fix V1

## UAT finding

Premium Booking Step 3 shows no slots when a maintenance interval is selected, while Availability Engine V2 works for the same branch/date/service.

## Root cause

`getAvailableTASSlots()` receives `maintenanceIntervalId` and calls:

```ts
listTASMaintenanceIntervals({ includeInactive: false })
```

But `listTASMaintenanceIntervals()` requires a valid `planId`; without one it returns `[]`. Therefore the selected interval cannot be resolved for Premium Booking availability.

## Fix

Resolve the selected active maintenance interval directly by its primary key inside `getAvailableTASSlots()`.

Preserved:
- active interval validation
- maintenance interval duration override
- Phase 6 physical Bay capacity
- Phase 7 auto Bay assignment
- Phase 8 premium slot enforcement
- Phases 9–12
- no schema migration
- no seed/data mutation during deploy
- no commit/push/stage/stash/reset

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
DEPLOY=PASS
PREMIUM_MAINTENANCE_AVAILABILITY_FIX=ACTIVE
MAINTENANCE_DURATION_OVERRIDE=PRESERVED
PHASE1_TO_12=PRESERVED
DB_SCHEMA_CHANGE=NONE
DB_DATA_CHANGE=NONE
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
