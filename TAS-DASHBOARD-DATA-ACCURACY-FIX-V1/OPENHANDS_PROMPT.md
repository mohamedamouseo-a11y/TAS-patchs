Use the existing connected TAS server.

Patch package:
`mohamedamouseo-a11y/TAS-patchs/TAS-DASHBOARD-DATA-ACCURACY-FIX-V1`

Base TAS master:
`928a88d54e6370dc2ecc1f862f2592acf03b91d7`

Do NOT modify production.
Do NOT deploy.
Do NOT push.
Do NOT modify the DB.

Create/use an isolated clean TAS worktree based exactly on the base SHA.
Fetch the patch package from GitHub.
Read `README.md`.
Run the exact patcher:

`node <patch-package>/scripts/apply-dashboard-data-accuracy-fix.mjs <clean-tas-worktree>`

Then validate:
1. `git diff --check`
2. only these TAS files changed:
   - client/src/pages/tas/TASDashboard.tsx
   - client/src/pages/tas/TASSalesPage.tsx
   - server/db.ts
3. `pnpm build`
4. verify all fabricated TASDashboard literals/fallbacks listed in README are gone
5. run READ-ONLY API/SQL comparison for 2026-08-30 through 2026-09-09 for Won deals, revenue, activities, and SLA breaches
6. verify `/tas/sales` KPI labels explicitly identify TAS pipeline / handover semantics

Return:
PATCH_APPLIED=
BASE_SHA=
BUILD=
DIFF_CHECK=
CHANGED_FILES=
STATIC_FAKE_VALUES_REMOVED=
WON_DEALS_API=
WON_DEALS_SQL=
REVENUE_API=
REVENUE_SQL=
ACTIVITIES_API=
ACTIVITIES_SQL=
SLA_API=
SLA_SQL=
LABEL_SEMANTICS=
ERROR=

Also return the final unified diff for the 3 changed files.
