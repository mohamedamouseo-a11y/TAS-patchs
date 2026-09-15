You are already connected to the TAS project server.

Finalize the already-tested dashboard data accuracy fix that was applied on top of:

BASE_SHA=a0441d59447c7e29dc3f7eb0353eb18c46e2d8d8

The tested result is exactly 3 changed files:
- client/src/pages/tas/TASDashboard.tsx
- client/src/pages/tas/TASSalesPage.tsx
- server/db.ts

Validated state before commit:
- BUILD=PASS
- DIFF_CHECK=PASS
- STATIC_FAKE_VALUES_REMOVED=YES
- WON_DEALS_API=0 and WON_DEALS_SQL=0
- REVENUE_API=0.00 and REVENUE_SQL=0.00
- ACTIVITIES_API=70 and ACTIVITIES_SQL=70
- SLA_API=0 and SLA_SQL=0
- LABEL_SEMANTICS=YES
- PUSHED=NO
- PRODUCTION_TOUCHED=NO

Do not modify code.
Do not re-run any patcher that changes files.
Do not touch production.
Do not deploy.
Do not push.

Before committing, verify:
1. git diff --name-only contains exactly the 3 files above.
2. git diff contains no unrelated changes.
3. pnpm build still passes.

Then create ONE local commit only with commit message:

fix: dashboard data accuracy and TAS KPI semantics

Return only:
BUILD=
CHANGED_FILES_COUNT=
LOCAL_COMMIT_SHA=
PUSHED=NO
ERROR=
