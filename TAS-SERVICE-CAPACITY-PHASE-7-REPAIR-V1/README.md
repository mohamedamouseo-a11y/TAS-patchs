# TAS Service Capacity — Phase 7 Repair V1

Purpose: repair a partial Phase 7 state where the verifier exists but the Phase 7 core source markers are missing from the active/canonical source.

Repairs only:
- server/tasDb.ts
- server/routers.ts
- client/src/pages/tas/TASServicePage.tsx
- scripts/verify-tas-auto-bay-assignment-v1.ts

Uses the canonical Phase 7 transformer/payload already stored in:
`TAS-SERVICE-CAPACITY-PHASE-7-AUTO-BAY-ASSIGNMENT-V1`.

Safety:
- no DB migration
- no DB writes
- no seed
- no commit
- no push
- backups active/canonical targets + active dist
- preflights transform on temporary copies before mutation
- preserves canonical Git index
- restores active/canonical/dist on failure before live success
- build + verifier + PM2 online + /tas/service HTTP 200 required

Expected:
```
REPAIR_PREFLIGHT=PASS
ACTIVE_REPAIR=PASS
BUILD=PASS
TAS_AUTO_BAY_ASSIGNMENT_VERIFY=PASS
PM2=online
HTTP=200
CANONICAL_REPAIR=PASS
INDEX_PRESERVED=YES
PHASE7_CORE_PRESENT=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
