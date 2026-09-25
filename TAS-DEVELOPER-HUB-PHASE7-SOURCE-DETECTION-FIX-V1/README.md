# TAS Developer Hub — Phase 7 Source Detection Fix V1

Problem:
- Phase 7 core source is present in canonical/live source.
- Developer Hub Review Push enters clean_snapshot_and_push with 0 reviewed files.
- Resulting GitHub commits contain no Phase 7 core file changes.

This repair is source-detection only.

It:
- resolves active and canonical roots
- verifies Phase 7 markers in both
- clears skip-worktree / assume-unchanged flags for the Phase 7 core files
- refreshes the Git index stat cache for those paths without staging content
- verifies Git can now see differences vs HEAD
- prints exact path/hash/status diagnostics

It does NOT:
- modify source contents
- touch DB
- build
- restart PM2
- commit
- push

Targets:
- server/tasDb.ts
- server/routers.ts
- client/src/pages/tas/TASServicePage.tsx
