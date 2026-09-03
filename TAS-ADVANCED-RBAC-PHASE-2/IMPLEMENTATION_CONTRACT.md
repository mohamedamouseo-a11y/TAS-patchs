# TAS Advanced Roles & Permissions — Phase 2 Implementation Contract

This document is authoritative for OpenHands/Developer Hub.

## 1. Authority model — MUST NOT be violated

### Normal Admin

`Admin` is the customer's operational administrator and must manage:

- users
- roles
- module permissions
- feature/page permissions
- role assignment
- RBAC audit
- Excel Imports management
- Competitive Queues
- normal CRM/business configuration
- customer-facing integration/settings pages

The Roles & Permissions UI is an **Admin feature**, not SuperAdmin-only.

### SuperAdmin

If `SuperAdmin`, `Super Admin`, or `Super Administrator` exists in this deployment, keep it distinct from Admin. It is reserved for developer/vendor-only capabilities such as developer tools, source-control/GitHub controls exposed inside the product, deployment/code controls, low-level developer API configuration, and technical diagnostics.

Do **not** normalize SuperAdmin to Admin in a way that collapses the distinction. Do **not** require SuperAdmin for normal business administration.

If no SuperAdmin role exists in the current product, Phase 2 does not need to invent customer-facing SuperAdmin UI. Only preserve a clean extension point for technical-only permissions if developer tooling is later mapped.

## 2. Preserve the current RBAC foundation

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

## 3. Schema

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
- absence of a feature row means inherit parent module
- do not seed overrides for existing roles
- no destructive user-data cascades

Mirror the schema in application schema definitions where appropriate.

## 4. Feature catalog

Create a stable shared catalog, or mirrored catalogs with a parity test.

Each entry includes a stable feature key, parent module, Arabic/English label, and route/API metadata where relevant.

Inventory the actual TAS/Automotive app. At minimum cover:

- dashboard home
- leads / lead profile
- Excel Imports
- Competitive Queues
- sales overview
- quotations
- tasks
- test drives
- trade-ins
- finance applications
- conversations
- catalog / inventory / brands
- finance
- service
- after-sales
- operations
- reports
- marketing
- shipping
- WhatsApp/integrations
- admin overview
- users
- roles & permissions
- audit log
- system settings

## 5. Effective feature permission

Single server source of truth:

```ts
moduleGrant = effectiveModuleGrant(role, feature.module)
override = featureOverride(role, feature.key)
effectiveAction = moduleGrant[action] && (override ? override[action] : true)
```

Rules:

- feature override may narrow but never widen parent
- parent `view=false` forces every child action false
- feature `dataScope` is not introduced in Phase 2; inherit parent module scope
- Admin has full operational access and cannot be weakened by ordinary RBAC editing

## 6. Admin protection

Normal Admin must:

- be able to access `/tas/admin/permissions`
- create/edit/deactivate non-Admin roles
- set module and feature permissions
- assign roles to users
- reset feature overrides to inheritance
- view RBAC audit data

Protect the Admin role itself from accidental weakening/deletion through the standard role editor.

This protection is for **Admin**, not a requirement that the operator be SuperAdmin.

## 7. RBAC router extensions

Extend `tasRbacRouter`:

### `catalog`
Return modules, actions, data scopes, feature catalog.

### `me`
Return normalized role, module permissions, effective feature permissions.

### `listRoles`
Admin-accessible. Return role metadata, module matrix, raw feature overrides, effective feature permissions.

### `saveRole`
Admin-accessible. Save module + feature permissions transactionally and audit before/after. Do not permit weakening/deleting the protected Admin role through this operation.

### `resetFeatureOverrides`
Admin-accessible. Delete selected/all feature override rows so features inherit parent again. Audit it.

### `assignUserRole`
Admin-accessible. Preserve transactional behavior and audit.

## 8. Server feature authorization

Extend the current authorization architecture, do not build a second engine.

Required precedence:

1. authenticated user
2. module/action permission
3. feature/action permission
4. existing request/data-scope checks
5. stricter resolver-specific business rule

Create deterministic mapping for major TAS/Automotive procedures. Fuzzy inference may remain only as compatibility fallback.

Important: Excel Imports Delete/Restore stays Admin-only at resolver/router level regardless of generic feature permissions.

## 9. Excel Imports non-regression

Phase 2 MUST NOT alter the existing Excel import execution pipeline.

Do not change:

- file parsing
- upload flow
- row processing
- importBatch linkage logic
- queue creation/processing
- lead creation semantics
- lifecycle implementation from V1 except where a permission guard wraps an existing operation

