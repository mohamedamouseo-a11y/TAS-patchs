# TAS Storage Divergence Audit V1

Read-only audit for the active-release `storage` vs initialized `shared-runtime/storage` divergence that blocked atomic deployment.

## Safety

- No writes to TAS source, runtime, or database.
- No PM2 restart/stop.
- No file contents are printed.
- Reports only relative paths, file type, size, mtime, and SHA-256.
- Ignores the unified operation lock directory itself when comparing manifests.

## Classification

- `SAME`: same relative path and same content.
- `ONLY_ACTIVE`: exists only in active release storage.
- `ONLY_SHARED`: exists only in shared-runtime storage.
- `DIFFERENT_SAME_PATH`: same relative path exists in both, but differs.
- `SAFE_REBIND_CANDIDATE=YES`: there are no active-only files and no same-path conflicts, so active storage is a strict/equal subset of shared storage.
- `SAFE_UNION_CANDIDATE=YES`: there are active-only files but no same-path conflicts. A later repair could copy active-only paths into shared before rebinding.
- Any `DIFFERENT_SAME_PATH` requires explicit reconciliation before rebinding.
