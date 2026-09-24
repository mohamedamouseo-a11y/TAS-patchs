# TAS Service Capacity — Phase 7 Auto Bay Assignment V1

Baseline: TAS master commit `6a21999c683974eaf6a793055b51f32d2d5ee380`.

## Scope

Phase 7 automatically assigns a physical service Bay when a service appointment is created.

### Assignment rules

When the selected branch has active Bays:
1. lock the branch's active Bay rows inside one DB transaction;
2. calculate the appointment end using the service-type duration unless a valid explicit end is supplied;
3. load overlapping non-cancelled/non-NoShow bookings;
4. explicit active-Bay bookings occupy those Bays;
5. legacy overlapping bookings with no `bayId` consume generic physical capacity;
6. deterministic free-Bay order is `sortOrder ASC, id ASC`;
7. enough early free Bays are shadow-reserved for legacy unassigned load;
8. the next free Bay is auto-assigned;
9. if no physical capacity remains, creation fails instead of double-booking a Bay;
10. the booking insert happens in the same transaction.

This serializes concurrent auto-assignment for a branch and prevents two normal TAS appointment creates from selecting the same Bay.

When the branch has zero active Bays:
- booking creation remains available in legacy mode;
- `bayId` remains NULL;
- no fake/default Bay is created.

### Compatibility

- No seed Bays.
- No hardcoded Bay count.
- No Bay capability/category guessing.
- Existing old bookings remain untouched.
- Phase 6 Availability Engine V2 remains the capacity source.
- The appointment list is enriched with Bay name/code.
- Create response keeps top-level `id` and additionally returns Bay assignment metadata.

### UI

The current Service appointment UI:
- confirms the assigned Bay in the success toast;
- shows a Bay column in appointment history;
- clearly labels old/legacy bookings as unassigned.

## Deliberately NOT in Phase 7

- No premium slot-picker booking flow — Phase 8.
- No scheduler board — Phase 9.
- No booking lifecycle expansion — Phase 10.
- No maintenance parts/costs — Phase 11.

## Database

No schema migration. Phase 7 depends on Phase 6 `tas_service_bookings.bayId`.
The verification script checks the column/index and runs deterministic assignment-algorithm cases without requiring seed branches.

Expected final output:

```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_AUTO_BAY_ASSIGNMENT_VERIFY=PASS
RACE_SERIALIZATION=BRANCH_BAY_ROW_LOCKS
DB_UNCHANGED=YES
DEPLOY=PASS
PM2=online
HTTP=200
AUTO_BAY_ASSIGNMENT=ACTIVE
LEGACY_NO_BAYS_FALLBACK=PRESERVED
CAPABILITY_GUESSING=NO
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
