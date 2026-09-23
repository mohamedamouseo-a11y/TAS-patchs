# TAS Service Capacity — Phase 2 Finalize Source & Runtime V3

V3 handles canonical TAS worktrees where unrelated prior work touches the same files as Phase 2.

## Strategy

- Never stash, reset, commit, or stage existing canonical work.
- Build an isolated pristine tree from canonical HEAD.
- Apply the verified Phase 2 patch to that pristine tree.
- For every Phase 2 target, perform a three-way merge:
  - base = canonical HEAD
  - ours = current canonical working file (including existing staged/unstaged work)
  - theirs = canonical HEAD + Phase 2
- All merges are precomputed in temp files first.
- If any real conflict exists, stop before changing the canonical worktree.
- If all merges are clean, replace only the Phase 2 target working files with the precomputed merged versions.
- The Git index is left untouched, preserving all pre-existing staged state exactly.
- New Phase 2 files are added only when absent or byte-identical; unexpected conflicting pre-existing new files block the operation.
- No DB migration and no live source deploy.
- Active release source remains unchanged.
- Runtime paths are finalized only when content-equivalent to shared-runtime; metadata-only differences do not block.

This specifically preserves unrelated changes such as the existing LeadDispatcherDashboard removal in server/routers.ts while layering Phase 2 changes into the same file.

Expected:
```
THREE_WAY_PREFLIGHT=PASS
SOURCE_SYNC=PASS
RUNTIME_BINDING=PASS
INDEX_PRESERVED=YES
UNRELATED_WORKTREE_PRESERVED=YES
ACTIVE_SOURCE_UNCHANGED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
```
