# TAS Service Capacity — Phase 4 Source Finalize V1

Phase 4 Maintenance Plans V1 is already deployed and verified live, but the canonical TAS Git source / GitHub master does not yet contain the Phase 4 source.

This finalizer uses the verified active release as the desired Phase 4 source and synchronizes only the 8 Phase 4 target files into the canonical Git worktree.

## Safety

- no DB migration
- no DB writes
- no live deployment
- no PM2 restart
- no runtime changes
- no commit or push
- preserves the Git index exactly
- preserves unrelated canonical staged/unstaged work
- existing files use three-way merge:
  - base = canonical HEAD
  - ours = current canonical working file
  - theirs = verified active release
- new Phase 4 files are copied only if absent or already byte-identical
- all merge results are precomputed before any canonical write
- on any conflict, exits before mutation
- on post-write verification failure, restores only the 8 Phase 4 targets

Targets:
- shared/schema.ts
- server/tasDb.ts
- server/routers.ts
- client/src/pages/tas/TASServicePage.tsx
- client/src/components/tas/TASMaintenancePlansSettings.tsx
- scripts/apply-tas-maintenance-plans-v1.ts
- scripts/verify-tas-maintenance-plans-v1.ts
- scripts/rollback-tas-maintenance-plans-v1.ts

Expected:
```
THREE_WAY_PREFLIGHT=PASS
SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
UNRELATED_WORKTREE_PRESERVED=YES
LIVE_PHASE4_CONFIRMED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
