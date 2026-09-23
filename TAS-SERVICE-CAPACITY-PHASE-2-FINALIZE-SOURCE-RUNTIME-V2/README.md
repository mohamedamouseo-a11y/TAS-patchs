# TAS Service Capacity — Phase 2 Finalize Source & Runtime V2

V2 fixes the V1 blocker caused by unrelated pre-existing changes in the canonical TAS Git worktree.

## Safety rules

- Does **not** require the entire canonical worktree to be clean.
- Preserves all unrelated staged, unstaged, and untracked files.
- Before applying Phase 2, checks only these Phase 2 target paths:
  - client/src/pages/tas/TASServicePage.tsx
  - client/src/components/tas/TASBranchSchedulingSettings.tsx
  - server/tasDb.ts
  - server/routers.ts
  - shared/schema.ts
  - scripts/apply-tas-service-branch-scheduling-v1.ts
  - scripts/verify-tas-service-branch-scheduling-v1.ts
  - scripts/rollback-tas-service-branch-scheduling-v1.ts
- If Phase 2 is already fully present in those targets, source sync is treated as already complete.
- If Phase 2 is not present, every Phase 2 target must be clean relative to HEAD before mutation.
- Patch dry-run is required before runtime/source mutation.
- Uses whitespace-tolerant Git apply because the verified live Phase 2 required whitespace-tolerant application.
- On source failure, restores only Phase 2 target files; unrelated canonical changes are untouched.
- Runtime rebind compares file **content**, ignoring harmless timestamp/permission-only differences.
- No DB migration, no DB writes, and no application source deployment are performed.
- Leaves canonical Phase 2 changes ready for Developer Hub review/push.

Expected final markers:

```
SOURCE_SYNC=PASS
RUNTIME_BINDING=PASS
UNRELATED_WORKTREE_PRESERVED=YES
ACTIVE_SOURCE_UNCHANGED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
