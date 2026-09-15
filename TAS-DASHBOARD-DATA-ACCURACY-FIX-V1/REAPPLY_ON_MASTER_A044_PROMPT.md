Current TAS master is now:
`a0441d59447c7e29dc3f7eb0353eb18c46e2d8d8`

Apply the already-reviewed dashboard accuracy fix on top of THIS current master, not the old 928a base.

Use the existing package:
`TAS-DASHBOARD-DATA-ACCURACY-FIX-V1`

Important verification already performed against current master:
- `client/src/pages/tas/TASDashboard.tsx` still contains the old fabricated dashboard values/static demo arrays.
- `server/db.ts` still contains the old dashboard-stat issues fixed by this package.
- The four TAS Sales KPI source lines targeted by the deterministic patcher are still present on current master.

Instructions:
1. Create an isolated clean worktree from exactly `a0441d59447c7e29dc3f7eb0353eb18c46e2d8d8`.
2. Run the existing deterministic patcher from `TAS-DASHBOARD-DATA-ACCURACY-FIX-V1/scripts/apply-dashboard-data-accuracy-fix.mjs` against that worktree.
3. Do not invent or hand-edit fixes. If any exact replacement guard fails, stop and return the failing target.
4. Confirm exactly these TAS files changed:
   - client/src/pages/tas/TASDashboard.tsx
   - client/src/pages/tas/TASSalesPage.tsx
   - server/db.ts
5. Run `git diff --check`.
6. Run `pnpm build`.
7. Confirm these fabricated values/expressions are absent from resulting `TASDashboard.tsx`:
   - 24.6%
   - 18.7M
   - +12458 / + 12458
   - +312 / + 312
   - 73%
   - pendingAppointments || 18
   - pendingAppointments || 12
   - appointments.length || 18
   - parts.length || 156
8. Re-run the read-only API/SQL truth checks for period 2026-08-30 through 2026-09-09:
   - won deals
   - revenue
   - activities
   - SLA breaches
9. Verify `/tas/sales` labels clearly distinguish TAS handover-pipeline metrics from generic CRM deal metrics.
10. Do not deploy, do not push, do not touch production DB.

Return only:
BASE_SHA=
PATCH_APPLIED=
DIFF_CHECK=
CHANGED_FILES_COUNT=
CHANGED_FILES=
BUILD=
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
PUSHED=NO
PRODUCTION_TOUCHED=NO
ERROR=