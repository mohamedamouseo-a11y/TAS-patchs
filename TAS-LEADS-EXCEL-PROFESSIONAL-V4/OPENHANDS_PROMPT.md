You are working on repository `mohamedamouseo-a11y/TAS` in the current isolated OpenHands/Developer Hub workspace.

Implement the patch bundle stored in:

`mohamedamouseo-a11y/TAS-patchs/TAS-LEADS-EXCEL-PROFESSIONAL-V4`

Read these files first and treat them as authoritative:

1. `README.md`
2. `IMPLEMENTATION_CONTRACT.md`

Reviewed remote baseline: `TAS/master` commit `42123f4ce5ec20dfb345980b8d3f5fdbaf434d1b`.

If this workspace legitimately contains newer local/user changes, preserve them. Do not reset, clean, discard, or overwrite unrelated work.

## GIT SAFETY

- Do NOT push to `TAS/master`.
- Do NOT merge.
- Do NOT open/merge a PR unless explicitly requested later.
- Work only in the current workspace/branch.
- User will review and push manually after validation.

## OBJECTIVE

Fix and professionalize the TAS Leads Excel export from end to end.

The current implementation is incomplete by design/behavior: it defaults to a limited lead count, the current “All” behavior is bounded, and it does not export all data sources that the live Lead Profile shows. The user specifically reports duplicated results and missing Sales notes/data.

Do not patch symptoms. Trace the real current export path and Lead Profile data sources, then implement the contract.

## REQUIRED WORKBOOK

Create these sheets in this order:

1. `Summary`
2. `Lead Overview`
3. `Sales Notes`
4. `Activity Timeline`
5. `Deals`
6. `Transfer History`
7. `Follow-ups`

Critical invariant: `Lead Overview` = exactly one row per unique Lead ID.

All one-to-many data belongs in separate sheets and must be linked using Lead ID + the child record primary key.

## IMPORTANT DATA SEMANTICS

The selected export date range chooses the LEADS.

After a lead is selected, export its COMPLETE related history:

- internal Sales Notes (`internal_notes` / same source as `trpc.notes.byLead`)
- canonical Activities (`trpc.activities.byLead` source)
- Deals (`trpc.deals.byLead` source)
- Lead Transfers (`lead_transfers` / `trpc.transfers.byLead` source)
- Follow-ups/reminders

Do not cut child history merely because an activity/note/reminder was created before the selected lead range.

Exclude soft-deleted child rows when the live profile excludes them.

## LIMIT / COMPLETENESS FIX

The export must not depend on the Leads table pagination or default to only 100 rows.

Remove the misleading partial-export behavior.

Default = all matching leads for the selected filters/range.

A server safety ceiling is acceptable, but NEVER silently truncate. If the count exceeds it, fail clearly before creating a partial workbook and tell the UI both the matching count and limit.

## PROFESSIONAL EXCEL REQUIREMENTS

Use the existing `exceljs` dependency.

- consistent professional header styling
- sensible widths
- freeze header rows
- AutoFilter on tabular sheets
- wrapped Sales Notes / Activity Notes / descriptions
- consistent date/time formatting
- phone values stored as text
- clean rich-text -> multiline plain text conversion
- formula-injection protection for user-controlled text starting with `=`, `+`, `-`, `@`
- deterministic sheet/row ordering
- workbook must reopen cleanly without repair warning

Do not add a new spreadsheet library unless strictly necessary.

## FRONTEND

Update the existing Leads export UX in `client/src/pages/LeadsList.tsx`:

- keep the required export date range
- preserve current filters
- export all matching leads, independent from current page/page size
- remove/redesign the numeric limit that currently defaults to 100 and treats 5000 as All
- clearly explain in EN/AR that the selected date range chooses the leads and complete related history will be included
- show clear errors for over-limit/no-result/export failures

Do not redesign unrelated parts of the Leads page.

## TESTING — AUTOMATED

Update/add focused tests as required by `IMPLEMENTATION_CONTRACT.md`.

At minimum validate:

- no duplicate Lead IDs in Overview
- multiple notes do not duplicate Overview leads
- Sales Notes use actual internal notes source and all records appear once
- complete Activity Timeline
- Deals, Transfers, Follow-ups in their own sheets
- correct sheet order
- date range selects leads but does not cut related history
- no silent truncation
- phone as text
- formula-injection protection
- rich-text note cleanup
- generated workbook can be loaded back with ExcelJS

Run the relevant project commands, including focused export tests, typecheck (`pnpm check` or current equivalent), production build, and full tests where feasible.

Do not fix unrelated baseline issues unless required for this patch; add zero new diagnostics.

## MANDATORY REAL BROWSER TEST

After the code/tests/build are acceptable, use the browser capability OpenHands has been given and test the REAL export flow.

Do not stop after unit tests.

1. Open the running TAS application.
2. Use the already authorized session/account.
3. Go to Leads.
4. Choose a real date range with a manageable but non-trivial lead set.
5. Export from the actual UI.
6. Download the resulting `.xlsx`.
7. Reopen the downloaded file programmatically with ExcelJS.
8. Compare workbook row IDs/counts to source/API/database data for the exact exported lead IDs.
9. Produce a JSON validation report.

Do not create/edit/delete production CRM records just to create test data. The E2E flow must be read-only apart from downloading/exporting.

The validation JSON must contain at least:

- workbook filename
- sheet names
- unique lead count
- row count for every sheet
- duplicate Lead IDs in Overview
- duplicate Note IDs
- duplicate Activity IDs
- duplicate Deal IDs
- duplicate Transfer IDs
- duplicate Follow-up IDs
- missing source IDs per child entity
- extra export IDs per child entity
- workbookReopenedSuccessfully

PASS requires duplicate/missing/extra arrays to be empty for the tracked records.

## GOOGLE DRIVE HANDOFF — MANDATORY IF CONFIGURED

After validation, upload BOTH artifacts to the user's configured PRIVATE Google Drive:

1. actual exported `.xlsx`
2. validation `.json`

Suggested names:

- `TAS_Leads_Professional_Export_Test_2026-09-12.xlsx`
- `TAS_Leads_Professional_Export_Validation_2026-09-12.json`

Prefer the private folder `TAS/OpenHands Validation/` if appropriate/available.

Do NOT commit customer export data to GitHub or `TAS-patchs`.
Do NOT make Drive files public.

If Google Drive upload is unavailable, do not pretend it worked: return the exact local artifact paths and exact blocker/error.

## FINAL REPORT

Return:

1. Base commit/workspace state.
2. Root causes confirmed.
3. Exact files changed.
4. Workbook structure implemented.
5. Automated tests with pass/fail.
6. Typecheck/build results.
7. Actual browser E2E export result.
8. XLSX filename + size.
9. Validation JSON summary (counts, duplicates, missing, extra).
10. Google Drive folder/path and file IDs/links if supplied by the integration.
11. `git diff --stat`.
12. `git status --short`.
13. Explicit confirmation: **No push to TAS/master was performed.**

Do not stop at analysis, suggestions, or a plan. Actually implement, test, export, validate, and perform the Drive handoff.