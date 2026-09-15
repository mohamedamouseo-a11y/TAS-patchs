# TAS Dashboard Data Accuracy Fix V1

Base TAS master: `928a88d54e6370dc2ecc1f862f2592acf03b91d7`.

This package implements the correction pass after `TAS-DASHBOARD-DATA-ACCURACY-AUDIT-V1`.

## Files changed in TAS

- `client/src/pages/tas/TASDashboard.tsx`
- `client/src/pages/tas/TASSalesPage.tsx`
- `server/db.ts`

## What this fixes

### `/tas`

Removes fabricated/live-looking demo metrics and demo rows. The old page included hard-coded values such as `24.6%`, `18.7M`, `+12458`, `+312`, `73%`, static funnel rows, static opportunity rows, static recent activity, static sales distribution, fake month-over-month deltas, and `||` fallbacks that turned valid zero values into fake non-zero values.

The replacement dashboard uses live TAS queries only:

- `tas.sales.overview`
- `tas.sales.pipeline`
- existing conversations / handovers / service appointments / after-sales requests

Where no trusted backing source exists, the UI explicitly shows `—` / no-data instead of inventing a business metric. In particular, customer satisfaction is no longer shown as a fake percentage.

Sales widgets are explicitly labelled as TAS handover-pipeline metrics rather than generic CRM deal metrics.

### `/tas/sales`

Renames the top KPI labels so users can see that Open / Won / Value / Win Rate come from the TAS automotive handover pipeline, not generic CRM deals.

No sales formula is changed in this package.

### CRM dashboard server accuracy

`server/db.ts` corrections:

1. Exclude soft-deleted activities from agent/team activity counts.
2. Use one consistent revenue-recognition date expression for `totalRevenue` and `revenueBreakdown`:
   `COALESCE(deals.closedAt, deals.updatedAt, deals.createdAt)`.
3. Exclude soft-deleted leads from agent Won-deal revenue/count queries.
4. Make team `wonDeals` use actual Won deal rows, not leads whose stage is `Won`.
5. Make team SLA breach count respect the selected date range.

## Intentionally not changed

- TAS sales handover business formulas themselves.
- RBAC.
- migrations / schema.
- production data.
- deployment.
- fresh-DB migration-chain cleanup.

## Apply

From a clean TAS worktree based on the base SHA, with this patch package available locally:

```bash
node /path/to/TAS-patchs/TAS-DASHBOARD-DATA-ACCURACY-FIX-V1/scripts/apply-dashboard-data-accuracy-fix.mjs /path/to/TAS
```

The patcher is deterministic: it copies the reviewed TAS dashboard replacement and performs exact-string guarded edits for `TASSalesPage.tsx` and `server/db.ts`. It fails instead of guessing if the expected base source is different.

## Required validation

Do not deploy or push during validation.

1. Confirm only the 3 intended TAS files changed.
2. Run `pnpm build`.
3. Confirm the old fabricated literals/expressions are absent from the resulting TAS dashboard source:
   - `24.6%`
   - `18.7M`
   - `+ 12458`
   - `+ 312`
   - `>73%<`
   - `pendingAppointments || 18`
   - `pendingAppointments || 12`
   - `appointments.length || 18`
   - `parts.length || 156`
4. Re-run the dashboard audit read-only checks for the fixed metrics.
5. For period `2026-08-30 00:00:00` through `2026-09-09 23:59:59.999`, compare API vs read-only SQL for:
   - Won deals
   - revenue
   - activities
   - SLA breaches
6. Verify `/tas/sales` labels clearly say TAS pipeline / handover where applicable.

This validation must not modify production or the database.