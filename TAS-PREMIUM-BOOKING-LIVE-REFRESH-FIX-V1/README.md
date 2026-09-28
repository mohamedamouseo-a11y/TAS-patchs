# TAS Premium Booking Live Refresh Fix V1

## UAT finding

A newly confirmed Premium Service Booking is created and Bay-assigned correctly, but Service Scheduler / availability-dependent views may remain stale until a manual browser reload.

## Root cause

`TASPremiumBookingFlow` only called its parent `onCreated` callback. The current page callback refetched `listAppointments`, but did not invalidate the independent cached queries used by:
- `getScheduler`
- `getAvailableSlots`
- `getPartsPreparationBoard`

Phase 10 lifecycle actions already use tRPC query invalidation correctly.

## Fix

After a successful Premium Booking mutation, invalidate:
- `tas.service.listAppointments`
- `tas.service.getScheduler`
- `tas.service.getAvailableSlots`
- `tas.service.getPartsPreparationBoard`

Then preserve the existing `onCreated` callback and form reset.

No DB/schema changes. No data seeds. No commit/push/stage/stash/reset.

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
DEPLOY=PASS
PREMIUM_BOOKING_LIVE_REFRESH=ACTIVE
SCHEDULER_INVALIDATION=ACTIVE
AVAILABILITY_INVALIDATION=ACTIVE
PREPARATION_INVALIDATION=ACTIVE
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
