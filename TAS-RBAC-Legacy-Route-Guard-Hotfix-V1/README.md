# TAS RBAC Legacy Route Guard Hotfix V1

Target: current `mohamedamouseo-a11y/TAS` codebase using the existing fixed-role sidebar matrix.

## Problem fixed

The sidebar hides pages by role, but `client/src/App.tsx` registers most private routes without a centralized role guard. A user can therefore try a protected URL directly even when the sidebar item is hidden. Some pages and APIs have their own guards, but coverage is inconsistent.

## Scope

This hotfix keeps the **current role matrix unchanged** and adds a client-side direct-route guard that matches the existing sidebar permissions for the core private CRM, TAS and Automotive pages.

It adds:

- `client/src/lib/legacyRolePermissions.ts`
  - centralized normalization for legacy role spellings
  - reusable route permission matrix
  - `canAccessLegacyRoute(role, pathname)`
- `client/src/components/LegacyRoleRouteGuard.tsx`
  - fail-closed `Access denied / غير مصرح لك بالوصول` state for unauthorized direct URLs
- deterministic apply script that wraps matching routes in `client/src/App.tsx`

## Important security note

This is a **route/UI hotfix only**. It does not replace server-side authorization. Existing backend `adminProcedure`, manager/read guards and TAS API authorization must remain in place. For full configurable RBAC, use the V1/V2/V3 RBAC packages already stored in this repository.

## Apply

From this patch repository:

```bash
node TAS-RBAC-Legacy-Route-Guard-Hotfix-V1/scripts/apply-tas-rbac-legacy-route-guard-hotfix-v1.mjs --target /path/to/TAS
```

Then run the normal gates:

```bash
pnpm check
pnpm test
pnpm build
```

## Permission test baseline

Validate at minimum these accounts:

- Admin — full baseline
- SalesManager — management pages but no Admin-only settings
- SalesAgent — operational sales pages only
- Finance — TAS sales/finance scope only
- ServiceAdvisor — service / after-sales / shipping scope
- Viewer — no TAS sidebar/edit access under the current legacy matrix
- MediaBuyer — marketing-focused access

For each role test:

1. sidebar visibility
2. allowed direct URL
3. forbidden direct URL
4. one allowed action and one forbidden action at API level

## Non-goals

- Does not change role assignments.
- Does not create test users.
- Does not change server permissions.
- Does not modify production TAS directly; this package is standalone in `TAS-patchs`.
