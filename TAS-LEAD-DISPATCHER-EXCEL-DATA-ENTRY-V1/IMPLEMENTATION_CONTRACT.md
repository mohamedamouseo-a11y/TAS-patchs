# Implementation Contract — TAS Lead Dispatcher Excel + Data Entry V1

## Authoritative base
Implement against TAS commit `c8e0ceaa7f362d8075181804361805f6be99805a` or a direct descendant containing no conflicting Lead Dispatcher changes.

## Scope
Wire the existing Lead Dispatcher role to the existing Excel Import and dispatcher/manual-data-entry workflows with least-privilege authorization. Do not redesign unrelated CRM/TAS modules.

## A. Inspect canonical RBAC first
Before editing, inspect and document the effective authorization path, including at minimum:
- `client/src/lib/tasRbac.ts` and any path-to-module mapping;
- `client/src/components/TASPermissionGuard.tsx`;
- `client/src/components/CRMLayout.tsx`;
- `server/tasRbacApiAccess.ts`;
- `server/tasRbacPolicy.ts`;
- `server/tasRbacRouter.ts` and role/default permission sources;
- `server/routers.ts` procedures used by `ImportLeads` and `TASSalesPage`.

Do not rely only on legacy role arrays if TAS RBAC is the effective source of truth.

## B. LeadDispatcher access contract
`LeadDispatcher` must be allowed to:
1. Open `/tas/sales` and use the existing `dispatcher` tab.
2. Use the existing manual lead entry form (name, phone, notes, optional direct assignment).
3. Read the dispatcher data needed by the screen: assignable sales agents, unassigned leads, assigned dispatcher leads, and existing queue state as designed.
4. Perform the existing dispatcher assignment/re-assignment/one-by-one queue actions already intended for this role.
5. Open `/import` and use the existing Excel import flow: file parsing, sheet selection, mapping, preview and final import/queue behavior.
6. Use only the supporting read APIs actually required by `ImportLeads` (campaigns, vehicle brands, assignable agents, Excel queues/progress, etc.) where current policy requires explicit permission.

Admin must retain all existing access.

Do not grant `LeadDispatcher` blanket Admin status or unrelated Admin-only modules.

## C. Excel Import authorization
Current `leads.import` is generic authenticated access. Replace that broad authorization with an explicit canonical policy.

Required behavior:
- `Admin/admin`: allowed.
- `LeadDispatcher`: allowed.
- Other ordinary roles such as `SalesAgent`, `MediaBuyer`, `Viewer`, Finance-only or unrelated roles: denied unless the repository already has a deliberate explicit import permission for that role. If such an existing permission is found, document it rather than silently removing it.
- Authorization must be enforced server-side; sidebar hiding is not enough.
- Preserve existing TAS Excel competitive-queue semantics and assignment modes.

Use a reusable named guard/policy when practical rather than scattered string comparisons.

## D. `/import` route protection and navigation
- Add LeadDispatcher visibility to the Excel Import navigation item through the canonical role/RBAC mechanism.
- Protect `/import` itself. A user cannot bypass authorization by typing the URL directly.
- Unauthorized access must use the project's normal forbidden/redirect behavior, not a blank page or infinite redirect.
- Admin navigation/route behavior must not regress.

## E. Dispatcher default landing after login
After successful authentication and auth refresh:
- Normalize role safely.
- If role is `LeadDispatcher`, navigate to `/tas/sales`.
- `TASSalesPage` must open its existing `dispatcher` tab for that role.
- Preserve current landing behavior for other roles unless a pre-existing centralized post-login destination helper/policy exists; if one exists, extend that helper instead of duplicating logic.
- Avoid redirect loops between `/`, `/login`, `/tas/sales`, and guards.

Also handle an already-authenticated LeadDispatcher visiting `/login` consistently.

## F. Least privilege / negative access
A LeadDispatcher must not gain Admin-only access as a side effect. Verify at minimum that this patch does not newly expose:
- Admin/Settings privilege management;
- Trash/permanent deletion;
- Audit log administration;
- unrelated integrations/marketing configuration;
- roles/permissions administration.

Do not encode credentials or identify a particular production user in source code. This is role-based functionality, not a one-user exception.

## G. Automated tests
Add focused deterministic coverage for at least:
1. LeadDispatcher is authorized for Excel import mutation.
2. Admin remains authorized for Excel import mutation.
3. A non-authorized role is rejected server-side for Excel import.
4. LeadDispatcher has route/navigation permission for `/import`.
5. Unauthorized role cannot access `/import` directly.
6. LeadDispatcher post-login destination resolves to `/tas/sales`.
7. LeadDispatcher sales page defaults to dispatcher mode/tab.
8. Existing dispatcher mutation/read authorization remains valid.
9. Existing TAS Excel competitive queue/import tests continue to pass.

Prefer extracting small authorization/destination helpers when that makes them directly testable instead of brittle source-text-only tests.

## H. Browser E2E
A real browser check is mandatory.

Using a securely configured LeadDispatcher test/production account without printing or committing credentials:
1. Sign in through the real login UI.
2. Confirm post-login URL becomes `/tas/sales`.
3. Confirm the Dispatch tab/screen is visible.
4. Confirm manual lead-entry fields are visible: customer name, phone, initial notes, direct assignment.
5. Confirm Excel Import appears in navigation.
6. Navigate to `/import` and confirm the file upload UI loads.
7. Use a safe local fixture `.xlsx` or `.csv` containing synthetic/non-customer data to verify parsing → mapping → preview.
8. Do not create production customer records merely for testing. If final mutation cannot be safely tested without production writes, stop before committing the fixture import and report that boundary; automated API authorization tests must still verify the mutation policy.
9. In a separate session/account for an unauthorized ordinary role (for example SalesAgent if current business policy denies import), confirm `/import` is absent and direct URL/API access is rejected.

Never include passwords, cookies or tokens in screenshots/reports.

## I. Build / regression checks
Run at minimum:
- focused new authorization/landing tests;
- relevant TAS RBAC tests;
- relevant import/competitive queue tests;
- `pnpm build` or repository equivalent;
- typecheck/baseline check where supported;
- deployed service restart/check if working directly on production server.

No new TypeScript diagnostics.

## J. Git safety
- Do not push to `TAS/master`.
- Do not reset/discard unrelated server changes.
- Do not merge/open a PR unless explicitly requested.
- Leave workspace ready for the user's manual push.

## Final report markers
Return these exact markers:

`BASE_COMMIT=`
`PATCH=YES|NO`
`LEAD_DISPATCHER_IMPORT_NAV=PASS|FAIL`
`LEAD_DISPATCHER_IMPORT_ROUTE=PASS|FAIL`
`LEAD_DISPATCHER_IMPORT_API=PASS|FAIL`
`UNAUTHORIZED_IMPORT_BLOCKED=PASS|FAIL`
`DISPATCHER_DEFAULT_LANDING=PASS|FAIL`
`DISPATCHER_DATA_ENTRY_SCREEN=PASS|FAIL`
`DISPATCHER_ASSIGNMENT_FLOW=PASS|FAIL`
`RBAC_PARITY=PASS|FAIL`
`IMPORT_QUEUE_REGRESSION=PASS|FAIL`
`BUILD=PASS|FAIL`
`SERVICE=RUNNING|FAIL`
`BROWSER_E2E=PASS|FAIL`
`PUSH_TO_MASTER=NO`
`ERROR=NONE|<exact error>`

Also include:
- confirmed root cause(s);
- changed files;
- exact authorization rule implemented;
- tests/commands run;
- browser E2E evidence summary with no secrets;
- `git diff --stat`;
- `git status --short`.
