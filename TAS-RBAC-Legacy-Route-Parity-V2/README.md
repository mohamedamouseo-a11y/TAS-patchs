# TAS RBAC Legacy Route Parity V2

Purpose: close confirmed frontend/direct-URL parity gaps on legacy TAS/CRM routes while preserving the already-applied RBAC V1/V2/V3 implementation.

## Important scope

This patch DOES NOT replace or modify:

- `TASPermissionGuard`
- `tasRbac.me`
- `server/tasRbacPolicy.ts`
- `tasPermissionProcedure`
- RBAC action/data-scope policy
- TAS/Automotive routes already protected by the central RBAC guard
- public TAS quotation routes
- public portal routes

It only adds a legacy route-admission layer for routes that the 2026-08-27 audit confirmed can be hidden by the sidebar while still mounting by direct URL.

## Added files

- `client/src/lib/legacyRouteParity.ts`
- `client/src/components/LegacyRouteParityGuard.tsx`

## App.tsx integration

The deterministic apply script wraps only the audited legacy route set, including:

- dashboard/leads/sales funnel/task SLA/calendar/inbox
- `/admin`, `/settings`, `/import`, `/competitive-queues`
- `/ux-library`, `/notification-settings`
- `/meta-campaigns`
- the audited `/bd*` sidebar family
- `/wa-gateway/accounts`
- `/wa-gateway`
- `/automotive/whatsapp`

The route policy mirrors the CURRENT legacy sidebar role predicates. This is intentional route parity, not a new product permission model.

## Explicitly excluded from V2

The following audit items require a separate product/backend decision and are not silently changed here:

- Viewer/Finance/ServiceAdvisor static sidebar vs central RBAC matrix disagreement
- `/bd/coaching`, `/bd/advanced`, `/bd/quote/:id`
- `/whatsapp-cloud` legacy alias
- `/admin/chat`
- `/clients/:id`, `/csat/:clientId`
- `/email-marketing`
- support/public routes

Do not infer that excluded routes are approved; they remain follow-up audit items.

## Apply

Run only against an isolated copy/candidate first:

```bash
node TAS-RBAC-Legacy-Route-Parity-V2/scripts/apply-tas-rbac-legacy-route-parity-v2.mjs --target <ISOLATED_TAS_CANDIDATE>
```

The script is fail-closed:

- it refuses to overwrite the two new files if they already exist
- it requires every expected current legacy App route anchor to be present before completing
- if an anchor is missing, application stops instead of guessing

## Required validation

After application, run the project's normal gates:

```bash
pnpm check
pnpm test
pnpm build
```

Then validate direct URL parity with non-production test accounts/fixtures for at least:

- Admin
- SalesManager
- SalesAgent
- Finance
- ServiceAdvisor
- MediaBuyer
- Viewer

Minimum regression assertions:

- Admin retains expected access.
- SalesManager cannot open Admin-only legacy routes directly.
- SalesAgent cannot open `/admin`, `/import`, `/bd/settings`, or `/wa-gateway/accounts` directly.
- Finance and ServiceAdvisor cannot open legacy sales/admin pages hidden by the current sidebar.
- MediaBuyer retains marketing routes but cannot open administrative legacy routes.
- Viewer is denied audited legacy routes hidden by the current sidebar.
- Existing `/tas/*` and `/automotive/*` central routes continue to use `TASPermissionGuard` unchanged.
- Public `/tas/quotation/:token` continues to work unchanged.

## Deployment safety

Do not mutate production users or role assignments merely to validate the patch.
Do not weaken backend authorization to make frontend tests pass.
Do not change the central RBAC matrix as part of this patch.
