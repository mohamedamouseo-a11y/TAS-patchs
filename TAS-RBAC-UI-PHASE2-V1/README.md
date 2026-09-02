# TAS RBAC UI Phase 2 V1

Phase 2 makes **view/navigation/read behavior** follow the TAS RBAC matrix end-to-end.

This phase must be applied **on top of Phase 1** (`fix/tas-rbac-ui-phase1-v1`). Phase 1 already moved sensitive mutation buttons to `rbac.can(module, action)`. Phase 2 must not undo or re-implement those action gates.

## Goal

If a role has `module.view=true`, TAS/Automotive navigation, route access, page sections, tabs, and read queries should behave consistently with that grant. If `module.view=false`, the feature should not be shown or queried.

Do not use literal role names as the authorization source for TAS/Automotive view behavior.

## Mandatory baseline check

Before changing anything, verify Phase 1 is present in the target TAS worktree. At minimum, `client/src/pages/automotive/VehicleCatalogPage.tsx` must use `useTasRbac(...)` and gate archive with `rbac.can("catalog", "delete")` (quote style may differ).

If Phase 1 is absent, stop and report the baseline mismatch. Do **not** silently rebuild Phase 1 inside this phase.

## Phase 2 scope

- sidebar/navigation visibility for `/tas/*` and `/automotive/*`
- route/page `view` guards
- view-only tabs and cards
- read-query `enabled` flags
- cross-module dashboard/admin-page read queries
- removal of current-user `isAdmin`, `role.includes(...)`, and similar view gates where TAS RBAC is the intended source of truth
- roles/users management page read parity with the RBAC matrix
- minimal backend **read/roles-management parity** only where the frontend RBAC matrix would otherwise expose a page whose API still hard-codes Admin/legacy roles

Out of scope:

- changing default role matrices
- changing persisted role permissions
- DB migrations or data writes
- widening unrelated legacy CRM routes outside TAS/Automotive
- changing Phase 1 create/edit/delete/assign/approve/export behavior except where Roles & Permissions itself needs action gates after removing `adminOnly`

---

## 1. CRMLayout — TAS/Automotive navigation

File: `client/src/components/CRMLayout.tsx`

`canUseHref()` already maps `/tas/*` and `/automotive/*` to RBAC modules through `tasModuleForPath()`.

Required:

- For paths resolved by `tasModuleForPath`, visibility must be based on `permissions[module].view` only.
- Remove the special hard-coded Admin rejection for `module === "roles"` **only after** the Roles backend parity described below is implemented.
- Do not use `TAS_*_ROLES` arrays to authorize TAS/Automotive mapped paths. They may remain only where needed for unrelated legacy/non-RBAC routes, but mapped TAS paths must ignore them.
- Do not refactor unrelated `/dashboard`, `/leads`, BD, support, or WA legacy navigation in this patch.
- Tara/super-admin product-specific checks are outside TAS RBAC unless the path is mapped by `tasModuleForPath`; do not broaden them accidentally.

Acceptance:

- custom role with `catalog.view=true` sees Vehicle Catalog navigation.
- same role with `catalog.view=false` does not see it.
- literal role name does not override the matrix.

---

## 2. TASPermissionGuard + App routes

Files:

- `client/src/components/TASPermissionGuard.tsx`
- `client/src/App.tsx`

All TAS/Automotive routes must remain guarded by `rbac.can(module, "view")`.

Required:

- Remove `adminOnly` from `TASPermissionGuard` once Roles backend parity is complete.
- Change `/tas/admin/permissions` from `module="roles" adminOnly` to `module="roles"`.
- Keep the protected system-Admin role immutable; removing `adminOnly` must **not** mean the Admin role itself can be edited/deleted.
- Do not weaken public/private routing outside TAS.

---

## 3. Dashboard cross-module read permissions

File: `client/src/pages/tas/TASDashboard.tsx`

Current role-name booleans such as `isAdminOrManager`, `canUseSalesDashboard`, `canUseFinanceDashboard`, etc. must be replaced with RBAC view flags.

Use `useTasRbac(isAuthenticated)` and derive exact view flags, including at minimum:

- dashboard -> `dashboard.view`
- catalog -> `catalog.view`
- admin/branches -> confirm backend inference for `tas.branches.list` (currently expected `admin.view`)
- finance -> `finance.view`
- service -> `service.view`
- conversations -> `conversations.view`
- handovers/sales -> confirm backend inference, expected `sales.view`
- after-sales -> `after_sales.view`
- shipping -> `shipping.view` only for shipping widgets/links
- reports -> `reports.view` for report/KPI links if those links route to reports

