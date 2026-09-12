# TAS Lead Dispatcher — Excel Import + Data Entry Access V1

## Target baseline
`mohamedamouseo-a11y/TAS` master @ `c8e0ceaa7f362d8075181804361805f6be99805a`

## Business request
The `LeadDispatcher` role must be able to do the exact operational job requested by the client without receiving Admin access:

1. Log in and land directly on the Lead Dispatcher working screen.
2. Manually register lead data from the existing dispatcher form.
3. Upload/import Excel lead files using the existing `/import` workflow.
4. Continue using the existing assignment / re-assignment / queue distribution workflow.
5. Be blocked from unrelated Admin-only areas and actions.

Do not create a second importer or a duplicate dispatcher page. Reuse the existing `ImportLeads` and `TASSalesPage` implementations.

## Current state confirmed in source
- `TASSalesPage.tsx` already recognizes `LeadDispatcher`, exposes the `dispatcher` tab, manual lead entry form, unassigned/assigned lead lists, direct assignment, re-assignment, and queue distribution.
- `TASSalesPage.tsx` already defaults a `LeadDispatcher` to the `dispatcher` tab when that page is opened.
- `CRMLayout.tsx` currently exposes `/import` only to `Admin/admin`, so `LeadDispatcher` cannot reach Excel Import from navigation.
- `/import` currently renders `ImportLeads` directly and must be protected explicitly; hiding a sidebar item is not authorization.
- `leads.import` is currently a generic authenticated (`protectedProcedure`) mutation. That is too broad for the intended permission model. Import must be explicitly allowed for Admin + LeadDispatcher (or the equivalent canonical RBAC permission) and denied to ordinary roles that do not have import permission.
- `Login.tsx` currently redirects every successful login to `/`, so `LeadDispatcher` does not automatically land on the dispatcher screen.

## Required outcome
For a `LeadDispatcher` user:
- Successful login lands at `/tas/sales` and opens the existing dispatcher tab.
- Sidebar/navigation exposes Excel Import.
- Direct visit to `/import` succeeds.
- Excel upload, mapping, preview and TAS queue/assignment functionality required by the existing import screen work normally.
- Manual lead creation/data-entry remains available from dispatcher screen.
- Assignment/re-assignment/queue flow remains available according to current dispatcher design.

For unauthorized roles:
- `/import` is not shown in navigation.
- Direct `/import` access is blocked/redirected with the project-standard unauthorized UX.
- The server-side Excel import mutation is denied even if called directly.

## Security boundary
Do **not** solve this by promoting `LeadDispatcher` to Admin or by granting blanket access to Settings/Admin/Trash/Audit/Marketing/etc.

UI hiding is not sufficient. Route and API authorization must match.

Do not place any real user email, password, session cookie, token, or production customer data in this public patch repository, source code, tests, logs, screenshots, or final report.

## Verification
Implementation is complete only after automated authorization tests, build/typecheck, and a real browser validation of LeadDispatcher login → dispatcher landing → import screen access, plus a negative unauthorized-role check.

See `IMPLEMENTATION_CONTRACT.md` and execute `OPENHANDS_PROMPT.md` completely.
