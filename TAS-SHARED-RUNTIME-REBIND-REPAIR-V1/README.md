# TAS Shared Runtime Rebind Repair V1

Purpose: safely repair the TAS atomic-deployment runtime binding when `shared-runtime` is initialized but the active release still has one or more local runtime directories.

Triggered by:
`Active storage is not bound to shared runtime; unified TAS operation lock is unavailable`.

## Safety model

- Acquires the same atomic deployment flock before changing runtime paths.
- Refuses to run if a TAS shared operation lock is present.
- Verifies PM2 is running from the current active release.
- Checks all protected runtime paths before making any change:
  - storage
  - uploads
  - downloads
  - backups
  - wa_sessions
  - public/downloads
- Existing active directory can be rebound only when:
  - it is byte-equivalent to the shared target (rsync checksum comparison), or
  - the shared target is empty, in which case active data is copied there and verified first.
- If both active and shared contain differing data, the repair stops with no runtime mutation.
- Stops TAS briefly only after the entire preflight is safe, repeats the safety comparison, then rebinds.
- Original active runtime directories are moved to a timestamped backup under `.atomic-release/runtime-rebind-backups`; they are not deleted.
- On repair failure the script restores the original runtime directories and restarts TAS.
- No application source or database rows are changed.

After a successful rebind the wrapper automatically retries the existing Phase 2 Branch Scheduling atomic deployment.

## Success

Expected end state includes:

```text
RUNTIME_REBIND=PASS
RUNTIME_PATHS_BOUND=YES
PM2_AFTER_REBIND=online
RETRY_PHASE2=YES
PATCH=PASS
MIGRATION=PASS
DEPLOY=PASS
HTTP=200
ERROR=NONE
```
