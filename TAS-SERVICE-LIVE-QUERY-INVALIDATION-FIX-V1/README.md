# TAS Service Live Query Invalidation Fix V1

## UAT finding

Newly created service bookings do not appear in the Service Scheduler until the user manually presses Refresh or reloads the whole page.

## Root cause

`TASPremiumBookingFlow` refreshes the parent appointments list through `onCreated`, but the scheduler uses its own cached tRPC query (`tas.service.getScheduler`). It is not invalidated after booking creation. Scheduler also has `refetchOnWindowFocus: false`.

## Fix

After a successful Premium Booking creation, invalidate the related active service queries:
- `tas.service.listAppointments`
- `tas.service.getScheduler`
- `tas.service.getAvailableSlots`
- `tas.service.getPartsPreparationBoard`

The existing `onCreated` callback remains preserved.

No polling is added. No schema/data migration. No seed data. No commit/push/stage/stash/reset.

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
DEPLOY=PASS
SCHEDULER_AUTO_REFRESH=ACTIVE
AVAILABILITY_AUTO_REFRESH=ACTIVE
APPOINTMENTS_AUTO_REFRESH=ACTIVE
PARTS_PREP_AUTO_REFRESH=ACTIVE
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
