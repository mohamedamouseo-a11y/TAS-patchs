Use the current LIVE TAS source as authoritative and apply only this LeadDispatcher V2 fix.

Goals:
- Keep LeadDispatcher on the existing shared `/import` Excel/Sheets workflow.
- In Settings > Campaigns, LeadDispatcher can create campaigns and Platform = Other must show/use the same extra custom-platform field as Admin.
- In Settings > Vehicle Brands, LeadDispatcher can use the existing VehicleBrandsSettings UI to LIST brands and ADD a new brand.

Permission boundary:
- Vehicle Brands: LeadDispatcher may LIST/READ and CREATE only.
- Do not allow LeadDispatcher to edit/update/delete/toggle vehicle brands.
- Campaigns remain CREATE-only for LeadDispatcher; no update/delete/toggle.
- Do not grant Catalog management, Service, Parts/After Sales, Finance, Admin, or unrelated settings.
- Preserve existing LeadDispatcher access to Leads, Add Lead, Export, Import, queue/distribution, campaign create, and creator attribution.

Implementation:
- Verify the `/import` sidebar/nav entry includes LeadDispatcher.
- Verify ImportRouteGuard allows LeadDispatcher and fix any extra visibility guard hiding Import Sheets.
- In the current AdminSettings.tsx, reuse the existing Admin Platform=Other behavior for LeadDispatcher. Do not create a second field/form.
- Reuse client/src/components/settings/VehicleBrandsSettings.tsx. Make the existing brands tab/entry visible to LeadDispatcher.
- Update the current server vehicleBrands authorization narrowly so LeadDispatcher can call LIST and CREATE, while UPDATE/EDIT remains restricted.
- If VehicleBrandsSettings shows Edit to all viewers, hide/disable Edit for LeadDispatcher.
- Do not create new pages or duplicate APIs.

After edits:
- Run git diff --check.
- Commit only files changed for this V2 fix with message: fix: restore LeadDispatcher import other and vehicle brand add
- Apply the same changed source files to the active release, build with the existing TAS build command, restart only PM2 process TAS, and confirm a new live JS asset is referenced.
- No screenshots, no browser visual QA, no git pull, no deploy script, no unrelated changes.

Return only:
IMPORT_NAV_VISIBLE=YES|NO
IMPORT_ROUTE_ALLOWED=YES|NO
OTHER_FIELD_MATCHES_ADMIN=YES|NO
VEHICLE_BRANDS_VISIBLE=YES|NO
VEHICLE_BRAND_LIST_ALLOWED=YES|NO
VEHICLE_BRAND_CREATE_ALLOWED=YES|NO
VEHICLE_BRAND_EDIT_ALLOWED=YES|NO
FILES_CHANGED=
COMMIT_SHA=
BUILD=PASS|FAIL
PM2_RESTARTED=YES|NO
LIVE_ASSET=
