# TAS RBAC Permissions V2 — UI, Navigation & Route Guards

Target: the currently active TAS server source that already contains **TAS RBAC Permissions V1**.

## Scope

This patch adds the admin-facing RBAC management experience and connects effective V1 permissions to the TAS/Automotive UI navigation and page routing.

### Adds

- `client/src/lib/tasRbac.ts`
  - client RBAC types/helpers
  - effective permission query hook
  - TAS/Automotive route → module mapping
- `client/src/components/TASPermissionGuard.tsx`
  - fail-closed page guard using `tasRbac.me`
  - dedicated Admin-only support for the role-management screen
- `client/src/pages/tas/TASRolesPermissionsPage.tsx`
  - Roles & Permissions admin page
  - module/action permission matrix
  - Data Scope selector
  - custom role creation/update/delete
  - user role assignment with explicit confirmation
  - protected Admin role rendered read-only
- `server/tasRbacUiV2.contract.test.ts`
  - static contract checks for routing, sidebar and RBAC admin UI wiring

### Integrates

The deterministic apply script modifies only:

- `client/src/App.tsx`
  - wraps TAS and Automotive private pages in module-level `view` permission guards
  - registers `/tas/admin/permissions`
- `client/src/components/CRMLayout.tsx`
  - fetches effective `tasRbac.me` permissions
  - uses RBAC instead of legacy fixed role lists for TAS/Automotive navigation
  - adds **Roles & Permissions** under the System group for Admin

## Apply

From a clone/fetch of this patch directory:

```bash
node scripts/apply-tas-rbac-v2-ui.mjs --target /path/to/isolated/TAS/candidate
```

The script fails closed if an expected source anchor is not found.

## Database

No schema or migration change is included in V2. The existing V1 RBAC tables are reused.

## Security boundary

V2 controls navigation and page-level access and supplies the administrator UI. Existing V1 RBAC management mutations remain server-protected. Fine-grained action/data-scope enforcement across the operational TAS API is intentionally handled as the next hardening patch after V2 passes deployment gates; do not claim V2 alone replaces every legacy endpoint guard.
