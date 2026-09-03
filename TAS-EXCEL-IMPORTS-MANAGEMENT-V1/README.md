# TAS Excel Imports Management V1

Patch bundle for turning every TAS Excel import into a manageable lifecycle entity without deleting historical CRM work.

## Target

- Source repository: `mohamedamouseo-a11y/TAS`
- Source branch: `master`
- Patch repository only: `mohamedamouseo-a11y/TAS-patchs`
- Do **not** push application changes to `TAS/master` from this patch bundle.

## Existing architecture reused

TAS already has:

- `tas_excel_import_batches`
- `tas_lead_queues`
- `tas_lead_queue_entries`
- Excel import flow in `client/src/pages/ImportLeads.tsx`
- Soft-delete columns on `leads`
- `audit_logs`
- TAS RBAC API enforcement
- Trash and Audit Log pages

This patch extends those components. It does not create a parallel import system.

## Product behavior

### Excel Imports page

Add `/excel-imports` and a navigation item named **Excel Imports**.

Default list excludes deleted imports and displays:

- File/import name
- Uploaded by
- Upload date/time
- Lead count
- Distribution type (`none`, `direct`, `competitive`)
- Processing status
- Lifecycle status
- Actions allowed by RBAC

Filters/tabs:

- Current
- Deleted
- Archived

### View

Opening an import shows the leads belonging to that import and core import metadata. Leads must be retrieved by `leads.importBatchId` and must support pagination/search.

### Edit

Allow RBAC-authorized edit users to update:

- `sourceFileName`
- distribution settings only while the import/queue state makes that change safe

Never rewrite historical lead owners merely because metadata is edited.

For distribution edits:

- `none -> direct/competitive` is allowed only when no distribution has already started and the server can create the required queue/assignments safely.
- changing selected agents is allowed only while there are no completed/assigned queue entries that would make the mutation destructive.
- otherwise return a clear `CONFLICT` response explaining why the setting is locked.

### Soft Delete

Admin only.

Deleting an import must be one database transaction:

1. Soft-delete the import batch.
2. Soft-delete only currently-active leads belonging to the import.
3. Set `leads.deletedByImportBatchId` for leads deleted by this action so Restore never revives a lead that had been deleted independently before the import was deleted.
4. Cancel the import's active queue.
5. Cancel waiting queue entries; do not destroy completed history.
6. Stop any pending distribution/assignment work associated with the batch.
7. Preserve Calls, Activities, Deals, notes and other historical records.
8. Write an Audit Log entry.

No hard deletes and no cascading history deletion.

### Delete warning / impact preview

Before showing the final delete confirmation, call a server preview endpoint and show:

- total leads
- active leads that will be soft-deleted
- leads with real work
- activities count
- Call activities count
- deals count
- active/waiting queue entries

If any activity/deal/call exists, render a prominent warning explaining that CRM history will remain preserved but the import and its leads will be hidden from normal active lists.

### Restore

Admin only.

Restore in one transaction:

1. Restore the import lifecycle.
2. Restore only leads where `deletedByImportBatchId = batchId`.
3. Clear `deletedByImportBatchId` on those restored leads.
4. Do not automatically restart a cancelled competitive queue. Keep distribution paused and show an explicit message. This avoids duplicate assignments. An admin may explicitly re-enable/rebuild distribution through an allowed edit action if safe.
5. Write an Audit Log entry.

### Archive

Archive is a non-destructive import lifecycle state. It hides the import from the Current tab but does not delete leads or CRM history. Archive/unarchive follows RBAC edit/delete rules defined by the existing matrix; Delete/Restore remain Admin-only regardless of matrix.

## Lifecycle model

Keep the existing processing `status` (`processing`, `completed`, `failed`, `cancelled`) for import execution state.

Add independent `lifecycleStatus`:

- `active`
- `completed`
- `deleted`
- `archived`

A Restore action sets lifecycle to the best valid non-deleted state (`completed` when processing status is completed; otherwise `active`) and records `restoredAt/restoredByUserId`. The UI may display a small “Restored” indicator from `restoredAt` without inventing a permanent `restored` state.

## RBAC

- View: TAS RBAC `sales.view`
- Edit/archive: TAS RBAC `sales.edit`
- Delete: Admin only, enforced server-side
- Restore: Admin only, enforced server-side

Never rely on hiding buttons as authorization.

## Audit

Use the existing `audit_logs` table with `entityType = "excel_import"`.

Actions:

- `excel_import.update`
- `excel_import.delete`
- `excel_import.restore`
- `excel_import.archive`
- `excel_import.unarchive`
- optional explicit distribution mutations such as `excel_import.distribution_update`

Store `previousValue` and `newValue` for edits and structured impact details for delete/restore.

## Files in this patch bundle

- `drizzle/20260903_excel_import_management.sql` — schema/data migration
- `IMPLEMENTATION_CONTRACT.md` — exact backend/frontend integration contract and acceptance gates
- `OPENHANDS_PROMPT.md` — ready-to-paste execution prompt

## Required verification

At minimum:

1. Apply migration on an isolated DB/candidate.
2. Import with `none`, `direct`, and `competitive` modes.
3. Verify every newly created lead gets `importBatchId`.
4. List/View/Edit import with RBAC.
5. Delete preview counts actual work correctly.
6. Admin soft-delete hides batch + linked leads while Calls/Activities/Deals remain queryable/history-preserved.
7. Queue waiting work is cancelled on delete.
8. Restore revives only leads deleted by this import action and does not auto-restart the queue.
9. Non-admin Delete/Restore API calls return FORBIDDEN.
10. Audit records actor, timestamp, previous/new values.
11. Existing Excel Competitive Queue tests continue passing.
12. Existing Trash/Audit functionality does not regress.
13. TypeScript baseline: zero new diagnostics.
14. Full tests and production build.

## Safety rule

Do not infer historical `importBatchId` using timestamps, uploader, filename or owner. Only backfill from an authoritative existing relation such as `tas_lead_queue_entries(importBatchId, leadId)`.