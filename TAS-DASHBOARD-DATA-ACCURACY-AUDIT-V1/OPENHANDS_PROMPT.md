You are already connected to the TAS project server.

Run a READ-ONLY dashboard data accuracy audit.

Audit instructions are in:
`mohamedamouseo-a11y/TAS-patchs/TAS-DASHBOARD-DATA-ACCURACY-AUDIT-V1/README.md`

Do not modify code.
Do not modify the database.
Do not deploy.
Do not push.
Do not create migrations.
Do not expose customer PII or secrets.

Compare the current connected server source/runtime behavior with TAS master reference:
`928a88d54e6370dc2ecc1f862f2592acf03b91d7`

Use SELECT/read-only database queries only.

Audit these pages:
- /dashboard
- /team-dashboard
- /sales-funnel
- /task-sla
- /tas
- /tas/sales

For date-filtered CRM metrics use this fixed period:
FROM=2026-08-30 00:00:00
TO=2026-09-09 23:59:59.999

Also audit all-time/current values for widgets with no date selector.

Critical required checks:
1. Detect every hard-coded/demo/fallback number visible as a real KPI/chart.
2. For every live KPI map: visible label -> client expression -> API procedure -> server function -> source table(s) -> formula/date field.
3. Recompute the same KPI directly with read-only SQL and compare.
4. Check createdAt vs contactTime, including NULL contactTime records.
5. Check soft-delete filtering for leads, deals, activities.
6. Check Won lead-stage count vs actual Won deals count; do not treat them as interchangeable.
7. Check revenue date/value/currency semantics.
8. Check SLA selected-period behavior; verify no all-time SLA value is shown under a selected-period label.
9. Check pagination/limit truncation.
10. For `tas.sales.overview`, identify exactly whether counts/value/win rate come from CRM leads/deals, `tas_sales_handovers`, or another TAS pipeline source, and whether the visible labels accurately describe that source.
11. Flag any expression like `realValue || fakeNumber`, arithmetic constants such as `+12458` / `+312`, or static arrays feeding live-looking charts.

Classification per metric:
- MATCH
- MISMATCH
- SEMANTIC_MISMATCH
- MISLEADING_STATIC_DATA
- UNVERIFIABLE

Return a compact evidence report. Do not return PII.

Required output format:
AUDIT_BASE_SHA=
RUNTIME_HEAD=
DB_READ_ONLY=YES

SUMMARY:
TOTAL_METRICS=
MATCH_COUNT=
MISMATCH_COUNT=
SEMANTIC_MISMATCH_COUNT=
MISLEADING_STATIC_DATA_COUNT=
UNVERIFIABLE_COUNT=

CRITICAL_FINDINGS_START
<highest-severity findings with page, label, displayed/API value, SQL truth value if applicable, delta, source, root cause>
CRITICAL_FINDINGS_END

METRIC_AUDIT_START
For each metric:
PAGE=
LABEL=
CLIENT_SOURCE=
API=
SERVER_FUNCTION=
TABLES=
FORMULA=
DATE_FIELD=
SOFT_DELETE_RULE=
ROLE_SCOPE=
LIMIT_CAP=
DASHBOARD_VALUE=
SQL_TRUTH=
STATUS=
DELTA=
ROOT_CAUSE=
METRIC_END
METRIC_AUDIT_END

DATE_SEMANTICS_START
CREATED_AT_COUNT=
CONTACT_TIME_COUNT=
NULL_CONTACT_TIME_COUNT=
NULL_CONTACT_TIME_IDS=<IDs only, no PII>
DATE_SEMANTICS_FINDING=
DATE_SEMANTICS_END

TAS_SALES_OVERVIEW_START
PIPELINE_SOURCE=
OPEN_FORMULA=
WON_FORMULA=
LOST_FORMULA=
OPEN_VALUE_FORMULA=
WON_VALUE_FORMULA=
WIN_RATE_FORMULA=
LABEL_SEMANTICS=
STATUS=
TAS_SALES_OVERVIEW_END

STATIC_DATA_START
<file:line/expression -> visible label -> why misleading>
STATIC_DATA_END

RECOMMENDED_FIX_ORDER_START
<ordered fix groups, no code changes yet>
RECOMMENDED_FIX_ORDER_END

ERROR=