# TAS RBAC Role Matrix Tests V1

Audit-only patch for TAS roles and permissions. It adds automated tests and a live database verifier. It does not change production permission behavior.

## Coverage

- Every built-in TAS role in `APP_USER_ROLES` has a permission matrix.
- Admin remains full access across every TAS RBAC module/action with `all` scope.
- Every configured grant uses a valid data scope.
- Any non-view action requires `view` to also be enabled.
- Frontend route-to-module mapping is verified for `/tas/*` and `/automotive/*` routes.
- Backend API module/action inference is verified for view/create/edit/delete/export/approve/assign.
- A live verifier reads active roles and their persisted matrices from MySQL and checks that `authorizeTasApiRequest` allows/denies representative TAS operations exactly according to each stored role matrix.
- The live verifier fails if an active permission uses `branch` scope because current backend enforcement is intentionally fail-closed for branch scope until explicit user-to-branch membership is configured.

## Files added to TAS

- `server/tasRbacPolicy.test.ts`
- `server/tasRbacApiAccess.test.ts`
- `client/src/lib/tasRbac.test.ts`
- `scripts/verify-tas-rbac-live.ts`

## Run

```bash
pnpm exec vitest run server/tasRbacPolicy.test.ts server/tasRbacApiAccess.test.ts client/src/lib/tasRbac.test.ts
pnpm check
pnpm exec tsx scripts/verify-tas-rbac-live.ts
```

The live verifier requires the same `DATABASE_URL` used by TAS.

## Important

This patch is audit-only. If a test fails, do not automatically loosen permissions or alter role matrices. Report the failing role/module/action first so the business intent can be confirmed before any production permission change.
