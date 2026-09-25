# TAS Developer Hub — Atomic Clean Snapshot Fix V1

## Root cause

In atomic deployment mode, `createWorkingTreeCandidateTree()` started from the remote GitHub tree and overlaid only Git-dirty files.

That loses valid source already present in the canonical/active TAS workspace when that source is part of divergent local history rather than a dirty worktree entry. The result can be:

- Developer Hub shows `clean_snapshot_and_push`
- Review reports 0 changed files
- Execute Push succeeds
- GitHub receives an empty commit
- live/canonical source changes such as Phase 7 never reach GitHub

## Fix

Atomic review mode now builds the candidate tree as a **full allowlisted source snapshot**:

1. start with an empty temporary Git index;
2. collect the existing TAS source allowlist;
3. add every allowed source file from the canonical Developer Hub worktree;
4. exclude runtime/deployment/generated/secret-sensitive paths using the existing safety rules;
5. write the candidate tree;
6. compare that complete tree with the remote tree.

This matches the UI promise: "clean snapshot of the active/canonical TAS source".

Non-atomic Git behavior is unchanged.

## Safety

- no DB changes
- no migration
- no commit or push
- backs up active + canonical `server/routes/developerHub.ts`
- build required
- PM2 restart + HTTP check required
- source markers verified
- canonical Git index preserved

After deployment, Developer Hub Review Push should list the actual Phase 7 source changes instead of 0 files.
