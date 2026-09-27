# TAS Service Types Settings UI V1

Baseline: TAS master `363bd5100ed234dce862303152c30453f011ed82`.

## Problem found during manual UAT

`/tas/service` exposes Availability Engine V2 and Premium Booking, but there is no Service Types settings UI. The operational dropdown uses `tas.service.listTypes`, which correctly returns active rows only; with no active service types the dropdown is empty and Phase 6 cannot be tested from the site.

## Fix

Add a dedicated Service Types settings section to `/tas/service`:
- create service type
- edit service type
- activate / deactivate
- name
- category
- duration minutes
- slot capacity
- description

Backend additions:
- `getTASServiceTypesAdmin` — settings list including inactive rows
- `updateTASServiceType`
- router procedures:
  - `listTypesAdmin`
  - `updateType`

Existing `listTypes` remains active-only for operational booking/availability dropdowns.

## Safety

- no schema migration
- no seed data
- no existing service-type mutation during deployment
- no booking mutation
- no stage / commit / push
- existing Phase 1–12 behavior preserved

Expected ending:

```
SCRIPT_PREFLIGHT=PASS
SOURCE_PREFLIGHT=PASS
PATCH_DRY_RUN=PASS
PATCH=PASS
BUILD=PASS
SERVICE_TYPES_SETTINGS_UI=ACTIVE
SERVICE_TYPES_ADMIN_LIST=ACTIVE
SERVICE_TYPES_UPDATE=ACTIVE
OPERATIONAL_LIST_ACTIVE_ONLY=PRESERVED
DB_SCHEMA_CHANGE=NONE
SOURCE_DATA_SEED=NONE
PHASE1_TO_12=PRESERVED
DEPLOY=PASS
PM2=online
HTTP=200
CANONICAL_SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
