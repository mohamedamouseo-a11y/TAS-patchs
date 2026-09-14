Fix ONLY these two LeadDispatcher regressions on the LIVE TAS server.

TAS_ROOT=/var/www/TAS-root
ACTIVE=$(readlink -f /var/www/TAS-root/current)

GOALS
1) LeadDispatcher must keep the existing normal Import Sheets / Excel Import access exactly like before. Do not create a separate dispatcher import page.
2) Settings > Campaigns: for LeadDispatcher, selecting Platform = Other must show the SAME extra input/behavior that the normal Admin user gets. Reuse the existing implementation; do not invent a different workflow.

IMPORTANT
- Current server source is authoritative. Do not overwrite newer code from GitHub.
- Inspect both /var/www/TAS-root and $ACTIVE before editing.
- Do NOT touch Service, Parts, Finance, Catalog, Admin permissions.
- Do NOT remove LeadDispatcher from /leads, Add Lead, Export, distribution/queue, or Campaign create permission.
- Do NOT change campaign edit/delete permissions.
- No screenshots/browser QA.
- No deploy script and no git pull.

FIX 1 — IMPORT SHEETS
Verify and enforce BOTH:
- client/src/components/CRMLayout.tsx: the existing /import nav item includes LeadDispatcher.
- client/src/components/ImportRouteGuard.tsx: LeadDispatcher is in IMPORT_ALLOWED_ROLES.
If there is any additional role/feature visibility guard around the existing Import Sheets entry in the current source, fix only that guard so LeadDispatcher sees the same existing import workflow.

FIX 2 — CAMPAIGN PLATFORM OTHER
Open the CURRENT client/src/pages/AdminSettings.tsx and find the existing Campaign create form behavior for Admin when Platform = Other.
- Make LeadDispatcher use that exact same Other conditional field and value handling.
- If the active source contains the Admin-only Other field behind an isAdmin condition, change only that condition so canCreateCampaign/LeadDispatcher gets it too.
- Do not add a second campaign form.
- Do not change DB schema unless the existing Admin Other implementation already requires it.
- Preserve LeadDispatcher as create-only for Campaigns: no update/delete/toggle permission expansion.

After edits:
1) Copy ONLY changed source files to the same relative paths under $ACTIVE.
2) git diff --check
3) Commit ONLY these regression-fix files with message:
   fix: restore LeadDispatcher import and campaign other field
4) Build in $ACTIVE:
   NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
5) Restart only PM2 process TAS.
6) Confirm live index.html references the newly built JS asset.

Return only:
IMPORT_NAV_VISIBLE=YES|NO
IMPORT_ROUTE_ALLOWED=YES|NO
OTHER_FIELD_MATCHES_ADMIN=YES|NO
FILES_CHANGED=
COMMIT_SHA=
BUILD=PASS|FAIL
PM2_RESTARTED=YES|NO
LIVE_ASSET=
