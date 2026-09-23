# TAS Storage Reconciliation Repair V1

Safe production repair for the characterized TAS storage divergence.

Prerequisite evidence from TAS-STORAGE-RECONCILIATION-PLAN-AUDIT-V2:
- AUTOMATED_RECONCILIATION_READY=YES
- Developer Hub encryption keys match.
- Both Developer Hub state files are valid JSON.
- Active Developer Hub state is logically newer.
- GitHub audit JSONL can be safely unioned.
- No unknown active-only paths exist.
- Same-path conflicts are limited to:
  - developer-hub.json
  - developer-hub-github-audit.jsonl

## Repair behavior

1. Acquire TAS atomic deployment flock.
2. Refuse if an operation lock exists in active or shared storage.
3. Re-run the same reconciliation safety checks.
4. Stop TAS.
5. Re-run safety checks while stopped.
6. Create full active-storage and shared-storage backups under:
   `.atomic-release/storage-reconciliation-backups/<timestamp>/`
7. Copy active-only known runtime files into shared storage.
8. Replace shared `developer-hub.json` with the logically newer active state.
9. Merge both GitHub audit JSONL histories, exact-line dedupe, ordered by event timestamp.
10. Verify matching Developer Hub key remains intact.
11. Rebind active `storage` to `shared-runtime/storage`.
12. Restart TAS and verify `/tas/service` returns HTTP 200.
13. Run the existing safe shared-runtime rebind for remaining runtime directories.
14. Retry Phase 2 Branch Scheduling deployment automatically.

No source code or DB rows are modified by the storage reconciliation itself.
