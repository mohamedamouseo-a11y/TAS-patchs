You are already on the TAS production server.

Apply ONLY this prepared patch:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEADDISPATCHER-ROLE-IMPORT-FIX-V1/tas-leaddispatcher-role-import-fix-v1.patch

Do not reset, stash, clean, revert, git pull, clone, or touch unrelated dirty files.

Target only:
server/routers.ts

Steps:
1. Confirm server/routers.ts is clean relative to HEAD. If it is dirty for unrelated reasons, STOP.
2. Download patch to /tmp/tas-role-fix.patch
3. git apply --check /tmp/tas-role-fix.patch
4. git apply /tmp/tas-role-fix.patch
5. Verify only server/routers.ts changed by this patch.
6. git diff --check -- server/routers.ts
7. Commit ONLY server/routers.ts:
   git add server/routers.ts
   git commit -m "fix(rbac): import LeadDispatcher role helper"
8. Copy server/routers.ts to /var/www/TAS-root/current/server/routers.ts
9. cd /var/www/TAS-root/current
10. NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
11. pm2 restart TAS
12. Verify TAS online and HTTP 200 on port 3600.

Return only:
PATCH=PASS|FAIL
COMMIT=
BUILD=PASS|FAIL
PM2=PASS|FAIL
HTTP=200|FAIL
