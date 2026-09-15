Finalize the already-tested dashboard data accuracy worktree at `/tmp/tas-dashboard-fix`.

Do not modify code.
Do not reapply the patch.
Do not touch production.
Do not deploy.
Do not push.

Verify the diff contains exactly these 3 files:
- client/src/pages/tas/TASDashboard.tsx
- client/src/pages/tas/TASSalesPage.tsx
- server/db.ts

Then run `pnpm build` once.

Create one LOCAL commit only with message:
`fix: replace misleading TAS dashboard metrics with live data`

Return only:
BUILD=
CHANGED_FILES_COUNT=
LOCAL_COMMIT_SHA=
PUSHED=NO
ERROR=
