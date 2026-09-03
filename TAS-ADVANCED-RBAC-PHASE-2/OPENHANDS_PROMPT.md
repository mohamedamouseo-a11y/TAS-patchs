You are working on repository `mohamedamouseo-a11y/TAS` in the current Developer Hub/OpenHands workspace.

Implement **Phase 2 — Advanced Roles & Permissions** from the patch bundle:

`mohamedamouseo-a11y/TAS-patchs/TAS-ADVANCED-RBAC-PHASE-2`

Read these files first and treat them as authoritative:

1. `README.md`
2. `IMPLEMENTATION_CONTRACT.md`
3. `drizzle/20260903_tas_advanced_rbac_phase2.sql`

IMPORTANT GIT SAFETY:

- Work on the current local `master` unless the workspace requires an isolated local branch.
- Do NOT push anything to GitHub.
- Do NOT merge on GitHub.
- Do NOT create a PR.
- Do NOT reset/clean/revert unrelated existing work.
- Preserve Excel Imports V1 and the WhatsApp changes already on current master.
- Leave the working tree ready for manual Developer Hub Review Push.

## Goal

Upgrade the existing TAS RBAC into an advanced hierarchical system controlled by the protected Admin/Super-Admin semantics.

Do NOT replace the existing RBAC. Extend it.

Current system already has:

- dynamic roles
- module permissions
- actions: view/create/edit/delete/export/approve/assign
- data scopes
- roles/users assignment UI
- `authorizeTasApiRequest`
- `TASPermissionGuard`

Phase 2 must add **feature/page-level overrides**, centralized UI action guards, deterministic server enforcement, and an advanced Roles & Permissions editor.

## Required permission behavior

Final effective permission resolution:

1. Check parent module permission.
2. Check optional feature override.
3. Missing feature override = inherit parent module.
4. Feature override may NARROW parent permission but may NOT widen a denied parent action.
5. Existing module dataScope remains inherited by child features.
6. Resolver-specific business restrictions remain stricter than generic RBAC.

Example:

A role may have:

- `sales.view = true`
- `sales.leads.view = true`
- `sales.excel_imports.view = false`

Result:

- Leads visible
- Excel Imports hidden
- Direct `/excel-imports` access denied
- Excel Imports API view calls denied

## Protected Admin / Super Admin

Keep the existing protected Admin authority model.

If deployment values such as `SuperAdmin`, `Super Admin`, or `Super Administrator` exist, normalize them safely to protected Admin semantics.

Do not create a competing second super-admin permission engine.

Protected Admin must:

- always retain full access
- never be deletable
- never be weakenable
- manage roles
- manage feature overrides
- assign user roles
- access RBAC audit information

## Database

Apply the supplied migration to the current isolated/candidate DB if available and safe:

`drizzle/20260903_tas_advanced_rbac_phase2.sql`

Create:

`tas_rbac_feature_permissions`

Do NOT seed feature rows for existing roles.

Absence of a row MUST mean inherit parent module permission so existing production roles keep working after migration.

If the repository mirrors DB schema in `shared/schema.ts`, add the table there too.

## Feature catalog

Create a centralized catalog shared by server/client where practical.

Inventory current TAS and Automotive routes/navigation instead of relying only on the minimum list.

Minimum feature keys include:

- `dashboard.home`
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
- `conversations.inbox`
- `conversations.monitor`
- `catalog.vehicles`
- `catalog.inventory`
- `catalog.brands`
- `finance.overview`
- `finance.programs`
- `service.overview`
- `service.bookings`
- `after_sales.overview`
- `after_sales.parts`
- `after_sales.feedback`
- `operations.overview`
- `reports.overview`
- `marketing.overview`
- `shipping.agent`
- `integrations.whatsapp_cloud`
- `integrations.whatsapp_gateway`
- `admin.overview`
- `admin.users`
- `admin.roles_permissions`
- `admin.audit_log`
- `admin.system_settings`

Each feature needs:

- stable key
- parent module
- Arabic label
- English label
- route metadata where relevant

Map additional real routes you find.

## Backend RBAC

Extend the existing system:

- `server/tasRbacPolicy.ts`
- `server/tasRbacRouter.ts`
- `server/tasRbacApiAccess.ts`

Do NOT implement a separate permissions service disconnected from these files.

Required router behavior:

### `tasRbac.catalog`
Return modules, actions, data scopes, and feature catalog.

### `tasRbac.me`
Return module permissions AND effective feature permissions.

### `tasRbac.listRoles`
Return role metadata, module matrix, raw feature overrides, effective feature permissions.

### `tasRbac.saveRole`
Save module + feature permissions transactionally and audit before/after.

### `tasRbac.resetFeatureOverrides`
Admin-only reset to inheritance.

### `tasRbac.assignUserRole`
Preserve existing behavior and audit.

## Server request enforcement

Add feature-aware authorization on top of `authorizeTasApiRequest`.

Prefer an explicit procedure/path mapping for major user-facing APIs rather than only substring inference.

Map at minimum:

