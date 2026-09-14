# TAS Audit Log White Screen Hotfix V1

## Purpose
Fix the deployed/recovered `AuditLogPage.tsx` variant that references `UserPlus` and `SlidersHorizontal` without importing them from `lucide-react`, causing a React white screen at runtime.

## Code review note
Clean TAS master at `928a88d54e6370dc2ecc1f862f2592acf03b91d7` does **not** currently reference `UserPlus` or `SlidersHorizontal` in `client/src/pages/AuditLogPage.tsx`. Therefore this patch must only be applied to the recovered/deployed Audit Log variant where those symbols are actually used and the imports are missing.

Do not blindly apply this patch to clean master if the symbols are not referenced there.

## Scope
Exactly one source file:

`client/src/pages/AuditLogPage.tsx`

Change only the existing `lucide-react` import block by adding:

- `UserPlus`
- `SlidersHorizontal`

No logic, RBAC, API, migration, database, or styling changes are included.

## Validation
After applying to the correct target variant:

- `pnpm build` must pass.
- Fresh Playwright/Chromium load must render the login/app UI.
- White screen must be gone.
- Page errors = 0.
- Failed asset requests = 0.

Push to TAS is manual from the system. This patch package does not push TAS/master.
