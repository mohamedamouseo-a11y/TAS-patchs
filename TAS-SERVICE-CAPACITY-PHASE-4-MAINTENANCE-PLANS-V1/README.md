# TAS Service Capacity — Phase 4 Maintenance Plans V1

Baseline: TAS master commit `98642f17fe8edbbc557ddbdd7910752428eb91a0`.

## Scope

Phase 4 introduces the configurable maintenance-plan master used by later vehicle/mileage scheduling phases.

### New tables

`tas_maintenance_plans`
- id
- name
- code
- description
- sortOrder
- isActive
- createdAt
- updatedAt

`tas_maintenance_intervals`
- id
- planId
- mileageKm
- label
- durationMinutes
- notes
- sortOrder
- isActive
- createdAt
- updatedAt

### API

Adds to both `tas.service` and `automotive.service`:
- listMaintenancePlans
- createMaintenancePlan
- updateMaintenancePlan
- listMaintenanceIntervals
- createMaintenanceInterval
- updateMaintenanceInterval

### UI

Adds premium bilingual `TASMaintenancePlansSettings` to the TAS service page:
- create/edit/activate/deactivate maintenance plans
- optional plan code
- editable description and ordering
- add/edit mileage intervals
- configurable duration per interval
- interval labels/notes/order/active state
- no seeded or hardcoded mileage values

## Deliberately NOT in Phase 4

- No vehicle/model/powertrain mapping — Phase 5.
- No Bay-based availability changes — Phase 6.
- No auto Bay assignment — Phase 7.
- No maintenance parts/operations/cost breakdown — Phase 11.
- No Excel import yet.
- No seed/demo maintenance plans.

## Deployment

Uses the existing TAS atomic deploy and migration contract. The runner generates a valid git-style patch from the exact active release, preflights canonical three-way source synchronization before deploy, runs migration/build/deploy/verify, then writes the precomputed merge to the canonical Git worktree without committing or pushing.

Expected final markers:

```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
THREE_WAY_PREFLIGHT=PASS
PATCH=PASS
MIGRATION=PASS
BUILD=PASS
DEPLOY=PASS
PM2=online
HTTP=200
MAINTENANCE_PLANS=ACTIVE
SEED_PLANS=0
VEHICLE_MAPPING=NOT_ENABLED
PARTS_COSTS=NOT_ENABLED
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
