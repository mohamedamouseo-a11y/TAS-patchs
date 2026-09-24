# TAS Service Capacity — Phase 6 Availability Engine V2

Baseline: TAS master commit `572de70506b803cb80b176250604940eb54ab21e`.

## Scope

Phase 6 upgrades service availability from aggregate slot capacity to physical-bay-aware capacity.

### Booking schema foundation
Adds nullable `bayId` to `tas_service_bookings` plus an index.

No automatic Bay assignment is introduced in this phase.

### Availability Engine V2

For branches with active service Bays:
- physical capacity = active Bays in the branch
- bookings with `bayId` occupy that exact active Bay during overlap
- legacy bookings with no `bayId` consume one generic Bay each during overlap
- duplicate overlapping bookings on the same explicit Bay occupy one physical Bay and remain visible as reserved bookings
- returns diagnostics per slot:
  - `engineVersion: 2`
  - `capacitySource: service_bays`
  - `configuredBayCount`
  - `availableCapacity`
  - `reservedCount`
  - `assignedOccupiedBayIds`
  - `freeBayIds`
  - `legacyUnassignedLoad`

For branches with zero active Bays:
- temporarily falls back to the existing legacy capacity calculation
- returns `capacitySource: legacy_capacity`

No capability/category inference is performed because Bay capabilities are currently free-form and are not yet normalized to service types.

### UI

Adds a premium bilingual Availability Engine V2 inspector to the TAS Service page:
- select branch
- select service type
- choose date
- see slot start/end
- available capacity
- Bay-backed vs legacy fallback
- occupied/free Bay diagnostics
- legacy unassigned load warning

This is read-only availability visibility. It does not change booking submission.

## Deliberately NOT in Phase 6

- No automatic Bay assignment — Phase 7.
- No booking-flow enforcement or premium booking flow — Phase 8.
- No scheduler UI — Phase 9.
- No hardcoded Bay capability-to-service mapping.
- No seed bookings or Bays.

## Deployment

Uses the same guarded direct deployment pattern proven in Phase 5:
- exact source preflight
- git-style patch generation
- dry-run
- source backup
- production build
- additive DB migration + verification
- PM2 restart + HTTP 200
- rollback on gated failure
- canonical source sync without stage/commit/push

Expected:

```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
MIGRATION=PASS
DEPLOY=PASS
PM2=online
HTTP=200
AVAILABILITY_ENGINE_V2=ACTIVE
BAY_AWARE_CAPACITY=YES
LEGACY_FALLBACK=PRESERVED
AUTO_BAY_ASSIGNMENT=NOT_ENABLED
BOOKING_FLOW_UNCHANGED=YES
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
