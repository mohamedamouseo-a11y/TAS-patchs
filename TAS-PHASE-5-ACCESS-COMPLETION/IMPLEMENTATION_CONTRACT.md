# TAS Phase 5 — Implementation Contract

This file is authoritative for implementation.

## 1. Preserve Phase 1–4

Do not replace or redesign existing systems. Reuse current RBAC, Data Scope, Audit, Notifications, Operational Settings, Excel Imports, Queues, and WhatsApp implementations.

## 2. Clients / Customers scope

First inspect the current schema and existing routers/services.

Determine the real ownership/assignment rule from existing code. `accountManagerId` may be used only if the business logic proves it is authoritative.

If safely established, add centralized Client scope support to the existing Phase 3 scope engine (`server/tasDataScope.ts` or its current equivalent):
- all: no extra restriction
- own/assigned: according to proven Client ownership/assignment semantics
- team: records belonging to users in actor's `users.teamId`
- branch: use only if Phase 5 discovers an authoritative branch relation

Apply server-side to every real Client endpoint where applicable:
- list/search
- get/detail
- count
- export
- edit/update
- delete/archive/restore
- assignment/reassignment

Do not filter only in the frontend.

If the ownership model remains ambiguous, make no speculative Client-scope change and report the exact ambiguity.

## 3. Branch scope

Search the real code/schema for branch/dealership/location membership.

Implement only when there is an authoritative actor-to-branch relation AND record-to-branch relation.

If absent, preserve fail-closed behavior for `branch`. Do not create a new branch-management subsystem in Phase 5.

## 4. Action UI parity

Use Phase 2 APIs/components (`canFeature`, feature/action grants, `TASActionGuard` or equivalent).

Denied actions should be hidden or disabled while server authorization remains authoritative.

Cover actual controls found in:
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

Do not add raw role-name authorization when RBAC can express the permission.
Do not weaken server checks.

## 5. Notification Preferences UI

Reuse existing `notificationPreferences.get/update` APIs and the current Notification Center.

Add the smallest user-facing preferences UI in an existing logical settings/notifications location.

Only expose backend-supported capabilities, such as:
- per-notification-type enabled/disabled
- sound preference
- popup/browser preference

Saving preferences must invalidate/refetch relevant preference state so Notification Center behavior updates.

Do not fake email, SMS, or unsupported channels.

Keep Arabic/English and RTL.

## 6. Admin / SuperAdmin semantics

Normal Admin = customer operational administrator.
SuperAdmin, if present = technical/developer only.

Do not require SuperAdmin for any Phase 5 business operation.

## 7. Regression rules

Do not change:
- Excel Import parsing/upload/processing
- `importBatchId` semantics
- Competitive Queue processing
- WhatsApp processing
- Phase 2 permission hierarchy
- Phase 3 existing Lead/child-entity scope
- Phase 4 Audit/Operational Settings
- existing owners/assignments

## 8. Verification

Verify as much as practical:
1. Client scope follows proven ownership semantics if implemented.
2. Out-of-scope Client cannot be fetched or edited.
3. Team Client scope excludes other teams.
4. Branch works only from authoritative membership or remains fail-closed.
5. Lead actions follow feature/action permissions.
6. Excel Import action visibility follows permissions while Delete/Restore remain Admin-only.
7. Queue action visibility follows permissions.
8. Quotation/task/test-drive/trade-in/finance action visibility follows permissions where controls exist.
9. Server still rejects manually crafted unauthorized mutations.
10. Notification preferences load/save and affect current Notification Center behavior.
11. Admin keeps full operational access.
12. Excel Import and Competitive Queue execution code remains unchanged.

Run production build.
Attempt full TypeScript check; if unavailable/OOM report `NOT VERIFIED` accurately.
Do not claim unexecuted tests passed.

## 9. Final report

Return:
- Client ownership rule discovered
- Client scope status
- Branch scope status
- UI action guards added (exact pages/actions)
- Notification preferences UI status
- exact changed files
- tests actually executed
- build result
- TypeScript result
- intentionally deferred items
- `git diff --stat`
- `git status --short`
- branch + HEAD
- explicit confirmation: No push was performed.