Every query for another module must use an `enabled: canViewX` condition so a user with `dashboard.view=true` but without another module's view permission does not trigger a forbidden query.

Every dashboard link/card that navigates into another module must be hidden when that module's `view` is false.

Do not replace missing live data with fake permission-driven values.

---

## 4. TAS/Automotive Marketing view parity

Files:

- `client/src/pages/tas/TASMarketingPage.tsx`
- `client/src/pages/automotive/AutomotiveMarketingPage.tsx`

Remove `['Admin','admin','MediaBuyer']` view gating.

The page itself is already route-guarded by `marketing.view`.

Required:

- query enable must follow `rbac.can("marketing", "view")`.
- integration-settings links/buttons must additionally require the destination module's `view` permission (normally `integrations.view` or `admin.view`, depending on the actual destination and backend).
- do not show a misleading "Admin/Media Buyer only" warning when RBAC grants marketing.view.

### Important backend parity check

Inspect the backend used by `marketingHub.getSummary` (or whatever query the page actually uses after Phase 1).

If that read API is still restricted by a legacy Admin/MediaBuyer procedure and a custom role with `marketing.view=true` would receive FORBIDDEN:

1. Do not simply broaden the legacy endpoint globally.
2. Prefer an additive TAS-scoped read endpoint (for example under `tas.marketing`) protected by `tasPermissionProcedure`, calling the same read service.
3. Switch only TAS/Automotive marketing pages to that RBAC-compatible read endpoint.
4. Keep the old legacy marketing endpoint behavior unchanged for non-TAS screens.

If an additive wrapper cannot be implemented cleanly, stop and report the mismatch instead of weakening authorization.

---

## 5. Admin pages — tab visibility and read-query enablement

Files:

- `client/src/pages/tas/TASAdminPage.tsx`
- `client/src/pages/automotive/AutomotiveAdminPage.tsx`

These pages aggregate multiple modules. Do not use one `isAdmin` view boolean for the whole page.

Use per-module `view` flags:

- catalog tab/data -> `catalog.view`
- branch/admin tab/data -> confirm `tas.branches.list`, expected `admin.view`
- finance tab/data -> `finance.view`
- service tab/data -> `service.view`
- integrations/channels tab/data -> `integrations.view`
- sales users/conversation-assignment data -> exact inferred module, usually `conversations.view` or `sales.view`
- branding/system sections -> exact module (`admin.view` / `system_settings.view`) according to the endpoint actually used

Required:

- hide tabs the user cannot view.
- do not execute their queries.
- if the default selected tab is not allowed, select the first allowed tab safely.
- preserve Phase 1 action gates inside visible tabs.
- a user with `admin.view=true` but `finance.view=false` must not query or render finance data merely because they can open the Admin page.

---

## 6. Finance / Conversations / Operations / Sales pages — remaining view gates

Files to audit and update as needed:

- `client/src/pages/tas/TASFinancePage.tsx`
- `client/src/pages/automotive/AutomotiveFinancePage.tsx`
- `client/src/pages/tas/TASConversationsPage.tsx`
- `client/src/pages/automotive/AutomotiveConversationsPage.tsx`
- `client/src/pages/tas/TASOperationsPage.tsx`
- `client/src/pages/automotive/AutomotiveOperationsPage.tsx`
- `client/src/pages/tas/TASSalesPage.tsx`

Phase 1 handled mutation buttons. Phase 2 must remove remaining current-user role checks used for:

- tab visibility
- query `enabled`
- read-only warning banners
- view-only management panels
- links to other TAS modules

For each condition, use the exact module's `view` permission. Cross-module sections must use the destination/data module, not simply the page's module.

Do not touch purely contextual checks that are not authorization (for example a status/type value or the role record being edited).

---

## 7. Roles & Permissions page — end-to-end RBAC parity

Files:

- `client/src/pages/tas/TASRolesPermissionsPage.tsx`
- `server/tasRbacRouter.ts`
- `client/src/components/TASPermissionGuard.tsx`
- `client/src/App.tsx`
- `client/src/components/CRMLayout.tsx`

The RBAC matrix exposes `roles` and `users` modules, so the page must not be permanently hard-coded to literal Admin if those permissions are granted to another role.

### Backend read/action rules

