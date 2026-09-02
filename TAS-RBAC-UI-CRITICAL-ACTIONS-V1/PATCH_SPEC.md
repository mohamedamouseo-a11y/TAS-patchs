# Phase 1 Patch Spec — Critical UI Actions

Use this only if the installer stops because the target TAS source has drifted from the reviewed `master` anchors. Do not broaden the patch.

## Core rule

For each mutation control, derive visibility/enabled state from `useTasRbac()` using the same `module.action` that `authorizeTasApiRequest` applies. Do not replace backend authorization and do not add role-name fallbacks.

### VehicleCatalogPage
- create vehicle + upload image -> `catalog.create`
- edit vehicle + set primary image -> `catalog.edit`
- archive vehicle + remove image -> `catalog.delete`

### TASAdminPage / AutomotiveAdminPage
- create vehicle / vehicle brand -> `catalog.create`
- update vehicle brand -> `catalog.edit`
- create branch -> `admin.create`
- create finance program -> `finance.create`
- create service type -> `service.create`
- upsert integration -> `integrations.edit`
- integration health reads may use `integrations.view`

### TASConversationsPage
- update status -> `conversations.edit`
- send manual reply -> `conversations.create`
- create sales handover -> `sales.create`

### TASFinancePage / AutomotiveFinancePage
- create program -> `finance.create`
- update program -> `finance.edit`

### TASOperationsPage / AutomotiveOperationsPage
- process channel queues -> `integrations.edit`
- update sales handover -> `sales.edit`
- send service follow-up -> `service.create`
- integration health reads -> `integrations.view`

### TASSalesPage
- create quote/test drive/task/trade-in/dispatcher lead -> `sales.create`
- update stage/complete task/claim-next -> `sales.edit`
- assign/reassign lead -> `sales.assign`
- create finance application -> `finance.create`
- inventory upsert -> `catalog.edit`

## Required behavior

- Missing permission: sensitive action must be hidden or disabled fail-closed and must not be presented as usable.
- Granted permission: the UI must not require a specific hard-coded role for that same action.
- Existing page/view/navigation role logic that is unrelated to the mutation control is Phase 2 and must not be refactored here.
- Do not change `server/tasRbacPolicy.ts`, `server/tasRbacApiAccess.ts`, `server/tasRbacRouter.ts`, DB rows, migrations, or default matrices.

After manual adaptation, run `scripts/verify-tas-rbac-ui-critical-actions-v1.mjs` and inspect the diff before committing.