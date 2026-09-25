# TAS Service Capacity — Phase 10 Booking Status Lifecycle V1

Baseline: TAS master commit `db563c55e1e5808a8a8429de16752107d1e029c7`.

## Goal

Turn service-booking status into an enforced operational lifecycle with audit history instead of allowing arbitrary status writes.

## Existing statuses preserved

- Pending
- PendingConfirmation
- Confirmed
- Completed
- Cancelled
- NoShow

No enum rewrite is required.

## Allowed transitions

- Pending -> PendingConfirmation | Confirmed | Cancelled
- PendingConfirmation -> Confirmed | Cancelled
- Confirmed -> Completed | Cancelled | NoShow
- Completed -> terminal
- Cancelled -> terminal
- NoShow -> terminal

The backend is authoritative. UI options mirror these rules but cannot bypass them.

## Required reasons

A non-empty reason is required for:
- Cancelled
- NoShow

Optional notes/reason may be stored for other transitions.

## Audit history

New table: `tas_service_booking_status_history`

Fields:
- id
- bookingId
- fromStatus
- toStatus
- reason
- actorUserId
- actorRole
- source
- createdAt

The booking row remains the current-state source of truth. The history table is append-only lifecycle evidence.

## Compatibility

- Existing bookings remain unchanged.
- The old service confirmation workflow is routed through the same lifecycle engine.
- Phase 7 Bay assignment is untouched.
- Phase 8 premium booking is untouched.
- Phase 9 scheduler remains the operational board and gains lifecycle actions.
- Existing follow-up workflow is preserved.

## UI

Lifecycle actions are available from:
- Service appointments table
- Phase 9 scheduler booking cards

A dialog shows:
- current status
- allowed next states
- reason field
- recent status history

## Safety

- migration only creates the status-history table/indexes if missing
- no status backfill
- no seed data
- no automatic status mutation
- no scheduler drag/drop
- no Phase 11 costs/items
- no Phase 12 parts preparation

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_BOOKING_LIFECYCLE_MIGRATION=PASS
TAS_BOOKING_LIFECYCLE_VERIFY=PASS
LIFECYCLE_ENGINE=ACTIVE
STATUS_HISTORY=ACTIVE
REASON_GUARD=ACTIVE
TERMINAL_STATE_GUARD=ACTIVE
LEGACY_CONFIRM_WORKFLOW=ROUTED_THROUGH_LIFECYCLE
PHASE7_AUTO_BAY=PRESERVED
PHASE8_PREMIUM_BOOKING=PRESERVED
PHASE9_SCHEDULER=PRESERVED
DEPLOY=PASS
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
