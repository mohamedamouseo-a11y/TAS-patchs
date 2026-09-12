# TAS Lead Dispatcher — Export Leads V1

## Base

- Main repo: `mohamedamouseo-a11y/TAS`
- Required base commit: `e81fb64af96ac90dc6a2116f5e1b2c8d1a357d73`
- Patch repo: `mohamedamouseo-a11y/TAS-patchs`

## Goal

Give the `LeadDispatcher` role permission to export potential-customer / Lead data to Excel using the existing professional Leads export workflow, without granting unrelated Admin permissions.

## Product behavior

The Lead Dispatcher must be able to export Leads from the existing Dispatcher experience.

Allowed export roles:
- `Admin`
- `admin`
- `SalesManager`
- `LeadDispatcher`

Blocked export roles:
- `SalesAgent`
- `MediaBuyer`
- `Finance`
- `Viewer`
- unauthenticated users
- every other unauthorized role

## UX

- Add an `Export Excel` action to the Lead Dispatcher area in `TASSalesPage` when `canUseDispatcher` is true.
- Do **not** grant `LeadDispatcher` the full `/leads` navigation/page just to make export possible.
- Reuse the existing professional Leads export behavior and workbook generation. Do not create a second Excel format.
- Require a valid date-from/date-to range before export, matching the existing Leads export contract.
- The resulting workbook must remain the same professional workbook already produced by `/api/export/leads`.

## Security

The current `/api/export/leads` route authenticates the session but must also enforce the explicit export-role allowlist server-side. UI hiding alone is not sufficient.

Do not expose credentials, customer data, cookies, session tokens, or production exports in this public patch repository.

## Regression constraints

- Existing Admin and SalesManager export must continue to work.
- Existing V4/V4.1/V4.1.1 workbook behavior must not regress.
- Do not reintroduce 100/5000-row truncation.
- Do not change Lead Dispatcher import permissions from the already-approved allowlist.
- Do not change TAS assignment/queue logic.
- Do not push to `TAS/master`; the user will push manually after review.
