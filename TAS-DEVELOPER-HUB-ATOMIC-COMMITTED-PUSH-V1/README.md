# TAS Developer Hub Atomic Committed Push V1

## Problem

TAS runs production with an atomic deployment layout where Git metadata lives at the deployment root while `GIT_WORK_TREE` points at the active release. In that mode `ATOMIC_WORKSPACE_ISOLATION=true`.

The current Developer Hub review logic intentionally skips Git ahead/behind and committed-diff calculations whenever atomic workspace isolation is active. That creates a false `Synced / noop` result even when the local Git `master` HEAD contains commits that are not on GitHub.

Observed incident:

- local `master`: `c05ddf47a95e8f9d231b74d7eab35c3f98395fc1`
- real GitHub `master`: `42123f4ce5ec20dfb345980b8d3f5fdbaf434d1b`
- Developer Hub incorrectly showed: `Push — Synced`, `noop`, `0 reviewed files`, `0 local ahead`
- GitHub did not contain `c05ddf47...`

## Root cause

`server/routes/developerHub.ts` currently does the following only outside atomic isolation:

```ts
if (remoteExists && !ATOMIC_WORKSPACE_ISOLATION) {
  // rev-list HEAD...origin/branch
}
```

It also disables `localCommitted` and remote committed-file discovery in atomic mode:

```ts
const localCommitted = !ATOMIC_WORKSPACE_ISOLATION && remoteExists && localAhead > 0
```

As a result, a committed local HEAD can be ahead of the remote but review still sees `localAhead=0`, no files, and chooses `noop`.

## Required behavior

Developer Hub must distinguish the Git commit state from the active-release worktree state.

When the selected branch is `master`, local Git HEAD is ahead of `origin/master`, GitHub is not ahead, and the active-release changes are compatible with the local committed HEAD, Review Push must return:

- `localAhead > 0`
- actual committed changed files
- `expectedAction = push`
- NOT `noop`
- NOT `Synced`

Execute Reviewed Push must then push the exact reviewed local HEAD SHA using the existing `pushReviewedCommit()` path.

## Safety design

### 1. Always calculate Git ahead/behind

`git rev-list --left-right --count HEAD...origin/<branch>` is ref-only and remains correct even when `GIT_WORK_TREE` points to the active release. Do not suppress it under `ATOMIC_WORKSPACE_ISOLATION`.

### 2. Always calculate committed local files

When `localAhead > 0`, calculate the local committed diff from `origin/<branch>...HEAD` in atomic mode too.

### 3. Do not mistake the active release for uncommitted local source

In atomic mode there are two source views:

- Git HEAD tree: the commit the user intends to push.
- active release candidate tree: the currently deployed source.

If local HEAD is ahead and remote is not ahead, prefer an exact local-HEAD push only when the active release is compatible with that local HEAD.

Compatibility is true when one of these is true:

1. active candidate tree equals the remote tree; or
2. active candidate tree equals local HEAD tree; or
3. every path changed in the active candidate relative to the remote has exactly the same content/state at local HEAD.

Case 3 is required for bootstrap repair: production may contain only the Developer Hub runtime fix while local HEAD also contains other already-reviewed changes such as WhatsApp UI changes.

If the active release contains a change that does not match either the remote or local HEAD on that path, fail closed with a clear `DUAL_SOURCE_DIVERGENCE` blocker. Never silently snapshot or overwrite it.

### 4. Existing action type is enough

Do NOT add a new frontend action. `decideGitHubSyncPlan()` already returns `push` when:

- dirty=false
- localAhead>0
- remoteAhead=0

For the safe atomic committed-head case, review should expose the local HEAD tree as `candidateTree`, set the active-release-only `workingChanges` to an empty list, and keep `localCommitted` as the reviewed file set. Existing execute logic already verifies:

- remote HEAD has not changed since review
- current HEAD SHA matches reviewed local SHA for `push`
- current HEAD tree matches reviewed candidate tree
- exact HEAD is sent to `pushReviewedCommit()`

### 5. Do not use clean snapshot for this case

`clean_snapshot_and_push` is for active-release source snapshots. It must NOT be selected merely because production is behind the local Git HEAD.

For the safe committed-head mode, `atomicWorkspaceChanged` / `cleanSnapshotRequired` must not override the normal `push` plan.

### 6. Preserve secret/history checks

Do not disable security because atomic mode is active.

