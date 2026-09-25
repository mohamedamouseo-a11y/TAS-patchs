# TAS Service Capacity — Phase 11 Maintenance Items & Costs V1

Baseline: TAS master commit `54fa6e3bd7ed103244da5d25025a49d95db46841`.

## Goal

Turn maintenance intervals into real service packages made of parts, fluids, consumables, labor, and operations with cost / selling price / VAT, while preserving historical booking values.

## Data model

### 1. Maintenance item catalog
`tas_maintenance_items`

- code
- name
- itemType: Part | Fluid | Consumable | Labor | Operation | Other
- unit
- partNumber
- defaultUnitCostEgp
- defaultUnitPriceEgp
- defaultVatRatePct
- preparationRequired
- notes
- sortOrder
- isActive

### 2. Interval package lines
`tas_maintenance_interval_items`

Each Phase 4 interval can contain package lines:

- intervalId
- itemId
- action: Replace | Inspect | Clean | Adjust | Lubricate | TopUp | Other
- quantity
- unitCostEgp
- unitPriceEgp
- vatRatePct
- preparationRequired
- notes
- sortOrder
- isActive

Package-line prices are explicit and may differ from catalog defaults.

### 3. Booking item snapshots
`tas_service_booking_items`

When a Phase 8 premium booking selects a maintenance interval, Phase 11 snapshots every active package line inside the same booking transaction.

The snapshot stores:
- item identity/name/type
- action
- unit
- quantity
- cost
- selling price
- VAT rate
- preparationRequired
- notes

This prevents later master-data price changes from rewriting historical bookings and gives Phase 12 a stable source for next-day parts preparation.

## Calculations

For an interval package:

- cost subtotal = sum(quantity × unit cost)
- price subtotal = sum(quantity × unit price)
- VAT = sum(quantity × unit price × VAT rate / 100)
- total = price subtotal + VAT

No fixed VAT percentage is assumed by TAS.

## UI

New **Maintenance Items & Costs** panel:

- item catalog create/edit/deactivate
- plan + interval selector
- add/edit/deactivate interval package lines
- action and preparation-required flags
- package cost / price / VAT / total summary
- read-only line calculations

## Source-data integrity

This patch creates the production data model and UI but **does not seed maintenance prices or line items**.

The previously discussed maintenance workbook/package is not embedded into this patch. TAS will not invent or approximate source values. A source-data import/seed must be generated only from an accessible source workbook/images/transcript.

## Preserved

- Phase 7 race-safe Bay assignment
- Phase 8 premium booking / maintenance interval duration
- Phase 9 scheduler
- Phase 10 lifecycle/history
- existing plans, intervals, mappings and bookings

Expected:
```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
TAS_MAINTENANCE_ITEMS_COSTS_MIGRATION=PASS
TAS_MAINTENANCE_ITEMS_COSTS_VERIFY=PASS
MAINTENANCE_ITEM_CATALOG=ACTIVE
INTERVAL_PACKAGE_LINES=ACTIVE
BOOKING_ITEM_SNAPSHOT=ACTIVE
PACKAGE_TOTALS=ACTIVE
PREPARATION_FLAG=ACTIVE
SOURCE_DATA_SEED=NOT_INCLUDED_BY_DESIGN
PHASE7_AUTO_BAY=PRESERVED
PHASE8_PREMIUM_BOOKING=PRESERVED
PHASE9_SCHEDULER=PRESERVED
PHASE10_LIFECYCLE=PRESERVED
DEPLOY=PASS
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
