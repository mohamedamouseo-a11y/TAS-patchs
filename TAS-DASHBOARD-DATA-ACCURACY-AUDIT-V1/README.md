# TAS Dashboard Data Accuracy Audit V1

Goal: prove which dashboard numbers are correct, wrong, stale, hard-coded, semantically misleading, or based on inconsistent date fields before changing production code.

Base reference: TAS master `928a88d54e6370dc2ecc1f862f2592acf03b91d7` plus the current connected server source for runtime comparison.

## Already-proven code red flags

`client/src/pages/tas/TASDashboard.tsx` contains user-visible static/demo numbers mixed with live query data, including examples such as:

- conversion rate `24.6%`
- total customers computed as `handovers.length + conversations.length + 12458`
- sales value `18.7M`
- active opportunities computed as `handovers.length + 312`
- today appointments fallback `pendingAppointments || 18`
- static funnel counts `212 / 156 / 98 / 45 / 28`
- static customer satisfaction `73%`
- service/parts fallbacks such as `|| 12`, `|| 18`, `|| 156`
- static sales distribution and revenue trend values
- static activity/deal display arrays

These are automatically classified as `MISLEADING_STATIC_DATA` unless the page is explicitly marked as demo-only. The production page must not present them as live business truth.

## Audit scope

Audit these user-visible dashboards and their backing procedures:

1. `/dashboard` — `AgentDashboard.tsx`
   - `dashboard.agentStats`
   - `dashboard.teamStats`
   - `dashboard.salesFunnel`
2. `/team-dashboard` — `TeamDashboard.tsx`
   - `dashboard.teamStats`
3. `/sales-funnel` — `SalesFunnelDashboard.tsx`
   - `dashboard.salesFunnel`
4. `/task-sla` — `TaskSlaDashboard.tsx`
   - `dashboard.taskSla`
5. `/tas` — `TASDashboard.tsx`
   - all live queries plus every hard-coded/fallback KPI/chart value
6. `/tas/sales` — `TASSalesPage.tsx`
   - `tas.sales.overview`
   - confirm whether KPI meaning is based on CRM leads/deals or TAS sales handovers/pipeline and whether labels match that meaning

## Required checks

For every KPI/chart/count, record:

- page and visible label
- client field/expression
- tRPC/API procedure
- server function
- source table(s)
- exact formula
- date field used (`createdAt`, `contactTime`, `closedAt`, `updatedAt`, etc.)
- soft-delete behavior
- role/owner scope behavior
- any pagination/limit cap
- API/dashboard result
- equivalent direct read-only SQL result
- status: `MATCH`, `MISMATCH`, `SEMANTIC_MISMATCH`, `MISLEADING_STATIC_DATA`, or `UNVERIFIABLE`
- delta and root cause

Use the reproducible period `2026-08-30 00:00:00` through `2026-09-09 23:59:59.999` for date-filtered CRM dashboard metrics. Also audit current/all-time values for dashboard widgets with no date selector.

Specifically verify:

- leads totals and stage distribution
- `createdAt` vs `contactTime` semantics, including null `contactTime`
- won deals vs leads whose stage is `Won`
- revenue date semantics and value field/currency semantics
- conversion rate numerator and denominator
- SLA breach counts and whether the selected date range is actually respected
- activities and soft-deleted activities
- campaign attribution totals
- average contact/response times
- TAS sales overview: open/won/lost counts, open/won value, win rate, alerts
- whether `tas_sales_handovers`/TAS pipeline rows are being labeled as generic CRM Sales/Leads metrics
- any UI fallback that replaces a legitimate zero with a fake non-zero number via `||`

## Safety

READ-ONLY ONLY. No INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE. No code edits. No migrations. No deploy. No push. Do not output customer names, phones, emails, message contents, credentials, tokens, or secrets.

The purpose of this audit is to produce evidence for a small, exact correction patch after the report is reviewed.