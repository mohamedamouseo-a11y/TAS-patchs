# TAS Final Testing & Hardening — Implementation Contract

## Scope

Test the completed TAS implementation from Phase 1–5. Fix only defects discovered during verification. Do not add new features.

## 1. RBAC / Authorization

Verify with at least Admin plus representative non-Admin roles:

- route access
- feature/action permissions
- direct API/mutation rejection when unauthorized
- inline action visibility for implemented guards
- Admin operational authority
- no accidental SuperAdmin requirement

Critical checks:

- Excel Import Delete/Restore = Admin-only
- Operational Settings = Admin-only unless existing explicit RBAC intentionally says otherwise
- Audit access must not expose unauthorized operational data
- server remains authoritative even if UI is manipulated

## 2. Data Scope

Verify `own / assigned / team / branch / all` where implemented.

### Leads
Check list, detail, count/export where available, update/delete, assign/reassign, transfer/handover, and linked sales entities.

### Clients
Check list, detail, update, delete use actual RBAC `dataScope` for every non-Admin. Missing scope must fail closed. Admin remains full access.

### Child sales records
Verify Deals, Quotations, Tasks, Test Drives, Trade-ins, Finance Applications cannot bypass parent Lead scope.

### Dashboards
Verify scoped Sales Funnel, Agent Stats, Team Stats, Task SLA do not aggregate unauthorized data.

### Branch
If no authoritative user-to-branch relationship exists, confirm branch remains fail-closed. Do not invent one.

## 3. Excel Imports

Verify existing lifecycle without changing parser/distribution logic:

- import succeeds on valid file
- batch-to-lead linkage exists
- metadata edit
- archive/unarchive
- delete warning/impact counts
- soft delete hides import + only linked leads as designed
- calls/activities/deals/history preserved
- restore restores only leads deleted by that import
- restore does NOT automatically restart distribution queue
- Delete/Restore Admin-only
- audit entries written
- relevant notification behavior works if implemented

## 4. Competitive Queues

Regression-only verification:

- existing queue execution still works
- configuration/member actions honor permissions
- Phase 5 UI guards do not block permitted users incorrectly
- no Excel Import or queue processing behavior was altered unintentionally

## 5. Audit / Operational Settings

Verify:

- audit list filters: user, action, date range, search, existing entity filter
- count matches filters
- before/after view still works
- role/user/lead/import/settings events are logged where implemented
- no passwords/tokens/API secrets appear in audit payloads
- Admin can read/update operational settings
- setting changes create audit entries

## 6. Notifications

Verify:

- Lead assignment notification reaches assigned user
- unread count
- mark read
- mark all read
- personal notification preferences load/save
- sound/popup behavior follows existing preference implementation where testable
- if user loses Lead access, notification becomes redacted and link is removed
- notification payload never bypasses Phase 3 data scope

Do not fake email/SMS tests if unsupported.

## 7. UI / Regression

Smoke-test critical pages in Arabic and English where practical:

- Leads
- Excel Imports
- Competitive Queues
- Roles & Permissions
- Audit Log
- Admin Settings / Operational Settings
- Notifications / notification settings
- Clients
- Catalog

Verify no obvious runtime errors, broken navigation, blank screens, or RTL regressions introduced by Phase 1–5.

## 8. WhatsApp

Regression only. Do not redesign or rewrite WhatsApp processing. Confirm existing relevant screens/routes still build and load where environment permits.

## 9. Automated / Build Checks

Run what the environment genuinely supports:

- `pnpm run build`
- existing project test commands if configured
- targeted scripts/tests discovered in package.json or repository
- attempt `tsc --noEmit` only if feasible

If TypeScript cannot be completed, report exactly:

`Full TypeScript check: NOT VERIFIED due to environment limitation`

Do not say Vite/esbuild performed full type-checking.

## 10. Defect Repair Rules

When a test fails:

- diagnose root cause
- apply the smallest safe fix
- rerun the affected check
- rerun production build after code changes
- preserve Phase 1–5 architecture
- do not broaden permissions to make tests pass
- do not change Excel Import, Competitive Queue, or WhatsApp business behavior unless the failure proves a regression caused by Phase 1–5 and the fix is narrowly scoped

## 11. Git Rules

- work locally
- no push
- no PR
- keep commits focused
- leave clean working tree

## Final Report

Return:

1. Tests/checks actually executed
2. PASS/FAIL/NOT VERIFIED matrix by area
3. Defects found
4. Fixes applied with exact files
5. RBAC/security findings
6. Data-scope findings
7. Excel Import findings
8. Notification/Audit/Settings findings
9. Regression findings
10. Build result
11. TypeScript result
12. Remaining known risks/deferred items
13. `git diff --stat`
14. `git status --short`
15. branch + HEAD
16. explicit confirmation: **No push was performed.**