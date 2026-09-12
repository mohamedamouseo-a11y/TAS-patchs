# Implementation Contract — TAS Leads Excel Professional V4.1.1

## Starting state
Work on top of the CURRENT server workspace that already contains the unpushed V4.1 files and deployed V4 implementation. TAS/master is still at `54f5e1c12338b5aa7064a385088ec011699f318b`.

Do NOT reset, clean, checkout over, or discard the current V4.1 workspace changes.

## Confirmed discrepancy
The uploaded Browser E2E validation JSON reports:

`summaryCountsMatch: false`

The V4.1 contract explicitly required Summary counts to match actual sheet entity counts. A final PASS report must not hide or omit a failed validation field.

## Required work
1. Reproduce the current Browser UI export and validation locally/server-side.
2. Determine exactly why `summaryCountsMatch` is false.
3. Inspect the actual Summary sheet values and actual entity row counts.
4. If the workbook Summary values are correct, fix the validator logic only. Common issues to check include:
   - numeric counts stored as strings in the Summary sheet;
   - blank separator rows;
   - counting header rows vs entity rows;
   - label mapping differences such as `Activities` vs `Activity Timeline`, `Transfer History Records` vs `Transfer History`, and `Follow-ups / Reminders` vs `Follow-ups`.
5. If an actual workbook count is wrong, fix the workbook builder instead and add regression coverage.
6. Validation must compare these Summary values against real child-sheet entity counts:
   - Unique Leads
   - Sales Notes
   - Activities
   - Deals
   - Transfer History Records
   - Follow-ups / Reminders
7. Regenerate a real Browser UI E2E XLSX and validation JSON.
8. Final JSON MUST contain `summaryCountsMatch: true`.
9. Preserve all V4/V4.1 behavior and schema reconciliation.

## Regression checks
- Browser UI export succeeds.
- Workbook reopens successfully.
- 7 sheets remain in the required order.
- Lead Overview has unique Lead IDs.
- Child IDs have zero duplicates.
- Every child Lead ID exists in Lead Overview.
- Phone cells remain text.
- Formula injection protection remains effective.
- Complete-history contract test remains PASS.
- Schema reconciliation remains PASS for all 3 tables.
- `pnpm build` passes.
- Service remains online.

## Reporting integrity
Do not declare overall PASS if any generated validation boolean is false.

Return explicit marker:
`SUMMARY_COUNTS_MATCH=PASS|FAIL`

Also return all V4.1 markers again, changed files, tests run, browser artifact names/Drive links, `git diff --stat`, and `git status --short`.

## Git safety
Do NOT push to TAS/master.
