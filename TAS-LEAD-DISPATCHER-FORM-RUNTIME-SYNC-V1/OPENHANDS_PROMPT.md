Apply ONLY this prepared runtime sync patch on TAS production:
https://raw.githubusercontent.com/mohamedamouseo-a11y/TAS-patchs/main/TAS-LEAD-DISPATCHER-FORM-RUNTIME-SYNC-V1/apply_patch.py

No audit. No extra fixes. Do not reset/stash/clean/revert/pull.

Run:
1. cd /var/www/TAS-root
2. curl -fsSL URL_ABOVE -o /tmp/tas-lead-dispatcher-form-sync.py
3. python3 /tmp/tas-lead-dispatcher-form-sync.py
4. cd /var/www/TAS-root/current
5. NODE_OPTIONS=--max-old-space-size=4096 pnpm run build
6. Verify built frontend contains BOTH strings:
   - Vehicle Brand
   - Automatic Distribution
   under dist/public/assets
7. pm2 restart TAS
8. Verify HTTP 200 on localhost:3600

Do not modify source logic. Do not commit anything; this patch only syncs the already-correct workspace files into the active release and rebuilds it.

Return only:
PATCH=PASS|FAIL
SOURCE_FEATURES=PASS|FAIL
RUNTIME_SYNC=PASS|FAIL
BUILD=PASS|FAIL
BUNDLE_HAS_BRAND=YES|NO
BUNDLE_HAS_AUTO=YES|NO
PM2=PASS|FAIL
HTTP=200|FAIL
