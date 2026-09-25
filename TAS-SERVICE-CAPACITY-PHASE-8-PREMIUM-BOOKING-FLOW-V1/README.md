# TAS Service Capacity — Phase 8 Premium Booking Flow V1

Baseline: TAS master commit `a69cadd77cf233028e3dcc0d42ee4a4761ea17b0`.

## Goal

Replace arbitrary manual service-time entry with a premium guided booking flow that connects the foundations built in Phases 2–7.

## Flow

1. Customer & Vehicle
   - customer name / phone
   - existing active TAS vehicle
   - vehicle year
   - current mileage
   - optional powertrain / variant

2. Maintenance Context
   - runs the Phase 5 mileage resolver
   - deterministic mapping only; ambiguous mapping blocks maintenance selection
   - shows plan and Exact / Previous / Next mileage intervals
   - Exact interval may be selected automatically because it is an exact match
   - Previous / Next are NEVER inferred as due; user must explicitly select one
   - user can explicitly choose General Service / no maintenance interval
   - user selects service type

3. Availability
   - user selects branch and date
   - Phase 6 Availability Engine V2 returns only schedule-valid slots
   - when a maintenance interval is selected, its duration overrides service-type duration
   - only slots with availableCapacity > 0 can be selected
   - no arbitrary time input

4. Review & Confirm
   - final customer, vehicle, mileage, plan/interval, duration, branch, and slot summary
   - create uses Phase 7 race-safe Bay assignment
   - assigned Bay is returned in confirmation

## Booking context persisted

Phase 8 adds nullable booking fields:
- vehicleId
- mileageKm
- maintenanceMappingId
- maintenancePlanId
- maintenanceIntervalId
- plannedDurationMinutes

No existing booking is rewritten.

## Server validation

For `bookingMode=premium_v1`:
- selected slot must exactly exist in Availability Engine V2 for that branch/date/service/duration
- selected slot must have positive availability at validation time
- selected maintenance mapping must be deterministic for the supplied vehicle/mileage/powertrain/variant/year
- selected interval must belong to the resolved active maintenance plan
- planned duration is derived server-side
- Phase 7 transaction locks and Bay conflict checks remain authoritative at insert time

Legacy callers remain compatible; premium-only slot enforcement is not imposed on old integrations.

## Deliberately not included

- no scheduler board — Phase 9
- no booking lifecycle expansion — Phase 10
- no operation/parts/cost master — Phase 11
- no parts preparation — Phase 12
- no automatic "due service" inference
- no seed data

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_PREMIUM_BOOKING_MIGRATION=PASS
TAS_PREMIUM_BOOKING_VERIFY=PASS
PREMIUM_SLOT_ENFORCEMENT=ACTIVE
MAINTENANCE_DURATION_OVERRIDE=ACTIVE
AUTO_BAY_ASSIGNMENT=PRESERVED
DEPLOY=PASS
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