- Leads
- Excel Imports
- Competitive Queues
- Quotations
- Tasks
- Test Drives
- Trade-ins
- Sales finance applications
- Conversations
- Catalog/inventory/brands
- Service bookings
- After-sales parts/feedback
- Reports
- Marketing
- Shipping
- WhatsApp/integrations
- TAS admin/users/roles/settings

Authorization order:

1. authentication
2. module action
3. feature action
4. existing data-scope request guard
5. resolver-specific restrictions

Critical regression rule:

Excel Imports `softDelete` and `restore` must remain Admin-only even if a non-admin role has `sales.excel_imports.delete` or edit permission.

## Client RBAC

Extend `client/src/lib/tasRbac.ts`.

Support:

- `canModule(module, action)`
- `canFeature(featureKey, action)`
- `featureGrant(featureKey)`
- existing `can(module, action)` for backward compatibility
- `scope(module)`

Create reusable components:

- `TASFeatureGuard`
- `TASActionGuard`

Use feature guards for pages/sections and action guards for buttons/menu items.

Do NOT write new authorization using raw role-name checks when RBAC can express it.

## Routes

Direct URL access must match sidebar visibility.

At minimum enforce:

- `/excel-imports` -> `sales.excel_imports.view`
- `/competitive-queues` -> `sales.competitive_queues.view`
- `/leads` -> `sales.leads.view`
- `/leads/:id` -> `sales.lead_profile.view`
- `/tas/sales` -> `sales.overview.view`
- `/tas/admin/permissions` -> protected Admin + `admin.roles_permissions.view`

Map all other relevant TAS/Automotive routes discovered during inventory.

## Sidebar/navigation

Update `CRMLayout.tsx` and other TAS nav components so each TAS/Automotive item uses a feature key.

A denied feature must not appear in navigation.

Do not accidentally hide unrelated legacy routes outside TAS RBAC scope.

## Tabs/buttons/action menus

Apply `TASActionGuard` or equivalent to significant actions in major TAS screens.

Priority:

### Leads
- create
- edit
- delete
- export
- assign/reassign

### Excel Imports
- edit
- archive
- view
- Delete/Restore remain Admin-only

### Competitive Queues
- create/configure
- assign/update members

### Quotations
- create
- edit
- delete
- approve where applicable
- export/share where applicable

### Tasks / Test Drives / Trade-ins / finance applications
- create/edit/assign/approve as applicable

### Catalog
- create/edit/archive
- inventory edit
- brand edit

### Reports
- export

### Integrations
- edit connection/settings actions

Do not weaken server authorization while adding UI guards.

## Roles & Permissions UI

Upgrade existing:

`client/src/pages/tas/TASRolesPermissionsPage.tsx`

Do NOT build a duplicate settings page.

Required UI:

- role search/list
- New Role
- role details
- module groups/cards
- module action toggles
- data-scope selector at module level
- nested feature/page rows
- Inherit / Custom status per feature
- per-feature action toggles
- module bulk actions:
  - Full Access
  - View Only
  - No Access
  - Reset Features to Inherit
- effective-permission preview
- assigned users
- user role assignment
- dirty-state indicator
- warning on leaving with unsaved changes
- protected Admin displayed read-only
- bilingual Arabic/English
- correct RTL

## Audit

Use existing `tas_rbac_audit_log`.

Audit:

- role.create
- role.update
- role.delete
- role.module_permissions.update
- role.feature_permissions.update
- role.feature_permissions.reset
- user.role.assign

Store meaningful before/after JSON.

## Phase boundary

Do NOT expand this task into Phase 3 record-level data filtering.

Preserve `dataScope` and current request-level protections, but full Leads/Deals/Clients record filtering will be implemented later.

## Backward compatibility

Must preserve:

- current Admin access
- existing built-in roles
- existing custom roles
- existing module-only permissions
- Excel Imports V1
- Competitive Queues
- current dataScope behavior

Existing roles with zero feature rows must behave as before through inheritance.

## Verification

Add/run focused tests or executable contracts for at least:

1. feature missing -> inherits parent
2. feature override can deny parent-granted action
3. feature override cannot grant parent-denied action
4. module view false forces child false
5. Admin full access
6. Admin cannot be weakened/deleted
7. custom role feature overrides persist
8. reset feature returns to inherit
9. sidebar and direct-route behavior agree
10. denied API returns FORBIDDEN
11. allowed API continues
12. Excel Imports non-admin Delete/Restore remain forbidden
13. role assignment refreshes effective permissions
14. catalog parity if server/client catalogs are mirrored
15. existing roles still work without override rows

Run production build.

Try the repository's TypeScript check with adequate Node heap. If it OOMs, report NOT VERIFIED; do not call esbuild a full TypeScript typecheck.

Do not claim unexecuted tests passed.

## Final report required

Return:

1. implementation summary
2. exact changed files
3. migration status
4. number of feature keys created
5. number of UI routes mapped
6. number of server procedures explicitly mapped
7. tests actually executed + exact pass/fail
8. TypeScript result
9. production build result
10. any endpoints still using compatibility fallback and why
11. `git diff --stat`
12. `git status --short`
13. current branch + HEAD SHA
14. explicit confirmation: **No push was performed.**

Do not stop after analysis. Implement the phase in the current workspace, verify it, and leave it ready for my manual Developer Hub push.