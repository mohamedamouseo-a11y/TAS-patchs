Implement and execute TAS Excel Import data cleanup V1.

Main repository: mohamedamouseo-a11y/TAS
Patch repository: mohamedamouseo-a11y/TAS-patchs
Patch branch: patch/tas-excel-import-data-cleanup-v1
Package: TAS-EXCEL-IMPORT-DATA-CLEANUP-V1

Read README.md first, apply TAS-EXCEL-IMPORT-DATA-CLEANUP-V1.patch, run the verifier, then run the cleanup script in dry-run mode against the production TAS database using the existing production runtime env. Never print DATABASE_URL or any secrets.

If dry-run succeeds, target counts are based only on Excel Import markers, and duplicateCrossReferences=0, execute the apply command with --apply --confirm=DELETE_TAS_EXCEL_IMPORT_DATA. Then run dry-run again and verify all target counts are zero.

Do not disable foreign keys, do not TRUNCATE, do not touch ordinary/manual/Meta/form leads, users, roles, RBAC, Google Drive, WhatsApp settings, or audit logs.

Create a local maintenance branch fix/tas-excel-import-data-cleanup-v1 and local commit for the script only. Do not push, merge, or create a PR. The data cleanup itself must be explicit and must not be wired into startup/deploy.
