You are working on repository `mohamedamouseo-a11y/TAS` in the current Developer Hub/OpenHands workspace.

Implement **Phase 2 — Advanced Roles & Permissions** from:

`mohamedamouseo-a11y/TAS-patchs/TAS-ADVANCED-RBAC-PHASE-2`

Read first and treat as authoritative:

1. `README.md`
2. `IMPLEMENTATION_CONTRACT.md`
3. `drizzle/20260903_tas_advanced_rbac_phase2.sql`

## Git safety

- Work on current local `master` unless the workspace requires an isolated local branch.
- Do NOT push.
- Do NOT merge on GitHub.
- Do NOT create a PR.
- Preserve all unrelated current master work.
- Preserve Excel Imports V1 exactly.

## CRITICAL AUTHORITY MODEL

Do not confuse Admin with SuperAdmin.

### Admin

The normal `Admin` is the CUSTOMER'S FULL OPERATIONAL ADMINISTRATOR.

Admin must be able to manage:

- users
- roles
- module permissions
- feature/page permissions
- user role assignment
- RBAC audit/history
- Excel Imports
- Competitive Queues
- CRM/business settings
- customer-facing operational integrations/settings

**The Roles & Permissions page and all Phase 2 RBAC management belong to normal Admin.**

Do NOT make any of these features SuperAdmin-only.

### SuperAdmin

If the current deployment has `SuperAdmin`, `Super Admin`, or `Super Administrator`, keep it distinct from normal Admin.

SuperAdmin is reserved for TECHNICAL / DEVELOPER-ONLY capabilities such as:

- developer tools
- code/deployment controls
- GitHub/source-control operations exposed inside the product, if any
- low-level developer API configuration intended for the software vendor
- technical diagnostics unavailable to the customer

Do NOT normalize SuperAdmin into Admin in a way that removes this distinction.
Do NOT require SuperAdmin for normal business administration.
Do NOT add GitHub push functionality in this task.

If no SuperAdmin role exists in the current TAS application, do not invent unnecessary SuperAdmin UI in Phase 2. Just do not architect normal Admin features as SuperAdmin-only.

## Goal

Extend the EXISTING TAS RBAC, do not replace it.

Current system already has dynamic roles, module permissions, actions, data scopes, user-role assignment, `authorizeTasApiRequest`, and `TASPermissionGuard`.

Phase 2 adds feature/page-level permission overrides so Admin can control individual pages/features under a module.

Example:

A custom role may have `sales.view=true`, but Admin can configure:

- Leads = visible
- Excel Imports = hidden
- Competitive Queues = visible

Likewise Admin can separately control actions such as Create/Edit/Delete/Export/Approve/Assign where supported.

## Permission inheritance

1. Parent module permission is checked first.
2. Optional feature override is checked second.
3. Missing feature override means INHERIT parent module.
4. Feature override may deny/narrow a parent grant.
5. Feature override may NOT grant an action denied by the parent module.
6. `dataScope` remains module-level in Phase 2.

This inheritance rule is critical so EXISTING ROLES KEEP WORKING WITHOUT RECONFIGURATION after the migration.

## Do not change Excel Import processing

Phase 2 must NOT modify the Excel upload/import workflow.

Do not change:

- Excel parsing
- lead insertion semantics
- `importBatchId` linkage
- queue creation
- queue processing
- duplicate logic
- import lifecycle logic from V1

Only add feature/action permission wrappers around the existing Excel Imports UI/API where necessary.

Excel Imports Delete and Restore must remain **Admin-only** as already implemented.

## Database

Apply `drizzle/20260903_tas_advanced_rbac_phase2.sql` only if the candidate/current DB is available and safe.

Create `tas_rbac_feature_permissions`.

Do NOT seed feature rows for existing roles.
Absence of a feature row = inherit parent module.

Mirror schema definitions if required by this repository.

## Feature catalog

Create a centralized catalog of real TAS/Automotive user-facing features.

At minimum cover:

- dashboard
- leads / lead profile
- Excel Imports
- Competitive Queues
- sales overview
- quotations
- tasks
- test drives
- trade-ins
- sales finance applications
- conversations
- vehicle catalog / inventory / brands
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

Inventory the actual current routes/navigation and map them properly.

## Server

Extend the existing files/architecture:

- `server/tasRbacPolicy.ts`
- `server/tasRbacRouter.ts`
- `server/tasRbacApiAccess.ts`

Do not build a second permission engine.

Required behavior:

