# TAS Automotive Catalog Admin Archive V1

This patch fixes the **Archive vehicle / أرشفة** action on `/automotive/catalog` so the button follows the TAS RBAC permission matrix instead of a hard-coded role-name list.

## Why this patch is needed

`VehicleCatalogPage.tsx` currently decides whether to show Archive using:

```ts
["Admin", "admin", "SalesManager"].includes(String(user?.role || ""))
```

That can hide Archive from an Admin/custom Admin role even when TAS RBAC grants `catalog.delete`, and it can also show Archive to `SalesManager` even though the default RBAC matrix only gives SalesManager `catalog.view`.

The backend is already correct:

- `automotive.catalog.archiveVehicle` is protected by `tasPermissionProcedure`.
- `archiveVehicle` is inferred as the RBAC action `delete`.
- the built-in `Admin` role has full `catalog` permissions, including `delete`.

So this patch only fixes the UI authorization check and leaves backend behavior unchanged.

## Change

`client/src/pages/automotive/VehicleCatalogPage.tsx`

- import `useTasRbac`.
- read `isAuthenticated` from `useAuth()`.
- replace the hard-coded `canArchive` role list with:

```ts
const rbac = useTasRbac(isAuthenticated);
const canArchive = rbac.can("catalog", "delete");
```

## Apply

From an isolated TAS checkout/candidate:

```bash
git apply /path/to/TAS-AUTOMOTIVE-CATALOG-ADMIN-ARCHIVE-V1/TAS-AUTOMOTIVE-CATALOG-ADMIN-ARCHIVE-V1.patch
pnpm check
```

Do not apply directly to production/master without normal review/deployment flow.

## Acceptance

1. Sign in as built-in **Admin**.
2. Open `/automotive/catalog`.
3. Confirm **أرشفة / Archive** appears on persisted vehicle cards.
4. Archive a test vehicle and confirm it becomes `hidden` / inactive after refresh.
5. Confirm Super Admin behavior is unchanged.
6. Confirm roles without `catalog.delete` do not see the Archive button.

## Scope

- No database migration.
- No schema changes.
- No change to vehicle rows until a user explicitly clicks Archive.
- No change to TAS `master`; this package only contains the patch.
