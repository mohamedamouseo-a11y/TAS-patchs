# TAS-LEADS-EXCEL-PROFESSIONAL-V4.1

Base TAS commit: `54f5e1c12338b5aa7064a385088ec011699f318b`

This phase closes the remaining gaps after V4 was pushed:

1. Reconcile production schema for `internal_notes`, `lead_transfers`, and `lead_reminders` using an idempotent, repository-tracked migration/reconciliation script.
2. Prove complete-history semantics with a test where a child record is older than the selected lead date range and must still be exported.
3. Run a true browser/UI export from the Leads page, not only direct API/curl.
4. Re-open and validate the downloaded XLSX.
5. Preserve V4 behavior: 7 sheets, one Lead Overview row per Lead ID, zero duplicates, phone-as-text, formula-injection protection, all matching leads export.

Do not push to `TAS/master`. Leave changes ready for manual push after review.
