# TAS Excel Imports Management V1 — Implementation Contract

This file is the source-of-truth implementation contract for OpenHands/Developer Hub.

## 1. Schema integration

Mirror `drizzle/20260903_excel_import_management.sql` in `shared/schema.ts`:

### `tasExcelImportBatches`

Add:

```ts
lifecycleStatus: mysqlEnum("lifecycleStatus", ["active", "completed", "deleted", "archived"]).notNull().default("active"),
deletedAt: timestamp("deletedAt", { mode: "string" }),
deletedByUserId: int("deletedByUserId"),
restoredAt: timestamp("restoredAt", { mode: "string" }),
restoredByUserId: int("restoredByUserId"),
archivedAt: timestamp("archivedAt", { mode: "string" }),
archivedByUserId: int("archivedByUserId"),
distributionPausedAt: timestamp("distributionPausedAt", { mode: "string" }),
```

Add indexes matching the migration.

### `leads`

Add:

```ts
importBatchId: int("importBatchId"),
deletedByImportBatchId: int("deletedByImportBatchId"),
```

Add indexes matching the migration.

Do not add destructive foreign-key cascades.

## 2. Existing Excel import flow

In the current `leads.import` / TAS Excel import implementation:

- Keep creating `tas_excel_import_batches` as today.
- Every lead successfully created by that request must persist `importBatchId = batch.id` in the same logical import operation.
- Batch processing status stays as-is.
- When import processing completes successfully, set `lifecycleStatus = "completed"`.
- Failed/cancelled import batches remain non-deleted and use lifecycle `active` unless explicitly archived/deleted later.
- Do not attach duplicate/skipped pre-existing leads to the import unless the current import semantics actually create a new lead row for them.

## 3. New server module

Prefer a focused module such as:

- `server/excelImportsRouter.ts`
- optional `server/services/excelImportsService.ts`

Mount it under the existing TAS namespace if practical, e.g. `tas.excelImports`, so `authorizeTasApiRequest` naturally maps it to the `sales` module because the API path contains import/lead/sales context. If inference does not map correctly, extend `inferTasRbacModule` explicitly and add a contract test.

Required procedures:

### `list`
Query input:

```ts
{
  lifecycle?: "current" | "deleted" | "archived" | "all";
  search?: string;
  page?: number;
  pageSize?: number;
}
```

Output rows should include:

- batch id
- source file name
- uploader id/name/role
- created/completed dates
- total/imported/duplicate/failed rows
- assignment mode and selected agents
- processing status
- lifecycle status
- deleted/restored/archived timestamps
- lead count from `leads.importBatchId`
- queue id/status where present

`current` means lifecycle is not deleted/archived.

### `get`
Returns batch metadata plus queue/distribution summary.

### `leads`
Paginated/searchable leads for one batch. Filter by `leads.importBatchId = batchId`. For normal View of a deleted import, allow showing its soft-deleted linked leads in this detail context; do not globally unhide them elsewhere.

### `deleteImpact`
Admin-only is acceptable, but it may also be available to a user who can see the delete control. The final `softDelete` must still independently enforce Admin.

Return at least:

```ts
{
  batchId,
  totalLeads,
  activeLeads,
  workedLeads,
  activitiesCount,
  callActivitiesCount,
  dealsCount,
  queueWaitingCount,
  queueAssignedCount
}
```

`workedLeads` = distinct linked leads with at least one Activity or Deal. Calls are Activities where `type='Call'`.

### `update`
RBAC sales/edit.

Editable metadata:

- `sourceFileName`
- distribution settings only when safe

Always load previous state first and write an audit record with previous/new values.

Distribution safety:

- Reject mutation if the batch is deleted/archived.
- Reject destructive changes after a queue has assigned/completed entries, unless the current queue service already exposes a safe dedicated mutation for that exact operation.
- Do not silently reassign existing lead ownership.

### `softDelete`
Strict Admin guard on server.

Perform in one DB transaction:

1. Lock/read the batch; return NOT_FOUND if missing.
2. If already deleted, make the operation idempotent or return a clear conflict.
3. Mark batch:
   - `lifecycleStatus='deleted'`
   - `deletedAt=NOW()`
   - `deletedByUserId=actor`
   - `distributionPausedAt=NOW()`
4. For linked leads where `deletedAt IS NULL`:
   - set `deletedAt=NOW()`
   - set `deletedBy=actor`
   - set `deletedByImportBatchId=batchId`
5. Cancel `tas_lead_queues` for this batch where status is active.
6. Cancel queue entries for this batch where status is `waiting`.
7. If another pending assignment/distribution table exists for this Excel flow, cancel only pending work; preserve assigned/completed history.
8. Do NOT delete Activities, Calls, Deals, Internal Notes, transfers, or other historical child data.
9. Insert `audit_logs` with action `excel_import.delete`, entityType `excel_import`, actor info, and impact summary.

