# OpenHands Execution Prompt — TAS Lead Dispatcher Excel + Data Entry V1

Implement this feature completely. Do not stop at analysis.

## Repository / baseline
- Target project: `mohamedamouseo-a11y/TAS`
- Expected base: `c8e0ceaa7f362d8075181804361805f6be99805a`
- Patch instructions: `mohamedamouseo-a11y/TAS-patchs/TAS-LEAD-DISPATCHER-EXCEL-DATA-ENTRY-V1`

Read `README.md` and `IMPLEMENTATION_CONTRACT.md` in this patch folder first and treat them as authoritative.

## Business outcome
The existing `LeadDispatcher` role must be able to:
- log in and land directly on the existing TAS Sales dispatcher screen;
- manually register lead data there;
- access the existing Excel Import page and import workflow;
- use the existing assignment/re-assignment/queue tools intended for dispatchers;
- remain least-privilege and NOT become Admin.

Reuse existing `TASSalesPage` and `ImportLeads`. Do not build duplicate screens.

## Important implementation rules
1. Inspect current TAS RBAC/path/API policy before changing role arrays. Confirm the effective permission source.
2. Fix UI navigation, direct route authorization, and backend mutation authorization together.
3. `leads.import` must NOT remain available to every authenticated user merely because it uses `protectedProcedure`. Make import explicitly authorized for the intended roles/permission; at minimum Admin + LeadDispatcher must pass and unauthorized ordinary roles must fail.
4. Preserve existing Excel queue / competitive assignment behavior.
5. Implement a safe LeadDispatcher post-login destination of `/tas/sales`; preserve other roles' behavior.
6. Do not hard-code a particular user's email/id/password. This is role-based behavior.
7. Never print, copy, commit or return real passwords, cookies, tokens, or customer data.
8. Do not reset or overwrite unrelated server changes.
9. Do NOT push to `TAS/master`.

## Testing requirements
Implement and run focused automated tests required by the contract. Also run relevant existing TAS RBAC and Excel queue/import regression tests, then build/typecheck.

Perform a real browser E2E using securely available credentials without exposing them:
- Login through the real UI as LeadDispatcher.
- Verify landing URL `/tas/sales`.
- Verify dispatcher/data-entry form is visible.
- Verify Excel Import is visible in navigation and `/import` opens.
- Parse a safe synthetic Excel/CSV fixture through upload → mapping → preview.
- Avoid writing synthetic customer records to production solely for validation; automated tests should validate import mutation authorization.
- Verify an unauthorized ordinary role cannot see/access `/import` and cannot call the import mutation.

If the application is deployed from a compiled server bundle, rebuild and restart using the repository's normal deployment process, then confirm the service is online.

## Completion rule
Do not report PASS if navigation works but direct route/API authorization does not, or if LeadDispatcher was granted broad Admin access.

Return the exact final markers required by `IMPLEMENTATION_CONTRACT.md`, plus changed files, tests, build/service result, browser E2E summary, `git diff --stat`, and `git status --short`.

Explicitly confirm: `PUSH_TO_MASTER=NO`.
