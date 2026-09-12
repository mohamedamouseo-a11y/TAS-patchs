# TAS Leads Excel Professional Export V4

Target repository: `mohamedamouseo-a11y/TAS`

Target branch baseline reviewed: `master` at `42123f4ce5ec20dfb345980b8d3f5fdbaf434d1b`.

This patch fixes the Leads Excel export so it becomes a complete, auditable, professional workbook instead of a partially flattened export.

## Why this patch exists

The current TAS export has several correctness gaps:

- `client/src/pages/LeadsList.tsx` defaults export to 100 leads and sends an explicit `limit`; the UI labels 5000 as “All”, so exports can be silently incomplete.
- `server/db.ts#getLeadsForExport()` defaults to 100 rows and hard-caps at 5000.
- `server/excelExport.ts` currently exports one `Leads` sheet plus `Feedback History` and `Follow-up History`.
- The Lead Profile itself reads sales notes from `trpc.notes.byLead` / `internal_notes`, transfers from `trpc.transfers.byLead`, activities from `trpc.activities.byLead`, and deal data from `trpc.deals.byLead`. The current Excel export does not reproduce all of those profile sources.
- `server/services/leadEngagementExport.ts` applies the lead-selection date range to activity/follow-up history, which can make an exported lead profile look incomplete when older history exists.
- One-to-many data must never be joined into the Lead Overview in a way that multiplies lead rows.

## Required final workbook

The export must contain these sheets in this order:

1. `Summary`
2. `Lead Overview`
3. `Sales Notes`
4. `Activity Timeline`
5. `Deals`
6. `Transfer History`
7. `Follow-ups`

`Lead Overview` must contain exactly one row per unique lead ID. Every one-to-many entity must live in its own sheet and be linked back with Lead ID.

## Core behavior

- Export all leads matching the selected filters/date range, independent of current table pagination.
- Never silently truncate. If a configured safety ceiling is exceeded, return a clear error telling the user the actual matching count and the ceiling.
- The selected date range determines which leads enter the export. Once a lead is selected, include that lead’s complete related history (notes, activities, deals, transfers, follow-ups), not only child records created inside the selected range.
- Soft-deleted child records must not be exported unless the live Lead Profile intentionally shows them.
- Deduplicate by stable primary key, never by display text.
- Preserve rich-text note line breaks as clean plain text.
- Keep phone values as text so Excel does not remove `+` or leading zeroes.
- Neutralize Excel formula injection for all user-controlled text cells beginning with `=`, `+`, `-`, or `@`.
- Use consistent date/time formatting and professional workbook styling.

## Scope

Primary expected files:

- `client/src/pages/LeadsList.tsx`
- `server/excelExport.ts`
- `server/services/leadEngagementExport.ts` (may be renamed/refactored into a broader export service)
- `server/db.ts` only where export-specific querying is needed
- `server/excelExport.test.ts`
- additional focused export tests as needed

Trace the exact live Lead Profile data sources before coding. Reuse current DB/schema and current authorization. No schema migration is expected for this patch.

## Out of scope

- Auth/security hardening unrelated to export
- CRM redesign
- Import flow changes
- Database schema redesign
- Push/merge to `TAS/master`

## OpenHands entrypoint

Give OpenHands this file:

`TAS-LEADS-EXCEL-PROFESSIONAL-V4/OPENHANDS_PROMPT.md`

OpenHands must implement the patch, run the automated checks, then perform a real browser export and upload the generated `.xlsx` plus the validation report to the configured private Google Drive for review.

Do **not** commit exported customer data or validation artifacts containing customer data to the public `TAS-patchs` repository.