Apply ONLY this prepared patch on TAS production:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-REVIEW-FINGERPRINT-V1/apply_patch.py

No audit. No extra fixes. Do not reset/stash/clean/revert/pull.

Run:
1. cd /var/www/TAS-root
2. curl -fsSL URL_ABOVE -o /tmp/tas-devhub-fingerprint-fix.py
3. python3 /tmp/tas-devhub-fingerprint-fix.py
4. git diff --check -- server/services/developerHubOperationTransaction.ts
5. git add server/services/developerHubOperationTransaction.ts && (git diff --cached --quiet || git commit -m "fix(devhub): validate reviewed state by authoritative fields")
6. cp server/services/developerHubOperationTransaction.ts /var/www/TAS-root/current/server/services/developerHubOperationTransaction.ts
7. cd /var/www/TAS-root/current && NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
8. If build PASS: pm2 restart TAS and verify HTTP 200.
9. If build FAIL: STOP. Do not diagnose unrelated issues.

Return only:
PATCH=PASS|FAIL
COMMIT=
BUILD=PASS|FAIL
PM2=PASS|SKIPPED|FAIL
HTTP=200|SKIPPED|FAIL
