You are working on `mohamedamouseo-a11y/TAS` after V4 was pushed.

Authoritative TAS base commit:
`54f5e1c12338b5aa7064a385088ec011699f318b`

Implement the patch bundle:
`mohamedamouseo-a11y/TAS-patchs/TAS-LEADS-EXCEL-PROFESSIONAL-V4.1`

Read first:
1. `README.md`
2. `IMPLEMENTATION_CONTRACT.md`

Do not stop at analysis. Implement, test, deploy to the current server workspace if that is the active TAS workflow, and leave changes ready for manual review/push.

Critical tasks:

1. Reconcile the database schema for `internal_notes`, `lead_transfers`, and `lead_reminders` in a repository-tracked, idempotent way. Production already has these tables because they were created manually during V4 testing, so your solution must be safe when the tables already exist and must not drop/recreate/truncate them.

2. Add a deterministic automated test proving complete-history semantics: a lead selected by the export date range has at least one child record older than `dateFrom`; that older child must still be present in the generated workbook.

3. Perform a REAL browser UI E2E export. Do not use curl/direct API as the substitute for this requirement. Log in through the browser UI, open Leads, open Export, choose the date range, click `Export All Matching Leads`, capture the browser download, and validate the downloaded XLSX.

4. Re-open the browser-downloaded XLSX and verify all V4 invariants: exact 7-sheet order, unique overview lead IDs, no duplicate child IDs, every child belongs to an overview lead, phones are text, no unsafe formulas, summary counts match, workbook opens successfully.

5. Preserve V4 behavior exactly unless a change is required to satisfy this contract. Do not reintroduce export limits or date-filter child history.

6. Run build/typecheck/focused tests and restart/reload the service only if needed by the normal server workflow.

GIT SAFETY:
- Do NOT push to TAS/master.
- Do NOT merge.
- Do NOT reset unrelated work.
- Do NOT create a PR unless explicitly told.

Return the exact final markers required by `IMPLEMENTATION_CONTRACT.md`, plus changed files, commands/tests run, `git diff --stat`, and `git status --short`.
