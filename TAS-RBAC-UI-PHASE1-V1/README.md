# TAS RBAC UI Phase 1 V1

Purpose: replace hard-coded UI role gates for sensitive actions with TAS RBAC checks. This phase intentionally does not change route/view/navigation behavior; that is Phase 2.

## Scope
Sensitive actions only: create, edit, delete, assign, approve, export.

Do not change backend permission matrices, DB rows, migrations, or default role permissions.

## Required implementation rule
Use `useTasRbac(isAuthenticated)` and gate each UI action using the exact module/action pair that protects the corresponding API. Do not replace one hard-coded role list with another.

Example:
```ts
const { isAuthenticated } = useAuth();
const rbac = useTasRbac(isAuthenticated);
const canArchive = rbac.can("catalog", "delete");
```

## Required files and mappings

### client/src/pages/automotive/VehicleCatalogPage.tsx
- create vehicle -> `catalog.create`
- edit vehicle -> `catalog.edit`
- archive vehicle -> `catalog.delete`
- add image -> confirm backend inference, expected `catalog.create`
- set primary image -> confirm backend inference, expected `catalog.edit`
- remove image -> confirm backend inference, expected `catalog.delete`
- remove hard-coded `Admin/admin/SalesManager` archive gate.

### client/src/pages/tas/TASConversationsPage.tsx
- send manual message -> `conversations.create`
- update status -> `conversations.edit`
- create handover -> inspect actual backend inference first; use the exact module/action returned by `inferTasRbacModule` + `inferTasRbacAction` for `tas.handovers.create`.
- remove hard-coded `canCreateSalesHandover` role list.

### client/src/pages/tas/TASFinancePage.tsx
- create program -> `finance.create`
- update program -> `finance.edit`
- replace `isAdmin` action gating with separate RBAC flags.

### client/src/pages/automotive/AutomotiveFinancePage.tsx
- create program -> `finance.create`
- update program -> `finance.edit`
- do not use one admin boolean for both.

### client/src/pages/tas/TASMarketingPage.tsx
- create/add/import/send -> `marketing.create`
- edit/update -> `marketing.edit`
- delete/remove -> `marketing.delete`
- export/download -> `marketing.export`
- approve -> `marketing.approve`
- remove Admin/MediaBuyer role-name action gates.

### client/src/pages/automotive/AutomotiveMarketingPage.tsx
Same mapping using module `marketing`.

### client/src/pages/tas/TASOperationsPage.tsx
- create/add/import/send/schedule -> `operations.create`
- edit/update -> `operations.edit`
- delete/remove/archive -> `operations.delete`
- assign/reassign/transfer/dispatch -> `operations.assign`
- approve/confirm -> `operations.approve`
- remove admin-only action gates where RBAC grants the action.

### client/src/pages/automotive/AutomotiveOperationsPage.tsx
Same mapping using module `operations`.

### client/src/pages/tas/TASSalesPage.tsx
For every mutation button, inspect the exact TRPC path and backend inference before wiring.
- create manual lead/quotation/test drive/task/trade-in/finance application: normally `sales.create`
- update pipeline/stage/task: normally `sales.edit`
- assign/reassign/handover: use exact inferred module/action; do not guess
- delete endpoints: use exact inferred delete permission
- export: `sales.export`
- replace hard-coded role lists on action controls only.

### client/src/pages/tas/TASAdminPage.tsx
This page mixes modules. Do not replace `isAdmin` with one `admin.edit` flag. Use per-feature permissions:
- add vehicle -> `catalog.create`
- create branch -> verify `tas.branches.create` inference, expected `admin.create`
- create finance program -> `finance.create`
- create service type -> `service.create`
- upsert integration -> verify exact inference for `tas.channels.upsertIntegration`
Read-only cards can remain visible in Phase 1.

### client/src/pages/automotive/AutomotiveAdminPage.tsx
Same per-feature rule; derive exact module/action from each backend endpoint.

### client/src/pages/tas/TASDashboard.tsx
Only replace hard-coded role checks that enable mutations/actions. Leave pure view/navigation checks for Phase 2. Every mutation action must use `rbac.can(module, action)` matching backend inference.

### client/src/components/CRMLayout.tsx
Do not change general navigation/view behavior in Phase 1. The roles-module sidebar special case belongs to Phase 2.

### client/src/pages/tas/TASRolesPermissionsPage.tsx
Do not change `draft?.roleKey === "Admin"`; it protects the role being edited and is not current-user authorization.

## Backend source of truth
Before wiring each action inspect `server/tasRbacApiAccess.ts`, `inferTasRbacModule`, `inferTasRbacAction`, and the exact TRPC endpoint in `server/routers.ts`.
Frontend checks must match backend inference exactly.

## Acceptance cases
- `catalog.view=true` + `catalog.delete=false`: catalog visible, Archive hidden/disabled.
- `catalog.delete=true`: Archive available regardless of literal role name.
- `finance.create=false`: Create Finance Program unavailable even if role name was previously allowed.
- custom DB roles receive the same action UI as built-in roles with identical grants.
- UI never grants more than backend.
- no DB permission or role matrix changes.

## Verification
Run existing RBAC audit tests and the UI audit:
```bash
pnpm exec vitest run server/tasRbacPolicy.test.ts server/tasRbacApiAccess.test.ts client/src/lib/tasRbac.test.ts
pnpm check
node scripts/audit-tas-rbac-ui-gates.mjs
```
Inspect remaining warnings. View/navigation-only role checks are deferred to Phase 2 and should be reported separately.

## Safety
- no push to master
- no merge
- no DB writes
- no migrations
- if frontend/backend permission inference disagree, stop and report instead of loosening backend permissions
