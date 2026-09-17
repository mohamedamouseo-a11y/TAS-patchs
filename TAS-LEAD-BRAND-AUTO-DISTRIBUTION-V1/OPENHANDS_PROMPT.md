You are already on the TAS production server.

Apply ONLY this prepared patch:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEAD-BRAND-AUTO-DISTRIBUTION-V1/apply_patch.py

Do NOT reset, stash, clean, revert, git pull, or touch unrelated dirty files.

Targets only:
- client/src/pages/LeadsList.tsx
- server/routers.ts
- server/db.ts

If these 3 target files are clean, proceed even if other files are dirty.

Steps:
1. cd /var/www/TAS-root
2. Download script to /tmp/tas-lead-brand-auto.py
3. python3 /tmp/tas-lead-brand-auto.py
4. Verify patch changed only the 3 target files.
5. git diff --check -- client/src/pages/LeadsList.tsx server/routers.ts server/db.ts
6. Commit ONLY those 3 files:
   git add client/src/pages/LeadsList.tsx server/routers.ts server/db.ts
   git commit -m "feat(leads): add vehicle brand and automatic distribution"
7. Copy ONLY those 3 files to /var/www/TAS-root/current matching paths.
8. cd /var/www/TAS-root/current
9. NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
10. pm2 restart TAS
11. Verify TAS HTTP 200.

Return only:
PATCH=PASS|FAIL
COMMIT=
BUILD=PASS|FAIL
PM2=PASS|FAIL
HTTP=200|FAIL
