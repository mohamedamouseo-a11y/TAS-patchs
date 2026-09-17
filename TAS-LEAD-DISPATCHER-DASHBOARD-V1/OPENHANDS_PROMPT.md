You are already on the TAS production server.

Apply ONLY this prepared patch:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEAD-DISPATCHER-DASHBOARD-V1/apply_patch.py

Do NOT reset, stash, clean, revert, git pull, or touch unrelated dirty files.

Targets only:
- client/src/App.tsx
- client/src/pages/LeadDispatcherDashboard.tsx
- server/routers.ts
- server/services/leadDispatcherDashboard.ts

If the existing target files are clean, proceed even if unrelated files are dirty.

Steps:
1. cd /var/www/TAS-root
2. Download script to /tmp/tas-lead-dispatcher-dashboard.py
3. python3 /tmp/tas-lead-dispatcher-dashboard.py
4. Verify only the 4 target files changed/created.
5. git diff --check -- client/src/App.tsx client/src/pages/LeadDispatcherDashboard.tsx server/routers.ts server/services/leadDispatcherDashboard.ts
6. Commit ONLY those 4 files:
   git add client/src/App.tsx client/src/pages/LeadDispatcherDashboard.tsx server/routers.ts server/services/leadDispatcherDashboard.ts
   git commit -m "feat(dispatcher): add operational dashboard"
7. Copy ONLY those 4 files to /var/www/TAS-root/current matching paths.
8. cd /var/www/TAS-root/current
9. NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
10. pm2 restart TAS
11. Verify TAS HTTP 200 and no new startup errors.

Do NOT do browser visual QA.

Return only:
PATCH=PASS|FAIL
COMMIT=
BUILD=PASS|FAIL
PM2=PASS|FAIL
HTTP=200|FAIL
