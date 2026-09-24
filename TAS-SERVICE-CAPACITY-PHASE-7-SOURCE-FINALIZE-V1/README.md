# TAS Service Capacity — Phase 7 Source Finalize V1

Phase 7 Auto Bay Assignment V1 is already live and operational, but GitHub master still contains Phase 6 only.

This finalizer synchronizes only Phase 7 source from the verified active release into the canonical Git worktree.

Targets:
- server/tasDb.ts
- server/routers.ts
- client/src/pages/tas/TASServicePage.tsx
- scripts/verify-tas-auto-bay-assignment-v1.ts

Safety:
- no DB writes/migration
- no deploy
- no PM2 restart
- no commit/push
- preserves Git index
- preserves unrelated worktree changes
- 3-way merge for existing files
- add/identical-only for the new verifier file

Expected:
```
THREE_WAY_PREFLIGHT=PASS
SOURCE_SYNC=PASS
INDEX_PRESERVED=YES
UNRELATED_WORKTREE_PRESERVED=YES
LIVE_PHASE7_CONFIRMED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
