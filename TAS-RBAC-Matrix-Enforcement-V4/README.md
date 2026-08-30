# TAS RBAC Matrix Enforcement V4

Purpose: make the UI, direct routes, action controls, and existing backend RBAC follow the permissions selected in `/tas/admin/permissions` instead of relying on hard-coded role names.

This patch is stored only in `TAS-patchs`. It does not deploy or modify the TAS production repository by itself.

## Confirmed bugs covered

From the SalesAgent permission test:

1. Legacy direct URLs mounted even though hidden from the sidebar:
   - `/admin`
   - `/import`
   - `/bd`
   - `/wa-gateway/accounts`
2. `catalog.view`-only users could still see/open Add Vehicle and edit controls.
3. Opening a conversation crashed because the page expected `detailsQ.data.conversation.status` while the server returns the conversation as a flat object plus `messages`.
4. Several TAS UI paths still derive capabilities from role names instead of the live permission matrix.

## What V4 does

### A. Direct-route parity

V4 composes the already validated sibling patch:

`TAS-RBAC-Legacy-Route-Parity-V2`

This closes the audited legacy direct-URL gaps without replacing `TASPermissionGuard`.

### B. Live matrix UI helper

Adds:

- `client/src/lib/tasUiPermissions.ts`
- `client/src/components/TASPermissionAction.tsx`

Pages can read the exact live module/action matrix:

- `view`
- `create`
- `edit`
- `delete`
- `export`
- `approve`
- `assign`
- `dataScope`

### C. Vehicle Catalog

`VehicleCatalogPage.tsx` is changed so UI actions follow the configured `catalog` matrix:

- Add Vehicle -> `catalog.create`
- Edit vehicle -> `catalog.edit`
- Upload/change images -> `catalog.edit`
- Archive/delete -> `catalog.delete`
- Save is fail-closed if the matching permission is missing.

A SalesAgent configured with `catalog.view=true` and all other catalog actions false must see the catalog but no add/edit/delete controls.

### D. Conversations

`AutomotiveConversationsPage.tsx`:

- fixes the flat conversation detail response adapter to prevent the confirmed `undefined.status` crash;
- Receive inbound / Send reply -> `conversations.create`;
- Update status -> `conversations.edit`;
- Create handover / assignment -> `conversations.assign`;
- conversation viewing remains controlled by `conversations.view` and the existing backend data scope.

### E. Sales page matrix migration

`TASSalesPage.tsx` begins replacing role-name admission with the live matrices for:

- `sales`
- `operations`
- `finance`
- `reports`
- `catalog`

The objective is that changing permissions in `/tas/admin/permissions` changes the UI without requiring a role-code edit.

## Backend security

V4 does **not** weaken or replace backend authorization.

The existing V3 backend remains the security boundary and already authorizes TAS API requests from the role permission matrix using inferred module/action plus data scope.

Do not remove `tasPermissionProcedure` or `authorizeTasApiRequest`.

## Apply only to an isolated candidate first

```bash
node TAS-RBAC-Matrix-Enforcement-V4/scripts/apply-tas-rbac-matrix-enforcement-v4.mjs --target /path/to/TAS-candidate
```

The apply script is fail-closed on missing expected source anchors.

## Mandatory compliance audit

After application run:

```bash
node TAS-RBAC-Matrix-Enforcement-V4/scripts/audit-tas-rbac-matrix-enforcement-v4.mjs --target /path/to/TAS-candidate
```

The audit scans TAS/Automotive UI source and fails if it finds mutation pages or hard-coded role UI that are not using the live matrix helper.

**Do not promote while the audit has findings.**

A finding is not permission to bypass the audit. Convert the affected action controls to `useTasModuleActions` / `TASPermissionAction`, then rerun.

## Normal validation gates

Use baseline-vs-candidate delta validation because the repository may already contain known TypeScript baseline diagnostics:

```bash
pnpm check
pnpm test
pnpm build
```

Acceptance:

- zero new TypeScript diagnostics attributable to V4;
- zero new test failures;
- zero new build failures;
- RBAC compliance audit PASS;
- existing `TASPermissionGuard` routes unchanged;
- public `/tas/quotation/:token` unchanged;
- backend authorization unchanged.

## Required permission regression

At minimum validate with test accounts for:

- Admin
- SalesManager
- SalesAgent
- Finance
- ServiceAdvisor
- MediaBuyer
- Viewer

For every role/module test:

`Sidebar -> Direct URL -> View -> Create -> Edit -> Delete -> Export -> Approve -> Assign -> Data scope`

Only test actions that exist in that module. Never create or mutate real customer data for a permission test.

### SalesAgent regression from the confirmed test

Expected with the matrix shown during testing:

- Dashboard view: allowed
- Conversations: view/create/edit according to selected matrix; no runtime crash
- Sales: view/create/edit according to selected matrix
- Catalog: view only; Add/Edit/Delete controls hidden
- Shipping: view only
- Finance/Service/After Sales/Operations/Reports/Marketing/Automotive Admin: direct URL denied
- `/admin`, `/import`, `/bd`, `/wa-gateway/accounts`: direct URL denied

## Deployment safety

This patch repository does not deploy anything.

When applying on the server:

- no push;
- no commit unless explicitly requested;
- no PM2 restart during candidate validation;
- no production user/role/data mutation;
- do not change the RBAC matrix to make a failing UI test pass.
