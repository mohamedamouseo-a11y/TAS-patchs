# TAS Service Capacity — Phase 6 Source Finalize V1

Phase 6 Availability Engine V2 is already live and verified at source/migration/PM2/HTTP level, but canonical TAS Git/GitHub still contains Phase 5 only.

This finalizer synchronizes only the Phase 6 source from the verified active release into the canonical Git worktree.

Safety:
- no DB migration/write
- no live deployment
- no PM2 restart
- no runtime directory changes
- no commit/push
- preserves Git index exactly
- preserves unrelated staged/unstaged work
- existing files use 3-way merge:
  - base = canonical HEAD
  - ours = current canonical working file
  - theirs = active release
- new Phase 6 files copy only if absent or byte-identical
- precomputes all merges before canonical mutation
- restores only Phase 6 target files on failure

Targets:
- shared/schema.ts
- server/tasDb.ts
- client/src/pages/tas/TASServicePage.tsx
- client/src/components/tas/TASAvailabilityEngineV2Panel.tsx
- scripts/apply-tas-availability-engine-v2.ts
- scripts/verify-tas-availability-engine-v2.ts
- scripts/rollback-tas-availability-engine-v2.ts
- scripts/verify-tas-availability-engine-v2-runtime.ts

Note:
The Phase 6 runtime verifier requires at least one service branch and service type. An empty branch table is treated as a test-data dependency, not a source-sync failure.

Expected:
```
THREE_WAY_PREFLIGHT=PASS
SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
UNRELATED_WORKTREE_PRESERVED=YES
LIVE_PHASE6_CONFIRMED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
