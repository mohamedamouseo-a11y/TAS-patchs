# TAS Service Capacity — Phase 3 Bays Management V1

Baseline: TAS master commit `679181ca75a71219576614fa0bbea1f84f33178d` with Phase 2 Branch Scheduling present.

## Scope

Phase 3 adds the physical service-bay configuration foundation per branch.

### Data model
New table: `tas_service_bays`

Fields:
- id
- branchId
- name
- code
- bayType
- capabilitiesJson
- notes
- sortOrder
- isActive
- createdAt
- updatedAt

No hardcoded bay count and no demo/seed bays.

### API / server
Adds:
- listTASServiceBays
- createTASServiceBay
- updateTASServiceBay

Adds parity to both:
- `tas.service.listBays/createBay/updateBay`
- `automotive.service.listBays/createBay/updateBay`

### UI
Adds premium bilingual `TASServiceBaysSettings` on the Service page:
- branch selector
- total/active bay counters
- bay cards
- add/edit bay
- active/inactive toggle
- bay type
- capabilities
- sort order
- notes
- explicit empty state

### Deliberately NOT in Phase 3
- No booking-to-bay assignment.
- No Bay-based availability calculation.
- No automatic Bay selection.
- No maintenance plan logic.
- No seed/demo Bays.
- Existing `capacityPerSlot` behavior remains unchanged for compatibility.

Those belong to later phases.

## Deployment safety

The deploy script:
1. preflights the active release and canonical Git worktree;
2. generates the exact application patch from the current active release;
3. uses the existing atomic deploy + migration contract;
4. migration is create-only/idempotent and records whether the table pre-existed;
5. rollback drops `tas_service_bays` only if this migration created it;
6. verifies PM2 + `/tas/service` HTTP 200;
7. applies the same source transformation to the canonical Git worktree without commit/push, leaving it ready for the user to push from TAS.

Expected final output:
```
PATCH=PASS
MIGRATION=PASS
BUILD=PASS
DEPLOY=PASS
PM2=online
HTTP=200
BAYS_MANAGEMENT=ACTIVE
BAY_COUNT_HARDCODED=NO
AVAILABILITY_ENGINE_UNCHANGED=YES
CANONICAL_SOURCE_SYNC=PASS
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
