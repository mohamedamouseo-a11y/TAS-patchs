Apply this patch to the LIVE TAS server with minimum investigation:

PATCH_URL=https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEAD-DISPATCHER-NORMAL-WORKFLOW-V1/tas-lead-dispatcher-normal-workflow-v1.patch
TAS_ROOT=/var/www/TAS-root

Goal:
- LeadDispatcher uses the existing shared `/leads` page and existing Add Lead / Export / `/import` flows.
- Keep dispatcher-only distribution/queue capability, but do not give LeadDispatcher the duplicate manual Add Lead or duplicate Export inside the dispatcher tab.
- LeadDispatcher sees Settings > Campaigns and can CREATE campaigns only. Do not grant campaign edit/delete.
- Manual lead creation records and displays who created the lead.
- Do NOT grant Service, Parts/After Sales, Finance, Catalog, Admin, or other extra modules.

Execution:
1. `cd /var/www/TAS-root`
2. Download patch and apply it to the git working tree. Use `git apply --check` first. If current source has drift, manually port ONLY the patch semantics; do not discard newer code.
3. Run `git diff --check`.
4. Commit ONLY the patch changes with message: `fix: normalize LeadDispatcher workflow and permissions`
5. IMPORTANT: this server uses a release snapshot. Resolve it with:
   `ACTIVE=$(readlink -f /var/www/TAS-root/current)`
   Copy ONLY the changed source files from `/var/www/TAS-root` into the same relative paths under `$ACTIVE` so the build is made from the patched source.
6. Build in `$ACTIVE` using the existing command: `NODE_OPTIONS=--max-old-space-size=4096 pnpm run build`
7. Restart ONLY PM2 service `TAS`.
8. No screenshots. No browser Visual QA. No unrelated refactor. No deploy script. No git pull.

Changed files expected:
- client/src/pages/Login.tsx
- client/src/components/CRMLayout.tsx
- client/src/pages/LeadsList.tsx
- client/src/pages/tas/TASSalesPage.tsx
- client/src/pages/AdminSettings.tsx
- client/src/pages/LeadProfile.tsx
- server/tasRbacPolicy.ts
- server/routers.ts

Return only:
PATCH_APPLIED=YES|NO
COMMIT_SHA=
ACTIVE_RELEASE=
BUILD=PASS|FAIL
PM2_RESTARTED=YES|NO
HTTP_STATUS=
FILES_CHANGED=
