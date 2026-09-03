# TAS Phase 5 — Access Completion & Operational UX

Target repository: `mohamedamouseo-a11y/TAS`
Target branch for implementation: local `master`
Patch repository only: `mohamedamouseo-a11y/TAS-patchs`

## Goal

Close the remaining access-control and UX gaps before final testing, without redesigning Phase 1–4.

Phase 5 has four limited goals:

1. Complete Clients/Customers data-scope enforcement only after confirming real ownership semantics.
2. Enable Branch scope only if an authoritative branch-membership model already exists; otherwise keep it fail-closed.
3. Finish UI action guards for important buttons/actions so the UI matches server RBAC.
4. Add user-facing Personal Notification Preferences UI using the existing backend.

## Safety rules

Do not change:
- Excel Import upload/parsing/processing
- importBatchId logic
- Competitive Queue execution
- WhatsApp processing
- Phase 2 RBAC architecture
- Phase 3 Lead scope rules
- Phase 4 Audit/Operational Settings
- existing ownership/assignment data

Normal `Admin` remains the customer operational administrator. SuperAdmin, if present, remains technical/developer-only.

## Clients

Inspect the real Clients/Customers schema and business logic first. Do not assume `accountManagerId` is ownership merely because the column exists.

If ownership is proven, implement server-side scopes using the existing Phase 3 scope engine:
- own
- assigned
- team
- all

Cover list/search/detail/count/export/edit/delete/archive/assignment where those operations actually exist.

If ownership semantics cannot be proven, leave Clients explicitly deferred and document why.

## Branch scope

Inspect for an authoritative existing relationship:
- branch/dealership/location table
- user-to-branch membership
- record branch linkage

If it exists, implement branch scope with it. If it does not exist, keep branch scope fail-closed. Do not invent a branch management subsystem in this phase.

## UI action guards

Use the existing Phase 2 feature/action permission helpers and guards. Significant controls should disappear when denied while server authorization remains authoritative.

Priority areas:
- Leads: create/edit/delete/assign/reassign/transfer/handover/export
- Excel Imports: edit/archive/configuration; Delete/Restore remain Admin-only
- Competitive Queues: create/configure/member/assignment actions
- Quotations: create/edit/delete/duplicate/approve/export/share where applicable
- Tasks: create/edit/status/assign
- Test Drives: create/edit/assign where available
- Trade-ins / Finance Applications: relevant create/edit/approve actions
- Reports: export
- Catalog / Inventory: create/edit/delete/archive
- Integrations: operational edit/connect actions

Do not add raw role-name checks when RBAC can express the rule.

## Personal notification preferences

Reuse the existing `notificationPreferences.get/update` backend. Do not build another preferences service.

Expose only backend-supported preferences, such as:
- per-notification-type enable/disable
- popup/browser preference
- sound preference

Do not fake email, SMS, or unsupported delivery channels.

Keep Arabic/English and RTL support.

## Completion criteria

Phase 5 is complete when:
- Client scope is safely implemented or explicitly deferred because ownership cannot be proven.
- Branch scope is implemented from authoritative data or remains fail-closed.
- Major operational action buttons follow Phase 2 RBAC.
- Personal notification preferences load/save and affect the existing Notification Center.
- Production build passes.
- No push is performed automatically.
