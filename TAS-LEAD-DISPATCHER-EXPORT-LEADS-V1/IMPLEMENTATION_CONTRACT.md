# Implementation Contract — TAS Lead Dispatcher Export Leads V1

## Scope

Implement Lead export permission for Lead Dispatcher against:

`e81fb64af96ac90dc6a2116f5e1b2c8d1a357d73`

The feature must reuse the existing professional Leads Excel export endpoint/workbook.

## Required behavior

### 1. Explicit server authorization

Protect `GET /api/export/leads` with an explicit role allowlist.

Allowed:
- `Admin`
- `admin`
- `SalesManager`
- `LeadDispatcher`

Blocked:
- `SalesAgent`
- `MediaBuyer`
- `Finance`
- `Viewer`
- unauthenticated
- all other roles

Use the canonical role normalizer if available. Do not rely only on the client UI or a broad generic permission that includes SalesAgent.

Expected HTTP behavior:
- unauthenticated: `401`
- authenticated but unauthorized: `403`
- authorized: normal export flow

### 2. Lead Dispatcher UI access

In `client/src/pages/tas/TASSalesPage.tsx`, expose an `Export Excel` action when the user can use Dispatcher functionality.

For `LeadDispatcher`, the action must be visible on the Dispatcher experience without requiring access to the full `/leads` page.

Do not add `LeadDispatcher` to `/leads` navigation as part of this patch unless absolutely required by the existing architecture. Least privilege is the contract.

### 3. Reuse the professional export

The dispatcher export must use the existing `/api/export/leads` endpoint and the same workbook builder already used by the Leads page.

Preserve:
- Summary
- Lead Overview
- Sales Notes
- Activity Timeline
- Deals
- Transfer History
- Follow-ups
- one unique Lead row in Lead Overview
- complete child history
- phone-as-text handling
- formula-injection protection
- no silent 100/5000 row truncation

Do not implement a separate simplified dispatcher Excel file.

### 4. Date range

A valid start and end date are mandatory before the request is sent.

Reject invalid or reversed ranges in the UI and keep server-side validation intact.

The date range selects matching Leads. Child-history rows must remain complete according to the existing V4 contract and must not be restricted to child timestamps.

### 5. Existing roles and features

Do not regress:
- Admin export
- SalesManager export
- Lead Dispatcher Excel Import
- Lead Dispatcher post-login landing `/tas/sales`
- manual lead creation
- queue assignment/reassignment

Do not grant SalesAgent export access.

## Required automated authorization tests

Execute real tests, not source-text assertions only.

Required cases:

- `ADMIN_EXPORT=PASS`
- `ADMIN_LOWERCASE_EXPORT=PASS`
- `SALES_MANAGER_EXPORT=PASS`
- `LEAD_DISPATCHER_EXPORT=PASS`
- `SALES_AGENT_EXPORT_BLOCKED=PASS`
- `MEDIA_BUYER_EXPORT_BLOCKED=PASS`
- `FINANCE_EXPORT_BLOCKED=PASS`
- `VIEWER_EXPORT_BLOCKED=PASS`
- `UNAUTHENTICATED_EXPORT_BLOCKED=PASS`

Prefer testing the actual authorization function/middleware used by the export route. A deterministic isolated test is acceptable if browser infrastructure is unavailable, but it must execute the real production authorization logic rather than duplicate it in the test.

## Browser E2E

Required when browser is available:

1. Login as LeadDispatcher.
2. Confirm landing at `/tas/sales`.
3. Confirm Dispatcher UI is visible.
4. Confirm `Export Excel` action is visible.
5. Open export dialog.
6. Choose a valid date range.
7. Trigger download through the browser.
8. Confirm an `.xlsx` download completes.
9. Reopen the XLSX and validate the expected professional workbook sheet order.

Negative browser case:
- Login as SalesAgent.
- Confirm Dispatcher export action is not available.
- Attempt direct `GET /api/export/leads` with that session and confirm `403`.

If the browser is unavailable, report `BROWSER_E2E=BLOCKED`; do not fabricate PASS.

## Build / deploy

- Build production assets.
- Restart TAS service.
- Confirm service is online.
- Do not push to `TAS/master`.

## Final report markers

Return exactly the factual results for:

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

Also include:
- `git diff --stat`
- `git status --short`
