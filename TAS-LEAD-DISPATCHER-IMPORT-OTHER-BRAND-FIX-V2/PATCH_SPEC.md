# TAS LeadDispatcher Import + Campaign Other + Vehicle Brand Fix V2

This patch supersedes `TAS-LEAD-DISPATCHER-IMPORT-OTHER-FIX-V1`.

## Required behavior

1. LeadDispatcher keeps the existing shared `/import` Excel/Sheets workflow. No dispatcher-specific import page.
2. In Settings > Campaigns, LeadDispatcher can create campaigns. When Platform = `Other`, it must get the exact same extra custom-platform field/value behavior as the existing normal/Admin implementation.
3. In Settings, LeadDispatcher can access the existing Vehicle Brands section and ADD a vehicle brand through the existing `VehicleBrandsSettings` UI/API.
4. Vehicle brand permission for LeadDispatcher is CREATE-ONLY unless the current normal implementation intrinsically requires read/list. Do not grant edit/update/delete/toggle/catalog management beyond what is strictly needed to list and add brands.
5. Keep all existing LeadDispatcher functionality from the previous workflow patch: `/leads`, Add Lead, Export, Import, queue/distribution, campaign create, creator attribution.
6. Do not grant Service, Parts/After Sales, Finance, Catalog management, Admin, or unrelated settings permissions.

## Implementation guidance

Current LIVE server source is authoritative because it contains post-GitHub fixes and release-specific changes. Inspect the current source before editing and port only the semantics above.

Likely relevant files include:
- `client/src/components/CRMLayout.tsx`
- `client/src/components/ImportRouteGuard.tsx`
- `client/src/pages/AdminSettings.tsx`
- `client/src/components/settings/VehicleBrandsSettings.tsx`
- current server router/procedure that backs `tas.vehicleBrands.list/create/update`

Do not assume GitHub master exactly matches LIVE. Reuse existing components and APIs; do not duplicate forms or routes.