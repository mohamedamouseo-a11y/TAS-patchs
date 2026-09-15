Read-only task. Do not edit or deploy.

Compare the current dirty production source against TAS master SHA:
928a88d54e6370dc2ecc1f862f2592acf03b91d7

Return ONLY the RBAC Phase 2 differences for these areas if present:
- server/tasRbacRouter.ts
- server/tasRbacFeatureAccess.ts
- server/tasRbacFeatureCatalog.ts
- server/tasDataScope.ts
- client/src/lib/tasRbac.ts
- client/src/components/TASFeatureGuard.tsx
- client/src/components/CRMLayout.tsx
- Roles & Permissions page/components
- drizzle/20260903_tas_advanced_rbac_phase2.sql

For each changed/new file return the full unified diff against master.
Do not include unrelated dirty files.
Do not modify production.
Do not push.

Return:
RBAC_FILES=
RBAC_DIFF_START
<unified diffs>
RBAC_DIFF_END
ERROR=
