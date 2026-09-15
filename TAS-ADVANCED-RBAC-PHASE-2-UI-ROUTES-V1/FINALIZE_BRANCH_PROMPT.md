Finalize the tested Advanced RBAC Phase 2 worktree only.

Base must be exactly:
928a88d54e6370dc2ecc1f862f2592acf03b91d7

Expected cumulative changed files only:
- client/src/App.tsx
- client/src/components/CRMLayout.tsx
- client/src/components/TASPermissionGuard.tsx
- client/src/lib/tasRbac.ts
- client/src/pages/tas/TASRolesPermissionsPage.tsx
- server/tasRbacApiAccess.ts
- server/tasRbacRouter.ts
- server/tasRbacFeatureCatalog.ts
- drizzle/20260903_tas_advanced_rbac_phase2.sql

Before committing:
- git diff --check
- confirm exactly 9 changed files
- confirm no package/lockfile changes
- pnpm build
- rerun the already-passing RBAC checks and PR #7 regression checks

If all pass, create local branch:
feat/advanced-rbac-phase2

Commit message:
feat: add advanced RBAC phase 2

Do NOT touch production.
Do NOT push.
Do NOT create PR.

Return:
BASE_SHA=
BRANCH=
DIFF_CHECK=
CHANGED_FILES_COUNT=
CHANGED_FILES=
BUILD=
RBAC_TESTS=
PR7_PRESERVED=
FINAL_LOCAL_COMMIT_SHA=
PUSH_PERFORMED=NO
PRODUCTION_TOUCHED=NO
ERROR=
