STOP the current manual/base64 patch attempts. The old .patch file had malformed hunk headers.

Use this fixed idempotent applicator instead:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEAD-DISPATCHER-NORMAL-WORKFLOW-V1/apply_patch_v1_1.py

TAS_ROOT=/var/www/TAS-root

Goal:
- LeadDispatcher uses the existing shared `/leads` page and existing Add Lead / Export / `/import` flows.
- Keep dispatcher distribution/queue capability in TAS Sales, but LeadDispatcher must NOT see the duplicate manual Add Lead or duplicate Export there.
- LeadDispatcher can open Settings > Campaigns and CREATE campaigns only; no campaign edit/delete.
- Manual Add Lead records the logged-in creator in sourceMetadata + audit log and Lead Profile shows “Created by”.
- Do NOT grant Service, Parts/After Sales, Finance, Catalog, Admin, or unrelated modules.

Execution only:
1. `cd /var/www/TAS-root`
2. Download the applicator to `/tmp/apply_patch_v1_1.py` and run: `python3 /tmp/apply_patch_v1_1.py`
3. Run `git diff --check`.
4. Review `git diff` ONLY for these expected files:
   - client/src/pages/Login.tsx
   - client/src/components/CRMLayout.tsx
   - client/src/pages/LeadsList.tsx
   - client/src/pages/tas/TASSalesPage.tsx
   - client/src/pages/AdminSettings.tsx
   - client/src/pages/LeadProfile.tsx
   - server/tasRbacPolicy.ts
   - server/routers.ts
5. Commit ONLY those patch changes with message: `fix: normalize LeadDispatcher workflow and permissions`
6. Resolve active release: `ACTIVE=$(readlink -f /var/www/TAS-root/current)`
7. Copy those 8 source files from `/var/www/TAS-root` to the same relative paths under `$ACTIVE`.
8. Build inside `$ACTIVE`: `NODE_OPTIONS=--max-old-space-size=4096 pnpm run build`
9. Restart ONLY PM2 service `TAS`.
10. Check HTTP 200 only. No screenshots, no browser Visual QA, no deploy script, no git pull, no unrelated refactor.

If some edits from the failed previous attempt are already present, DO NOT reset them blindly. The applicator is idempotent and should keep already-correct target edits.

Return only:
PATCH_APPLIED=YES|NO
COMMIT_SHA=
ACTIVE_RELEASE=
BUILD=PASS|FAIL
PM2_RESTARTED=YES|NO
HTTP_STATUS=
FILES_CHANGED=