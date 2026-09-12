# OpenHands Prompt — TAS Lead Dispatcher Export Leads V1

Apply this patch bundle against TAS base commit:

`e81fb64af96ac90dc6a2116f5e1b2c8d1a357d73`

Read `README.md` and `IMPLEMENTATION_CONTRACT.md` completely before changing code.

## Goal

Give the Lead Dispatcher permission and UI access to export potential-customer / Lead data to Excel using the existing professional Leads export implementation.

## Important current-state facts

- Lead Dispatcher import access is already implemented on the base commit.
- Lead Dispatcher already lands on `/tas/sales`.
- The professional Leads export already exists at `GET /api/export/leads`.
- The current Leads page shows the export button to Admin/admin/SalesManager.
- Do not create another workbook format.
- Do not grant LeadDispatcher the full `/leads` page merely to expose export.

## Required implementation

1. Inspect the actual current export route in `server/_core/index.ts` and the professional workbook path it calls.
2. Add explicit server-side export authorization for exactly:
   - Admin
   - admin
   - SalesManager
   - LeadDispatcher
3. Block SalesAgent, MediaBuyer, Finance, Viewer and all other unauthorized roles with `403`; keep unauthenticated as `401`.
4. Prefer extracting the authorization decision into a small shared/testable production helper so tests execute the same logic the route uses.
5. Add an `Export Excel` action to the Dispatcher UI in `client/src/pages/tas/TASSalesPage.tsx`.
6. Reuse the existing professional `/api/export/leads` request/workbook behavior. Do not build a second simplified Excel generator.
7. Give the Dispatcher export UI a required start/end date range. Validate missing/reversed ranges before sending the request.
8. Do not alter assignment, queue, import, or post-login behavior.
9. Do not add LeadDispatcher to `/leads` navigation/page unless the architecture makes reuse impossible; if you believe that is required, stop and report instead of silently broadening access.
10. Preserve the existing professional workbook contract and no-truncation behavior.

## Authorization tests

Run real deterministic tests against production authorization logic and report:

- ADMIN_EXPORT=PASS
- ADMIN_LOWERCASE_EXPORT=PASS
- SALES_MANAGER_EXPORT=PASS
- LEAD_DISPATCHER_EXPORT=PASS
- SALES_AGENT_EXPORT_BLOCKED=PASS
- MEDIA_BUYER_EXPORT_BLOCKED=PASS
- FINANCE_EXPORT_BLOCKED=PASS
- VIEWER_EXPORT_BLOCKED=PASS
- UNAUTHENTICATED_EXPORT_BLOCKED=PASS

Do not mark PASS based on grep/source inspection alone.

## Browser E2E

If browser is available:

LeadDispatcher:
- login
- lands on `/tas/sales`
- Dispatcher tab is visible
- Export Excel action is visible
- choose valid date range
- click export
- browser downloads XLSX
- reopen XLSX and verify sheet order:
  `Summary`, `Lead Overview`, `Sales Notes`, `Activity Timeline`, `Deals`, `Transfer History`, `Follow-ups`

Negative:
- SalesAgent session must not have Dispatcher export action
- direct export request must return `403`

If browser is unavailable, report `BROWSER_E2E=BLOCKED`. Never fabricate PASS.

## Build / deploy

- Build production app.
- Restart TAS.
- Verify service online.
- Do not push to TAS/master.

## Final response

Return:

```text
BASE_COMMIT=
PATCH=YES|NO
ADMIN_EXPORT=
SALES_MANAGER_EXPORT=
LEAD_DISPATCHER_EXPORT=
SALES_AGENT_EXPORT_BLOCKED=
MEDIA_BUYER_EXPORT_BLOCKED=
FINANCE_EXPORT_BLOCKED=
VIEWER_EXPORT_BLOCKED=
UNAUTHENTICATED_EXPORT_BLOCKED=
DISPATCHER_EXPORT_UI=
PROFESSIONAL_WORKBOOK_REUSED=
EXPORT_LIMIT_REGRESSION=
BROWSER_E2E=
BUILD=
SERVICE=
CHANGED_FILES=
PUSH_TO_MASTER=NO
ERROR=
```

Then include:

```text
git diff --stat
git status --short
```

Do not expose secrets, credentials, cookies, customer data, or production export contents.
