# TAS Storage Cleanup Canary V2

This patch does not modify TAS source.

It exists because the first cleanup canary could hang silently for an unlimited period.

V2:
- keeps TAS PM2 online;
- emits stage-by-stage output immediately;
- bounds storagePut, Drive verification, and storageDelete;
- wraps the whole canary process with a hard shell timeout;
- preserves the currently applied TAS_STORAGE_CLEANUP_LEASE_FIX_V1 source;
- does not touch the existing 64 Help Center V5 media objects.

Run:

`bash TAS-STORAGE-CLEANUP-CANARY-V2/run.sh`

The output identifies exactly whether a hang occurs in upload, Drive verification, or delete/cleanup.

Do not commit or push from OpenHands.
