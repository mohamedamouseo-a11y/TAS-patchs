Use patch bundle:
`TAS-ADVANCED-RBAC-PHASE-2-CORE-V1`
from `mohamedamouseo-a11y/TAS-patchs`.

Apply the files exactly as mapped in README.md to a clean TAS worktree based on:
`928a88d54e6370dc2ecc1f862f2592acf03b91d7`

Then:
- create `tas_rbac_feature_permissions` only in a disposable DB
- `pnpm build`
- verify no override = inherit parent
- verify child override can deny parent grant
- verify child override cannot grant parent denial
- verify Admin remains full access
- verify PR #7 checks still pass

Do not touch production.
Do not push.

Return:
PATCH_APPLIED=
BUILD=
INHERIT_TEST=
DENY_TEST=
NO_WIDEN_TEST=
ADMIN_TEST=
PR7_PRESERVED=
CHANGED_FILES=
ERROR=
