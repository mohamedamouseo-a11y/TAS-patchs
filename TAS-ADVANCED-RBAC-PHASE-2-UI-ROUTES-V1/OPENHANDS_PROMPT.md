Use `TAS-ADVANCED-RBAC-PHASE-2-UI-ROUTES-V1` from `mohamedamouseo-a11y/TAS-patchs` on the same clean worktree where Core V1 passed.

Apply exactly as `README.md` says.

Then:
- `git apply --check ui-routes.patch` before applying it
- `pnpm build`
- use disposable DB only
- verify Admin can open `/tas/admin/permissions`
- verify feature rows show Inherit/Custom
- set a non-Admin `sales.leads.view=false` while parent `sales.view=true`: direct `/leads` must deny and sidebar Leads must hide
- reset that feature to inherit: `/leads` must work again
- verify feature override cannot widen a parent denial
- verify SalesManager `/import` behavior is unchanged
- run PR #7 regression checks

Do not touch production. Do not push.

Return:
PATCH_APPLIED=
BUILD=
FEATURE_UI=
DIRECT_ROUTE_DENY=
SIDEBAR_DENY=
RESET_INHERIT=
NO_WIDEN=
IMPORT_NONREGRESSION=
PR7_PRESERVED=
CHANGED_FILES=
ERROR=