- `tasRbac.catalog` returns modules/actions/scopes/features
- `tasRbac.me` returns module + effective feature permissions
- `tasRbac.listRoles` is accessible to normal Admin and returns module grants + raw overrides + effective feature grants
- `tasRbac.saveRole` is accessible to normal Admin, saves module + feature permissions transactionally, audits before/after
- `tasRbac.resetFeatureOverrides` is accessible to normal Admin
- `tasRbac.assignUserRole` remains accessible to normal Admin

Protect the Admin base role from accidental weakening/deletion through the standard editor, but DO NOT require SuperAdmin to administer other roles.

## Feature-aware API enforcement

Extend `authorizeTasApiRequest` or add a connected helper.

Authorization precedence:

1. authentication
2. parent module action
3. feature action
4. existing scope protection
5. stricter resolver-specific restrictions

Create deterministic feature mapping for major TAS/Automotive APIs instead of relying only on substring inference.

## Client

Extend `client/src/lib/tasRbac.ts` with feature helpers such as:

- `canModule(module, action)`
- `canFeature(featureKey, action)`
- `featureGrant(featureKey)`
- existing `can(module, action)` stays backward-compatible
- `scope(module)` stays

Add reusable guards such as:

- `TASFeatureGuard`
- `TASActionGuard`

Use them for sidebar visibility, direct routes, tabs, buttons and menus.

## Roles & Permissions page

Upgrade the EXISTING:

`client/src/pages/tas/TASRolesPermissionsPage.tsx`

Normal Admin must be able to use the page fully.

Required UX:

- role list/search
- New Role
- role details
- module permissions
- nested feature/page permissions
- Inherit / Custom status
- action toggles
- Full Access / View Only / No Access / Reset Features to Inherit bulk controls
- module data scope selector
- assigned users
- role assignment
- effective permission preview
- dirty state / unsaved changes warning
- Admin base role protected against lockout
- Arabic/English and RTL

## Route examples

- `/excel-imports` -> `sales.excel_imports.view`
- `/competitive-queues` -> `sales.competitive_queues.view`
- `/leads` -> `sales.leads.view`
- `/leads/:id` -> `sales.lead_profile.view`
- `/tas/sales` -> `sales.overview.view`
- `/tas/admin/permissions` -> accessible to normal Admin for RBAC management

Map other actual TAS/Automotive routes too.

## Action guards priority

- Leads: create/edit/delete/export/assign
- Excel Imports: view/edit/archive; Delete/Restore stay Admin-only
- Competitive Queues: create/configure/assign
- Quotations: create/edit/delete/approve/export as applicable
- Tasks/Test Drives/Trade-ins/Finance applications: relevant actions
- Catalog: create/edit/archive/inventory/brands
- Reports: export
- customer-facing Integrations: edit/settings actions

Do not change business behavior, only authorization/visibility.

## Phase boundary

Do NOT implement full record-level data-scope filtering across Leads/Deals/Clients. That is Phase 3.

## Verification required

Verify/test at least:

1. missing feature override inherits parent
2. override can deny parent-granted action
3. override cannot grant parent-denied action
4. parent module view false forces child false
5. normal Admin can open/manage Roles & Permissions
6. Admin can create/edit other roles and assign users
7. Admin base role cannot be accidentally deleted/weakened through the standard editor
8. SuperAdmin, if present, is NOT required for normal Admin operations
9. custom feature overrides persist
10. reset returns feature to inheritance
11. sidebar and direct-route permissions agree
12. denied API returns FORBIDDEN
13. allowed API continues
14. Excel Imports Delete/Restore remain Admin-only
15. Excel import execution flow is functionally unchanged
16. existing roles with no feature overrides behave as before

Run production build.
Try full TypeScript check with adequate heap; if it OOMs, report NOT VERIFIED rather than calling build a full typecheck.
Do not claim unexecuted tests passed.

## Final report

Return:

1. summary
2. exact changed files
3. migration status
4. feature catalog count
5. routes mapped count
6. server procedures mapped count
7. explicit confirmation that normal Admin manages Roles & Permissions
8. explicit confirmation that SuperAdmin is technical/developer-only if present and is not required for operational administration
9. explicit confirmation Excel Import execution pipeline was not changed
10. tests actually executed + pass/fail
11. TypeScript result
12. production build result
13. `git diff --stat`
14. `git status --short`
15. branch + HEAD SHA
16. explicit confirmation: **No push was performed.**

Do not stop after analysis. Implement Phase 2, verify it, and leave local master ready for my manual Developer Hub push.