### `restore`
Strict Admin guard on server.

One transaction:

1. Restore lifecycle to `completed` if processing status is completed, otherwise `active`.
2. Clear batch `deletedAt/deletedByUserId`.
3. Set `restoredAt=NOW()`, `restoredByUserId=actor`.
4. Restore **only** leads matching both:
   - `importBatchId=batchId`
   - `deletedByImportBatchId=batchId`
5. For those leads clear `deletedAt`, `deletedBy`, `deletedByImportBatchId`.
6. Do not automatically reactivate a cancelled queue or recreate assignments.
7. Keep `distributionPausedAt` populated until an explicit safe distribution action resumes/rebuilds it.
8. Audit as `excel_import.restore` with restored lead count.

### `archive` / `unarchive`
Non-destructive. No lead soft delete. Audit both actions.

## 4. Audit helper

Reuse the existing audit infrastructure (`audit_logs` / `createAuditLog`) rather than creating a second audit table.

Required fields:

- userId
- userName
- userRole
- action
- entityType=`excel_import`
- entityId=batchId
- entityName=sourceFileName
- details
- previousValue
- newValue

## 5. RBAC and authorization

View/Edit must go through the existing TAS RBAC permission system.

Expected mapping:

- list/get/leads/deleteImpact => sales/view
- update => sales/edit
- archive/unarchive => sales/edit or existing delete semantics if policy requires it
- softDelete/restore => **Admin role only**, checked inside the resolver/service even if RBAC grants delete/edit to another role

UI authorization is secondary; server is source of truth.

## 6. Frontend

Create `client/src/pages/ExcelImports.tsx` using the project's existing CRM layout/components and bilingual/RTL conventions.

### List UI

Columns:

- File Name
- Uploaded By
- Uploaded At
- Leads
- Distribution
- Processing
- Status
- Actions

Tabs/filters:

- Current
- Deleted
- Archived

Include search and pagination if consistent with existing page patterns.

### View UI

Use either a dedicated route or a large Dialog/Sheet. It must show:

- metadata summary
- import counts
- queue/distribution state
- paginated linked leads

### Edit UI

- filename field
- distribution fields rendered only if server says editable/safe
- server conflict messages must be surfaced clearly

### Delete UI

Delete is visible to Admin only.

Flow:

1. click Delete
2. fetch `deleteImpact`
3. render counts
4. if `activitiesCount > 0 || dealsCount > 0`, show strong warning
5. require explicit final confirm
6. execute softDelete
7. refresh lists/navigation counts

Never label the action as permanent deletion.

### Restore UI

Visible to Admin for deleted imports. After restore, show message that leads were restored but distribution was **not automatically restarted**.

## 7. Routing/navigation

Add route `/excel-imports` to `client/src/App.tsx` with the same authenticated/RBAC route-guard approach used for Import Leads/TAS Sales pages.

Add sidebar/navigation item **Excel Imports** near Import Leads / Competitive Queues. Respect existing permission visibility logic.

Add Arabic label: `استيرادات Excel`.

## 8. Trash/Audit compatibility

Do not rewrite the existing Trash page unless needed. It is acceptable for deleted imports to be restored from Excel Imports -> Deleted. If adding an Excel Import section to Trash can be done cleanly without destabilizing generic trash, it is optional for V1.

AuditLogPage should continue displaying free-form `excel_import` records. Add friendly labels only if the current page has a central entity/action label mapper.

## 9. Tests

Add focused tests/contracts for:

1. import attaches `importBatchId` to every newly created lead.
2. list defaults to excluding deleted/archived.
3. View returns only the batch's linked leads.
4. non-admin delete forbidden.
5. non-admin restore forbidden.
6. soft delete sets batch + active linked leads deleted.
7. soft delete does not mutate activities/deals.
8. soft delete cancels active queue and waiting entries.
9. restore revives only leads marked `deletedByImportBatchId=batchId`.
10. restore does not reactivate queue.
11. update audits previous/new values.
12. delete/restore audit actor + counts.
13. safe legacy competitive backfill covered by migration/contract where practical.
14. existing `tasExcelCompetitiveQueue*` tests remain green.
15. TypeScript/build regression gates.

## 10. Completion evidence

Before declaring done, output:

- exact changed files
- migration applied/not applied status
- tests run and results
- build result
- `git diff --stat`
- `git status --short`
- confirmation that no push to TAS master occurred

Do not claim success if migration/tests/build were not actually executed.