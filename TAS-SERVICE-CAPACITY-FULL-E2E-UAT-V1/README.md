# TAS Service Capacity Full E2E / UAT V1

Baseline verified before authoring:
`363bd5100ed234dce862303152c30453f011ed82`

## Purpose

Run a live, isolated end-to-end test across all 12 TAS service-capacity phases.

This is not a marker-only check. It exercises the real backend functions against the live TAS database using uniquely named synthetic UAT records, then removes every synthetic record in a `finally` cleanup.

## Coverage

- Phase 1: foundation tables / required schema
- Phase 2: branch scheduling + invalid-window guard
- Phase 3: physical Bays + duplicate-code guard
- Phase 4: maintenance plans / intervals + duplicate-mileage guard
- Phase 5: deterministic vehicle mapping + exact / previous / next mileage resolution
- Phase 6:
  - Availability Engine V2
  - maintenance-duration override
  - physical-Bay capacity
  - zero-Bay legacy-capacity fallback
- Phase 7:
  - deterministic Bay assignment
  - two-Bay capacity saturation
  - third same-slot booking rejection
- Phase 8:
  - premium generated-slot enforcement
  - arbitrary-time rejection
  - maintenance booking context
  - General Service mode without maintenance interval
  - zero-Bay legacy booking mode
- Phase 9:
  - assigned Bay scheduler lanes
  - unassigned / legacy lane
  - inactive-Bay exception lane
- Phase 10:
  - legacy confirm routed through lifecycle
  - Confirmed / Completed
  - Cancelled reason guard
  - NoShow reason guard
  - terminal-state reopen rejection
  - audit history
- Phase 11:
  - item catalog
  - interval package lines
  - package totals
  - booking snapshot
  - snapshot price immutability after master-data edit
- Phase 12:
  - selected-day preparation board
  - aggregate requirements
  - Partial
  - Shortage reason guard
  - Prepared
  - readiness percentage
  - closed-booking exclusion
  - preparation mutation blocked after booking closure
- UI/source integration markers for all service components
- production build
- existing Phase 3–12 verifier scripts where present
- PM2 online + /tas/service HTTP 200

## Data safety

- Uses unique `__TAS_UAT_...` names/codes.
- Uses a far-future service date within MySQL TIMESTAMP range.
- Does not touch existing customer bookings.
- Does not seed real maintenance source data.
- Does not mutate inventory or purchase orders.
- Cleanup runs on success and failure.
- Final residue scan must equal zero.
- No stage / commit / push / stash / reset.

Expected successful ending:

```
PHASE1_FOUNDATION=PASS
PHASE2_BRANCH_SCHEDULING=PASS
PHASE3_BAYS=PASS
PHASE4_MAINTENANCE_PLANS=PASS
PHASE5_VEHICLE_MAPPING=PASS
PHASE6_AVAILABILITY=PASS
PHASE7_AUTO_BAY=PASS
PHASE8_PREMIUM_BOOKING=PASS
PHASE9_SCHEDULER=PASS
PHASE10_LIFECYCLE=PASS
PHASE11_ITEMS_COSTS=PASS
PHASE12_PARTS_PREPARATION=PASS
UI_INTEGRATION=PASS
FULL_E2E_UAT=PASS
SYNTHETIC_DATA_CLEANUP=PASS
DB_RESIDUE=0
SOURCE_MUTATION=NONE
PM2=online
HTTP=200
ERROR=NONE
```
