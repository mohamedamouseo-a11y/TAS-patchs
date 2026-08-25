# TAS RBAC Permissions V3 — Server API Enforcement

Final server-side RBAC enforcement layer for TAS/Automotive operational tRPC APIs.

## What V3 adds

- Server-side module/action authorization for TAS and Automotive API calls.
- Action inference for `view`, `create`, `edit`, `delete`, `export`, `approve`, and `assign`.
- Effective permission lookup from the V1 RBAC tables with Admin full-access protection.
- Custom-role execution bridge to existing TAS legacy resolver profiles after the RBAC decision succeeds.
- Request-level Data Scope enforcement for explicit user targets:
  - `own`
  - `assigned`
  - `team` (same-team target validation using `users.teamId`)
  - `all`
- `branch` scope is intentionally fail-closed because the current TAS user model has no authoritative user-to-branch membership mapping. It cannot silently degrade to `all` or `team`.
- Existing public TAS shared quotation access remains public.
- Existing WA super-admin-only procedures remain stricter and are not weakened.

## Apply

```bash
node TAS-RBAC-Permissions-V3-API/scripts/apply-tas-rbac-v3-api.mjs --target <ISOLATED_TAS_CANDIDATE>
```

## Authorized source scope

The apply script adds:

- `server/tasRbacApiAccess.ts`
- `server/tasRbacApiV3.contract.test.ts`

And integrates only:

- `server/routers.ts`

No database migration is required. V1 RBAC tables remain the source of truth.

## Required gates

1. V3 contract test.
2. Existing V1/V2 RBAC tests.
3. TypeScript baseline comparison with zero new diagnostics.
4. Full test suite.
5. Production build.
6. Official TAS atomic deployment.
7. Read-only post-deploy API verification.

Do not mutate a real Production user's role merely to test V3.
