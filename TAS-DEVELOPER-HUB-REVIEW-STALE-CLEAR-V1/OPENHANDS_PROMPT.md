Apply ONLY this prepared patch on TAS production:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-REVIEW-STALE-CLEAR-V1/apply_patch.py

No audit. No extra fixes. Do not reset/stash/clean/revert/pull.

Run:
1. cd /var/www/TAS-root
2. curl -fsSL URL_ABOVE -o /tmp/tas-devhub-review-fix.py
3. python3 /tmp/tas-devhub-review-fix.py
4. TARGET=$(grep -rl 'TAS_DEVHUB_REVIEW_STALE_CLEAR_V1' client/src --include='DeveloperHubTab.tsx' | head -1)
5. test -n "$TARGET"
6. git diff --check -- "$TARGET"
7. git add "$TARGET" && (git diff --cached --quiet || git commit -m "fix(devhub): clear consumed review after execute error")
8. cp "$TARGET" "/var/www/TAS-root/current/$TARGET"
9. cd /var/www/TAS-root/current && NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
10. If build PASS: pm2 restart TAS and verify HTTP 200.
11. If build FAIL: STOP. Do not diagnose or fix unrelated build errors.

Return only:
PATCH=PASS|FAIL
TARGET=
COMMIT=
BUILD=PASS|FAIL
BUILD_ERROR=
PM2=PASS|SKIPPED|FAIL
HTTP=200|SKIPPED|FAIL
