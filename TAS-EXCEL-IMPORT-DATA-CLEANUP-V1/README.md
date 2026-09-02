# TAS-EXCEL-IMPORT-DATA-CLEANUP-V1

## Goal

Remove only the lead data created by the TAS Excel Import flow and remove the uploaded Excel import batch/queue records. Do not touch ordinary leads created from Meta/forms/manual entry or unrelated sales data.

The TAS Excel importer marks created leads with `sourceMetadata.source = "Excel Import"` and stores `importBatchId`. It also creates records in `tas_excel_import_batches`, optional competitive queues, brand interests, assignments, conversations/handovers and in-app notifications.

## Target data

Delete/purge only data tied to Excel import batches:

- leads created by TAS Excel Import;
- `tas_excel_import_batches` rows (the uploaded-sheet/import history records);
- queue entries/members/queues belonging to those batches;
- import-created brand interests;
- assignments/activities and TAS sales artifacts whose `leadId` belongs to those imported leads;
- TAS conversation/message/dispatch/handover rows belonging to those imported leads;
- in-app notifications whose metadata points to one of those imported lead IDs.

Preserve:

- users and roles;
- ordinary/manual/Meta/form leads;
- unrelated sales data;
- RBAC settings;
- Google Drive / WhatsApp settings;
- audit logs (keep audit history intact);
- schema/migrations.

## Safety contract

The cleanup script is **dry-run by default**. It may only delete when both are supplied:

```bash
--apply --confirm=DELETE_TAS_EXCEL_IMPORT_DATA
```

It must never disable foreign-key checks and must never use `TRUNCATE`.

Before apply it must print counts only (no lead names, phones, emails or other PII) for:

- target import batches;
- target leads;
- target queues;
- target conversations;
- target conversation messages;
- target notifications;
- every table that has a `leadId`, `conversationId`, `conversationMessageId`, `queueId`, or `importBatchId` reference that will be affected.

The target lead set must be built from strong import markers:

1. `leads.sourceMetadata.source = "Excel Import"`, and/or
2. lead IDs linked to `tas_excel_import_batches` through queue entries or `tas_lead_brand_interests.source = "excel_import"`.

Do not select leads by name, phone number, created date, owner, campaign, or stage.

## Permanent removal

This cleanup is intentionally a permanent purge of the imported demo/test dataset, not a soft delete to Trash.

Before hard-deleting target leads, detect non-target leads whose `duplicateOfId` points at a target imported lead. If any exist, abort apply and report only the count. Do not silently modify non-target leads.

## Expected implementation

The patch adds:

`scripts/cleanup-tas-excel-import-data.ts`

Run from the TAS repository root:

```bash
pnpm exec tsx scripts/cleanup-tas-excel-import-data.ts
```

Expected dry-run marker:

`TAS_EXCEL_IMPORT_CLEANUP=DRY_RUN`

Apply only after reviewing the dry-run counts:

```bash
pnpm exec tsx scripts/cleanup-tas-excel-import-data.ts --apply --confirm=DELETE_TAS_EXCEL_IMPORT_DATA
```

Expected success marker:

`TAS_EXCEL_IMPORT_CLEANUP=PASS`

Run dry-run again after apply. Expected target counts are zero.

## Verification

After cleanup verify from DB/application:

- 0 remaining `tas_excel_import_batches`;
- 0 remaining `tas_lead_queues` tied to those batches;
- 0 active/import queue entries;
- 0 leads with `sourceMetadata.source = "Excel Import"`;
- no import-created TAS conversations for those deleted lead IDs;
- ordinary leads remain unchanged.

The script should be kept as a one-time maintenance utility only if desired. Do not wire it into startup/deploy automatically.

## Git workflow

OpenHands may apply the script locally and commit locally, but must **not push**, merge, or create a PR. Data cleanup is run explicitly; deploying the code alone must not auto-delete anything.
