# TAS RBAC UI Critical Actions V1

Phase 1 UI enforcement patch for TAS RBAC. This patch changes **critical mutation controls only** so the UI follows the same `module.action` permissions enforced by `tasPermissionProcedure` / `authorizeTasApiRequest`.

It does **not** change role matrices, database permission rows, API authorization, navigation visibility, page route guards, or data-scope rules.

## Why

The RBAC audit proved the live backend/database authorization is healthy, but several UI pages still use hard-coded role names. That can cause either:

- a button to be visible while the backend denies it; or
- a custom/overridden role to have backend permission but not see the action in the UI.

## Target files

1. `client/src/pages/automotive/VehicleCatalogPage.tsx`
2. `client/src/pages/tas/TASAdminPage.tsx`
3. `client/src/pages/automotive/AutomotiveAdminPage.tsx`
4. `client/src/pages/tas/TASConversationsPage.tsx`
5. `client/src/pages/tas/TASFinancePage.tsx`
6. `client/src/pages/automotive/AutomotiveFinancePage.tsx`
7. `client/src/pages/tas/TASOperationsPage.tsx`
8. `client/src/pages/automotive/AutomotiveOperationsPage.tsx`
9. `client/src/pages/tas/TASSalesPage.tsx`

## Permission mapping enforced

| UI operation | RBAC permission |
|---|---|
| Add vehicle / upload image | `catalog.create` |
| Edit vehicle / set primary image / inventory upsert | `catalog.edit` |
| Archive vehicle / remove image | `catalog.delete` |
| Add/update vehicle brand | `catalog.create` / `catalog.edit` |
| Add branch | `admin.create` |
| Create/update finance program | `finance.create` / `finance.edit` |
| Create finance application | `finance.create` |
| Create service type / send service follow-up | `service.create` |
| Save/update channel integration / process channel queues | `integrations.edit` |
| Update conversation status | `conversations.edit` |
| Send manual conversation reply | `conversations.create` |
| Create sales handover / quote / test drive / task / trade-in / dispatcher lead | `sales.create` |
| Update sales stage / complete task / claim-next queue operation | `sales.edit` |
| Assign / reassign sales lead | `sales.assign` |

The patch uses `useTasRbac()` and keeps UI actions fail-closed while permissions are loading.

## Apply

From the `TAS-patchs` checkout on branch:

`patch/tas-rbac-ui-critical-actions-v1`

run the compatibility installer:

```bash
node TAS-RBAC-UI-CRITICAL-ACTIONS-V1/scripts/apply-tas-rbac-ui-critical-actions-v1-compatible.mjs --target <TAS_WORKTREE>
```

The compatibility installer also handles a worktree where the earlier `VehicleCatalogPage` archive-only RBAC patch is already present.

Expected:

```text
TAS_RBAC_UI_CRITICAL_ACTIONS_APPLY=PASS
```

Then verify:

```bash
node scripts/verify-tas-rbac-ui-critical-actions-v1.mjs
pnpm exec vitest run server/tasRbacPolicy.test.ts server/tasRbacApiAccess.test.ts client/src/lib/tasRbac.test.ts
pnpm check
```

If the earlier audit test files are not present in the worktree, run the project's normal relevant tests instead and report that explicitly.

## Safety

- No DB writes or migrations.
- No role-matrix changes.
- No backend permission widening.
- No navigation/sidebar changes in this phase.
- No automatic merge or push to `master`.
- Installer fails if an expected source anchor is missing instead of guessing.

## Next phase

Phase 2 will address page/sidebar/view visibility (`module.view`) and remaining hard-coded navigation/view gates after this action-level patch is verified.