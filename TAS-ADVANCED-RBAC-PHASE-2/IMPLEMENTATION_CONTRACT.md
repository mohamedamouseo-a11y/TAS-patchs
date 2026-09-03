# TAS Advanced Roles & Permissions — Phase 2 Implementation Contract

This document is authoritative for OpenHands/Developer Hub.

## 1. Preserve the current RBAC foundation

Do not replace the existing system. Reuse:

- `tas_rbac_roles`
- `tas_rbac_role_permissions`
- `tas_rbac_user_roles`
- `tas_rbac_audit_log`
- `server/tasRbacPolicy.ts`
- `server/tasRbacRouter.ts`
- `server/tasRbacApiAccess.ts`
- `client/src/lib/tasRbac.ts`
- `client/src/components/TASPermissionGuard.tsx`
- `client/src/pages/tas/TASRolesPermissionsPage.tsx`

Existing module permissions remain the parent policy.

## 2. Schema

Create `tas_rbac_feature_permissions` with optional role-specific feature overrides.

Required fields:

- `id`
- `role_id`
- `feature_key`
- `can_view`
- `can_create`
- `can_edit`
- `can_delete`
- `can_export`
- `can_approve`
- `can_assign`
- `created_at`
- `updated_at`

Requirements:

- unique `(role_id, feature_key)`
- FK to `tas_rbac_roles(id)` is acceptable with cascade on role deletion only if roles are actually hard-deleted; current system soft-disables roles, so no destructive cascade is necessary
- do not add user-data cascades
- no feature rows are required for existing roles: absence means inherit parent module

The migration must be idempotent or safe to apply once with a clear verification section.

## 3. Feature catalog

Create a stable catalog in a shared location usable by server/client, or mirror it with a parity test.

Each feature entry includes:

```ts
{
  key: "sales.excel_imports",
  module: "sales",
  labelAr: "استيرادات Excel",
  labelEn: "Excel Imports",
  routePrefixes?: ["/excel-imports"],
}
```

Inventory the current app and map all TAS/Automotive/sidebar routes that are user-facing.

At minimum include the feature keys listed in `README.md`.

Do not use arbitrary role names as feature logic.

## 4. Effective permission resolution

Implement a single server source of truth for effective feature permissions.

Pseudo-rule:

```ts
moduleGrant = effectiveTasPermissions(role)[feature.module]
override = featureOverride(role, feature.key)

featureGrant.action = moduleGrant.action && (override ? override.action : true)
```

Thus feature permissions can narrow parent permissions but cannot widen them.

If parent `view=false`, every action for every child feature resolves false regardless of stored override.

Feature data scope is inherited from the parent module in Phase 2. Do not create feature-specific data scopes yet.

Admin resolves full access even with missing feature rows.

## 5. Admin / Super Admin normalization

The protected authority remains the current Admin semantics.

Extend normalization only if needed so these legacy deployment values resolve to Admin:

- `Admin`
- `admin`
- `SuperAdmin`
- `Super Admin`
- `Super Administrator`

Do not let a custom role named similarly bypass protected Admin checks.

The protected Admin role:

- cannot be deleted
- cannot have permissions weakened
- can manage roles and feature overrides
- can assign roles
- can view RBAC audit information

## 6. RBAC router extensions

Extend `tasRbacRouter`.

### `catalog`

Return:

- modules
- actions
- data scopes
- feature catalog grouped by parent module

### `me`

Return:

- normalized role
- module permissions
- effective feature permissions

### `listRoles`

Return each role with:

- role metadata
- module permissions
- raw feature overrides
- effective feature permissions

### `saveRole`

Accept module permissions and feature overrides in one transaction.

Rules:

- protected Admin cannot be weakened
- validate every feature key against the catalog
- validate feature belongs to known parent module
- reject an override attempting to grant an action denied by the submitted parent module, or normalize it to false and return the normalized result
- replace only that role's feature overrides
- write audit before/after

### `resetFeatureOverrides`

Admin-only.

Input:

```ts
{ roleKey: string, featureKeys?: string[] }
```

Delete selected overrides (or all overrides for the role) so those features inherit the parent module again. Audit the operation.

### `assignUserRole`

Keep current transactional behavior and audit.

## 7. Server authorization

Extend the current API authorization architecture, not a second system.

Add an explicit feature-aware helper, e.g.:

```ts
authorizeTasFeatureRequest(user, {
  module,
  feature,
  action,
  input,
})
```

or enhance `authorizeTasApiRequest` to resolve the feature deterministically.

### Required precedence

1. authenticated user
2. module/action grant
3. feature/action effective grant
4. existing data-scope request protection
5. resolver-specific business restrictions

Resolver-specific restrictions remain stricter. Example: Excel Import Delete/Restore remains Admin-only regardless of `sales.excel_imports.delete`.

### API mapping

Create an explicit mapping for major TAS/Automotive procedures rather than depending only on fuzzy substring inference.

At minimum map procedures for:

- dashboard
- conversations/messages
- leads/sales pipeline
- Excel Imports
- Competitive Queues
- quotations
- tasks
- test drives
- trade-ins
- finance applications
- catalog/inventory/brands
- service bookings
- after-sales parts/feedback
- reports
- marketing
- shipping
- WhatsApp/integrations
- TAS admin/roles/users/settings

Fallback fuzzy inference may remain for backward compatibility but unknown user-facing TAS mutations must be logged/fail-closed where practical.

## 8. Client permission API

Extend `client/src/lib/tasRbac.ts` with feature-aware helpers.

Required APIs:

```ts
canModule(module, action)
canFeature(featureKey, action)
featureGrant(featureKey)
scope(module)
```

Maintain backward compatibility with existing `can(module, action)` call sites until migrated.

## 9. Reusable UI guards

Create reusable guards, preferably:

- `TASFeatureGuard`
- `TASActionGuard`

`TASFeatureGuard` controls page/section access.

`TASActionGuard` controls buttons/menu items without duplicating role checks.

Support a `fallback={null}` mode for simply hiding controls.

Examples:

```tsx
<TASActionGuard feature="sales.leads" action="assign">
  <Button>Assign</Button>
</TASActionGuard>
```

```tsx
<TASFeatureGuard feature="sales.excel_imports">
  <ExcelImports />
</TASFeatureGuard>
```

## 10. Route enforcement

Map TAS/Automotive routes to feature keys.

Required examples:

- `/excel-imports` -> `sales.excel_imports.view`
- `/competitive-queues` -> `sales.competitive_queues.view`
- `/leads` and `/leads/:id` -> `sales.leads.view` / `sales.lead_profile.view`
- `/tas/sales` -> `sales.overview.view`
- `/tas/admin/permissions` -> protected Admin + `admin.roles_permissions.view`

Direct URL access must not bypass the sidebar permission.

## 11. Sidebar/navigation

Inventory `CRMLayout.tsx` and any TAS navigation components.

Every TAS/Automotive item must have a feature key and be hidden when `canFeature(feature, "view")` is false.

Do not hide unrelated legacy non-TAS navigation unless the route belongs to this RBAC domain.

## 12. Tabs and actions

Inventory the main TAS screens and apply guards to significant tabs and controls.

Priority actions:

### Leads
- create
- edit
- delete
- export
- assign/reassign

### Excel Imports
- view
- edit
- archive
- delete/restore remains Admin-only

### Competitive Queues
- create/configure
- assign/update members

### Quotations
- create
- edit
- delete
- approve where applicable
- export/share if the action maps to export

### Tasks / Test Drives / Trade-ins / Finance applications
- create
- edit
- assign/approve where applicable

### Catalog
- create/edit/archive vehicles
- inventory edits
- brand edits

### Reports
- view/export

### Integrations
- view/edit connection settings

Do not reduce server security to match the UI. The server is authoritative.

## 13. Roles & Permissions UI redesign

Upgrade the existing page; do not build a separate admin screen.

Required UX:

- left panel role search/list
- New Role
- role metadata
- module cards/accordion
- module-level action toggles
- feature rows nested under module
- each feature row: Inherit/Custom badge
- per-feature action toggles
- bulk actions per module:
  - Full Access
  - View Only
  - No Access
  - Reset Features to Inherit
- data scope selector stays at module level
- effective permission preview
- users assigned to selected role
- user role assignment section
- save button with dirty-state indicator
- before-navigation/browser unload warning when dirty
- protected Admin read-only with clear badge
- bilingual Arabic/English + RTL

## 14. Audit UI

If the existing audit UI can display RBAC audit rows cleanly, add friendly labels for the new actions. Do not create another audit log page.

## 15. Backward compatibility

Critical:

- Existing roles without feature override rows inherit module grants, so the application does not suddenly disappear after migration.
- Existing custom roles remain valid.
- Existing module-only UI guards continue working during migration.
- Do not change Data Scope semantics in this phase.
- Do not regress Excel Imports V1 authorization.

## 16. Tests / contracts

Add focused tests or executable contracts for:

1. no feature override -> inherits module permission
2. feature override can deny parent-granted action
3. feature override cannot grant parent-denied action
4. module view false forces child feature view false
5. Admin always full
6. protected Admin cannot be weakened/deleted
7. custom role persists feature overrides
8. reset feature -> inherits again
9. sidebar feature visibility agrees with route guard
10. denied direct route does not render protected page
11. denied API request returns FORBIDDEN
12. allowed feature API request continues to resolver
13. Excel Imports non-admin delete/restore remain forbidden
14. role change invalidates/refetches effective permissions
15. feature catalog server/client parity if mirrored
16. migration leaves existing roles working via inheritance
17. build/typecheck gates

## 17. Completion report

OpenHands must return:

- summary
- exact changed files
- migration status
- feature catalog count
- routes mapped count
- server procedures mapped count
- tests actually run + results
- typecheck status
- build status
- `git diff --stat`
- `git status --short`
- branch + HEAD
- explicit confirmation no push was performed

Never claim unexecuted tests as passing.