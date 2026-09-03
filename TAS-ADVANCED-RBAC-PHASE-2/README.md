# TAS Advanced Roles & Permissions — Phase 2

Patch bundle for upgrading the existing TAS RBAC into a hierarchical permissions system **managed operationally by the normal Admin role**.

## Non-negotiable authority model

This project has two different concepts and they must NOT be mixed:

### Admin = client / operational administrator

The normal `Admin` is the customer's full system administrator. Admin must be able to manage all normal business and operational settings, including:

- users
- roles
- permissions
- feature/page visibility
- role assignment
- Excel Imports management
- Competitive Queues
- CRM settings
- operational integrations/settings that are intended for the customer
- RBAC audit/history

**Phase 2 belongs to Admin.** The Roles & Permissions page must be visible and fully usable by Admin.

### SuperAdmin = technical/developer authority only

`SuperAdmin` / `Super Admin` / `Super Administrator`, if present in this deployment, is reserved for developer-only capabilities such as:

- developer tools
- source-control / GitHub operations exposed inside the application, if any
- code/deployment controls
- low-level API/developer configuration intended only for the software vendor
- technical diagnostics that are not customer-operational settings

SuperAdmin may also retain normal Admin access if the product already does so, but **normal Admin must never need SuperAdmin in order to manage users, roles, permissions, Excel Imports, queues, or other client operations.**

Do NOT normalize SuperAdmin into Admin in a way that removes this distinction. Do NOT make operational administration SuperAdmin-only.

## Target

- Source repository: `mohamedamouseo-a11y/TAS`
- Source branch: `master`
- Patch repository only: `mohamedamouseo-a11y/TAS-patchs`
- Do **not** push application changes to `TAS/master` from this bundle.

## Existing architecture reused

TAS already has the module-level RBAC foundation (`tas_rbac_roles`, `tas_rbac_role_permissions`, `tas_rbac_user_roles`, `tas_rbac_audit_log`, server/client helpers, and the Roles & Permissions page). Phase 2 extends that system; it must not create a parallel permission engine.

## What Phase 2 actually changes

The current matrix is module-level. For example `sales.view` is too broad to independently control Leads, Excel Imports, Competitive Queues, Quotations, Tasks, Test Drives, etc.

Phase 2 adds optional **feature/page-level overrides** underneath the existing module permission.

Example:

- role has `sales.view = true`
- `sales.leads.view = true`
- `sales.excel_imports.view = false`

Result:

- Leads visible
- Excel Imports hidden
- direct `/excel-imports` access denied
- Excel Imports API view calls denied

No feature override row means inherit the parent module permission, so current roles continue working after migration without manual reconfiguration.

## Important: Excel Imports is NOT being redesigned here

Phase 2 does **not** change the Excel upload/import workflow, parsing, queue processing, or lead creation behavior.

It only adds permission checks around visibility/actions. Existing Excel Imports V1 behavior must remain intact, including its Admin-only Delete/Restore restriction.

## Permission model

1. Resolve parent module permission.
2. Resolve optional feature override.
3. Missing feature override = inherit parent module.
4. Feature override can narrow a granted parent action but cannot widen a denied parent action.
5. Existing module `dataScope` remains inherited by child features.
6. Resolver/business rules can remain stricter than generic RBAC.

## Phase 2 feature catalog

Create a centralized feature catalog for real TAS/Automotive pages and major UI areas. Minimum examples:

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
- `catalog.vehicles`
- `catalog.inventory`
- `catalog.brands`
- `finance.overview`
- `service.overview`
- `after_sales.overview`
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

Inventory and map the actual current app; do not rely only on this minimum list.

## Actions

Keep the current action set:

- View
- Create
- Edit
- Delete
- Export
- Approve
- Assign

## Roles & Permissions UI

Upgrade the existing `/tas/admin/permissions` page. It must be fully accessible to normal Admin.

Required UX:

- role list/search
- create custom role
- module permission matrix
- nested feature/page permissions
- Inherit / Custom indicator
- action toggles
- module bulk actions
- module-level data scope selector
- assigned users / user role assignment
- audit-friendly save behavior
- Arabic/English + RTL

Admin is the protected operational authority: do not allow an ordinary role to remove Admin's ability to administer RBAC.

## Navigation / routes / buttons

Use centralized feature/action guards for sidebar items, routes, tabs, buttons, and row actions. Server remains authoritative.

## Backend enforcement

Extend `authorizeTasApiRequest`/the existing RBAC architecture with deterministic feature-aware authorization for major TAS/Automotive procedures. Do not build a disconnected authorization system.

## Audit

Use `tas_rbac_audit_log` for role/module/feature permission changes and user-role assignments.

## Phase boundary

Phase 2 stores and resolves existing `dataScope` but does **not** roll out full record-level Leads/Deals/Clients filtering. That remains Phase 3.

## Backward compatibility / safety

Critical requirements:

1. Existing roles with no feature rows inherit their current module permissions.
2. Normal Admin retains full operational administration.
3. Do not make Roles & Permissions SuperAdmin-only.
4. Do not change Excel upload/import execution logic.
5. Preserve Excel Imports V1 Admin-only Delete/Restore behavior.
6. Preserve existing custom roles and current module-only guards while migrating.
7. No automatic push to GitHub.

## Files

- `README.md`
- `IMPLEMENTATION_CONTRACT.md`
- `drizzle/20260903_tas_advanced_rbac_phase2.sql`
- `OPENHANDS_PROMPT.md`
