# TAS RBAC Permissions V1

Target: `mohamedamouseo-a11y/TAS` branch `master`.

## Goal
Introduce production-grade role based access control without breaking the existing TAS roles.

## Permission model
Each module permission has actions:

- view
- create
- edit
- delete
- export
- approve
- assign

Each module also has a data scope:

- own
- assigned
- team
- branch
- all

## Initial modules

- dashboard
- conversations
- sales
- catalog
- finance
- service
- after_sales
- operations
- reports
- marketing
- shipping
- integrations
- admin
- users
- roles
- audit_log
- system_settings

## Existing roles retained

- Admin
- SalesManager
- SalesAgent
- LeadDispatcher
- AccountManager
- AccountManagerLead
- Finance
- ServiceAdvisor
- PartsAgent
- CrmFollowUp
- Viewer
- MediaBuyer
- BusinessDeveloper

## Default policy

`Admin` maps to Super Admin semantics and always receives every permission. Existing users keep their current role. No existing user is denied access during migration unless an explicit permission matrix is saved for that role.

## Database objects

Create:

- `tas_rbac_roles`
- `tas_rbac_role_permissions`
- `tas_rbac_user_roles`
- `tas_rbac_audit_log`

`tas_rbac_roles.key` stores the compatible existing role key. Custom roles use generated keys.

## UI

Add an Admin tab named `Roles & Permissions / الأدوار والصلاحيات`.

The page must include:

1. role selector
2. create custom role
3. permission matrix by module
4. action toggles: View/Create/Edit/Delete/Export/Approve/Assign
5. data-scope selector: Own/Assigned/My Team/Branch/All
6. user assignment panel
7. protected-system-role badges
8. Save action with audit log

## Security requirements

- Hiding UI is never considered authorization.
- Permission enforcement belongs on the backend before mutations/queries execute.
- Permission-management endpoints are Admin-only.
- `Admin` cannot be deleted or stripped of full access.
- A user cannot remove the last active Admin assignment.
- Unauthorized requests return tRPC `FORBIDDEN`.
- Every role create/update/delete/assignment is written to `tas_rbac_audit_log` with actor, target and before/after JSON.

## Route/UI behavior

The frontend reads `rbac.me` after authentication and uses it to:

- hide inaccessible navigation modules
- block direct navigation to unauthorized TAS routes
- hide action buttons the user cannot execute
- preserve a clear Forbidden state instead of redirect loops

## Backend behavior

Expose helpers:

- `hasPermission(user, module, action)`
- `requirePermission(user, module, action)`
- `getDataScope(user, module)`
- `applyScope(...)`

Legacy fallback is deliberate: until a role has explicit RBAC rows, existing role-based behavior remains active. Once explicit rows exist for the role/module, RBAC becomes authoritative.

## Validation gate

Run:

```bash
pnpm check
pnpm test
pnpm build
```

Then validate at least these users/roles:

- Admin: all modules/actions
- SalesManager: sales + team scope, no system settings
- SalesAgent: assigned/own sales only
- Finance: finance/report access, no user/role administration
- Viewer: view only, no write/export unless explicitly enabled

Do not create a new TAS branch. Apply only to the existing `master` branch after validation.