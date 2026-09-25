# TAS Service Capacity — Phase 12 Next-Day Parts Preparation V1

Baseline: TAS master commit `a9df722ac1be19af8fa2a14d3e909ddd16647222`.

## Goal

Turn Phase 11 booking-item snapshots into an operational parts-preparation board for tomorrow or any selected service day.

## Source of truth

Phase 12 reads **booking snapshots**, not mutable maintenance master data.

Flow:
1. Phase 8 creates the maintenance booking.
2. Phase 11 snapshots the interval package into `tas_service_booking_items`.
3. Phase 12 selects future bookings for the chosen date.
4. Only snapshot lines with `preparationRequired=1` are included.
5. Requirements are aggregated by item + unit.
6. Warehouse/service staff track preparation at booking-line level.
7. Aggregate readiness updates from the line-level preparation records.

This means later package-price/item edits do not rewrite historical or already-booked preparation requirements.

## Preparation tracking

New table: `tas_service_booking_item_preparation`

One row per booking snapshot line:
- bookingItemId (unique)
- bookingId
- status: Pending | Partial | Prepared | Shortage
- preparedQuantity
- notes
- updatedByUserId
- createdAt
- updatedAt

Rules:
- Pending => prepared quantity = 0
- Prepared => prepared quantity = full required quantity
- Partial => 0 < prepared quantity < required quantity
- Shortage => prepared quantity < required quantity and a note/reason is required
- cancelled / no-show / completed bookings are excluded from the active preparation board

## Board

Default day: tomorrow.

Filters:
- date
- branch or all branches

Summary:
- bookings requiring preparation
- distinct required items
- preparation lines
- prepared lines
- shortage lines
- line-readiness percentage

Views:
1. Aggregated requirements by item/unit
   - required quantity
   - prepared quantity
   - remaining quantity
   - booking count
   - shortage count

2. Booking checklist
   - appointment time
   - branch
   - customer / vehicle
   - item / action
   - required quantity
   - prepared quantity
   - status
   - notes
   - quick Pending / Partial / Prepared / Shortage actions

## Safety / boundaries

- no inventory deduction
- no purchase-order creation
- no stock assumptions
- no automatic substitution of parts
- no maintenance source-data seeding
- no modification of Phase 11 package snapshots
- no booking rescheduling
- no automatic lifecycle mutation

Existing Phase 7–11 behavior is preserved.

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_PARTS_PREPARATION_MIGRATION=PASS
TAS_PARTS_PREPARATION_VERIFY=PASS
NEXT_DAY_PREPARATION_BOARD=ACTIVE
SNAPSHOT_REQUIREMENTS=ACTIVE
AGGREGATED_REQUIREMENTS=ACTIVE
PREPARATION_STATUS_TRACKING=ACTIVE
SHORTAGE_REASON_GUARD=ACTIVE
CANCELLED_NOSHOW_COMPLETED_EXCLUDED=YES
INVENTORY_MUTATION=NONE
SOURCE_DATA_SEED=NOT_INCLUDED
PHASE7_TO_11=PRESERVED
DEPLOY=PASS
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
