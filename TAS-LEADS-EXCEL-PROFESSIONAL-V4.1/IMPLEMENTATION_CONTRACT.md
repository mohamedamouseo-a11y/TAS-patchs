# Implementation Contract — TAS Leads Excel Professional V4.1

## Authoritative base
Implement against TAS commit `54f5e1c12338b5aa7064a385088ec011699f318b` or a descendant containing the V4 export changes.

## Scope
Only close V4 verification/schema gaps. Do not redesign unrelated CRM/export behavior.

## A. Schema reconciliation
Production previously required manual creation of these tables:
- `internal_notes`
- `lead_transfers`
- `lead_reminders`

Create repository-tracked, idempotent reconciliation that can safely run when tables already exist.

Requirements:
- Inspect current Drizzle/shared schema definitions and existing migration history first.
- Do not drop or recreate existing production tables.
- Do not destroy or truncate data.
- If a table exists, verify required columns/indexes and add only missing safe pieces.
- If a table does not exist, create it according to the authoritative current schema.
- Handle migration-history drift/pre-existing-table conflicts safely.
- Produce a verification command/script that reports each table as PRESENT/VALID or exact mismatch.
- Do not invent columns not present in current code/schema.

## B. Complete-history contract test
Add focused automated coverage proving that the export date range selects leads, while child history is not truncated by that range.

Required fixture/invariant:
- Lead matches the selected lead date range.
- At least one activity/note/reminder child belongs to that lead but predates `dateFrom`.
- Export must still contain that child record.
- Overview must contain exactly one row for the lead.
- No duplicated child IDs.

Prefer testing the V4 workbook builder directly with mocked data if that makes the contract deterministic.

## C. True browser/UI E2E
Use an actual browser session against deployed TAS:
1. Log in through the UI.
2. Navigate to Leads.
3. Open Export dialog.
4. Select a valid date range.
5. Trigger `Export All Matching Leads` from the UI button.
6. Wait for browser download and locate the XLSX.
7. Confirm HTTP/UI completion without direct curl as a substitute.
8. Re-open the XLSX programmatically and validate it.

Direct API/curl may be used only as an additional diagnostic, not as the required E2E proof.

## D. XLSX validation
Validate the downloaded browser-generated file:
- Sheet order exactly:
  1. Summary
  2. Lead Overview
  3. Sales Notes
  4. Activity Timeline
  5. Deals
  6. Transfer History
  7. Follow-ups
- `Lead Overview`: unique Lead IDs only.
- Child sheets: no duplicated entity IDs.
- Every child Lead ID must exist in Lead Overview.
- Phone cells remain text values.
- No user-supplied formula injection.
- Workbook re-opens successfully.
- Summary counts match actual sheet entity counts.

## E. Regression requirements
Preserve these V4 changes:
- no UI export row-limit selector;
- no silent 100/5000 truncation semantics;
- all matching leads export subject only to the V4 server safety ceiling;
- filter support including stage, quality, fit status, campaign, SLA, search, owner, lead date range;
- full child history independent of lead date range.

## F. Required checks
Run at minimum:
- focused V4/V4.1 export tests;
- relevant DB/schema verification;
- `pnpm build` or repository equivalent;
- typecheck/baseline check where applicable;
- real browser/UI export validation.

## G. Git safety
- Do not push to `TAS/master`.
- Do not reset unrelated changes.
- Do not merge or open a PR unless explicitly requested.
- Leave workspace ready for manual review/push.

## Final report markers
Return these exact markers:

`BASE_COMMIT=`
`PATCH=YES|NO`
`SCHEMA_RECONCILIATION=PASS|FAIL`
`INTERNAL_NOTES_TABLE=PASS|FAIL`
`LEAD_TRANSFERS_TABLE=PASS|FAIL`
`LEAD_REMINDERS_TABLE=PASS|FAIL`
`COMPLETE_HISTORY_TEST=PASS|FAIL`
`BROWSER_UI_EXPORT=PASS|FAIL`
`XLSX_REOPEN=PASS|FAIL`
`OVERVIEW_DUPLICATES=0|<count>`
`CHILD_DUPLICATES=0|<count>`
`PHONE_AS_TEXT=PASS|FAIL`
`FORMULA_INJECTION_PROTECTION=PASS|FAIL`
`BUILD=PASS|FAIL`
`SERVICE=RUNNING|FAIL`
`PUSH_TO_MASTER=NO`
`ERROR=NONE|<exact error>`

Also include changed files, commands/tests run, `git diff --stat`, and `git status --short`.
