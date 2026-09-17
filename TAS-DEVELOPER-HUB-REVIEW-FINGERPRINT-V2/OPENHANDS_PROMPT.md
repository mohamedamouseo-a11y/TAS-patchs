Apply ONLY this prepared patch on TAS production:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-REVIEW-FINGERPRINT-V2/apply_patch.py

No audit. No extra fixes. Do not reset/stash/clean/revert/pull.

Run:
1. cd /var/www/TAS-root
2. curl -fsSL URL_ABOVE -o /tmp/tas-devhub-review-v2.py
3. python3 /tmp/tas-devhub-review-v2.py
4. git diff --check -- server/services/developerHubOperationTransaction.ts
5. git add server/services/developerHubOperationTransaction.ts && (git diff --cached --quiet || git commit -m "fix(devhub): validate review by authoritative state only")
6. ACTIVE=$(readlink -f /var/www/TAS-root/current)
7. cp server/services/developerHubOperationTransaction.ts "$ACTIVE/server/services/developerHubOperationTransaction.ts"
8. cd "$ACTIVE" && NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
9. test "$(grep -c 'The project or GitHub branch changed after review' dist/index.js || true)" = "0"
10. pm2 restart TAS
11. PID=$(pm2 pid TAS); test -n "$PID"; test "$(readlink -f /proc/$PID/cwd)" = "$ACTIVE"
12. curl -fsS http://localhost:3600/ >/dev/null

Return only:
PATCH=PASS|FAIL
COMMIT=
BUILD=PASS|FAIL
OLD_ERROR_IN_DIST=YES|NO
PM2=PASS|FAIL
RUNTIME_CWD_MATCH=YES|NO
HTTP=200|FAIL
