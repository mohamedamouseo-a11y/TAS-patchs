# TAS Advanced RBAC Phase 2 — Core V1

Base: `928a88d54e6370dc2ecc1f862f2592acf03b91d7`

This is the clean Phase 2 core foundation. It intentionally does **not** include the dirty-runtime `CRMLayout.tsx` changes because those changes are only a module-level shim and mix unrelated LeadDispatcher/import role edits.

## What this patch adds

- central server feature catalog
- feature override table
- effective feature permissions in `tasRbac.me`
- feature catalog in `tasRbac.catalog`
- raw + effective feature permissions in `listRoles`
- optional transactional feature saves in `saveRole`
- `resetFeatureOverrides`
- feature-aware TAS API authorization that can narrow but never widen the parent module permission
- client `canModule`, `canFeature`, `featureGrant`, and backward-compatible `can`
- feature support in `TASPermissionGuard`

## Files to apply to TAS

Copy these bundle files to the matching TAS paths:

- `files/server/tasRbacFeatureCatalog.ts` -> `server/tasRbacFeatureCatalog.ts` (new)
- `files/server/tasRbacRouter.ts` -> `server/tasRbacRouter.ts`
- `files/server/tasRbacApiAccess.ts` -> `server/tasRbacApiAccess.ts`
- `files/client/src/lib/tasRbac.ts` -> `client/src/lib/tasRbac.ts`
- `files/client/src/components/TASPermissionGuard.tsx` -> `client/src/components/TASPermissionGuard.tsx`
- `files/drizzle/20260903_tas_advanced_rbac_phase2.sql` -> `drizzle/20260903_tas_advanced_rbac_phase2.sql`

Do not change `CRMLayout.tsx`, `App.tsx`, or the Roles & Permissions page in Core V1. Those come in the next patch after this core builds and its permission semantics are verified.

## Required semantics

- missing feature override inherits the parent module
- an override may deny an action already granted by the module
- an override must never grant an action denied by the module
- module `view=false` forces all child actions false
- Admin ignores feature overrides and remains full operational authority
- existing module-only callers remain compatible
- no production deployment or push from the executor
