# TAS Service Capacity — Phase 3 Source Finalize V1

Phase 3 Bays Management is already live and verified, but the canonical TAS Git worktree / GitHub master does not yet contain the Phase 3 source.

This finalizer performs **source synchronization only**.

Safety:
- no database migration
- no database writes
- no live deployment
- no PM2 restart
- no runtime-directory changes
- no commit/push
- preserves the Git index exactly
- preserves unrelated staged/unstaged canonical work
- uses a precomputed three-way merge for existing Phase 3 target files
- stops before writing if any real source conflict exists

Merge model:
- base = canonical HEAD
- ours = current canonical working file
- theirs = canonical HEAD + Phase 3 Bays source transform

Targets:
- shared/schema.ts
- server/tasDb.ts
- server/routers.ts
- client/src/pages/tas/TASServicePage.tsx
- client/src/components/tas/TASServiceBaysSettings.tsx
- scripts/apply-tas-service-bays-v1.ts
- scripts/verify-tas-service-bays-v1.ts
- scripts/rollback-tas-service-bays-v1.ts

Expected:
```
THREE_WAY_PREFLIGHT=PASS
SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
UNRELATED_WORKTREE_PRESERVED=YES
LIVE_PHASE3_CONFIRMED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
