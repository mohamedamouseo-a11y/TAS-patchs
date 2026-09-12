Implement the V4.1.1 validation hotfix on top of the CURRENT TAS server workspace.

Authoritative patch docs:
- `mohamedamouseo-a11y/TAS-patchs/TAS-LEADS-EXCEL-PROFESSIONAL-V4.1.1/README.md`
- `mohamedamouseo-a11y/TAS-patchs/TAS-LEADS-EXCEL-PROFESSIONAL-V4.1.1/IMPLEMENTATION_CONTRACT.md`

Critical workspace rule:
- TAS/master is still `54f5e1c12338b5aa7064a385088ec011699f318b`.
- The server workspace already contains unpushed V4.1 changes.
- DO NOT reset, clean, checkout over, or discard those changes.
- Apply this hotfix directly on top of the current workspace state.

Confirmed issue:
The real Browser E2E validation JSON contains `summaryCountsMatch: false`, even though the previous final report declared overall PASS and omitted this failed field.

Required outcome:
1. Reproduce and diagnose the mismatch.
2. Verify actual Summary sheet values against actual entity rows.
3. Fix the validator if the workbook is already correct; fix the workbook only if an actual count is wrong.
4. Add/adjust deterministic regression coverage for Summary count parity.
5. Run the complete-history test and schema reconciliation checks again.
6. Run `pnpm build`.
7. Restart/verify service if code affecting runtime changed.
8. Perform a fresh TRUE browser UI export from Leads -> Export dialog -> Export All Matching Leads.
9. Reopen the downloaded XLSX programmatically.
10. Generate a new validation JSON where every required boolean passes, including exactly `summaryCountsMatch: true`.
11. Upload the new XLSX and validation JSON to the user's private Google Drive if configured.
12. Do NOT push to TAS/master.

Reporting rule:
Never declare PASS while any validation boolean is false.

Return:
- root cause of `summaryCountsMatch=false`
- changed files
- tests/commands run
- Browser E2E result
- XLSX + JSON artifact names and Drive links
- validation JSON summary
- `SUMMARY_COUNTS_MATCH=PASS|FAIL`
- all V4.1 final contract markers again
- `git diff --stat`
- `git status --short`
- explicit `PUSH_TO_MASTER=NO`