- unrelated histories must still block
- local commits being pushed must still go through commit-history secret scanning
- normal path blocking/secret scanning remains unchanged

## Suggested implementation

Add a pure helper to `server/services/developerHubGitHubAdvancedSync.ts`:

```ts
export type AtomicCommittedHeadDecision =
  | { mode: "none"; reason: null }
  | { mode: "push_local_head"; reason: null }
  | { mode: "blocked"; reason: string };

export function decideAtomicCommittedHead(input: {
  atomicWorkspaceIsolation: boolean;
  remoteExists: boolean;
  localAhead: number;
  remoteAhead: number;
  historiesRelated: boolean;
  activeCandidateCompatibleWithLocalHead: boolean;
}): AtomicCommittedHeadDecision
```

Recommended rules:

- non-atomic => `none`
- no remote => `none` (existing clean-snapshot/bootstrap path remains)
- localAhead <= 0 => `none`
- unrelated histories => `blocked`
- remoteAhead > 0 => `blocked` in atomic mode; require explicit resolution/review instead of pretending synced
- localAhead > 0, remoteAhead=0, active compatible => `push_local_head`
- localAhead > 0, remoteAhead=0, active incompatible => `blocked` with `DUAL_SOURCE_DIVERGENCE`

In `server/routes/developerHub.ts`:

1. import `decideAtomicCommittedHead`.
2. calculate ahead/behind regardless of atomic isolation.
3. calculate real `historiesRelated` regardless of atomic isolation.
4. capture both `activeCandidateTree` and `localHeadTree`.
5. compute active-release compatibility with local HEAD at paths changed relative to remote.
6. call the helper.
7. for `push_local_head`:
   - use `localHeadTree` as reviewed `candidateTree`;
   - set `workingChanges=[]` so the active release is not treated as an uncommitted mutation;
   - include `localCommitted` from `origin/<branch>...HEAD`;
   - suppress `cleanSnapshotRequired` for this mode.
8. for helper `blocked`, set the sync plan to `expectedAction="blocked"` and expose the reason.
9. do not skip local commit-history secret scan in atomic mode.
10. do not skip unrelated-history checks in atomic mode.

A small route-local helper may compare the active candidate against local HEAD only on paths changed from the remote. It must use Git tree comparisons, not filesystem timestamps.

## Regression tests

Add focused tests, preferably in `server/services/developerHubGitHubAdvancedSync.test.ts` or an existing Developer Hub test file.

Required cases:

1. atomic + local ahead + remote not ahead + compatible active source => `push_local_head`.
2. atomic + local ahead + remote ahead => blocked.
3. atomic + local ahead + incompatible active source => blocked with dual-source divergence reason.
4. atomic + local not ahead => `none`.
5. non-atomic => `none` from the atomic helper.
6. `decideGitHubSyncPlan({ action:"push", dirty:false, localAhead:1, remoteAhead:0, remoteExists:true, branchMatches:true })` => `push`.

## Acceptance criteria

For the incident state, after the fix is active in production:

- real remote master is `42123f4...`
- local master is ahead
- Review Push must NOT say `Synced/noop`
- Review Push must show `localAhead >= 1`
- Review Push must show committed source files
- expected action must be `push`
- Execute Reviewed Push must push the exact reviewed local HEAD
- after execution, `git ls-remote origin refs/heads/master` must equal the pushed local HEAD
- Developer Hub must never display `Successful/Synced` unless the remote head is confirmed at the expected SHA

## Bootstrap deployment (important)

There is a catch-22: the production Developer Hub is the broken component, so do not rely on it to push/deploy its own repair.

After implementing and committing the source fix locally:

1. build a production patch containing ONLY runtime files required for the Developer Hub fix:
   - `server/routes/developerHub.ts`
   - `server/services/developerHubGitHubAdvancedSync.ts`
2. stamp the patch using the active production `scripts/stamp-tas-patch-base.mjs`.
3. deploy it with the active production `scripts/deploy-active-release.sh` atomic deploy flow.
4. do NOT include test files in the production bootstrap patch.
5. verify TAS remains online.
6. reopen Developer Hub and run Review Push only.
7. required preview: local ahead is non-zero and expected action is `push`, not `noop`.
8. STOP before executing the GitHub push. The user will perform Execute Reviewed Push from the repaired Developer Hub.

Do not directly push from OpenHands. Do not merge. Do not create a PR.
