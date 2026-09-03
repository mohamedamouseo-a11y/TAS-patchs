# TAS Advanced Roles & Permissions — Phase 2

Patch bundle for upgrading the existing TAS RBAC into a hierarchical, Super-Admin-controlled permissions system without replacing the current role matrix.

## Target

- Source repository: `mohamedamouseo-a11y/TAS`
- Source branch: `master`
- Patch repository only: `mohamedamouseo-a11y/TAS-patchs`
- Do **not** push application changes to `TAS/master` from this bundle.

## Existing architecture reused

TAS already has:

- `server/tasRbacPolicy.ts`
- `server/tasRbacRouter.ts`
- `server/tasRbacApiAccess.ts`
- `client/src/lib/tasRbac.ts`
- `client/src/components/TASPermissionGuard.tsx`
- `client/src/pages/tas/TASRolesPermissionsPage.tsx`
- `tas_rbac_roles`
- `tas_rbac_role_permissions`
- `tas_rbac_user_roles`
- `tas_rbac_audit_log`
- module actions: `view/create/edit/delete/export/approve/assign`
- data scopes: `own/assigned/team/branch/all`

Phase 2 extends this system. It must not create a parallel permission engine.

## Why Phase 2 is needed

The current matrix is module-level. For example, `sales.view` is too broad to independently control Leads, Excel Imports, Competitive Queues, Quotations, Tasks, Test Drives, etc.

Phase 2 adds optional **feature/page-level overrides** while preserving module permissions as the parent/fallback policy.

## Permission model

Permission resolution becomes:

1. Admin protected full access.
2. Resolve role module permission.
3. If a feature override exists for that role + feature, apply the override.
4. If no feature override exists, inherit the parent module permission.
5. Server remains source of truth; UI hiding is only secondary enforcement.

A feature override must never grant an action that the parent module denies unless the implementation deliberately supports explicit feature grants and validates them consistently. For V2, use **parent-cap semantics**: feature permission can narrow the module grant, never widen it.

## Phase 2 feature catalog

Create a centralized catalog shared by server/client (or mirrored with a contract test) with stable feature keys.

Minimum required features:

### Dashboard
- `dashboard.home`

### Sales
- `sales.overview`
- `sales.leads`
- `sales.lead_profile`
- `sales.excel_imports`
- `sales.competitive_queues`
- `sales.quotations`
- `sales.tasks`
- `sales.test_drives`
- `sales.trade_ins`
- `sales.finance_applications`

### Conversations
- `conversations.inbox`
- `conversations.monitor`

### Catalog
- `catalog.vehicles`
- `catalog.inventory`
- `catalog.brands`

### Finance
- `finance.overview`
- `finance.programs`

### Service / After Sales
- `service.overview`
- `service.bookings`
- `after_sales.overview`
- `after_sales.parts`
- `after_sales.feedback`

### Operations / Reports / Marketing
- `operations.overview`
- `reports.overview`
- `marketing.overview`

### Shipping / Integrations
- `shipping.agent`
- `integrations.whatsapp_cloud`
- `integrations.whatsapp_gateway`

### Administration
- `admin.overview`
- `admin.users`
- `admin.roles_permissions`
- `admin.audit_log`
- `admin.system_settings`

The implementation may add more feature keys after inventorying the actual current navigation/routes. Do not omit a TAS/Automotive route simply because it is not listed here; map every relevant route to a feature.

## Actions

Keep the existing actions:

- View
- Create
- Edit
- Delete
- Export
- Approve
- Assign

Use actions for UI controls as well as API authorization.

Examples:

- Excel Imports page visibility: `sales.excel_imports.view`
- Edit Import button: `sales.excel_imports.edit`
- Archive Import: `sales.excel_imports.delete` or `edit` according to the existing operation contract; server behavior must remain consistent.
- Lead assignment button: `sales.leads.assign`
- Export button: `sales.leads.export`
- Create quotation: `sales.quotations.create`

## Super Admin behavior

The existing protected `Admin` role remains the permission administrator and cannot be weakened/deleted.

Normalize legacy labels such as `SuperAdmin`, `Super Admin`, and `Super Administrator` to the protected Admin semantics if those values already exist in deployments. Do not create a second competing super-admin authority model.

Only protected Admin semantics may:

- create/edit/delete roles
- change feature overrides
- assign roles to users
- view RBAC audit history

## Roles & Permissions UI

Upgrade `/tas/admin/permissions` into an advanced editor with:

- role list/search
- create custom role
- role details
- module permission matrix
- feature/page permissions grouped under each module
- action toggles
- Inherit / Custom indicator per feature
- bulk actions: View only / Full module / Clear module / Reset features to inherit
- user-role assignment section
- effective permission preview
- unsaved-change warning
- protected Admin role read-only
- Arabic/English labels and RTL

When a module View is disabled, all child feature views/actions must resolve to disabled.

## Navigation / routes / tabs / buttons

Centralize UI checks.

Add reusable helpers/components, e.g.:

- `useTasPermission(feature, action)`
- `TASFeatureGuard`
- `TASActionGuard`

Use them to enforce:

- sidebar/navigation visibility
- route access
- tabs inside pages
- primary action buttons
- row action menus

Do not scatter raw role-name checks such as `role === 'SalesManager'` for authorization when an RBAC permission can express the rule.

## Backend enforcement

Add feature-aware authorization on top of `authorizeTasApiRequest`.

Required behavior:

- API route/procedure resolves parent module + action + feature.
- Module permission is checked first.
- Optional feature override narrows the module permission.
- No UI-only authorization.
- Unknown TAS mutating endpoints should fail closed where practical, or be included in an explicit compatibility allowlist with a documented reason.

The implementation must inventory existing TAS/Automotive tRPC procedures and map them deterministically to feature keys for the major user-facing areas.

## Audit

Use `tas_rbac_audit_log`.

Audit at minimum:

- role.create
- role.update
- role.delete
- role.feature_permissions.update
- role.module_permissions.update
- user.role.assign

Store actor, target, before JSON, after JSON, and timestamp.

## Phase boundary

Phase 2 stores and resolves `dataScope` but does **not** attempt the full record-level data filtering rollout across Leads/Deals/Clients. That is Phase 3.

Do not regress existing request-scope protections already present in `tasRbacApiAccess.ts`.

## Files in this patch bundle

- `README.md`
- `IMPLEMENTATION_CONTRACT.md`
- `drizzle/20260903_tas_advanced_rbac_phase2.sql`
- `OPENHANDS_PROMPT.md`

## Required quality gates

Before declaring done:

1. Existing roles continue to work through inheritance without requiring manual reconfiguration.
2. Admin retains full access.
3. A role can hide Excel Imports while still viewing Leads.
4. A role can view Leads but cannot create/edit/delete/assign/export when those actions are off.
5. Sidebar and direct route access agree.
6. Server denies manually constructed requests when feature/action permission is denied.
7. Creating a custom role persists module + feature permissions.
8. Feature reset-to-inherit behaves correctly.
9. Audit captures before/after changes.
10. Existing Excel Imports Admin-only delete/restore restrictions remain stricter than generic feature permissions.
11. Existing TAS RBAC behavior not covered by feature overrides remains backward compatible.
12. Production build passes.
13. Focused RBAC tests/contracts run where possible.

## Git safety

OpenHands/Developer Hub must leave the implementation on the local `master` (or current isolated branch if the workspace requires it) for manual reviewed push. It must never push automatically.