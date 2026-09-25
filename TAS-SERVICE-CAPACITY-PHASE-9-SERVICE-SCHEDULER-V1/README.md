# TAS Service Capacity — Phase 9 Service Scheduler V1

Baseline: TAS master commit `7a5c180cacc03713c3cf9442d1414d8ff03a8b08`.

## Goal

Add an operational daily service scheduler built on the real branch timetable, physical Bays, Phase 7 Bay assignments, and Phase 8 planned durations.

## Scheduler model

- one selected branch
- one selected day
- horizontal time axis from branch workday start to workday end
- one lane per active physical Bay
- booking cards positioned by their actual start/end time
- booking width reflects actual planned duration
- maintenance bookings show plan / interval / mileage context
- General Service bookings remain supported
- Cancelled and NoShow bookings do not consume the operational board

## Legacy / exception safety

The scheduler NEVER invents a Bay for old bookings.

- bookings with no `bayId` appear in a dedicated **Unassigned / Legacy** lane
- bookings assigned to an inactive or missing Bay appear in a dedicated **Bay Exception** lane
- no drag/drop or implicit reassignment is performed

## Summary metrics

- active Bays
- scheduled bookings
- assigned bookings
- unassigned legacy bookings
- Bay exceptions
- utilization percentage = scheduled assigned minutes / active Bay workday minutes

## Phase boundary

Phase 9 is scheduling visibility only.

Not included:
- no status mutation or lifecycle workflow — Phase 10
- no drag/drop rescheduling
- no reassignment
- no operations/parts/costs — Phase 11
- no parts preparation — Phase 12
- no database migration
- no seed data

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_SERVICE_SCHEDULER_VERIFY=PASS
SERVICE_SCHEDULER=ACTIVE
BAY_TIME_GRID=ACTIVE
UNASSIGNED_LEGACY_LANE=ACTIVE
BAY_EXCEPTION_LANE=ACTIVE
STATUS_MUTATION=NOT_INCLUDED
DB_UNCHANGED=YES
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
