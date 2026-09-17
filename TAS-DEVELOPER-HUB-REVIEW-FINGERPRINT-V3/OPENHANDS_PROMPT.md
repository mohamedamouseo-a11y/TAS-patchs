Apply ONLY this prepared patch on TAS production:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-DEVELOPER-HUB-REVIEW-FINGERPRINT-V3/apply_patch.py

No audit. No extra fixes. Do not reset/stash/clean/revert/pull.

Run:
1. cd /var/www/TAS-root
2. curl -fsSL URL_ABOVE -o /tmp/tas-devhub-fingerprint-v3.py
3. python3 /tmp/tas-devhub-fingerprint-v3.py
4. If PATCH_APPLIED=YES, show changed source paths only.
5. git diff --check
6. Commit ONLY canonical /var/www/TAS-root source files changed by the patch. Do not commit current/release copies.
7. cd /var/www/TAS-root/current
8. NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
9. Verify exact string is ABSENT from /var/www/TAS-root/current/dist/index.js:
   The project or GitHub branch changed after review. Review again.
10. If absent: pm2 restart TAS and verify HTTP 200.
11. If still present: STOP and return the exact remaining source/dist occurrence count. Do not invent another fix.

Return only:
PATCH=PASS|FAIL
SOURCE_HITS_BEFORE=
FILES_CHANGED=
COMMIT=
BUILD=PASS|FAIL
OLD_ERROR_IN_DIST=YES|NO
PM2=PASS|SKIPPED|FAIL
HTTP=200|SKIPPED|FAIL
