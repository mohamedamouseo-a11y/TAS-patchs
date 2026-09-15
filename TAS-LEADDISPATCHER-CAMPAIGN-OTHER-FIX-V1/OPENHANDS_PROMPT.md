You are already on the TAS production server.

Apply ONLY this prepared patch script:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEADDISPATCHER-CAMPAIGN-OTHER-FIX-V1/apply_patch.py

Do not diagnose or redesign. Do not git pull/reset/force-push.

Run:
1. Ensure existing TAS source at /var/www/TAS-root has no unrelated uncommitted changes. If it does, STOP and report DIRTY_WORKTREE.
2. Download script to /tmp/campaign-other-fix.py
3. python3 /tmp/campaign-other-fix.py /var/www/TAS-root
4. Verify ONLY these changed:
   client/src/pages/AdminSettings.tsx
   server/routers.ts
5. git diff --check
6. Commit: fix(campaigns): restore Other platform field for LeadDispatcher
7. Copy those 2 files to matching paths under /var/www/TAS-root/current
8. In /var/www/TAS-root/current run: NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
9. pm2 restart TAS
10. Verify TAS online.

Return only:
PATCH=PASS|FAIL
FILES_CHANGED=
COMMIT=
BUILD=PASS|FAIL
PM2=PASS|FAIL
