# TAS Service Capacity — Phase 2 Finalize Source & Runtime V1

Purpose: close the gap created when Phase 2 was applied manually to the active atomic release after the atomic deploy was blocked.

Observed state:
- live Phase 2 schema/health verification passed;
- GitHub/canonical source still does not contain the Phase 2 source changes;
- active storage is already bound to shared runtime;
- the remaining runtime directories must be verified/finalized before the next atomic deployment.

This finalizer:
1. acquires the TAS deployment flock;
2. verifies the active release and canonical Git worktree are distinct;
3. verifies/finalizes runtime bindings for uploads, downloads, backups, wa_sessions, public/downloads;
4. only rebinds a local runtime directory when its file content is checksum-equivalent to the shared target;
5. keeps backups under .atomic-release/runtime-finalize-backups;
6. restarts TAS and verifies /tas/service HTTP 200 if runtime links changed;
7. applies the existing Phase 2 source patch to the canonical Git worktree only;
8. does NOT run DB migration, build, deploy, or modify the active release source;
9. leaves the canonical Git worktree dirty so Developer Hub can review/push the exact Phase 2 source changes.

Expected final markers:
SOURCE_SYNC=PASS
RUNTIME_BINDING=PASS
ACTIVE_SOURCE_UNCHANGED=YES
DB_UNCHANGED=YES
READY_FOR_GITHUB_PUSH=YES
ERROR=NONE
