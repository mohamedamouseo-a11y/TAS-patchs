# TAS Lead Residence & Sales Contact Visibility V1

Target repository: `mohamedamouseo-a11y/TAS`  
Reviewed baseline: `master@11b8efce`  
Patch folder: `TAS-LEAD-RESIDENCE-CONTACT-VISIBILITY-V1`

## Business requirements

1. Add an optional, persistent **Residence / محل الإقامة** field to prospective customers (leads).
2. Let authorized Lead Dispatcher / sales-management users see which assigned leads were contacted by sales and which were not.

## Contact definition

A lead is **Contacted** only when it has at least one non-deleted activity whose type is not `Note`. Notes alone never count as contact. The table shows the latest qualifying activity time and the user who recorded it.

## Security boundary

This does not make all leads visible to every SalesAgent. The feature remains behind the existing `assertTASSalesDispatchRead` / TAS RBAC gate. Existing ownership and data-scope rules remain unchanged.

## Included artifact

- `tas-lead-residence-contact-visibility-v1.patch`: implementation blueprint for schemas, API, TAS sales service, UI, and migration.
- `OPENHANDS_PROMPT.md`: safe execution prompt.

## Acceptance criteria

- Manual Lead Dispatcher creation accepts Residence and persists it.
- Generic lead create/update accepts Residence.
- Assigned-leads view displays Residence, owner, Contacted/Not contacted, latest contact time, and latest contacting user.
- Filter supports All / Contacted / Not contacted.
- Search matches Residence.
- A Note-only lead remains Not contacted.
- A Call/WhatsApp/SMS/Meeting/Offer/Email activity makes it Contacted.
- SalesAgent row-level access is not widened.
- Migration is additive and existing lead rows remain valid.
- `pnpm check`, `pnpm build`, and focused tests pass.

## Rollback

Code rollback: revert only the files changed by this patch.  
Database rollback is optional; leaving the nullable `leads.residence` column is safe. Do not drop it if production data has already been entered.
