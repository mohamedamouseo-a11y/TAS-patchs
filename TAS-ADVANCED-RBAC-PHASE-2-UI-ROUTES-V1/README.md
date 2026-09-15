# TAS Advanced RBAC Phase 2 — UI + Routes V1

Base: `928a88d54e6370dc2ecc1f862f2592acf03b91d7`

Prerequisite: apply and verify `TAS-ADVANCED-RBAC-PHASE-2-CORE-V1` first.

This bundle adds the client-facing Phase 2 enforcement without copying the dirty runtime shim.

## Apply

1. Copy:
   - `files/client/src/pages/tas/TASRolesPermissionsPage.tsx`
   - to `client/src/pages/tas/TASRolesPermissionsPage.tsx`
2. Apply:
   - `ui-routes.patch`

## What it does

- adds feature-level direct-route guards for existing TAS/Automotive routes
- guards Leads, Lead Profile, Import Leads, Competitive Queues, and Audit Log with feature permissions
- preserves `ImportRouteGuard` as the stricter existing business rule
- filters mapped sidebar entries by effective feature permission
- upgrades Roles & Permissions UI to show feature rows under each parent module
- supports explicit feature overrides and reset-to-inherit
- sends only explicit feature overrides to `tasRbac.saveRole`
- keeps Admin protected/read-only

## Important non-regressions

- does not add an `/excel-imports` route because that management page is not present on the clean base
- does not remove SalesManager from `/import`
- does not change LeadDispatcher role arrays
- does not feature-guard generic `/settings` yet because that route currently mixes personal/operational settings and enforcing `system_settings` would narrow existing access unexpectedly
- does not change WhatsApp Gateway/Tara special access semantics
- no backend workflow logic changes
- no production deployment
- no push from executor
