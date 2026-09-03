You are working on repository `mohamedamouseo-a11y/TAS` from the current isolated Developer Hub/OpenHands workspace.

Your task is to implement the patch bundle stored in:

`mohamedamouseo-a11y/TAS-patchs/TAS-EXCEL-IMPORTS-MANAGEMENT-V1`

Read these patch files first and treat them as authoritative:

1. `README.md`
2. `IMPLEMENTATION_CONTRACT.md`
3. `drizzle/20260903_excel_import_management.sql`

IMPORTANT GIT SAFETY:

- Do NOT push anything to `TAS/master`.
- Do NOT merge anything.
- Do NOT open or merge a PR unless explicitly instructed later.
- Make the changes only in the current isolated workspace/branch so I can review and push them myself from Developer Hub.
- Preserve all unrelated local changes if any. Do not reset, clean, or overwrite unrelated work.

IMPLEMENTATION GOAL:

Turn the existing TAS Excel import batch into a fully manageable entity named **Excel Imports** while reusing the existing Excel import flow, Competitive Queue, soft-delete system, audit log, and TAS RBAC.

The final feature must include:

- New `/excel-imports` page.
- List all imports with file name, uploader, upload time, lead count, distribution type, processing state, lifecycle state.
- View the leads belonging to a selected import.
- Edit import metadata and only safe distribution settings.
- Admin-only Soft Delete.
- Admin-only Restore.
- Preserve Calls, Activities, Deals and historical CRM records.
- Cancel/pause active queue distribution when an import is deleted.
- Audit Edit/Delete/Restore/Archive actions with actor and previous/new values.
- View/Edit according to existing RBAC.
- Current / Deleted / Archived states.
- Delete impact preview with a prominent warning when linked leads have actual work.
- Restore only leads deleted by that import deletion operation.
- Never automatically restart a cancelled queue during Restore.

EXISTING ARCHITECTURE YOU MUST REUSE:

- `shared/schema.ts` already contains `tasExcelImportBatches`.
- `tas_excel_import_batches` already tracks sourceFileName, assignmentMode, selectedAgentIds, row statistics, processing status, uploader and timestamps.
- `tasLeadQueues` and `tasLeadQueueEntries` already persist importBatchId.
- `client/src/pages/ImportLeads.tsx` already sends `sourceFileName`, assignmentMode and selectedAgentIds and receives importBatchId/queueId.
- `leads` already has `deletedAt` and `deletedBy`.
- Existing `audit_logs` must be reused.
- Existing TAS RBAC server enforcement must be reused; do not build another permissions system.

SCHEMA/MIGRATION:

Apply the supplied SQL migration to the isolated candidate database only if a database is available and it is safe to do so. Mirror the migration in `shared/schema.ts`.

Critical new lead fields:

- `importBatchId`
- `deletedByImportBatchId`

Critical import lifecycle fields:

- `lifecycleStatus`
- delete/restore/archive actor/timestamps
- `distributionPausedAt`

Do not add destructive FK cascades.

BACKEND:

Implement a focused Excel Imports router/service and mount it into the existing tRPC tree, preferably under the TAS namespace.

Required operations:

- list
- get
- leads
- deleteImpact
- update
- softDelete
- restore
- archive
- unarchive

All mutations involving import + leads + queue + audit must be transactionally safe.

For softDelete:

- Admin only at server level.
- Soft-delete batch.
- Soft-delete linked active leads.
- Mark those leads with `deletedByImportBatchId=batchId`.
- Cancel active queue.
- Cancel waiting queue entries.
- Preserve assigned/completed history.
- Do not delete Activities/Calls/Deals/history.
- Audit the action and counts.

For restore:

- Admin only at server level.
- Restore the batch.
- Restore ONLY leads with `deletedByImportBatchId=batchId`.
- Do not restore leads that were independently deleted before the import deletion.
- Do not restart/recreate the competitive queue automatically.
- Keep distribution paused until an explicit safe action.
- Audit the action and restored count.

For update/distribution editing:

- Enforce existing RBAC sales/edit.
- Do not silently change historical ownership.
- Reject unsafe changes with a clear CONFLICT response if queue assignments have already progressed.

IMPORT PIPELINE INTEGRATION:

Modify the existing Excel import implementation so every lead newly created by an import stores that batch's `importBatchId`.

Do not attach skipped duplicates/pre-existing leads to a batch unless a new lead row is truly created.

Set lifecycle to completed when a successful import completes.

LEGACY DATA:

Use the supplied migration's authoritative backfill from `tas_lead_queue_entries(importBatchId, leadId)` for old competitive imports.

Do NOT infer links for historical Direct/None imports from filename, uploader, timestamps, owner or any heuristic.

FRONTEND:

Create `client/src/pages/ExcelImports.tsx` using existing CRM UI/layout conventions and RTL/bilingual conventions.

Add route and sidebar/navigation entry near Import Leads / Competitive Queues.

Arabic label: `استيرادات Excel`.

List columns:

- File Name
- Uploaded By
- Uploaded At
- Leads
- Distribution
- Processing
- Status
- Actions

Tabs:

- Current
- Deleted
- Archived

View must show metadata + paginated linked leads.

Delete UX:

- Admin-only visible button.
- Fetch deleteImpact before confirmation.
- Display total leads, active leads, worked leads, activity count, call count, deal count, waiting/assigned queue counts.
- If activities/calls/deals exist, show a strong warning.
- Clearly state that CRM history is preserved.
- Then require explicit final confirmation.

Restore UX:

After successful restore, explicitly tell the admin that leads were restored but queue distribution was not automatically restarted.

RBAC:

- View queries => existing TAS sales/view permission.
- Edit/update/archive => existing TAS sales/edit permission.
- Delete and Restore => strict Admin only, server enforced regardless of UI/RBAC matrix.

TESTS/QUALITY GATES:

Add focused tests described in `IMPLEMENTATION_CONTRACT.md` and run the relevant existing tests, especially Excel/Competitive Queue and RBAC contracts.

At minimum run the repository's appropriate equivalents of:

- typecheck / TypeScript baseline
- focused Excel import tests
- Competitive Queue tests
- RBAC tests
- full test suite where feasible
- production build

If the repository already has baseline TypeScript diagnostics, compare against baseline and ensure this change adds zero new diagnostics. Do not "fix" unrelated baseline errors unless necessary for this feature.

Before finishing, inspect the final diff for accidental unrelated changes.

FINAL REPORT REQUIRED:

Return:

1. Summary of what you implemented.
2. Exact changed files.
3. Migration status.
4. Tests run with pass/fail results.
5. Build/typecheck results.
6. Any legacy imports that cannot be linked safely and why.
7. `git diff --stat`.
8. `git status --short`.
9. Explicit confirmation: **No push to TAS/master was performed.**

Do not stop after analysis or only provide instructions. Actually implement the feature in the current workspace, run the available checks, and leave the working tree ready for my manual review/push.