Refactor `tasRbacRouter` minimally so these operations use the existing RBAC matrix instead of `adminProcedure`:

- `listRoles` -> require `roles.view`
- `listUsers` -> require `users.view`
- create a new role -> require `roles.create`
- edit an existing role -> require `roles.edit`
- delete a role -> require `roles.delete`
- assign a role to a user -> require `roles.assign`

Use `requireTasPermission(...)` / `effectiveTasPermissions(...)` already defined in the RBAC module. Do not invent a second permission system.

For `saveRole`, determine whether the role already exists before choosing `roles.create` vs `roles.edit`.

### Frontend controls

`TASRolesPermissionsPage` must use `useTasRbac` for the current user:

- page read is handled by route `roles.view`
- role creation control -> `roles.create`
- save/edit existing role -> `roles.edit`
- delete role -> `roles.delete`
- users table/query -> `users.view`
- role assignment control -> `roles.assign` AND enough user visibility to render the target user

Keep the existing contextual protection:

`draft?.roleKey === "Admin"`

The protected system Admin role must remain non-editable/non-deletable regardless of grants.

Do not allow any role to delete/deactivate the protected Admin role.

### Admin bootstrap safety

The built-in Admin must retain full permissions through `DEFAULT_TAS_ROLE_MATRIX.Admin`. Do not make admin access depend on a DB override that could lock the system out.

---

## 8. Query/backend parity audit

For every TAS/Automotive read query touched in Phase 2:

1. identify its exact TRPC path;
2. determine its backend guard/inferred module;
3. ensure the frontend `view` flag matches;
4. if a legacy non-RBAC read guard conflicts with TAS RBAC, either add a minimal TAS-scoped read wrapper or stop/report.

Do not widen create/edit/delete endpoints in Phase 2.

---

## 9. Existing contextual exceptions

Do not treat these as current-user authorization bugs unless inspection proves otherwise:

- `draft?.roleKey === "Admin"` in Roles & Permissions — protects the role being edited.
- super-admin-only support/credential controls unrelated to the TAS RBAC matrix.
- Tara-specific access rules unless they are explicitly mapped to a TAS RBAC module.
- non-TAS legacy CRM routes outside `/tas/*` and `/automotive/*`.

---

## 10. Acceptance cases

Verify all of these:

1. Custom role: `catalog.view=true` -> Vehicle Catalog nav + route visible; `catalog.delete=false` -> Archive still unavailable from Phase 1.
2. `finance.view=false` -> Finance nav hidden, Finance route denied, finance queries on Dashboard/Admin pages do not execute.
3. `service.view=true` with an unusual/custom role name -> service navigation and allowed read content works.
4. `marketing.view=true` for a custom role -> TAS Marketing page reads successfully without an Admin/MediaBuyer literal-role gate.
5. `roles.view=true`, `users.view=true`, but `roles.edit=false` -> role matrix is readable, save controls unavailable.
6. `roles.assign=false` -> role assignment controls unavailable even if the page is visible.
7. protected Admin role remains immutable.
8. `dashboard.view=true` with `sales.view=false` -> dashboard itself opens, but sales queries/links/cards that require sales data are not fetched/shown.
9. No unauthorized query should spam the console/network with predictable FORBIDDEN responses merely because a page is visible.
10. Phase 1 sensitive-action behavior remains intact.

---

## 11. Verification commands

Run the existing RBAC tests/audits if available:

```bash
pnpm exec vitest run server/tasRbacPolicy.test.ts server/tasRbacApiAccess.test.ts client/src/lib/tasRbac.test.ts
pnpm check
node scripts/audit-tas-rbac-ui-gates.mjs
```

Then run the Phase 2 verifier from TAS-patchs:

```bash
node <TAS_PATCHS_PATH>/TAS-RBAC-UI-PHASE2-V1/scripts/verify-tas-rbac-ui-phase2-v1.mjs <TAS_WORKTREE>
```

Expected success marker:

```text
TAS_RBAC_UI_PHASE2_VERIFY=PASS
```

The verifier is static/read-only. It does not change permissions or DB data.

---

## 12. Safety

- Do not push.
- Do not merge.
- Do not create a PR.
- Do not run DB migrations.
- Do not change persisted RBAC rows.
- Do not modify default role grants except if a test proves a coding defect; in that case stop and report first.
- Do not fix unrelated TypeScript baseline errors.
- If Phase 1 is not in the target branch/worktree, stop instead of applying Phase 2 on an outdated baseline.