Only add permission visibility/action enforcement around the already implemented feature.

## 10. Client permission API

Extend `client/src/lib/tasRbac.ts` with:

- `canModule(module, action)`
- `canFeature(featureKey, action)`
- `featureGrant(featureKey)`
- `scope(module)`

Keep current `can(module, action)` backward-compatible.

## 11. Reusable UI guards

Create/extend centralized guards such as:

- `TASFeatureGuard`
- `TASActionGuard`

Use them for route/page access, sidebar, tabs, buttons, menus.

Do not use raw role-name checks where a permission can express the rule, except explicit Admin-only business rules such as Excel Import Delete/Restore.

## 12. Route/navigation enforcement

Direct URL and sidebar visibility must agree.

Examples:

- `/excel-imports` -> `sales.excel_imports.view`
- `/competitive-queues` -> `sales.competitive_queues.view`
- `/leads` -> `sales.leads.view`
- `/leads/:id` -> `sales.lead_profile.view`
- `/tas/sales` -> `sales.overview.view`
- `/tas/admin/permissions` -> normal Admin-accessible Roles & Permissions management

Map all relevant current routes.

## 13. Action-level controls

Apply feature/action checks to major controls without changing underlying workflow logic.

Priority:

- Leads: create/edit/delete/export/assign
- Excel Imports: view/edit/archive; Delete/Restore Admin-only
- Competitive Queues: create/configure/assign
- Quotations: create/edit/delete/approve/export where applicable
- Tasks/Test Drives/Trade-ins/Finance applications: relevant create/edit/assign/approve
- Catalog: create/edit/archive/inventory/brands
- Reports: export
- Integrations: customer-operational settings actions

## 14. Roles & Permissions UI

Upgrade the existing page only.

Required UX:

- Admin can open and use it
- role search/list
- New Role
- role metadata
- module cards/accordion
- module action toggles
- feature rows grouped under parent module
- Inherit / Custom indicator
- per-feature action toggles
- module bulk actions: Full Access, View Only, No Access, Reset Features to Inherit
- module-level data scope selector
- effective permission preview
- assigned users / role assignment
- dirty-state indicator
- unsaved-change warning
- Admin role displayed protected/read-only where necessary to prevent accidental lockout
- Arabic/English + RTL

## 15. SuperAdmin technical boundary

Do not move any normal Admin feature under SuperAdmin.

If the app currently contains developer-only pages/settings, keep them separate and document them. Examples could include vendor developer tools, code/deployment controls, GitHub/source-control controls, or low-level developer API diagnostics. Only those may be SuperAdmin-only.

Do not add GitHub push behavior to this patch.

## 16. Audit

Use `tas_rbac_audit_log` for:

- role.create
- role.update
- role.delete/deactivate
- role.module_permissions.update
- role.feature_permissions.update
- role.feature_permissions.reset
- user.role.assign

Store meaningful before/after JSON.

## 17. Phase boundary

Do not implement full record-level `dataScope` filtering across Leads/Deals/Clients here. That is Phase 3. Preserve existing request-scope behavior.

## 18. Backward compatibility

Critical:

- existing roles with no feature overrides behave exactly as before
- existing custom roles remain valid
- Admin retains normal operational administration
- no normal operational feature becomes SuperAdmin-only
- Excel Imports V1 workflow is unchanged
- module-only guards continue to function during migration

## 19. Required verification

Verify/test at least:

1. no override -> inherit parent
2. override can deny parent-granted action
3. override cannot grant parent-denied action
4. module view false forces child false
5. Admin can access and manage Roles & Permissions
6. Admin cannot accidentally delete/weaken its own protected base role
7. SuperAdmin, if present, is not required for normal Admin tasks
8. custom role feature overrides persist
9. reset feature returns to inherit
10. sidebar and direct route agree
11. denied API returns FORBIDDEN
12. allowed API continues
13. Excel Imports non-admin Delete/Restore remain forbidden
14. Excel import upload/processing code has no functional changes from Phase 2
15. existing roles work without override rows
16. build/typecheck gates

Do not claim unexecuted tests passed.

## 20. Completion report

Return:

- summary
- exact changed files
- migration status
- feature catalog count
- routes mapped count
- server procedures mapped count
- confirmation normal Admin manages Roles & Permissions
- confirmation SuperAdmin is only technical/developer scope if present
- confirmation Excel Import execution flow was not changed
- tests actually executed + results
- typecheck status
- build status
- `git diff --stat`
- `git status --short`
- branch + HEAD
- explicit confirmation no push was performed
