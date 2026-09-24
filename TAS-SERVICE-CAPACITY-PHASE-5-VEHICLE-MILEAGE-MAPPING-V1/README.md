# TAS Service Capacity — Phase 5 Vehicle / Mileage Mapping V1

Baseline: TAS master commit `645756b1f4fd1f3f2b4e818d891d14512f614fc0`.

## Scope

Phase 5 connects the existing TAS vehicle catalog to the maintenance-plan master created in Phase 4.

### New table

`tas_maintenance_vehicle_mappings`
- id
- vehicleId
- planId
- powertrain (optional free text)
- variant (optional free text)
- yearFrom (optional)
- yearTo (optional)
- notes
- sortOrder
- isActive
- createdAt
- updatedAt

No duplicate vehicle catalog is introduced. Mappings reference existing `tas_vehicles`.

### API

Adds to both `tas.service` and `automotive.service`:
- listMaintenanceVehicleMappings
- createMaintenanceVehicleMapping
- updateMaintenanceVehicleMapping
- resolveMaintenanceMileage

Mileage resolution returns:
- selected mapping / plan when deterministic
- exactInterval when mileage exactly matches a configured interval
- previousInterval
- nextInterval
- ambiguity information when more than one mapping matches and no unique powertrain/variant/default can be selected

It does not silently invent a maintenance interval.

### UI

Adds premium bilingual `TASMaintenanceVehicleMappingSettings`:
- select existing TAS vehicle
- select maintenance plan
- optional powertrain / variant / year range
- activate/deactivate mappings
- mileage resolution tester showing exact / previous / next interval
- ambiguity state instead of hidden guessing

## Deliberately NOT in Phase 5

- No booking-flow changes — Phase 8.
- No Bay-based availability — Phase 6.
- No automatic Bay assignment — Phase 7.
- No maintenance parts / operations / costs — Phase 11.
- No Excel import or seed mappings.

## Deployment

Because the current TAS atomic deploy typecheck baseline is not reliable for feature patches, this phase uses a guarded direct release update:
1. verifies Phase 4 live + canonical baseline;
2. requires the Phase 5 target files to be clean and identical between active/canonical;
3. generates a git-style patch in a temporary Git tree;
4. snapshots the active and canonical Phase 5 targets;
5. applies only the Phase 5 patch to the active release;
6. builds with a controlled Node heap;
7. applies/verifies the migration;
8. restarts TAS and verifies `/tas/service` HTTP 200;
9. rolls back Phase 5 source + DB table if any gated step fails;
10. copies the verified Phase 5 source to canonical without stage/commit/push.

Expected final markers:

```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH=PASS
BUILD=PASS
MIGRATION=PASS
DEPLOY=PASS
PM2=online
HTTP=200
VEHICLE_MILEAGE_MAPPING=ACTIVE
SEED_MAPPINGS=0
BOOKING_FLOW_UNCHANGED=YES
AVAILABILITY_ENGINE_UNCHANGED=YES
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
